// Phase B 스키마 — Scrivener식 다중 파일 프로젝트 구조.
//
// 한 프로젝트 = 폴더. 폴더 안의 두 핵심 JSON 파일:
//   - project.json: 메타 (제목, 장르, status/label 정의, sourceNotes)
//   - binder.json: 트리 (folder/document 노드)
// 각 장면 .md는 SceneFrontmatter를 갖는다.

import { Genre, PLUGIN_ID, ProjectStatus } from "../types";

// ---- 스키마 식별자 ----

export const PROJECT_SCHEMA = "ai-manuscript-studio.project.v2";
export const BINDER_SCHEMA = "ai-manuscript-studio.binder.v2";
export const SCENE_TYPE = "writing-scene" as const;

// ---- Status / Label 정의 ----

/** 사용자 정의 가능한 status 항목 (project.json 안에 살아 있음). */
export interface StatusDef {
  id: string;
  name: string;
  color: string;
  /** 단 하나만 true. 새 노드의 기본값. */
  default?: boolean;
}

/** 사용자 정의 가능한 label 항목. */
export interface LabelDef {
  id: string;
  name: string;
  color: string;
  default?: boolean;
}

/** 영구노트/장면 단위 status id (사용자 커스텀 가능). */
export type NodeStatusId = string;
export type NodeLabelId = string;

// ---- ProjectMeta — project.json 의 형태 ----

export interface ProjectMeta {
  schema: typeof PROJECT_SCHEMA;
  /** 프로젝트 식별자 (slug). 폴더명과 일치. */
  id: string;
  title: string;
  genre: Genre;
  /** 원고 전체 라이프사이클 (idea → published). v1 9-state 그대로 재활용. */
  status: ProjectStatus;
  /** 프로젝트 자체의 label id (예: "manuscript"). 사용자 정의 가능. */
  label: NodeLabelId;
  wordGoal: number;
  currentWords: number;
  targetReader: string;
  coreMessage: string;
  createdAt: string;
  updatedAt: string;
  customStatuses: StatusDef[];
  customLabels: LabelDef[];
  sourceNotes: string[];
  /** 옵시디언 호환용 식별자. */
  plugin: typeof PLUGIN_ID;
  /** 자유로운 추가 메타데이터 (작가가 원하는 키-값). */
  customMetadata?: Record<string, string>;
  /** Concept Wizard 가 진행 중일 때 sessionId 를 박아 둔다. 재진입 시 복구용. */
  pendingWizard?: { sessionId: string };
}

// ---- Binder 트리 ----

/** Shortcut 모드 — 노드의 본문이 외부(또는 다른 위치의) 파일과 양방향 동기화된다.
 *  존재 시 노드의 file 필드(있다면)는 무시되고 absolutePath 가 진실의 원천이 된다.
 *  폴더 노드도 linkedFile 을 가질 수 있어 children 을 유지한 채 본문 텍스트만 외부와 링크.
 *  Scrivener 의 "folder-with-text" 모델과 같은 의미. */
export interface BinderLinkedFile {
  /** OS 절대 경로. 옵시디언 볼트 외부 파일도 가능. */
  absolutePath: string;
}

interface BinderNodeBase {
  id: string;
  title: string;
  /** customLabels 의 어떤 id. */
  label: NodeLabelId;
  /** customStatuses 의 어떤 id. */
  status: NodeStatusId;
  synopsis: string;
  /** 자유 키-값 메타. */
  customMetadata?: Record<string, string>;
  /** 외부 파일 shortcut (옵션). 있으면 read/write 가 absolutePath 로 라우팅. */
  linkedFile?: BinderLinkedFile;
}

export interface BinderFolder extends BinderNodeBase {
  type: "folder";
  children: BinderNode[];
}

export interface BinderDocument extends BinderNodeBase {
  type: "document";
  /** 프로젝트 폴더에 대한 상대 경로 (예: "01-도입/01-노트북.md"). */
  file: string;
  /** 마지막으로 측정된 글자 수. */
  wordCount?: number;
}

export type BinderNode = BinderFolder | BinderDocument;

export interface BinderTree {
  schema: typeof BINDER_SCHEMA;
  root: BinderNode[];
}

// ---- Scene Frontmatter ----

export interface SceneFrontmatter {
  type: typeof SCENE_TYPE;
  plugin: typeof PLUGIN_ID;
  /** 부모 ProjectMeta.id. */
  project: string;
  /** binder 노드의 id. */
  scene_id: string;
  status: NodeStatusId;
  label: NodeLabelId;
  synopsis: string;
  word_count: number;
  /** YYYY-MM-DD. */
  updated: string;
}

// ---- Defaults ----

/** 기본 5단계 status 셋. "first-draft"가 기본값으로 선택됨. */
export const DEFAULT_STATUSES: StatusDef[] = [
  { id: "to-do", name: "To Do", color: "#888888" },
  { id: "first-draft", name: "First Draft", color: "#e8a", default: true },
  { id: "revised", name: "Revised", color: "#9be" },
  { id: "final", name: "Final", color: "#9d7" },
  { id: "done", name: "Done", color: "#7c5" },
];

/** 기본 7종류 label 셋. "scene"이 기본값. */
export const DEFAULT_LABELS: LabelDef[] = [
  { id: "chapter", name: "장", color: "#88a" },
  { id: "scene", name: "장면", color: "#aac", default: true },
  { id: "research", name: "리서치", color: "#7ba" },
  { id: "manuscript", name: "원고", color: "#a87" },
  { id: "material", name: "자료", color: "#9c8" },
  { id: "fragment", name: "단편", color: "#cca" },
  { id: "note", name: "메모", color: "#999" },
];

// ---- Type guards ----

function isStringRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isStatusDef(v: unknown): v is StatusDef {
  if (!isStringRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.color === "string" &&
    (v.default === undefined || typeof v.default === "boolean")
  );
}

export function isLabelDef(v: unknown): v is LabelDef {
  return isStatusDef(v); // shape 동일
}

export function isProjectMeta(v: unknown): v is ProjectMeta {
  if (!isStringRecord(v)) return false;
  if (v.schema !== PROJECT_SCHEMA) return false;
  if (typeof v.id !== "string" || typeof v.title !== "string") return false;
  if (typeof v.genre !== "string") return false;
  if (typeof v.status !== "string") return false;
  if (typeof v.label !== "string") return false;
  if (typeof v.wordGoal !== "number" || typeof v.currentWords !== "number") {
    return false;
  }
  if (
    typeof v.targetReader !== "string" ||
    typeof v.coreMessage !== "string"
  ) {
    return false;
  }
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") {
    return false;
  }
  if (
    !Array.isArray(v.customStatuses) ||
    !v.customStatuses.every(isStatusDef)
  ) {
    return false;
  }
  if (!Array.isArray(v.customLabels) || !v.customLabels.every(isLabelDef)) {
    return false;
  }
  if (
    !Array.isArray(v.sourceNotes) ||
    !v.sourceNotes.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (v.plugin !== PLUGIN_ID) return false;
  if (v.pendingWizard !== undefined) {
    if (!isStringRecord(v.pendingWizard)) return false;
    if (typeof v.pendingWizard.sessionId !== "string") return false;
  }
  return true;
}

function isLinkedFile(v: unknown): v is BinderLinkedFile {
  return isStringRecord(v) && typeof v.absolutePath === "string";
}

export function isBinderNode(v: unknown): v is BinderNode {
  if (!isStringRecord(v)) return false;
  if (typeof v.id !== "string" || typeof v.title !== "string") return false;
  if (typeof v.label !== "string" || typeof v.status !== "string") return false;
  if (typeof v.synopsis !== "string") return false;
  if (v.linkedFile !== undefined && !isLinkedFile(v.linkedFile)) return false;
  if (v.type === "folder") {
    return Array.isArray(v.children) && v.children.every(isBinderNode);
  }
  if (v.type === "document") {
    return (
      typeof v.file === "string" &&
      (v.wordCount === undefined || typeof v.wordCount === "number")
    );
  }
  return false;
}

export function isBinderTree(v: unknown): v is BinderTree {
  if (!isStringRecord(v)) return false;
  if (v.schema !== BINDER_SCHEMA) return false;
  if (!Array.isArray(v.root)) return false;
  return v.root.every(isBinderNode);
}

export function isSceneFrontmatter(v: unknown): v is SceneFrontmatter {
  if (!isStringRecord(v)) return false;
  return (
    v.type === SCENE_TYPE &&
    v.plugin === PLUGIN_ID &&
    typeof v.project === "string" &&
    typeof v.scene_id === "string" &&
    typeof v.status === "string" &&
    typeof v.label === "string" &&
    typeof v.synopsis === "string" &&
    typeof v.word_count === "number" &&
    typeof v.updated === "string"
  );
}

// ---- Concept Wizard Draft Session (Phase G) ----
//
// 책 한 권의 컨셉/시놉시스/12-30장 목차를 작가와 AI 가 다턴으로 짜는 5단계
// 마법사의 in-flight 상태. 단계별 결과물은 모두 한 세션 객체에 누적된다.
// 영구 저장은 P3-T9 에서 도입 — 그 전까지는 sessionStorage 만 거친다.

export const CONCEPT_DRAFT_SCHEMA = "ai-manuscript-studio.concept-draft.v1";

// v2 — memo (의식의 흐름) + treatment (역할별 카드 보드) 단계가 추가됐다.
// 디스크 호환을 위해 옛 stage 값("outline") 도 union 에 남겨두고, 마이그레이션 시
// loadFromSession 단에서 treatment 로 lift 한다.
export type ConceptDraftStage =
  | "seed"
  | "memo"
  | "concept"
  | "synopsis"
  | "treatment"
  | "outline" // legacy — 옛 세션 파일이 가질 수 있음. 새 세션은 "treatment" 사용.
  | "done";

/** 글의 문체·논조 — 장르(Genre)와 별개. UI 라디오에서 골라 잡는다. */
export type ConceptTone =
  | "decision-memo"
  | "analytical-report"
  | "customer-report"
  | "legal-accounting-review"
  | "column-narrative"
  | "long-form-reasoning"
  | "lecture-presentation"
  | "explanatory";

export interface ConceptMessage {
  role: "user" | "assistant";
  content: string;
  /** ISO 8601. */
  at: string;
}

export interface OutlineChapter {
  /** "ch-01" 등 안정 id (mergeChapters / splitChapter 가 새 번호 부여). */
  id: string;
  title: string;
  /** 한 단락 일세. */
  summary: string;
}

/** 의식의 흐름 메모를 AI 가 5축으로 분해한 결과. 모든 배열은 길이 무관. */
export interface MemoAnalysis {
  recurringThoughts: string[];
  emotionAxis: string;
  hiddenThemes: string[];
  strongSentences: string[];
  /** 글로 발전 가능한 방향 — 정확히 3개를 권장하지만 강제하진 않는다. */
  developmentDirections: string[];
}

export interface ConceptMemo {
  raw: string;
  analysis?: MemoAnalysis;
  /** 사용자가 ✓ 체크한 항목들의 "축:인덱스" 또는 "축:문자열" 식별자. concept 단계 prefill 용. */
  selected?: string[];
}

/** 트리트먼트 카드 한 장의 역할. */
export type TreatmentCardRole =
  | "intro"
  | "problem"
  | "case"
  | "explain"
  | "pivot"
  | "conclusion";

export interface TreatmentCard {
  /** "tc-<n>" 안정 id. */
  id: string;
  title: string;
  role: TreatmentCardRole;
  /** 본 카드의 내용 요약 (1~3문장). */
  summary: string;
  /** 카드에서 가장 힘 있는 한 문장 (선택). */
  keySentence?: string;
  /** 카드 끝에서 독자가 느꼈으면 하는 감정 (선택). */
  readerEmotion?: string;
  /** 작가 메모 (선택). */
  note?: string;
}

export interface ConceptDraftSession {
  schema: typeof CONCEPT_DRAFT_SCHEMA;
  id: string;
  seed: string;
  tone: ConceptTone;
  /** 기존 Genre 재사용. */
  genre: Genre;
  /** 옵시디언 노트 [[wiki-link]] 또는 경로. */
  attachedNotes: string[];
  conversation: ConceptMessage[];
  conceptParagraph: string;
  synopsis: string;
  /** v1 호환 — 옛 세션이 outline 만 가진 경우 유지. 신규 작성은 treatment 사용. */
  outline: OutlineChapter[];
  /** v2 — 의식의 흐름 메모 + AI 분석. */
  memo?: ConceptMemo;
  /** v2 — 역할별 카드 배열. binder 시드의 1차 소스. */
  treatment?: TreatmentCard[];
  stage: ConceptDraftStage;
  createdAt: string;
  updatedAt: string;
}

export function isConceptMessage(v: unknown): v is ConceptMessage {
  if (!isStringRecord(v)) return false;
  return (
    (v.role === "user" || v.role === "assistant") &&
    typeof v.content === "string" &&
    typeof v.at === "string"
  );
}

export function isOutlineChapter(v: unknown): v is OutlineChapter {
  if (!isStringRecord(v)) return false;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.summary === "string"
  );
}

const TREATMENT_ROLES: readonly TreatmentCardRole[] = [
  "intro",
  "problem",
  "case",
  "explain",
  "pivot",
  "conclusion",
];

export function isTreatmentCardRole(v: unknown): v is TreatmentCardRole {
  return typeof v === "string" && (TREATMENT_ROLES as readonly string[]).includes(v);
}

export function isTreatmentCard(v: unknown): v is TreatmentCard {
  if (!isStringRecord(v)) return false;
  if (typeof v.id !== "string") return false;
  if (typeof v.title !== "string") return false;
  if (!isTreatmentCardRole(v.role)) return false;
  if (typeof v.summary !== "string") return false;
  if (v.keySentence !== undefined && typeof v.keySentence !== "string") return false;
  if (v.readerEmotion !== undefined && typeof v.readerEmotion !== "string") return false;
  if (v.note !== undefined && typeof v.note !== "string") return false;
  return true;
}

export function isMemoAnalysis(v: unknown): v is MemoAnalysis {
  if (!isStringRecord(v)) return false;
  const strArr = (x: unknown): boolean =>
    Array.isArray(x) && x.every((s) => typeof s === "string");
  return (
    strArr(v.recurringThoughts) &&
    typeof v.emotionAxis === "string" &&
    strArr(v.hiddenThemes) &&
    strArr(v.strongSentences) &&
    strArr(v.developmentDirections)
  );
}

export function isConceptMemo(v: unknown): v is ConceptMemo {
  if (!isStringRecord(v)) return false;
  if (typeof v.raw !== "string") return false;
  if (v.analysis !== undefined && !isMemoAnalysis(v.analysis)) return false;
  if (
    v.selected !== undefined &&
    (!Array.isArray(v.selected) || !v.selected.every((s) => typeof s === "string"))
  ) {
    return false;
  }
  return true;
}

export function isConceptDraftSession(v: unknown): v is ConceptDraftSession {
  if (!isStringRecord(v)) return false;
  if (v.schema !== CONCEPT_DRAFT_SCHEMA) return false;
  if (typeof v.id !== "string") return false;
  if (typeof v.seed !== "string") return false;
  const VALID_TONES = new Set<string>([
    "decision-memo",
    "analytical-report",
    "customer-report",
    "legal-accounting-review",
    "column-narrative",
    "long-form-reasoning",
    "lecture-presentation",
    "explanatory",
  ]);
  if (typeof v.tone !== "string" || !VALID_TONES.has(v.tone)) {
    return false;
  }
  const VALID_GENRES = new Set<string>([
    "investment-strategy-memo",
    "investment-report",
    "legal-accounting-review",
    "column-essay",
    "lecture-presentation",
    "long-form-manuscript",
  ]);
  if (typeof v.genre !== "string" || !VALID_GENRES.has(v.genre)) {
    return false;
  }
  if (
    !Array.isArray(v.attachedNotes) ||
    !v.attachedNotes.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (
    !Array.isArray(v.conversation) ||
    !v.conversation.every(isConceptMessage)
  ) {
    return false;
  }
  if (typeof v.conceptParagraph !== "string") return false;
  if (typeof v.synopsis !== "string") return false;
  if (!Array.isArray(v.outline) || !v.outline.every(isOutlineChapter)) {
    return false;
  }
  // v2 — memo / treatment 는 optional. 있으면 형태 확인.
  if (v.memo !== undefined && !isConceptMemo(v.memo)) return false;
  if (
    v.treatment !== undefined &&
    (!Array.isArray(v.treatment) || !v.treatment.every(isTreatmentCard))
  ) {
    return false;
  }
  const stage = v.stage;
  if (
    stage !== "seed" &&
    stage !== "memo" &&
    stage !== "concept" &&
    stage !== "synopsis" &&
    stage !== "treatment" &&
    stage !== "outline" &&
    stage !== "done"
  ) {
    return false;
  }
  if (typeof v.createdAt !== "string") return false;
  if (typeof v.updatedAt !== "string") return false;
  return true;
}
