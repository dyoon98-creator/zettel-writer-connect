// node.ts — Node-only public surface of @ai-manuscript-studio/core.
//
// 이 진입점은 child_process / node:fs / node:crypto 같은 Node 모듈을 쓰는
// 클래스를 노출한다. 옵시디언 메인 프로세스 / Tauri Rust측 / 테스트 환경에서만
// import 한다. 데스크톱 렌더러는 `@ai-manuscript-studio/core` (=browser)를 쓴다.

// Re-export browser-safe surface for caller convenience.
export * from "./browser";

// Node-only AI adapters
export { CodexCLIAdapter, splitArgs } from "./ai/CodexCLIAdapter";
export type { CodexCLIAdapterOptions } from "./ai/CodexCLIAdapter";
export { ClaudeCodeAdapter } from "./ai/ClaudeCodeAdapter";

import { CodexCLIAdapter } from "./ai/CodexCLIAdapter";
import { ClaudeCodeAdapter } from "./ai/ClaudeCodeAdapter";
import type { LocalAIBridge } from "./ai/LocalAIBridge";
import type { AIProviderSettings } from "./browser";

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

// Node-only skillpack
export { LicenseChecker, computeHmac } from "./skillpack/LicenseChecker";
export {
  SkillPackLoader,
  sanitizeManifest,
} from "./skillpack/SkillPackLoader";
