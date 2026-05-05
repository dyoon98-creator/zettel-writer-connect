// Status transition rules for writing projects.
// Each state lists the valid next states. A state may transition to itself
// is NOT allowed (a no-op transition just means: don't call setStatus).

import { ProjectStatus } from "../types";

const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  // 아이디어 단계: 본격 시작 또는 자료부터 모으기
  idea: ["planning", "researching"],
  // 기획: 뼈대로 발전, 또는 자료 수집으로 우회
  planning: ["outline", "researching", "idea"],
  // 뼈대: 자료/초안으로 진행
  outline: ["researching", "drafting", "planning"],
  // 자료 수집: 뼈대 보완 또는 초안 진입
  researching: ["outline", "drafting", "planning"],
  // 초안: 피드백/퇴고로 진행, 다시 자료로 회귀 가능
  drafting: ["feedback", "revising", "researching"],
  // 피드백: 퇴고로 진행, 또는 초안으로 회귀
  feedback: ["revising", "drafting"],
  // 퇴고: 완성으로, 또는 피드백/초안 회귀
  revising: ["final", "feedback", "drafting"],
  // 완성: 발행 또는 퇴고 재개
  final: ["published", "revising"],
  // 발행: 퇴고로 재개 가능 (개정판 시나리오)
  published: ["revising"],
};

export const StatusMachine = {
  /** Returns the list of valid next states from `current`. */
  nextStates(current: ProjectStatus): ProjectStatus[] {
    return [...TRANSITIONS[current]];
  },

  /** Returns true iff the transition `from → to` is allowed. */
  canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    if (from === to) return false;
    return TRANSITIONS[from].includes(to);
  },
};
