// CodexCLIAdapter — desktop-only adapter that spawns the `codex` CLI.
// Prompts go through stdin; results are read from stdout. stderr is captured
// for error reporting only.

import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  AIBridgeInvocationError,
  AIInvokeContext,
  AIProviderId,
  AIResult,
  LocalAIBridge,
} from "./LocalAIBridge";

export interface CodexCLIAdapterOptions {
  /** Absolute path to the CLI binary; if empty, search PATH. */
  binaryPath: string;
  /** Whitespace-separated extra args passed before stdin is opened. */
  extraArgs: string;
  /** Hard timeout for the entire invocation (ms). Defaults to 60000. */
  timeoutMs?: number;
  /** Override the binary name when scanning PATH (used by ClaudeCodeAdapter). */
  binaryName?: string;
  /** Override id/displayName so this class can back ClaudeCodeAdapter. */
  id?: AIProviderId;
  displayName?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const KILL_GRACE_MS = 2_000;
const STDERR_TAIL_BYTES = 2 * 1024;

/** Splits `--model gpt-5  --foo bar` → ["--model", "gpt-5", "--foo", "bar"]. */
export function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export class CodexCLIAdapter implements LocalAIBridge {
  readonly id: AIProviderId;
  readonly displayName: string;
  private readonly binaryName: string;
  private resolvedBinary: string | null = null;
  private resolvedAt = 0;

  constructor(private opts: CodexCLIAdapterOptions) {
    this.id = opts.id ?? "codex";
    this.displayName = opts.displayName ?? "Codex CLI";
    this.binaryName = opts.binaryName ?? "codex";
  }

  /** Cached resolution of the binary path. Returns null if not found. */
  resolveBinary(): string | null {
    // Re-evaluate at most once per 5s so settings changes are picked up.
    const now = Date.now();
    if (this.resolvedBinary && now - this.resolvedAt < 5_000) {
      return this.resolvedBinary;
    }
    this.resolvedAt = now;

    const explicit = this.opts.binaryPath.trim();
    if (explicit) {
      if (this.isExecutable(explicit)) {
        this.resolvedBinary = explicit;
        return explicit;
      }
      this.resolvedBinary = null;
      return null;
    }

    // Search PATH using `which` (POSIX) or `where` (Windows). Avoid throwing.
    const which = process.platform === "win32" ? "where" : "which";
    try {
      const r = spawnSync(which, [this.binaryName], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (r.status === 0 && r.stdout) {
        const first = r.stdout.split(/\r?\n/).find((l) => l.trim().length > 0);
        if (first && this.isExecutable(first.trim())) {
          this.resolvedBinary = first.trim();
          return this.resolvedBinary;
        }
      }
    } catch {
      // fall through
    }

    // Fallback: scan PATH manually.
    const pathEnv = process.env.PATH ?? "";
    const sep = process.platform === "win32" ? ";" : ":";
    const exts = process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
      : [""];
    for (const dir of pathEnv.split(sep)) {
      if (!dir) continue;
      for (const ext of exts) {
        const candidate = path.join(dir, this.binaryName + ext);
        if (this.isExecutable(candidate)) {
          this.resolvedBinary = candidate;
          return candidate;
        }
      }
    }
    this.resolvedBinary = null;
    return null;
  }

  private isExecutable(p: string): boolean {
    try {
      const stat = fs.statSync(p);
      if (!stat.isFile()) return false;
      // On POSIX, also confirm executable bit. On Windows, file existence is enough.
      if (process.platform !== "win32") {
        // eslint-disable-next-line no-bitwise
        if ((stat.mode & 0o111) === 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.resolveBinary() !== null;
  }

  async invoke(ctx: AIInvokeContext): Promise<AIResult> {
    const binary = this.resolveBinary();
    if (!binary) {
      throw new AIBridgeInvocationError({
        kind: "not-found",
        message: `${this.displayName}을(를) 찾을 수 없습니다. 설정에서 경로를 지정하세요.`,
      });
    }

    const timeoutMs = this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const args = splitArgs(this.opts.extraArgs);
    const start = Date.now();

    return new Promise<AIResult>((resolve, reject) => {
      let child;
      try {
        child = spawn(binary, args, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (e) {
        reject(
          new AIBridgeInvocationError({
            kind: "spawn",
            message: `프로세스 시작 실패: ${(e as Error).message}`,
          }),
        );
        return;
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stderrLen = 0;
      let timedOut = false;
      let aborted = false;
      let settled = false;

      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        fn();
      };

      const killTree = (): void => {
        if (!child.killed) {
          try {
            child.kill("SIGTERM");
          } catch {
            /* ignore */
          }
          // Hard kill if it doesn't exit in KILL_GRACE_MS.
          const hardKill = setTimeout(() => {
            if (!child.killed) {
              try {
                child.kill("SIGKILL");
              } catch {
                /* ignore */
              }
            }
          }, KILL_GRACE_MS);
          // Don't keep the event loop alive just to wait for the grace period.
          if (typeof hardKill.unref === "function") hardKill.unref();
        }
      };

      const timer = setTimeout(() => {
        timedOut = true;
        killTree();
      }, timeoutMs);

      const onAbort = (): void => {
        aborted = true;
        killTree();
      };
      if (ctx.signal) {
        if (ctx.signal.aborted) {
          onAbort();
        } else {
          ctx.signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      child.stdout?.on("data", (c: Buffer) => {
        stdoutChunks.push(c);
      });
      child.stderr?.on("data", (c: Buffer) => {
        if (stderrLen < STDERR_TAIL_BYTES * 2) {
          stderrChunks.push(c);
          stderrLen += c.length;
        }
      });

      child.on("error", (e) => {
        clearTimeout(timer);
        if (ctx.signal) ctx.signal.removeEventListener("abort", onAbort);
        settle(() =>
          reject(
            new AIBridgeInvocationError({
              kind: "spawn",
              message: `프로세스 오류: ${(e as Error).message}`,
            }),
          ),
        );
      });

      child.on("close", (code, _signal) => {
        clearTimeout(timer);
        if (ctx.signal) ctx.signal.removeEventListener("abort", onAbort);
        const durationMs = Date.now() - start;

        if (aborted) {
          settle(() =>
            reject(
              new AIBridgeInvocationError({
                kind: "aborted",
                message: "사용자가 취소했습니다.",
              }),
            ),
          );
          return;
        }
        if (timedOut) {
          settle(() =>
            reject(
              new AIBridgeInvocationError({
                kind: "timeout",
                message: `시간 초과 (${Math.round(durationMs / 1000)}s)`,
                durationMs,
              }),
            ),
          );
          return;
        }
        const stdout = Buffer.concat(stdoutChunks).toString("utf8");
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        const tail =
          stderr.length > STDERR_TAIL_BYTES
            ? stderr.slice(stderr.length - STDERR_TAIL_BYTES)
            : stderr;

        const exitCode = code ?? -1;
        if (exitCode !== 0) {
          settle(() =>
            reject(
              new AIBridgeInvocationError({
                kind: "exit",
                message: `CLI 종료 코드 ${exitCode}: ${tail.trim() || "(stderr 없음)"}`,
                exitCode,
                stderrTail: tail,
              }),
            ),
          );
          return;
        }
        settle(() => resolve({ text: stdout, durationMs, exitCode }));
      });

      // Send the prompt and close stdin so the CLI can finish.
      try {
        child.stdin?.write(ctx.prompt);
        child.stdin?.end();
      } catch (e) {
        clearTimeout(timer);
        settle(() =>
          reject(
            new AIBridgeInvocationError({
              kind: "spawn",
              message: `stdin 쓰기 실패: ${(e as Error).message}`,
            }),
          ),
        );
      }
    });
  }
}
