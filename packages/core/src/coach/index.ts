// coach — 글쓰기 코치 액션 카탈로그.
//
// 출처: 김정운·양혁준 『챗GPT, 글쓰기 코치가 되어 줘』 (밀리의 서재).
// Inspector CoachPanel, 슬래시 명령, selection floating 버튼이 공통으로 사용.

export type {
  CoachAction,
  CoachCategory,
  CoachContextScope,
  CoachSaveTo,
} from "./types";
export { CATEGORY_LABEL_KO, CATEGORY_DESCRIPTION_KO } from "./types";

export { COACH_ACTIONS, COACH_ACTIONS_BY_ID } from "./templates";
export { CoachActionRegistry } from "./CoachActionRegistry";

export { COACH_SYSTEM_PROMPT, buildCoachPrompt } from "./systemPrompt";
