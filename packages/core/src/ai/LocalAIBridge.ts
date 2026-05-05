// LocalAIBridge — abstraction over a local CLI that takes a prompt over stdin
// and returns a single text completion on stdout.
//
// Adapters: CodexCLIAdapter (default), ClaudeCodeAdapter (opt-in).
// The adapter is selected by `settings.aiProvider`.

export interface AIInvokeContext {
  /** Fully composed prompt to send to the CLI. */
  prompt: string;
  /** Optional cancellation. The adapter MUST honor this. */
  signal?: AbortSignal;
  // Metadata for logging only — never used to mutate state.
  actionId: string;
  projectPath: string;
}

export interface AIResult {
  text: string;
  durationMs: number;
  exitCode: number;
}

export type AIProviderId = "codex" | "claude-code";

export interface LocalAIBridge {
  readonly id: AIProviderId;
  readonly displayName: string;
  /** Fast probe: does the CLI exist and is it executable? */
  isAvailable(): Promise<boolean>;
  invoke(ctx: AIInvokeContext): Promise<AIResult>;
}

/** Typed errors emitted by adapters. Caller may switch on `kind`. */
export type AIBridgeError =
  | { kind: "not-found"; message: string }
  | { kind: "timeout"; message: string; durationMs: number }
  | { kind: "exit"; message: string; exitCode: number; stderrTail: string }
  | { kind: "aborted"; message: string }
  | { kind: "spawn"; message: string };

export class AIBridgeInvocationError extends Error {
  constructor(public detail: AIBridgeError) {
    super(detail.message);
    this.name = "AIBridgeInvocationError";
  }
}
