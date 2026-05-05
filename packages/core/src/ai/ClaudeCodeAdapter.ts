// ClaudeCodeAdapter — thin variant of CodexCLIAdapter that runs `claude`.
// Same spawn/stdin/stdout shape; differs only in binary name + display id.

import { CodexCLIAdapter } from "./CodexCLIAdapter";

export class ClaudeCodeAdapter extends CodexCLIAdapter {
  constructor(opts: { binaryPath: string; extraArgs: string; timeoutMs?: number }) {
    super({
      binaryPath: opts.binaryPath,
      extraArgs: opts.extraArgs,
      timeoutMs: opts.timeoutMs,
      binaryName: "claude",
      id: "claude-code",
      displayName: "Claude Code CLI",
    });
  }
}
