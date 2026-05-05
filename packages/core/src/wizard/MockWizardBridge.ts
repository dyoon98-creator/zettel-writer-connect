// MockWizardBridge — 압축 인터뷰의 결정론적 mock AI.
//
// 단계 구조 (3단계):
//   1) motive             — 글을 쓰게 된 계기 (1턴 객관식)
//   2) audience-message   — 독자(turn 0) + 핵심 메시지(turn 1) 두 번의 객관식
//   3) tone               — 글의 톤 (1턴 객관식)
//
// 전체 평균 ~4턴이면 인터뷰 끝. 토큰 스트림(askNext) 은 호환을 위해 남겨두지만
// 신규 UI 는 askNextQuestion (구조화 JSON) 을 우선 사용한다.

import type {
  WizardMessage,
  WizardSession,
  WizardStageId,
  WizardSummary,
} from "./types";
import type {
  WizardAIBridge,
  WizardQuestion,
  WizardSummarizeResult,
} from "./WizardConductor";

export interface MockWizardBridgeOptions {
  tokenDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  rngSeed?: number;
}

const DEFAULT_DELAY = 30;

/** 단계의 첫(=유일한) 결정 키. audience-message 는 turn 별로 분기되어 별도 처리. */
const STAGE_DECISION_KEY: Record<WizardStageId, string> = {
  motive: "motive",
  "audience-message": "target_reader+core_message",
  tone: "tone",
  "structure-pick": "structure_template",
};

const STAGE_SUMMARY_HEAD: Record<WizardStageId, string> = {
  motive: "글을 쓰게 된 계기",
  "audience-message": "독자와 핵심 메시지",
  tone: "이 글의 어조",
  "structure-pick": "선택한 글 구조",
};

function countUserTurns(session: WizardSession, stage: WizardStageId): number {
  return session.messages.filter(
    (m) => m.role === "user" && m.stage === stage,
  ).length;
}

function userAnswers(session: WizardSession, stage: WizardStageId): string[] {
  return session.messages
    .filter((m) => m.role === "user" && m.stage === stage)
    .map((m) => m.content.trim())
    .filter((s) => s.length > 0);
}

/** 단계 종료 시 결정사항을 만든다. audience-message 는 두 답을 분리. */
function buildStageSummary(
  session: WizardSession,
  stage: WizardStageId,
): { summary: string; decisions: Record<string, string> } {
  const head = STAGE_SUMMARY_HEAD[stage];
  const answers = userAnswers(session, stage);
  const first = answers[0] ?? "(미정)";

  if (stage === "audience-message") {
    const reader = answers[0] ?? "";
    const message = answers[1] ?? answers[0] ?? "";
    const summary = `${head}: ${reader} → ${message}`;
    return {
      summary,
      decisions: {
        target_reader: reader,
        core_message: message,
        summary,
        transcript_excerpt: answers.join(" / "),
      },
    };
  }

  const summary = `${head}: ${first}`;
  return {
    summary,
    decisions: {
      [STAGE_DECISION_KEY[stage]]: first,
      summary,
      transcript_excerpt: answers.join(" / "),
    },
  };
}

function buildFinalStructure(
  session: WizardSession,
): WizardSummary["structureProposal"] {
  // audience-message 의 두 번째 답(=core_message) 가 있으면 시놉시스에 반영.
  const audAnswers = userAnswers(session, "audience-message");
  const message = audAnswers[1] ?? audAnswers[0] ?? "메시지를 더 구체화해야 합니다";

  // structure-pick 단계의 답에서 사용자가 고른 템플릿을 파싱.
  // 형식: "구조 이름 — 단계 미리보기" 또는 "직접 입력: ...".
  const pickAnswers = userAnswers(session, "structure-pick");
  const picked = pickAnswers[0] ?? "";
  const templateName = picked.split(" — ")[0].replace(/^직접 입력:\s*/, "");
  // 하이픈으로 단계 이름 분해. 예: "기-승-전-결" → ["기","승","전","결"].
  const stageNames = templateName
    .split(/[-–—]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "직접 입력");

  const titles = stageNames.length >= 3 && stageNames.length <= 9
    ? stageNames
    : ["도입", "전개", "절정", "결말"];

  return titles.map((title, i) => {
    // 키워드는 톤·메시지에서 가져온 짧은 명사로 채움 (mock 이라 단순화).
    const tone = userAnswers(session, "tone")[0] ?? "톤";
    const motive = userAnswers(session, "motive")[0] ?? "동기";
    const kw1 = title.replace(/\s+/g, "");
    const kw2 = motive.split(/\s+/)[0] ?? "동기";
    const kw3 = tone.split(/\s+/)[0] ?? "톤";
    const summary =
      i === 0
        ? `독자에게 글의 출발점을 제시한다.`
        : i === titles.length - 1
          ? `핵심 메시지("${message}")를 다시 짚으며 마무리한다.`
          : `핵심 메시지를 뒷받침하는 사고와 사례를 펼친다.`;
    return {
      id: `chap-${i + 1}`,
      title,
      synopsis: `#${kw1} #${kw2} #${kw3} — ${summary}`,
    };
  });
}

/** 단계 + turn 별 객관식 옵션. 단계당 충분한 turn 수를 미리 정의해 안전망. */
interface ChoiceItem {
  q: string;
  opts: string[];
}
const CHOICE_BANK: Record<WizardStageId, ChoiceItem[]> = {
  motive: [
    {
      q: "이 글을 쓰게 된 가장 가까운 출발점은 어디인가요?",
      opts: [
        "최근 강하게 든 한 감정",
        "오래 묵힌 한 장면",
        "독자에게 꼭 해줄 한 마디",
        "비판하고 싶은 통념",
        "직접 입력",
      ],
    },
  ],
  "audience-message": [
    {
      q: "이 글의 첫 독자로 가장 먼저 떠오르는 사람은?",
      opts: [
        "글쓰기를 막 시작한 사람",
        "비슷한 길을 걷는 동료",
        "방향을 잃은 30대",
        "10년 후의 나",
        "직접 입력",
      ],
    },
    {
      q: "그 한 사람에게 남기고 싶은 한 줄은 어느 쪽에 가까운가요?",
      opts: [
        "당신의 기록이 곧 무기다",
        "혼자 쓰지 마세요",
        "AI는 비서일 뿐, 작가는 당신",
        "포기하지 않은 사람만 쓴다",
        "직접 입력",
      ],
    },
  ],
  tone: [
    {
      q: "이 글의 톤은 어느 쪽에 가까운가요?",
      opts: [
        "따뜻한 회의주의자",
        "단단하고 군더더기 없는",
        "유머와 자조 섞인",
        "정중하고 정밀한",
        "직접 입력",
      ],
    },
  ],
  "structure-pick": [
    {
      q: "이 원고에 가장 어울릴 흐름은 어느 쪽인가요?",
      opts: [
        "서론-본론-결론 — 3장 단순한 흐름",
        "기-승-전-결 — 4장 고전 구조",
        "도입부-발단-전개-위기-절정-해결-결말 — 7장 서사",
        "문제-원리-방법-사례 — 4장 실용형",
        "직접 입력",
      ],
    },
  ],
};

const STAGE_FALLBACK_QUESTION: Record<WizardStageId, string> = {
  motive: "방금 답을 한 문장으로 정리해주시면 동기 단계는 마무리하겠습니다.",
  "audience-message":
    "독자와 메시지가 어느 정도 정해졌습니다. 한 줄로 정리해주세요.",
  tone: "이 톤을 유지하기 위해 절대 쓰지 않을 표현이 있다면 무엇인가요?",
  "structure-pick": "선택한 흐름을 한 문장으로 다시 정리해주세요.",
};

function buildAssistantTurn(
  session: WizardSession,
  stage: WizardStageId,
): string {
  const turn = countUserTurns(session, stage);
  const item = CHOICE_BANK[stage][turn];
  if (item) return item.q;
  return STAGE_FALLBACK_QUESTION[stage];
}

export class MockWizardBridge implements WizardAIBridge {
  private readonly delayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(opts: MockWizardBridgeOptions = {}) {
    this.delayMs = opts.tokenDelayMs ?? DEFAULT_DELAY;
    this.sleep =
      opts.sleep ??
      ((ms: number) =>
        new Promise<void>((res) => {
          if (ms <= 0) {
            res();
            return;
          }
          setTimeout(res, ms);
        }));
  }

  async *askNext(
    session: WizardSession,
    opts?: { signal?: AbortSignal },
  ): AsyncIterable<string> {
    const stage = session.currentStage;
    const text = buildAssistantTurn(session, stage);
    const chars = Array.from(text);
    for (const ch of chars) {
      if (opts?.signal?.aborted) return;
      yield ch;
      if (this.delayMs > 0) await this.sleep(this.delayMs);
    }
  }

  async askNextQuestion(
    session: WizardSession,
    _opts?: { signal?: AbortSignal },
  ): Promise<WizardQuestion> {
    const stage = session.currentStage;
    const turn = countUserTurns(session, stage);
    const item = CHOICE_BANK[stage][turn];
    if (item) {
      return {
        question: item.q,
        format: "choice",
        options: item.opts,
        intro: turn === 0 ? "" : "직전 답변 잘 들었습니다.",
      };
    }
    // 안전망 — turn 이 미리 정의된 객관식 수보다 많으면 주관식으로 마무리.
    return {
      question: STAGE_FALLBACK_QUESTION[stage],
      format: "open",
      intro: "마지막 정리 한 줄.",
    };
  }

  async summarize(
    session: WizardSession,
    mode: "stage" | "final",
  ): Promise<WizardSummarizeResult> {
    if (mode === "stage") {
      const { summary, decisions } = buildStageSummary(
        session,
        session.currentStage,
      );
      return { summary, decisions };
    }

    // final: 모든 단계의 결정을 모은다.
    const allDecisions: Record<string, string> = {};
    for (const stage of ["motive", "audience-message", "tone"] as WizardStageId[]) {
      const { decisions } = buildStageSummary(session, stage);
      if (stage === "audience-message") {
        allDecisions.target_reader = decisions.target_reader ?? "";
        allDecisions.core_message = decisions.core_message ?? "";
      } else {
        allDecisions[STAGE_DECISION_KEY[stage]] =
          decisions[STAGE_DECISION_KEY[stage]] ?? "";
      }
    }
    const structure = buildFinalStructure(session);
    const summary = [
      `계기: ${allDecisions.motive || "(미정)"}`,
      `독자: ${allDecisions.target_reader || "(미정)"}`,
      `핵심 메시지: ${allDecisions.core_message || "(미정)"}`,
      `톤: ${allDecisions.tone || "(미정)"}`,
    ].join("\n");
    return { summary, decisions: allDecisions, structure };
  }
}

export function _previewAssistantTurn(
  session: WizardSession,
  stage?: WizardStageId,
): string {
  return buildAssistantTurn(session, stage ?? session.currentStage);
}

export type { WizardMessage as _WizardMessage };
