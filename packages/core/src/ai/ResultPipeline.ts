// ResultPipeline — orchestrator for a single AI invocation.
//
// Steps:
//   1. compose context
//   2. (optional) confirm via host-supplied confirmRun callback
//   3. show progress via NoticeAdapter; honor AbortController
//   4. invoke bridge
//   5. ask host to preview the result
//   6. on user choice: save / insert / copy / discard, then write to history.
//
// Phase A: removed direct Obsidian dependencies. The pipeline's host (the
// Obsidian plugin or the Tauri app) supplies:
//   - VaultAdapter / NoticeAdapter / FrontmatterAdapter (via composer)
//   - ResultSink (where save/insert results land)
//   - confirmRun(...) / previewResult(...) callbacks (UI)
//   - askForUserInput(...) callback (modal in the host)

import {
  AIBridgeInvocationError,
  AIInvokeContext,
  LocalAIBridge,
} from "./LocalAIBridge";
import {
  ContextComposer,
  ContextComposerDeps,
  MinimalAction,
} from "./ContextComposer";
import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { FrontmatterAdapter } from "../adapters/FrontmatterAdapter";
import { ResultSink } from "../adapters/ResultSink";
import { log } from "../utils/logger";
import { LicenseStatus } from "../skillpack/types";

/** Action shape used by the pipeline. */
export interface PipelineAction extends MinimalAction {
  /** Human label, e.g. "첫 문장 코칭". */
  label: string;
  /** Optional H2 anchor in the project body. */
  sectionAnchor?: string;
  /** Phase 3: optional license gate; undefined = free. */
  license?: LicenseStatus;
  /** Phase 3: if true, prompt the user for {{user_input}} before composing. */
  requiresUserInput?: boolean;
}

/** Choice the user makes from the host's preview UI. */
export type ResultChoice = "save" | "insert" | "copy" | "discard";

/** Settings shape consumed by the pipeline (subset of v1's full settings). */
export interface PipelineSettings {
  confirmBeforeRun: boolean;
  enableExecLog: boolean;
  /** Vault-relative folder for skillpacks (used to host the .exec-log.jsonl). */
  skillpackFolder: string;
  excludedFolders: string[];
}

const SAVE_TARGETS: Record<string, string> = {
  feedback: "피드백",
  revising: "퇴고 메모",
  materials: "자료",
  draft: "초안",
  plan: "기획",
};

function saveSectionFor(saveTo: string): string {
  return SAVE_TARGETS[saveTo] ?? "피드백";
}

/** Minimal info passed to the host's confirm callback. */
export interface ConfirmRequest {
  action: PipelineAction;
  prompt: string;
  adapterName: string;
}

/** Result of the host's confirm callback. */
export interface ConfirmResponse {
  proceed: boolean;
  /** If true, suppress further confirms in this session. */
  skipForSession?: boolean;
}

/** Info passed to the host's preview callback. */
export interface PreviewRequest {
  action: PipelineAction;
  resultText: string;
  durationMs: number;
  contextStats: { sources: number; totalChars: number; truncated: boolean };
  adapterName: string;
  /** Human label for the save button (e.g., "피드백 탭에 저장"). */
  saveButtonLabel: string;
}

export interface PipelineDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  frontmatter: FrontmatterAdapter;
  sink: ResultSink;
  bridge: LocalAIBridge;
  settings: PipelineSettings;
  composer: ContextComposer;
  /** Mutable runtime flag — when true, suppress confirm modal for this session. */
  sessionFlags: { suppressConfirm: boolean };
  /** Host-supplied UI hooks. */
  confirmRun?: (req: ConfirmRequest) => Promise<ConfirmResponse>;
  previewResult?: (req: PreviewRequest) => Promise<ResultChoice>;
  askForUserInput?: (action: PipelineAction) => Promise<string | null>;
}

/** Convenience builder for tests and host code that wants the default composer. */
export function buildPipelineComposer(deps: ContextComposerDeps): ContextComposer {
  return new ContextComposer(deps);
}

export interface RunInput {
  /** Vault-relative path of the project file. */
  projectPath: string;
  /** Display title — typically the basename without `.md`. */
  projectTitle: string;
}

export class ResultPipeline {
  constructor(private deps: PipelineDeps) {}

  /** Run a single action against the given project. */
  async run(action: PipelineAction, input: RunInput): Promise<void> {
    // 0. License gate (Phase 3). Free / phase 2 actions pass automatically.
    const license = action.license;
    if (license && license.kind !== "ok" && license.kind !== "free") {
      this.deps.notice.warn(
        `라이선스 필요: ${"reason" in license ? license.reason : "라이선스 확인 실패"}`,
      );
      return;
    }

    // 1. Availability check
    if (!(await this.deps.bridge.isAvailable())) {
      this.deps.notice.warn(
        `${this.deps.bridge.displayName}이(가) 설치되어 있지 않습니다. 설정에서 경로를 지정하세요.`,
      );
      return;
    }

    // 1.5. Optional user-input prompt (skillpack actions can request this).
    let userInput: string | undefined;
    if (action.requiresUserInput) {
      if (!this.deps.askForUserInput) {
        this.deps.notice.warn(
          `이 액션은 사용자 입력을 요구하지만, askForUserInput이 등록되지 않았습니다.`,
        );
        return;
      }
      const got = await this.deps.askForUserInput(action);
      if (got === null) return; // user cancelled
      userInput = got;
    }

    // 2. Compose context
    const composed = await this.deps.composer.compose({
      projectPath: input.projectPath,
      projectTitle: input.projectTitle,
      sectionAnchor: action.sectionAnchor,
      userInput,
      action,
      excludedFolders: this.deps.settings.excludedFolders,
    });

    // 3. Confirm (unless suppressed)
    const confirmNeeded =
      this.deps.settings.confirmBeforeRun &&
      !this.deps.sessionFlags.suppressConfirm;
    if (confirmNeeded && this.deps.confirmRun) {
      const resp = await this.deps.confirmRun({
        action,
        prompt: composed.prompt,
        adapterName: this.deps.bridge.displayName,
      });
      if (!resp.proceed) return;
      if (resp.skipForSession) this.deps.sessionFlags.suppressConfirm = true;
    }

    // 4. Invoke with progress notice + abort
    const ctrl = new AbortController();
    const start = Date.now();
    this.deps.notice.info(`${this.deps.bridge.displayName} 호출 중…`);

    let result;
    try {
      const ctx: AIInvokeContext = {
        prompt: composed.prompt,
        signal: ctrl.signal,
        actionId: action.id,
        projectPath: input.projectPath,
      };
      result = await this.deps.bridge.invoke(ctx);
    } catch (e) {
      if (e instanceof AIBridgeInvocationError) {
        this.deps.notice.error(`AI 호출 실패: ${e.detail.message}`);
      } else {
        this.deps.notice.error(`AI 호출 실패: ${(e as Error).message}`);
      }
      log.error("ResultPipeline invoke error", e);
      return;
    }

    // 5. Exec log (best-effort, opt-in)
    if (this.deps.settings.enableExecLog) {
      void this.appendExecLog({
        timestamp: new Date().toISOString(),
        actionId: action.id,
        projectPath: input.projectPath,
        promptChars: composed.prompt.length,
        prompt: composed.prompt,
        result: result.text.slice(0, 2000),
        durationMs: result.durationMs,
        exitCode: result.exitCode,
      });
    }

    // 6. Show preview via host. If no host hook, default = save.
    let choice: ResultChoice;
    if (this.deps.previewResult) {
      choice = await this.deps.previewResult({
        action,
        resultText: result.text,
        durationMs: result.durationMs,
        contextStats: composed.contextStats,
        adapterName: this.deps.bridge.displayName,
        saveButtonLabel: `${saveSectionFor(action.saveTo)} 탭에 저장`,
      });
    } else {
      choice = "save";
    }

    // 7. Carry out the choice
    await this.applyChoice(choice, action, input.projectPath, result.text);

    // 8. History trail
    if (choice === "save" || choice === "insert" || choice === "copy") {
      await this.appendHistory(input, action, result.text, Date.now() - start);
    }
  }

  private async applyChoice(
    choice: ResultChoice,
    action: PipelineAction,
    projectPath: string,
    text: string,
  ): Promise<void> {
    if (choice === "discard" || choice === "copy") return;
    if (choice === "save") {
      const section = saveSectionFor(action.saveTo);
      const stamp = formatTimestamp(new Date());
      const heading = `### ${stamp} — ${action.label}`;
      await this.deps.sink.appendUnderSection(projectPath, section, text, heading);
      this.deps.notice.info(`${section} 탭에 저장되었습니다.`);
      return;
    }
    if (choice === "insert") {
      if (this.deps.sink.insertAtCursor) {
        try {
          await this.deps.sink.insertAtCursor(text);
          this.deps.notice.info("결과를 커서 위치에 삽입했습니다.");
        } catch (e) {
          this.deps.notice.warn(
            `삽입할 수 없습니다: ${(e as Error).message}`,
          );
        }
      } else {
        this.deps.notice.warn(
          "현재 환경에서 커서 삽입을 지원하지 않습니다.",
        );
      }
    }
  }

  /** Append the call to <project>.ams-history.md. Creates if missing. */
  private async appendHistory(
    input: RunInput,
    action: PipelineAction,
    text: string,
    durationMs: number,
  ): Promise<void> {
    const historyPath = input.projectPath.replace(/\.md$/i, "") + ".ams-history.md";
    const stamp = formatTimestamp(new Date());
    const entry =
      `## ${stamp} — ${action.label} (${action.id})\n` +
      `소요: ${(durationMs / 1000).toFixed(1)}s · 어댑터: ${this.deps.bridge.displayName}\n\n` +
      `${text.trim()}\n\n---\n\n`;

    if (await this.deps.vault.fileExists(historyPath)) {
      const prev = await this.deps.vault.readFile(historyPath);
      await this.deps.vault.writeFile(historyPath, prev + entry);
      return;
    }
    const header =
      `# ${input.projectTitle} — AI 실행 이력\n\n` +
      `이 파일은 자동 생성됩니다. AI 호출의 입출력 흔적을 남깁니다.\n\n`;
    await this.deps.vault.writeFile(historyPath, header + entry);
  }

  /** Append one JSONL line to <skillpackFolder>/.exec-log.jsonl. */
  private async appendExecLog(record: Record<string, unknown>): Promise<void> {
    try {
      const folder = this.deps.settings.skillpackFolder || "_skillpacks";
      const logPath = `${folder}/.exec-log.jsonl`;
      const line = JSON.stringify(record) + "\n";
      if (await this.deps.vault.fileExists(logPath)) {
        const prev = await this.deps.vault.readFile(logPath);
        await this.deps.vault.writeFile(logPath, prev + line);
        return;
      }
      await this.deps.vault.ensureDir(folder);
      await this.deps.vault.writeFile(logPath, line);
    } catch (e) {
      log.warn("exec-log write failed", e);
    }
  }
}

function formatTimestamp(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd} ${hh}:${mm}`;
}
