// types.ts — CoachAction 타입 정의.
//
// 출처: 김정운·양혁준 『챗GPT, 글쓰기 코치가 되어 줘』 (밀리의 서재)
// 책의 60+ 프롬프트 패턴을 카테고리·contextScope·saveTo로 정규화한 형태.

export type CoachCategory =
  | "vocab" // 어휘 — 단어·표현 다듬기
  | "structure" // 구조 — 문장·문단·글 전체 구성
  | "description" // 묘사 — 장면·감각·이미지
  | "analysis" // 분석/패러디 — 작가 분석·문체 모방
  | "revise" // 퇴고 — 7가지 원칙·피드백
  | "inspire" // 영감 — 사고 훈련·브레인스토밍
  | "research"; // 리서치 — 출처·사실 체크

/** 액션이 어떤 컨텍스트를 입력으로 요구하는가. */
export type CoachContextScope =
  | "word" // 단어 한 개 (selection 1~10자)
  | "sentence" // 문장 한 개 (selection or 커서 위치 문장)
  | "paragraph" // 문단 한 개
  | "scene" // 현재 장면 본문 전체
  | "project" // 프로젝트 모든 장면 합본
  | "none"; // 컨텍스트 불필요 (영감·사고 훈련 등)

/** 액션 결과를 어디에 저장할 것인가. */
export type CoachSaveTo =
  | "inline" // 에디터 cursor 위치에 직접 삽입
  | "replace-selection" // 선택 영역을 결과로 교체 (사용자 확인 후)
  | "feedback-section" // <scene>.feedback.md 에 timestamped append
  | "new-node" // binder 에 새 document 노드 추가
  | "preview-only"; // 모달만 띄움, 저장 안 함

export interface CoachAction {
  /** 안정 식별자. 예: "vocab.verb-strengthen". */
  id: string;
  category: CoachCategory;
  /** 한국어 라벨. UI 버튼·메뉴에 표시. */
  label: string;
  /** 1~2 문장 설명. 호버 툴팁·검색 매칭. */
  description: string;
  contextScope: CoachContextScope;
  /**
   * Codex CLI 에 보낼 프롬프트 템플릿.
   * placeholder: {{selection}}, {{paragraph}}, {{scene}}, {{project_meta}},
   *              {{user_input}}, {{full_body}}.
   * Role prompting 은 시스템 프롬프트로 별도 주입되므로 여기엔 task 만 적는다.
   */
  promptTemplate: string;
  /** 액션이 추가 사용자 입력(예: 키워드, 출처)을 요구하는가. */
  requiresUserInput?: boolean;
  /** 사용자에게 보일 입력 라벨. requiresUserInput true 일 때 사용. */
  userInputLabel?: string;
  /** 첨부 자료가 필요한가 (예: 사진으로 묘사). 현재 image 만 지원. */
  requiresAttachment?: "image" | null;
  saveTo: CoachSaveTo;
  /** CodeMirror 슬래시 명령용 단축키 (소문자). */
  shortcut?: string;
  /**
   * 책의 어느 부분에서 왔는가. 신뢰성·학습 자료로 표기.
   * 예: "Chapter 3, 프롬프트 2-46" / "Chapter 10, 프롬프트 3-36 (단축키 ss)".
   */
  sourceBookSection?: string;
  /**
   * 응답 길이 힌트. 단어 단위 액션은 짧게, 글 검토는 길게.
   * "short" ≤ 200자 / "medium" ~500자 / "long" ~2000자.
   */
  expectedLength?: "short" | "medium" | "long";
  /**
   * 응답이 옵션 리스트(예: 5개 후보)인가, 단일 텍스트인가.
   * "options" 면 UI 가 라디오 버튼으로 표시하고 선택 시 inline 적용.
   */
  responseFormat?: "text" | "options" | "json";
}

/** 카테고리별 한국어 라벨. */
export const CATEGORY_LABEL_KO: Record<CoachCategory, string> = {
  vocab: "어휘",
  structure: "구조",
  description: "묘사",
  analysis: "분석",
  revise: "퇴고",
  inspire: "영감",
  research: "리서치",
};

/** 카테고리별 짧은 설명 (탭 호버 툴팁용). */
export const CATEGORY_DESCRIPTION_KO: Record<CoachCategory, string> = {
  vocab: "단어·표현을 더 생생하게",
  structure: "문장·문단·글 전체 구성",
  description: "장면·감각·이미지로 그리기",
  analysis: "작가 분석과 문체 모방",
  revise: "7가지 원칙으로 다듬기",
  inspire: "사고 훈련과 브레인스토밍",
  research: "출처와 사실 체크",
};
