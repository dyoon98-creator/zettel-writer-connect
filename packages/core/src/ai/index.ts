// AI barrel — public exports for the bridge implementations and pipeline.

export { CodexCLIAdapter, splitArgs } from "./CodexCLIAdapter";
export type { CodexCLIAdapterOptions } from "./CodexCLIAdapter";
export { ClaudeCodeAdapter } from "./ClaudeCodeAdapter";
export type {
  LocalAIBridge,
  AIInvokeContext,
  AIResult,
  AIProviderId,
  AIBridgeError,
} from "./LocalAIBridge";
export { AIBridgeInvocationError } from "./LocalAIBridge";

export { ContextComposer, render, sliceH2Section, stripFrontmatter, parseWikiLink, matchesExcludedFolder } from "./ContextComposer";
export type {
  ContextComposerDeps,
  ComposeInput,
  ComposedContext,
  ContextStats,
  MinimalAction,
  WikiResolver,
} from "./ContextComposer";

export { ResultPipeline, buildPipelineComposer } from "./ResultPipeline";
export type {
  PipelineAction,
  PipelineDeps,
  PipelineSettings,
  ResultChoice,
  ConfirmRequest,
  ConfirmResponse,
  PreviewRequest,
  RunInput,
} from "./ResultPipeline";

export { PHASE2_ACTIONS, findAction } from "./Phase2Actions";

export type AIProviderSettings = {
  aiProvider: "codex" | "claude-code";
  codexPath: string;
  codexExtraArgs: string;
  claudeCodePath: string;
};

import { CodexCLIAdapter } from "./CodexCLIAdapter";
import { ClaudeCodeAdapter } from "./ClaudeCodeAdapter";
import type { LocalAIBridge } from "./LocalAIBridge";

/** Pick Codex or Claude Code based on settings.aiProvider. */
export function createBridge(settings: AIProviderSettings): LocalAIBridge {
  if (settings.aiProvider === "claude-code") {
    return new ClaudeCodeAdapter({
      binaryPath: settings.claudeCodePath,
      extraArgs: settings.codexExtraArgs,
    });
  }
  return new CodexCLIAdapter({
    binaryPath: settings.codexPath,
    extraArgs: settings.codexExtraArgs,
  });
}
