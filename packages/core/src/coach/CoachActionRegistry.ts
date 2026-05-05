// CoachActionRegistry.ts — 카탈로그 조회/필터.
//
// CoachPanel 의 카테고리 탭, 슬래시 명령, selection floating 버튼이
// 모두 이 레지스트리를 통해 액션을 찾는다.

import { COACH_ACTIONS, COACH_ACTIONS_BY_ID } from "./templates";
import type { CoachAction, CoachCategory, CoachContextScope } from "./types";

export class CoachActionRegistry {
  /** 모든 액션. (slice copy 로 외부 수정 방지) */
  static all(): CoachAction[] {
    return COACH_ACTIONS.slice();
  }

  /** 카테고리별 액션 목록. */
  static byCategory(category: CoachCategory): CoachAction[] {
    return COACH_ACTIONS.filter((a) => a.category === category);
  }

  /** ID 로 조회. 없으면 null. */
  static byId(id: string): CoachAction | null {
    return COACH_ACTIONS_BY_ID.get(id) ?? null;
  }

  /**
   * 현재 사용자 컨텍스트(선택 길이·커서 위치)에 맞는 액션 목록.
   * floating AI 버튼이 selection 길이로 어떤 액션을 노출할지 결정할 때 사용.
   */
  static byContextScope(scope: CoachContextScope): CoachAction[] {
    return COACH_ACTIONS.filter((a) => a.contextScope === scope);
  }

  /**
   * 슬래시 명령(`/foo`) 매칭. 한국어 입력기에서 한 글자 단축키도 매칭하도록
   * shortcut 와 label 둘 다 prefix 검사.
   */
  static slashSearch(query: string): CoachAction[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return COACH_ACTIONS.filter((a) => {
      if (a.shortcut && a.shortcut.toLowerCase().startsWith(q)) return true;
      if (a.label.toLowerCase().includes(q)) return true;
      if (a.id.includes(q)) return true;
      return false;
    });
  }

  /**
   * 텍스트 길이로 contextScope 추론.
   * floating 버튼이 사용자가 선택한 길이로 어떤 액션 메뉴를 띄울지 정할 때.
   */
  static inferScopeFromText(text: string): CoachContextScope {
    const trimmed = text.trim();
    if (!trimmed) return "none";
    const charLen = trimmed.length;
    // 줄바꿈 2개 이상이면 문단(또는 그 이상).
    const paragraphCount = trimmed.split(/\n\s*\n/).filter(Boolean).length;
    if (paragraphCount >= 2) return "scene";
    // 줄바꿈 없이 짧으면 단어/문장 구분: 마침표나 어절 갯수로.
    if (charLen <= 10 && !/[.!?。…\s]/.test(trimmed)) return "word";
    if (charLen <= 80 && !trimmed.includes("\n")) return "sentence";
    return "paragraph";
  }
}
