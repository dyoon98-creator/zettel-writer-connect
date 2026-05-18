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
import { CLIWizardBridge } from "./CLIWizardBridge";

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
      // 스트림 중이면 cancel 먼저.
      get().cancelStream();
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

  cancelStream() {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({ isStreaming: false, streamingBuffer: "" });
  },

  async completeCurrentStage() {
    const { conductorRef, engineRef } = get();
    if (!conductorRef || !engineRef) return;

    // 진행 중 스트림 중지 + 즉시 대기 상태 표시.
    get().cancelStream();
    set({ isAwaitingQuestion: true, currentQuestion: null });

    try {
      await conductorRef.completeCurrentStage();
    } catch (e) {
      tauriNoticeAdapter.error(
        `단계 종료 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    // 다음 단계로 진행 시도.
    const nextStage = engineRef.advance();
    set({ rev: get().rev + 1 });

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
    get().cancelStream();
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

  const ctrl = newAbortController();
  activeAbortController = ctrl;

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
      tauriNoticeAdapter.error(
        `AI 응답 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      set({ isAwaitingQuestion: false });
    } finally {
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
    tauriNoticeAdapter.error(
      `AI 응답 실패: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    if (activeAbortController === ctrl) activeAbortController = null;
    set({
      isStreaming: false,
      streamingBuffer: "",
      rev: get().rev + 1,
    });
  }
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
