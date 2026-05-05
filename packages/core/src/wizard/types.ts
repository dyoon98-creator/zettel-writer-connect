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
