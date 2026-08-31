// wizard/types.ts — 마법사 인터뷰 상태 머신의 데이터 타입.
//
// 이 파일은 IO 가 없는 순수 타입 + 작은 상수만 노출한다.
// `WizardEngine` 은 이 타입들 위에서 동작하는 transition 함수의 묶음이며,
// 실제 AI 호출 / 파일 저장 / UI 렌더는 모두 외부 책임이다.

import type { Genre } from "../types";

/** 압축 인터뷰의 4단계 식별자. 순서가 있는 배열은 `WIZARD_STAGES` 참고. */
export type WizardStageId =
  | "motive"
  | "audience-message"
  | "tone"
  | "structure-pick";

/**
 * 사용자가 문서 «종류» 를 고르지 않은 채 진행했을 때 화면과 프롬프트가 함께 쓰는
 * 유일한 기본값.
 *
 * 왜 상수가 필요한가 (대표 실사용 결함 2026-08-31): 같은 기본값이 컨셉 마법사
 * 1단계와 기획 인터뷰 헤더에 «두 벌» 하드코딩돼 있었다. 한쪽만 고치면 두 화면이
 * 서로 다른 종류를 주장한다. 기본값은 한 곳에서만 정한다.
 *
 * 컨셉 마법사 1단계는 이 기본값을 «쓰지 않는다» — 거기서는 고르지 않으면 다음으로
 * 넘어가지 못한다(침묵이 「투자·전략 메모」가 되는 함정을 원천에서 없앴다).
 * 이 값이 쓰이는 곳은 컨셉을 거치지 않고 인터뷰로 바로 들어온 경우의 «표시» 뿐이다.
 */
export const DEFAULT_DRAFT_GENRE: Genre = "investment-strategy-memo";

/** UI 가 순서대로 렌더할 때 사용하는 정해진 시퀀스. */
export const WIZARD_STAGES: WizardStageId[] = [
  "motive",
  "audience-message",
  "tone",
  "structure-pick",
];

/** 사이드바 / 헤더에 노출되는 한국어 단계명. */
export const STAGE_LABEL_KO: Record<WizardStageId, string> = {
  motive: "동기", // 글을 쓰게 된 계기
  "audience-message": "독자·메시지",
  tone: "톤",
  "structure-pick": "글 구조",
};

/** 단계별 한국어 부제 — 카드/도움말 등에 사용. */
export const STAGE_DESCRIPTION_KO: Record<WizardStageId, string> = {
  motive: "글을 쓰게 된 계기 — 한 번의 객관식",
  "audience-message": "누구에게 무엇을 — 독자 + 핵심 메시지",
  tone: "글의 어조 — 한 번의 객관식",
  "structure-pick": "글의 흐름 — 장르별 구조 선택",
};

export type WizardMessageRole = "user" | "assistant" | "system";

export interface WizardMessage {
  /** 메시지 식별자 — 렌더링 key 로 사용. */
  id: string;
  /** 이 메시지가 속한 단계. */
  stage: WizardStageId;
  role: WizardMessageRole;
  content: string;
  /** ISO 시각. */
  createdAt: string;
}

export type StageStatus = "pending" | "active" | "complete";

export interface StageOutcome {
  stage: WizardStageId;
  status: StageStatus;
  /** AI 가 단계 종료 시 만든 구조화된 한국어 요약. */
  summary?: string;
  /**
   * 단계가 결정한 키-값 쌍. 예: { "tone": "따뜻한 회의주의자" }.
   * `WizardConductor` 가 채워준다.
   */
  decisions?: Record<string, string>;
  /**
   * 이 단계를 사용자가 «답해서» 닫은 것이 아니라 앞 단계 결과로 «대체해» 닫았을 때의 사유.
   *
   * 왜 `status` 에 "skipped" 를 더하지 않았나 (2026-08-31 판정):
   *   `StageStatus` 를 넓히면 그 union 을 좁게 받는 화면들이 함께 깨진다 —
   *   레거시 Tauri 앱(`apps/desktop`)의 `WizardSidebar` 가 그 자리라 실측으로
   *   `tsc -noEmit` 이 2건 실패했다. 그쪽은 폐기 예정이라 손대지 않는다.
   *   그래서 «상태» 는 그대로 `complete`(= 더 이상 막지 않는다) 로 두고,
   *   «사실» 은 이 필드가 들고 있는다. 이 값이 있으면 사용자가 그 단계에서
   *   답한 적이 없다는 뜻이다 — 화면은 「완료」가 아니라 「이어받음」으로 그린다.
   */
  skippedReason?: string;
}

/** 컨셉 마법사가 만든 카드 한 장 중, 기획 인터뷰가 쓰는 부분만. */
export interface ConceptHandoffCard {
  id: string;
  /** 한국어 역할 라벨 (도입/문제 제기/사례/설명/전환/결론). 모르면 빈 문자열. */
  role: string;
  title: string;
  summary: string;
}

/**
 * 컨셉 마법사(6단계) 결과 중 **기획 인터뷰가 실제로 쓰는 것만** 추린 이어받기 꾸러미.
 *
 * 왜 전부 싣지 않는가: 이 값은 `{{structured_handoff}}` 로 프롬프트에 들어간다.
 * 전문을 실으면 프롬프트가 부풀어 정작 필요한 지시를 밀어낸다.
 * 카드 본문(summary)은 binder 구조 제안에만 쓰고 프롬프트에는 싣지 않는다.
 */
export interface ConceptHandoff {
  /** 어디서 이어받았는가. `concept-wizard` = 방금 그 자리에서, `planning-md` = 볼트 저장물에서. */
  source: "concept-wizard" | "planning-md";
  /** 컨셉 단락 — `audience-message` 단계가 확인받을 값의 근거. */
  conceptParagraph?: string;
  /** 시놉시스 — `tone` 단계가 확인받을 값의 근거. */
  synopsis?: string;
  /** 메모 분석의 감정 축 — `motive` 단계가 확인받을 값의 근거. */
  memoEmotionAxis?: string;
  /** 「글로 발전 가능한 방향」 — `motive` 선택지의 재료. */
  memoDirections?: string[];
  /** 「힘 있는 문장」 — 핵심 메시지 선택지의 재료. */
  memoStrongSentences?: string[];
  /** 트리트먼트 카드 — `structure-pick` 을 대신한다. */
  treatment?: ConceptHandoffCard[];
  attachedNotes?: string[];
  /** 앞서 «끝난» 기획 인터뷰가 있으면 그 결정. 다시 묻지 않고 확인만 받는다. */
  priorDecisions?: {
    motive?: string;
    targetReader?: string;
    coreMessage?: string;
    tone?: string;
  };
}

export interface WizardSession {
  /** 세션 식별자 — `planning.md` 의 frontmatter 와 매칭. */
  id: string;
  /** ISO 시각. */
  startedAt: string;
  updatedAt: string;
  draftTitle?: string;
  draftGenre?: Genre;
  currentStage: WizardStageId;
  stages: Record<WizardStageId, StageOutcome>;
  messages: WizardMessage[];
  /**
   * 컨셉 마법사에서 이어받은 결과. 없으면 «백지에서 묻는» 기존 흐름 그대로다.
   * 이 필드가 있으면 인터뷰는 「묻는 자리」가 아니라 「확인하는 자리」가 된다.
   */
  conceptHandoff?: ConceptHandoff;
}

/**
 * 마법사 종료 시점에 만들어지는 최종 요약. `wizardSeed.ts` 가
 * 이 객체를 받아 project.json + binder.json + planning.md 를 작성한다.
 */
export interface WizardSummary {
  sessionId: string;
  title: string;
  genre: Genre;
  /** "글을 쓰게 된 계기" 단계의 결정. */
  motive: string;
  targetReader: string;
  coreMessage: string;
  tone: string;
  /**
   * 자동 시드할 binder 의 폴더(=장) 목록. 4개 권장 (도입/전개/절정/결말).
   * 각 항목은 폴더가 되고, 폴더 안에 비어 있는 장면 1개가 생성된다.
   */
  structureProposal: { id: string; title: string; synopsis: string }[];
  /** 마법사 대화 전체 — `planning.md` 에 그대로 기록. */
  transcript: WizardMessage[];
  completedAt: string;
}
