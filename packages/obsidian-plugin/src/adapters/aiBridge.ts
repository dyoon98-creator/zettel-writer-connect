// aiBridge.ts — Tauri 의 ai_invoke / ai_cancel 을 Node child_process.spawn
// 기반으로 옵시디언 환경(Electron renderer)에서 재구현.
//
// 원본 Rust 구현(apps/desktop/src-tauri/src/ai_bridge.rs)의 의도를 1:1 로
// 보존한다:
//   - codex 인 경우 tempdir 격리 + `--output-last-message <file>` 사용
//   - 60초 (또는 caller 지정) 타임아웃 → SIGTERM → 2초 grace → SIGKILL
//   - stderr 는 마지막 2KB 만 보관해 에러 메시지에 첨부
//   - stdout 라인 단위 token 스트리밍 (라인 끝에 \n 추가)
//   - codex 실패 시 JSONL 에서 사람이 읽을 수 있는 사유 추출
//
// streamingHandle.ts 의 export 시그니처(`StreamingHandle`, `startAiInvocation`)
// 를 그대로 모방하여 UI 가 import 경로만 바꾸면 동작하도록 설계.

import { electronRequire } from "./electronBridge";
import { getExpandedPathString } from "./findBinary";

const STDERR_TAIL_BYTES = 2 * 1024;
const KILL_GRACE_MS = 2_000;
const CODEX_DEFAULT_MODEL = "gpt-5.4";

export interface StartAiInvocationInput {
  provider: "codex" | "claude-code" | "mock";
  binaryPath: string;
  extraArgs: string[];
  prompt: string;
  timeoutSecs?: number;
  signal?: AbortSignal;
}

export interface AiInvocationResult {
  fullText: string;
  durationMs: number;
  exitCode: number;
}

export interface AiInvocationError extends Error {
  kind: "ai-error";
  message: string;
  stderr: string;
}

export interface StreamingHandle {
  invocationId: string;
  tokens: () => AsyncIterable<string>;
  done: Promise<AiInvocationResult>;
  cancel: () => Promise<void>;
}

class AiInvocationErrorImpl extends Error {
  kind = "ai-error" as const;
  stderr: string;
  constructor(message: string, stderr: string) {
    super(message);
    this.name = "AiInvocationError";
    this.stderr = stderr;
  }
}

function newInvocationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `inv-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

interface CodexCtx {
  workDir: string;
  lastMsgPath: string;
}

function buildCodexCtx(): CodexCtx {
  const os = electronRequire<typeof import("node:os")>("node:os") ??
    electronRequire<typeof import("os")>("os");
  const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  const path = electronRequire<typeof import("node:path")>("node:path") ??
    electronRequire<typeof import("path")>("path");
  if (!os || !fs || !path) {
    throw new Error("Node tempdir 모듈을 사용할 수 없습니다 (모바일 환경?).");
  }
  const stamp = Date.now() * 1_000_000 + Math.floor(Math.random() * 1_000_000);
  const workDir = path.join(os.tmpdir(), `ai-manuscript-codex-${stamp}`);
  fs.mkdirSync(workDir, { recursive: true });
  return { workDir, lastMsgPath: path.join(workDir, "last-message.txt") };
}

export function buildCodexArgs(ctx: CodexCtx, extra: string[]): string[] {
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "-s",
    "read-only",
    "-C",
    ctx.workDir,
    "--output-last-message",
    ctx.lastMsgPath,
  ];
  const userHasModel = extra.some((a) => a === "-m" || a === "--model");
  if (!userHasModel) args.push("-m", CODEX_DEFAULT_MODEL);
  for (const a of extra) if (a) args.push(a);
  args.push("-");
  return args;
}

/** stdout JSONL 의 역방향 스캔으로 마지막 의미 있는 message text 추출. */
export function extractLastCodexMessage(stdout: string): string | null {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const v = JSON.parse(line) as Record<string, unknown>;
      const msg =
        (typeof v.message === "string" && v.message) ||
        (typeof v.output === "string" && v.output) ||
        (typeof (v.turn as { message?: unknown } | undefined)?.message ===
          "string"
          ? ((v.turn as { message: string }).message as string)
          : "");
      if (msg) return msg;
    } catch {
      /* not JSON */
    }
  }
  return null;
}

export function extractCodexFailureReason(stdout: string): string | null {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let v: Record<string, unknown>;
    try {
      v = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const ty = typeof v.type === "string" ? v.type : "";
    if (ty !== "error" && ty !== "turn.failed") continue;
    const msg =
      (typeof v.message === "string" && (v.message as string)) ||
      (typeof (v.error as { message?: unknown } | undefined)?.message ===
        "string"
        ? ((v.error as { message: string }).message as string)
        : "");
    if (!msg) continue;
    // 중첩 JSON 메시지일 수도.
    try {
      const inner = JSON.parse(msg) as Record<string, unknown>;
      const innerMsg = (inner.error as { message?: unknown } | undefined)
        ?.message;
      if (typeof innerMsg === "string") return innerMsg;
    } catch {
      /* msg 는 평문 */
    }
    return msg.length > 240 ? `${msg.slice(0, 240)}...` : msg;
  }
  return null;
}

interface SpawnedProcess {
  pid?: number;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill: (signal?: string) => boolean;
  on: (event: "exit", listener: (code: number | null) => void) => void;
}

function spawnProcess(binaryPath: string, args: string[]): SpawnedProcess {
  const cp = electronRequire<typeof import("node:child_process")>(
    "node:child_process",
  ) ?? electronRequire<typeof import("child_process")>("child_process");
  if (!cp) {
    throw new Error("Node child_process 를 사용할 수 없습니다 (모바일 환경?).");
  }
  // 옵시디언이 GUI 앱이라 PATH 가 launchd 의 짧은 것 (보통 /usr/bin:/bin:/...)
  // 만 가진다. codex 같은 Node CLI 는 shebang `#!/usr/bin/env node` 라
  // 자식 프로세스가 PATH 에서 node 를 못 찾아 exit 127 (env: node: No such
  // file or directory) 로 죽는다. login shell 로 확장된 PATH 를 env 로
  // 전달해 자식 프로세스가 nvm/homebrew/.bun/.cargo 등의 node 를 찾을 수
  // 있게 한다. (findBinary 가 이미 캐싱한 PATH 재사용)
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  const baseEnv: Record<string, string> = {};
  if (proc) {
    for (const [k, v] of Object.entries(proc.env)) {
      if (typeof v === "string") baseEnv[k] = v;
    }
  }
  baseEnv.PATH = getExpandedPathString();

  const child = cp.spawn(binaryPath, args, {
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
    env: baseEnv,
  });
  return child as unknown as SpawnedProcess;
}

/** stdout 을 line 단위로 yield 하는 비동기 generator. */
async function* readLines(
  stream: NodeJS.ReadableStream,
): AsyncGenerator<string> {
  let buf = "";
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let idx = buf.indexOf("\n");
    while (idx >= 0) {
      yield buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      idx = buf.indexOf("\n");
    }
  }
  if (buf.length > 0) yield buf;
}

export function startAiInvocation(input: StartAiInvocationInput): StreamingHandle {
  const invocationId = newInvocationId();
  const tokenQueue: string[] = [];
  type TokenResolver = (
    v: { value: string; done: false } | { value: undefined; done: true },
  ) => void;
  let tokenResolver: TokenResolver | null = null;
  let finished = false;
  let errorState: Error | null = null;

  let resolveDone!: (r: AiInvocationResult) => void;
  let rejectDone!: (e: Error) => void;
  const donePromise = new Promise<AiInvocationResult>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  donePromise.catch(() => {
    /* swallow unhandled rejection — caller is responsible */
  });

  let child: SpawnedProcess | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = (err: Error | null): void => {
    if (finished) return;
    finished = true;
    if (err) errorState = err;
    if (tokenResolver) {
      const fn = tokenResolver;
      tokenResolver = null;
      fn({ value: undefined, done: true });
    }
    if (killTimer) clearTimeout(killTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
  };

  const cancel = async (): Promise<void> => {
    if (finished) return;
    if (child) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* swallow */
      }
      killTimer = setTimeout(() => {
        try {
          child?.kill("SIGKILL");
        } catch {
          /* swallow */
        }
      }, KILL_GRACE_MS);
    }
    const err = new AiInvocationErrorImpl("사용자가 취소했습니다.", "");
    finish(err);
    rejectDone(err);
  };

  void (async () => {
    const start = Date.now();
    const timeoutSecs = Math.max(1, input.timeoutSecs ?? 180);

    let codexCtx: CodexCtx | null = null;
    let args: string[];
    try {
      if (input.provider === "codex") {
        codexCtx = buildCodexCtx();
        args = buildCodexArgs(codexCtx, input.extraArgs);
      } else {
        args = [...input.extraArgs];
      }
    } catch (e) {
      const err = new AiInvocationErrorImpl(
        `작업 디렉터리 생성 실패: ${(e as Error).message}`,
        "",
      );
      finish(err);
      rejectDone(err);
      return;
    }

    try {
      child = spawnProcess(input.binaryPath, args);
    } catch (e) {
      const err = new AiInvocationErrorImpl(
        `프로세스 시작 실패: ${(e as Error).message}`,
        "",
      );
      finish(err);
      rejectDone(err);
      return;
    }

    // stdin 으로 prompt 주입 후 닫기.
    if (child.stdin) {
      try {
        child.stdin.write(input.prompt);
        child.stdin.end();
      } catch (e) {
        const err = new AiInvocationErrorImpl(
          `stdin 쓰기 실패: ${(e as Error).message}`,
          "",
        );
        try {
          child.kill("SIGTERM");
        } catch {
          /* swallow */
        }
        finish(err);
        rejectDone(err);
        return;
      }
    }

    let stdoutAcc = "";
    let stderrTail = "";
    const stdoutStream = child.stdout;
    const stderrStream = child.stderr;

    const pushToken = (token: string): void => {
      const fn = tokenResolver;
      if (fn) {
        tokenResolver = null;
        fn({ value: token, done: false });
      } else {
        tokenQueue.push(token);
      }
    };

    const stdoutTask = (async (): Promise<void> => {
      if (!stdoutStream) return;
      for await (const line of readLines(stdoutStream)) {
        if (finished) break;
        const token = `${line}\n`;
        stdoutAcc += token;
        pushToken(token);
      }
    })();

    const stderrTask = (async (): Promise<void> => {
      if (!stderrStream) return;
      for await (const line of readLines(stderrStream)) {
        stderrTail += `${line}\n`;
        if (stderrTail.length > STDERR_TAIL_BYTES * 2) {
          stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
        }
      }
      if (stderrTail.length > STDERR_TAIL_BYTES) {
        stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
      }
    })();

    // 타임아웃 가드.
    timeoutTimer = setTimeout(() => {
      if (finished || !child) return;
      try {
        child.kill("SIGTERM");
      } catch {
        /* swallow */
      }
      killTimer = setTimeout(() => {
        try {
          child?.kill("SIGKILL");
        } catch {
          /* swallow */
        }
      }, KILL_GRACE_MS);
    }, timeoutSecs * 1_000);

    // signal abort → cancel.
    if (input.signal) {
      if (input.signal.aborted) void cancel();
      else input.signal.addEventListener("abort", () => void cancel(), { once: true });
    }

    const exitCode = await new Promise<number>((res) => {
      child!.on("exit", (code) => res(typeof code === "number" ? code : -1));
    });
    await stdoutTask;
    await stderrTask;

    if (finished) return; // 이미 cancel/timeout 으로 종료된 경우.

    const durationMs = Date.now() - start;

    // codex 인 경우 진짜 응답은 last-message.txt 에 있다.
    let fullText = stdoutAcc;
    if (codexCtx) {
      try {
        const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
          electronRequire<typeof import("fs")>("fs");
        if (fs) {
          const s = fs.readFileSync(codexCtx.lastMsgPath, "utf8");
          if (s.trim()) fullText = s;
          else
            fullText = extractLastCodexMessage(stdoutAcc) ?? stdoutAcc;
        } else {
          fullText = extractLastCodexMessage(stdoutAcc) ?? stdoutAcc;
        }
      } catch {
        fullText = extractLastCodexMessage(stdoutAcc) ?? stdoutAcc;
      }
    }

    if (exitCode === 0) {
      const result: AiInvocationResult = { fullText, durationMs, exitCode };
      finish(null);
      resolveDone(result);
    } else {
      const reason = codexCtx
        ? extractCodexFailureReason(stdoutAcc) ?? stderrTail
        : stderrTail;
      const err = new AiInvocationErrorImpl(
        `AI 호출 실패 (exit ${exitCode}): ${reason || "사유 미상"}`,
        stderrTail,
      );
      finish(err);
      rejectDone(err);
    }
  })();

  const tokens = (): AsyncIterable<string> => ({
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          if (errorState) return Promise.reject(errorState);
          if (tokenQueue.length > 0) {
            const value = tokenQueue.shift()!;
            return Promise.resolve({ value, done: false });
          }
          if (finished) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => {
            tokenResolver = (r) => {
              if (errorState) {
                resolve({ value: undefined, done: true });
                return;
              }
              resolve(r as IteratorResult<string>);
            };
          });
        },
      };
    },
  });

  return {
    invocationId,
    tokens,
    done: donePromise,
    cancel,
  };
}
