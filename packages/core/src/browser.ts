// browser.ts — Browser-safe public surface of @ai-manuscript-studio/core.
//
// 이 진입점은 Node 전용 모듈(child_process, node:fs, node:path, node:crypto)을
// 일절 가져오지 않는다. Tauri 데스크톱 프론트와 옵시디언 플러그인의 렌더러가
// 이걸 import 한다.
//
// Node 전용 클래스(CodexCLIAdapter / ClaudeCodeAdapter / SkillPackLoader /
// LicenseChecker)는 `./node` 진입점에서 따로 노출한다.

export * from "./types";
export * from "./adapters";

// Project
export { StatusMachine } from "./project/StatusMachine";
export { Templates, CANONICAL_SECTIONS } from "./project/Templates";
export type { CanonicalSection } from "./project/Templates";
export {
  WritingNoteIO,
  serialize as serializeFrontmatter,
  parse as parseWritingNote,
  replaceFrontmatter,
  buildInitialNote,
} from "./project/WritingNoteIO";
export { ProjectManager } from "./project/ProjectManager";
export type {
  CreateProjectInput,
  WritingProject,
  ProjectIndex,
  ProjectManagerDeps,
} from "./project/ProjectManager";

// Project v2 (Phase B)
export {
  PROJECT_SCHEMA,
  BINDER_SCHEMA,
  SCENE_TYPE,
  DEFAULT_STATUSES,
  DEFAULT_LABELS,
  isProjectMeta,
  isBinderTree,
  isBinderNode,
  isSceneFrontmatter,
  isStatusDef,
  isLabelDef,
} from "./project/schema";
export type {
  ProjectMeta,
  BinderTree,
  BinderNode,
  BinderFolder,
  BinderDocument,
  SceneFrontmatter,
  StatusDef,
  LabelDef,
  NodeStatusId,
  NodeLabelId,
} from "./project/schema";
export { ProjectMetaIO } from "./project/ProjectMetaIO";
export type { CreateProjectMetaInput } from "./project/ProjectMetaIO";
export { BinderIO } from "./project/BinderIO";
export {
  MANUSCRIPT_ROOT_ROLE,
  MANUSCRIPT_ROOT_BACKUP_FILE,
  ensureSingleManuscriptRoot,
  findManuscriptRoot,
  isManuscriptRoot,
  makeManuscriptRootFolder,
  migrateBinderOnDisk,
} from "./project/manuscriptRoot";
export type {
  EnsureRootResult,
  MigrateOnDiskResult,
} from "./project/manuscriptRoot";
export {
  SceneIO,
  serializeScene,
  parseScene,
  replaceSceneFrontmatter,
} from "./project/SceneIO";
export type { CreateSceneInput } from "./project/SceneIO";
export { SnapshotIO, diffLines } from "./project/SnapshotIO";
export type {
  Snapshot,
  SnapshotMeta,
  TakeSnapshotInput,
  DiffLine,
  DiffOp,
} from "./project/SnapshotIO";
export { ProjectV2Manager } from "./project/ProjectV2Manager";
export type {
  ProjectV2ManagerDeps,
  ProjectV2Snapshot,
  AddSceneInput,
  AddFolderInput,
} from "./project/ProjectV2Manager";

// Status & Label (Phase B)
export { StatusManager } from "./status/StatusManager";
export { LabelManager } from "./status/LabelManager";
export { isValidColor, assertValidColor } from "./status/colors";

// Migration v1 → v2
export { migrate as migrateV1ToV2, parseH2Sections } from "./migrate/v1ToV2";
export type { MigrateOptions, MigrationReport } from "./migrate/v1ToV2";

// Metrics
export {
  WordCounter,
  countChars,
  countWords,
  bucketSourceNotes,
} from "./metrics/WordCounter";
export type {
  SourceBuckets,
  WikiResolver as WordCounterWikiResolver,
} from "./metrics/WordCounter";

// AI — browser-safe parts only.
// CodexCLIAdapter / ClaudeCodeAdapter는 child_process를 쓰므로 ./node에서 export.
export type {
  LocalAIBridge,
  AIInvokeContext,
  AIResult,
  AIProviderId,
  AIBridgeError,
} from "./ai/LocalAIBridge";
export { AIBridgeInvocationError } from "./ai/LocalAIBridge";

export {
  ContextComposer,
  render,
  sliceH2Section,
  stripFrontmatter,
  parseWikiLink,
  matchesExcludedFolder,
} from "./ai/ContextComposer";
export type {
  ContextComposerDeps,
  ComposeInput,
  ComposedContext,
  ContextStats,
  MinimalAction,
  WikiResolver,
} from "./ai/ContextComposer";

export { ResultPipeline, buildPipelineComposer } from "./ai/ResultPipeline";
export type {
  PipelineAction,
  PipelineDeps,
  PipelineSettings,
  ResultChoice,
  ConfirmRequest,
  ConfirmResponse,
  PreviewRequest,
  RunInput,
} from "./ai/ResultPipeline";

export { PHASE2_ACTIONS, findAction } from "./ai/Phase2Actions";

export type AIProviderSettings = {
  aiProvider: "codex" | "claude-code";
  codexPath: string;
  codexExtraArgs: string;
  claudeCodePath: string;
};

// Skillpack — browser-safe parts only.
// LicenseChecker (uses node:crypto) and SkillPackLoader (uses node:fs)는 ./node로.
export * from "./skillpack/types";
export { SkillPackRegistry } from "./skillpack/SkillPackRegistry";
export {
  SUPPORTED_PLACEHOLDERS,
  buildPlaceholders,
  applyTemplate,
  validateTemplate,
} from "./skillpack/PromptTemplate";
export type {
  PlaceholderName,
  TemplateValidation,
} from "./skillpack/PromptTemplate";

// Actions
export { ActionRegistry } from "./actions/ActionRegistry";
export type {
  UnifiedAction,
  UnifiedSource,
  FreeActionProvider,
} from "./actions/ActionRegistry";

// Utils
export {
  classifyPath,
  slugify,
  todayDateStamp,
  todayIso,
  FOLDER_RAW,
  FOLDER_INBOX,
  FOLDER_LITERATURE,
  FOLDER_WIKI,
  FOLDER_PERMANENT,
} from "./utils/paths";
export type { SourceBucket } from "./utils/paths";
export { log } from "./utils/logger";

// UI primitives (env-neutral helpers)
export { FocusMode, FOCUS_CLASS } from "./ui/FocusMode";

// Wizard (Phase E)
export {
  WIZARD_STAGES,
  STAGE_LABEL_KO,
  STAGE_DESCRIPTION_KO,
} from "./wizard/types";
export type {
  WizardStageId,
  WizardMessage,
  WizardMessageRole,
  WizardSession,
  WizardSummary,
  StageOutcome,
  StageStatus,
} from "./wizard/types";
export { WizardEngine } from "./wizard/WizardEngine";
export {
  WizardConductor,
} from "./wizard/WizardConductor";
export type {
  WizardAIBridge,
  WizardQuestion,
  WizardSummarizeResult,
  ConductorOptions,
} from "./wizard/WizardConductor";
export {
  MockWizardBridge,
} from "./wizard/MockWizardBridge";
export type { MockWizardBridgeOptions } from "./wizard/MockWizardBridge";
export { PlanningMdWriter } from "./wizard/PlanningMdWriter";

// Coach — 글쓰기 코치 액션 카탈로그 (Phase A.2 / 김정운 책 기반).
export {
  COACH_ACTIONS,
  COACH_ACTIONS_BY_ID,
  CoachActionRegistry,
  COACH_SYSTEM_PROMPT,
  buildCoachPrompt,
  CATEGORY_LABEL_KO as COACH_CATEGORY_LABEL_KO,
  CATEGORY_DESCRIPTION_KO as COACH_CATEGORY_DESCRIPTION_KO,
} from "./coach";
export type {
  CoachAction,
  CoachCategory,
  CoachContextScope,
  CoachSaveTo,
} from "./coach";
