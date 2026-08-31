// wizardStore.ts — 마법사 인터뷰의 UI 상태 (Zustand).
//
// 책임:
//  - WizardEngine 인스턴스를 보유하고, 사용자/어시스턴트 메시지 누적 / 단계 전이를 트리거
//  - 토큰 스트리밍 진행 중 streamingBuffer 와 isStreaming 노출
//  - 사용자 액션(start, sendUserMessage, regenerateLast, cancelStream, revisitStage,
//    completeAndSeed, close)
//
// AI 측은 WizardAIBridge 인터페이스 너머의 mock 또는 실제 구현이 들어간다.
// Phase E 에서는 MockWizardBridge 가 기본값.

import { create } from "zustand";
import {
  MockWizardBridge,
  WIZARD_STAGES,
  WizardConductor,
  WizardEngine,
  type ConceptHandoff,
  type Genre,
  type WizardAIBridge,
  type WizardMessage,
  type WizardQuestion,
  type WizardSession,
  type WizardStageId,
  type WizardSummary,
} from "@ai-manuscript-studio/core";

import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";
import { tauriVaultAdapter } from "../vaultAdapter";
import { CLIWizardBridge } from "./CLIWizardBridge";
import { parseConceptHandoffFromMarkdown } from "./wizardHandoff";

export type WizardPhase =
  | "idle" // 마법사가 닫혀 있음
  | "interviewing" // 인터뷰 중
  | "awaiting-seed" // 5단계 끝 → 사용자에게 binder 시드 여부 묻는 중
  | "seeding" // 시드 작업 중
  | "done";

export interface WizardStoreState {
  isOpen: boolean;
  phase: WizardPhase;

  /** 활성 engine. start() 호출 전엔 null. */
  engineRef: WizardEngine | null;
  bridgeRef: WizardAIBridge | null;
  conductorRef: WizardConductor | null;

  /** 현재 스트리밍 중인 임시 텍스트 (모든 토큰 누적). 토큰 스트림 모드에서만 사용. */
  streamingBuffer: string;
  isStreaming: boolean;

  /** AI 가 던진 다음 질문. 객관식/주관식 표현. null = 응답 대기 중. */
  currentQuestion: WizardQuestion | null;
  /** 응답을 기다리고 있는지 (CLI 호출 중). 스트리밍이 아닌 단일 응답 모드. */
  isAwaitingQuestion: boolean;

  /** UI 가 메시지 목록을 다시 그리도록 강제하는 카운터. engineRef 의 messages 가
   *  변경될 때마다 +1. (Zustand 가 불변 비교를 빠르게 하도록.) */
  rev: number;

  /** 마지막으로 완성된 WizardSummary — awaiting-seed/done 상태에서 채워짐. */
  summary: WizardSummary | null;

  // ----- actions -----

  /** 마법사를 연다. bridge 가 주입되지 않으면 MockWizardBridge 를 사용.
   *  targetProjectFolder 가 지정되면 마법사 종료 시 새 프로젝트를 만들지 않고
   *  해당 기존 프로젝트의 binder/planning.md 를 마법사 결과로 갱신한다. */
  start: (opts?: {
    bridge?: WizardAIBridge;
    draftTitle?: string;
    draftGenre?: Genre;
    targetProjectFolder?: string;
    /**
     * 컨셉 마법사에서 방금 넘어온 결과. 주면 인터뷰는 「묻는 자리」가 아니라
     * 「확인하는 자리」가 된다. 주지 않았고 `targetProjectFolder` 가 있으면
     * 그 폴더의 저장물(`concept-summary.md` → `planning.md`)에서 스스로 찾는다.
     */
    conceptHandoff?: ConceptHandoff;
  }) => void;

  /** start 시점에 받은 기존 프로젝트 폴더. null = 새 프로젝트. */
  targetProjectFolder: string | null;

  /** 사용자 메시지 전송 + 다음 assistant 토큰 스트림 시작. */
  sendUserMessage: (content: string) => Promise<void>;

  /** 마지막 assistant 메시지를 제거하고 다시 토큰 스트림. */
  regenerateLast: () => Promise<void>;

  /** 진행 중인 스트림이 있으면 abort. */
  cancelStream: () => void;

  /** 현재 단계를 닫고 다음 단계로. 모두 끝나면 awaiting-seed 로 이동. */
  completeCurrentStage: () => Promise<void>;

  /** 다른 단계로 점프. 진행 중인 스트림이 있으면 cancel. */
  revisitStage: (stage: WizardStageId) => void;

  /** awaiting-seed 단계에서 사용자가 동의 → seed 실행 콜백 호출 → done. */
  acceptSeed: (
    seedFn: (summary: WizardSummary) => Promise<void>,
  ) => Promise<void>;

  /** awaiting-seed 단계에서 사용자가 거부. 마법사를 닫음 (파일은 안 만듦). */
  declineSeed: () => void;

  /** 마법사를 닫는다. 진행 중이던 스트림은 abort. */
  close: () => void;
}

function newAbortController(): AbortController {
  return new AbortController();
}

let activeAbortController: AbortController | null = null;

// ── 「밀려난 요청」과 「사용자가 그만둔 요청」을 가른다 ──────────────────────
//
// 왜 필요한가 (대표 실사용 결함 2026-08-31):
//   기획 인터뷰에서 아무것도 안 눌렀는데 「사용자가 취소했습니다」가 빨간 오류로
//   떴다. 원인은 문면이 아니라 «소유권» 이다. 질문 요청이 겹치면 뒤 요청이
//   activeAbortController 를 그냥 덮어썼고(앞 것을 abort 하지도, 기억하지도 않음),
//   그 뒤 어떤 경로든 abort 를 걸면 앞 요청이 끊겼다. 끊김은 aiBridge 에서
//   «취소» 로 표현되고, 화면은 그것을 사용자 잘못으로 오해해 오류로 띄웠다.
//
//   끊김에는 «세 가지 다른 일» 이 섞여 있었다.
//     (1) 사용자가 그만뒀다        — 알려야 한다 (다만 «고장» 이 아니다)
//     (2) 새 요청이 앞 요청을 밀어냈다 — 내부 사정이다. 감춘다
//     (3) 진짜로 실패했다          — 오류로 보여야 한다
//   아래 두 변수가 그 셋을 가른다.
//
// 왜 «전역» 을 유지하는가 (컨셉 마법사처럼 훅으로 옮기지 않는가):
//   컨셉 마법사의 호출은 «컴포넌트» 가 소유한다(useStreamingChat 의 useRef).
//   기획 인터뷰의 호출은 «스토어» 가 소유한다 — start() 는 Step5Commit 과 전역
//   단축키에서, 나머지는 스토어 액션에서 시작되고, 그 어느 것도 특정 컴포넌트의
//   수명에 매여 있지 않다. 훅으로 옮기면 컴포넌트 밖에서 시작되는 start() 가
//   갈 곳을 잃는다. 결함은 «전역이라서» 가 아니라 «주인이 바뀔 때 앞 주인을
//   말없이 버려서» 였다. 그래서 소유권을 명시적으로 넘기게 고친다.

/** 질문 요청 일련번호. 「지금 유효한 요청」이 무엇인지 가리는 유일한 기준. */
let askSeq = 0;

/** 사용자가 직접 그만두라고 한 요청 번호. 이 번호의 끊김만 사용자에게 알린다. */
let userStoppedTurn: number | null = null;

/**
 * 진행 중인 질문 요청을 «밀어낸다».
 * 사용자가 그만둔 것이 아니라 우리가 대체한 것이므로 조용히 끝나야 한다.
 * (앞 요청을 abort 하지 않고 참조만 버리면, 그 요청은 계속 살아서 늦게 도착한
 *  답을 화면에 덧붙이거나 엉뚱한 때에 끊겨 오류로 보인다.)
 */
function supersedeActiveAsk(): void {
  const prev = activeAbortController;
  activeAbortController = null;
  if (prev && !prev.signal.aborted) prev.abort();
}

let pendingSession: WizardSession | null = null; // 사용 안 함 — 보존만

export const useWizardStore = create<WizardStoreState>((set, get) => ({
  isOpen: false,
  phase: "idle",
  engineRef: null,
  bridgeRef: null,
  conductorRef: null,
  streamingBuffer: "",
  isStreaming: false,
  currentQuestion: null,
  isAwaitingQuestion: false,
  rev: 0,
  summary: null,
  targetProjectFolder: null,

  start(opts) {
    // 새 세션. engine 과 bridge / conductor 를 생성.
    const engine = new WizardEngine();
    if (opts?.draftTitle) engine.setDraftTitle(opts.draftTitle);
    if (opts?.draftGenre) engine.setDraftGenre(opts.draftGenre);
    if (opts?.conceptHandoff) engine.setConceptHandoff(opts.conceptHandoff);
    const bridge = opts?.bridge ?? defaultBridgeFromSettings();
    const conductor = new WizardConductor(engine, bridge);

    set({
      isOpen: true,
      phase: "interviewing",
      engineRef: engine,
      bridgeRef: bridge,
      conductorRef: conductor,
      streamingBuffer: "",
      isStreaming: false,
      currentQuestion: null,
      isAwaitingQuestion: true,
      rev: 1,
      summary: null,
      targetProjectFolder: opts?.targetProjectFolder ?? null,
    });

    // ── 이미 있는 프로젝트에서 「이어서 하기」 ─────────────────────────────────
    //
    // 컨셉 마법사를 방금 거쳐 온 경우(Step5Commit)는 handoff 를 손에 들고 온다.
    // 그러나 대표가 어제 만든 프로젝트를 오늘 다시 열어 「기획 인터뷰」를 누르는
    // 길에는 그것이 없다 — 그때는 볼트에 남아 있는 저장물에서 되찾는다.
    // 첫 질문을 «이어받기가 끝난 뒤» 던져야 첫 질문부터 확인 모드가 된다.
    if (!opts?.conceptHandoff && opts?.targetProjectFolder) {
      const folder = opts.targetProjectFolder;
      void (async () => {
        const carried = await readConceptHandoff(folder);
        if (carried) {
          engine.setConceptHandoff(carried);
          set({ rev: get().rev + 1 });
        }
        await runAskAndStream(get, set);
      })();
      return;
    }

    // 첫 질문은 AI 가 draft_genre 를 받아 장르별로 생성한다.
    // (motive.md prompt 의 stage_user_turn_count == 0 분기 + 장르별 옵션 가이드.)
    void runAskAndStream(get, set);
  },

  async sendUserMessage(content) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const { engineRef, phase, isStreaming } = get();
    if (!engineRef || phase !== "interviewing") return;
    if (isStreaming) {
      // 앞 요청을 밀어낸다 — 사용자가 그만둔 것이 아니다.
      supersedeActiveAsk();
      set({ isStreaming: false, streamingBuffer: "" });
    }

    engineRef.addMessage("user", trimmed);
    // 클릭 즉시 대기 상태 표시 — CLI 응답 전에 ChoiceInput 숨기고 로딩 인디케이터 노출.
    set({ rev: get().rev + 1, isAwaitingQuestion: true, currentQuestion: null });

    // 압축 인터뷰 — 단계당 한 번의 객관식이 기본. audience-message 만 (독자, 메시지) 두
    // 번. 임계값 도달 시 단계를 닫고 자동으로 다음 단계의 첫 질문으로 넘어간다.
    const STAGE_TURN_LIMIT: Record<WizardStageId, number> = {
      motive: 1,
      "audience-message": 2,
      tone: 1,
      "structure-pick": 1,
    };
    const session = engineRef.session;
    const userTurnsInStage = session.messages.filter(
      (m) => m.role === "user" && m.stage === session.currentStage,
    ).length;

    if (userTurnsInStage >= STAGE_TURN_LIMIT[session.currentStage]) {
      await get().completeCurrentStage();
      return;
    }

    await runAskAndStream(get, set);
  },

  async regenerateLast() {
    const { engineRef } = get();
    if (!engineRef) return;
    // 마지막 assistant 메시지를 찾아 제거.
    const msgs = engineRef.session.messages;
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      if (msgs[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;
    // engine 의 internal 을 직접 변경하는 setter 가 없으므로,
    // 우리가 messages 를 잘라낸 새 engine 을 세팅한다.
    const trimmedSession: WizardSession = {
      ...engineRef.session,
      messages: msgs.slice(0, lastAssistantIdx),
    };
    const newEngine = new WizardEngine(trimmedSession);
    const newConductor = new WizardConductor(newEngine, get().bridgeRef!);
    set({
      engineRef: newEngine,
      conductorRef: newConductor,
      rev: get().rev + 1,
    });
    await runAskAndStream(get, set);
  },

  // 사용자가 직접 그만두라고 한 것 (WizardChat 의 Esc). 내부 전환은 이것을 쓰지
  // 않고 supersedeActiveAsk() 를 쓴다 — 둘은 다른 일이다.
  cancelStream() {
    if (activeAbortController) {
      userStoppedTurn = askSeq;
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({ isStreaming: false, streamingBuffer: "" });
  },

  async completeCurrentStage() {
    const { conductorRef, engineRef } = get();
    if (!conductorRef || !engineRef) return;

    // 진행 중 요청을 밀어낸다 + 즉시 대기 상태 표시.
    // (사용자가 그만둔 것이 아니므로 오류로 보이면 안 된다.)
    supersedeActiveAsk();
    set({
      isAwaitingQuestion: true,
      currentQuestion: null,
      isStreaming: false,
      streamingBuffer: "",
    });

    try {
      await conductorRef.completeCurrentStage();
    } catch (e) {
      tauriNoticeAdapter.error(
        `단계 종료 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    // 다음 단계로 진행 시도.
    let nextStage = engineRef.advance();
    set({ rev: get().rev + 1 });

    // ── structure-pick 건너뛰기 ───────────────────────────────────────────────
    //
    // 트리트먼트 카드는 「글 구조」 그 자체다. 이미 사용자가 컨셉 마법사에서
    // 손으로 짜 놓은 것을 다시 객관식으로 고르게 하는 것은 같은 일을 두 번
    // 시키는 것이다(두 단계가 완전히 겹친다). 이어받은 카드가 있으면 묻지 않는다.
    //
    // 「완료」로 위장하지 않는다 — `skipStage` 가 `skippedReason` 을 남겨
    // 사이드바가 「완료」가 아니라 「이어받음」으로 그리고, `finalize` 는 AI 가
    // 지어낸 구조 대신 그 카드들을 구조 제안으로 쓴다.
    const carriedCards = engineRef.session.conceptHandoff?.treatment ?? [];
    if (nextStage === "structure-pick" && carriedCards.length > 0) {
      engineRef.skipStage(
        "structure-pick",
        `컨셉 마법사의 트리트먼트 ${carriedCards.length}장을 그대로 씁니다 (다시 묻지 않았습니다).`,
        { structure_template: `트리트먼트 ${carriedCards.length}장 — 컨셉 마법사에서 이어받음` },
      );
      nextStage = null;
      set({ rev: get().rev + 1 });
    }

    if (nextStage === null) {
      // 모든 단계 끝 → 최종 요약 만들기.
      try {
        const summary = await conductorRef.finalize();
        set({ phase: "awaiting-seed", summary, rev: get().rev + 1 });
      } catch (e) {
        tauriNoticeAdapter.error(
          `최종 요약 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }

    // 다음 단계의 첫 질문 시작.
    await runAskAndStream(get, set);
  },

  revisitStage(stage) {
    const { engineRef } = get();
    if (!engineRef) return;
    // 단계 이동도 «밀어내기» 다 — 사용자가 그만둔 것이 아니다.
    supersedeActiveAsk();
    set({ isStreaming: false, streamingBuffer: "" });
    engineRef.revisitStage(stage);
    set({ phase: "interviewing", rev: get().rev + 1 });
    void runAskAndStream(get, set);
  },

  async acceptSeed(seedFn) {
    const { summary } = get();
    if (!summary) return;
    set({ phase: "seeding" });
    try {
      await seedFn(summary);
      set({ phase: "done", isOpen: false });
    } catch (e) {
      tauriNoticeAdapter.error(
        `프로젝트 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      set({ phase: "awaiting-seed" });
    }
  },

  declineSeed() {
    set({
      isOpen: false,
      phase: "idle",
      summary: null,
      engineRef: null,
      bridgeRef: null,
      conductorRef: null,
      streamingBuffer: "",
      isStreaming: false,
      rev: 0,
    });
  },

  close() {
    get().cancelStream();
    set({
      isOpen: false,
      phase: "idle",
      summary: null,
      engineRef: null,
      bridgeRef: null,
      conductorRef: null,
      streamingBuffer: "",
      isStreaming: false,
      rev: 0,
    });
  },
}));

/**
 * 다음 질문을 받아 store 에 적용.
 *  - bridge.askNextQuestion 이 있으면 (production 권장) 단일 응답으로 받아
 *    WizardQuestion 객체를 currentQuestion 에 set + assistant 메시지로 추가.
 *  - 없으면 (legacy) bridge.askNext 토큰 스트림으로 누적 → 동일하게 메시지로 추가.
 *
 * AbortController 는 module-level 에 저장하여 cancelStream 으로 abort 가능.
 */
async function runAskAndStream(
  get: () => WizardStoreState,
  set: (
    partial:
      | Partial<WizardStoreState>
      | ((state: WizardStoreState) => Partial<WizardStoreState>),
  ) => void,
): Promise<void> {
  const { conductorRef, bridgeRef, engineRef } = get();
  if (!conductorRef || !bridgeRef || !engineRef) return;

  // ── 한 번에 하나만 ──────────────────────────────────────────────────────
  // 앞 요청이 아직 돌고 있으면 «밀어낸다». 이렇게 하지 않으면 두 요청이 나란히
  // 끝나 같은 질문이 화면에 두 번 붙는다(대표 스크린샷의 그 증상).
  supersedeActiveAsk();
  const myTurn = (askSeq += 1);

  const ctrl = newAbortController();
  activeAbortController = ctrl;

  /** 내가 도는 사이에 더 새 요청이 들어왔는가. */
  const superseded = (): boolean => myTurn !== askSeq;

  // 우선 askNextQuestion 이 있으면 그걸 사용.
  if (typeof bridgeRef.askNextQuestion === "function") {
    set({
      isAwaitingQuestion: true,
      currentQuestion: null,
      streamingBuffer: "",
      isStreaming: false,
    });
    try {
      const q = await bridgeRef.askNextQuestion(engineRef.session, {
        signal: ctrl.signal,
      });
      // 늦게 도착한 답이 새 요청의 질문 위에 덧붙지 않게 한다.
      if (superseded()) return;
      // assistant 메시지에는 intro + question 만 누적. 옵션 목록은 ChoiceInput
      // 버튼이 단독으로 렌더하므로 본문 인라인 텍스트는 중복이 된다.
      // 사용자가 고른 답은 user 메시지로 transcript 에 들어가므로 final-summary
      // 가 어떤 옵션이 선택됐는지 여전히 알 수 있다.
      const lines: string[] = [];
      if (q.intro) lines.push(q.intro);
      lines.push(q.question);
      engineRef.addMessage("assistant", lines.join("\n\n"));
      set({
        currentQuestion: q,
        isAwaitingQuestion: false,
        rev: get().rev + 1,
      });
    } catch (e) {
      // 끊김 세 갈래를 가른다. 「사용자가 취소했습니다」라는 «문면» 이 아니라
      // 「누가 끊었는가」라는 «사실» 로 가른다 — 문면은 바뀔 수 있다.
      const wasStoppedByUser = userStoppedTurn === myTurn;
      const wasCut = ctrl.signal.aborted;

      if (superseded() || (wasCut && !wasStoppedByUser)) {
        // 우리가 밀어낸 것 — 내부 사정이다. 사용자에게 보이지 않는다.
        // (다음 요청이 화면을 이어받으므로 대기 표시도 건드리지 않는다.)
      } else if (wasCut && wasStoppedByUser) {
        // 사용자가 그만뒀다 — 고장이 아니므로 빨간 오류로 띄우지 않는다.
        tauriNoticeAdapter.info("질문 만들기를 그만뒀습니다.");
        set({ isAwaitingQuestion: false });
      } else {
        tauriNoticeAdapter.error(
          `AI 응답 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
        set({ isAwaitingQuestion: false });
      }
    } finally {
      if (userStoppedTurn === myTurn) userStoppedTurn = null;
      if (activeAbortController === ctrl) activeAbortController = null;
    }
    return;
  }

  // Legacy 토큰 스트림 모드.
  set({ isStreaming: true, streamingBuffer: "", currentQuestion: null });
  try {
    await conductorRef.runAskNext({
      signal: ctrl.signal,
      onToken: (_chunk, accumulated) => {
        set({ streamingBuffer: accumulated });
      },
    });
  } catch (e) {
    // askNextQuestion 경로와 같은 잣대 — 밀려난 것과 사용자가 그만둔 것은
    // 「고장」이 아니다.
    const wasStoppedByUser = userStoppedTurn === myTurn;
    const wasCut = ctrl.signal.aborted;
    if (superseded() || (wasCut && !wasStoppedByUser)) {
      /* 내부 사정 — 화면에 띄우지 않는다 */
    } else if (wasCut && wasStoppedByUser) {
      tauriNoticeAdapter.info("질문 만들기를 그만뒀습니다.");
    } else {
      tauriNoticeAdapter.error(
        `AI 응답 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  } finally {
    if (userStoppedTurn === myTurn) userStoppedTurn = null;
    if (activeAbortController === ctrl) activeAbortController = null;
    set({
      isStreaming: false,
      streamingBuffer: "",
      rev: get().rev + 1,
    });
  }
}

/**
 * 이미 만들어진 프로젝트 폴더에서 컨셉 결과를 되찾는다 — 「이어서 하기」의 심장.
 *
 * 왜 컨셉 마법사처럼 세션 JSON 을 따로 두지 않았나 (2026-08-31 판정):
 *   컨셉 마법사는 «프로젝트가 만들어지기 전» 에 도는 단계라 저장할 곳이 없어
 *   `<vault>/.ai-manuscript-studio/wizard-sessions/<id>.json` 을 따로 만들었다.
 *   기획 인터뷰는 그 반대다 — 항상 «프로젝트가 만들어진 뒤» 에 돈다. 저장처가
 *   이미 폴더 안에 있는데 옆에 또 하나를 만들면 진실이 둘이 된다.
 *   그래서 새 저장소를 만들지 않고 이미 있는 파일을 읽는다.
 *
 * 읽는 순서에 이유가 있다:
 *   1. `concept-summary.md` — 컨셉 마법사 결과의 «영구 보관본». 인터뷰가 끝나도
 *      덮어쓰이지 않는다(`conceptSeed.ts` 주석).
 *   2. `planning.md` — 인터뷰 «전» 에는 컨셉 본문이지만, 인터뷰가 한 번 끝나면
 *      인터뷰 결과로 덮어쓰인다. 그때는 앞선 인터뷰의 결정을 이어받는다.
 *   둘을 합쳐, 컨셉도 앞선 인터뷰 결정도 함께 이어받는다.
 *
 * 어느 쪽도 못 읽으면 `null` — 그때는 지금까지와 똑같이 백지에서 묻는다.
 */
async function readConceptHandoff(
  projectFolder: string,
): Promise<ConceptHandoff | null> {
  const readOrNull = async (rel: string): Promise<string | null> => {
    try {
      if (!(await tauriVaultAdapter.fileExists(rel))) return null;
      return await tauriVaultAdapter.readFile(rel);
    } catch {
      return null;
    }
  };

  const conceptMd = await readOrNull(`${projectFolder}/concept-summary.md`);
  const planningMd = await readOrNull(`${projectFolder}/planning.md`);

  const fromConcept = conceptMd ? parseConceptHandoffFromMarkdown(conceptMd) : null;
  const fromPlanning = planningMd ? parseConceptHandoffFromMarkdown(planningMd) : null;

  if (!fromConcept) return fromPlanning;
  if (!fromPlanning) return fromConcept;
  // 컨셉 본문은 concept-summary.md 가, 앞선 인터뷰 결정은 planning.md 가 정본이다.
  return {
    ...fromConcept,
    priorDecisions: fromPlanning.priorDecisions ?? fromConcept.priorDecisions,
  };
}

/** Lint: pendingSession 변수는 향후 hot-reload 보존용으로 남겨둠. */
void pendingSession;

/**
 * 헬퍼: 외부 컴포넌트가 engine 의 메시지 배열을 가져갈 때.
 * (rev 를 dependency 로 두면 변경마다 리렌더된다.)
 */
export function getWizardMessages(): WizardMessage[] {
  const engine = useWizardStore.getState().engineRef;
  return engine ? [...engine.session.messages] : [];
}

/** 사이드바 진척도. */
export function useWizardProgress(): {
  complete: number;
  total: number;
  current: WizardStageId;
} {
  const engineRef = useWizardStore((s) => s.engineRef);
  // rev 를 의존성에 포함시키기 위해 같이 구독.
  useWizardStore((s) => s.rev);
  if (!engineRef) {
    return { complete: 0, total: WIZARD_STAGES.length, current: "motive" };
  }
  return {
    ...engineRef.getProgress(),
    current: engineRef.session.currentStage,
  };
}

export const ALL_WIZARD_STAGES = WIZARD_STAGES;

/** 마법사가 어떤 bridge 를 쓰는지 외부 컴포넌트가 표시할 수 있게 노출. */
export interface BridgeInfo {
  kind: "codex-cli" | "claude-code-cli" | "mock";
  binaryPath?: string;
  reason?: string; // mock 일 때 사유 (예: "Codex CLI 경로가 비어있음")
}

let lastBridgeInfo: BridgeInfo = { kind: "mock", reason: "초기화 전" };
export function getActiveBridgeInfo(): BridgeInfo {
  return lastBridgeInfo;
}

function defaultBridgeFromSettings(): WizardAIBridge {
  const settings = useSettingsStore.getState().settings;
  if (settings.useMockBridge) {
    lastBridgeInfo = { kind: "mock", reason: "설정에서 mock 모드 강제됨" };
    tauriNoticeAdapter.warn(
      "마법사가 mock 모드로 시작합니다 (설정의 useMockBridge=true).",
    );
    return new MockWizardBridge();
  }
  if (settings.aiProvider === "mock") {
    lastBridgeInfo = { kind: "mock", reason: "AI 공급자가 mock 으로 설정됨" };
    tauriNoticeAdapter.warn(
      "AI 공급자가 mock 으로 설정되어 마법사가 mock 응답을 사용합니다.",
    );
    return new MockWizardBridge();
  }
  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;
  if (!binaryPath.trim()) {
    lastBridgeInfo = {
      kind: "mock",
      reason: `${settings.aiProvider === "claude-code" ? "Claude Code" : "Codex"} CLI 경로가 비어있음`,
    };
    // 강한 알림 — 사용자가 인지하도록.
    tauriNoticeAdapter.error(
      `${settings.aiProvider === "claude-code" ? "Claude Code" : "Codex"} CLI 경로가 비어있어 mock 응답을 씁니다. 설정 → AI 호출 → 실행 경로에 \`which codex\` 결과를 입력하세요.`,
      8000,
    );
    return new MockWizardBridge();
  }
  lastBridgeInfo = {
    kind: settings.aiProvider === "claude-code" ? "claude-code-cli" : "codex-cli",
    binaryPath,
  };
  tauriNoticeAdapter.info(
    `${lastBridgeInfo.kind === "codex-cli" ? "Codex CLI" : "Claude Code CLI"} (${binaryPath}) 로 마법사를 시작합니다.`,
    4000,
  );
  return new CLIWizardBridge({
    provider: settings.aiProvider,
    binaryPath,
    extraArgs: settings.codexExtraArgs,
    fallback: new MockWizardBridge(),
  });
}
