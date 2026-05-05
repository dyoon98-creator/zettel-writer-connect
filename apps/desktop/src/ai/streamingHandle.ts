// streamingHandle.ts — Tauri AI 호출의 토큰 스트림 + 완료/취소를 묶은 헬퍼.
//
// 사용 예 (UI / 마법사 양쪽 공통):
//   const handle = startAiInvocation({ provider, binaryPath, extraArgs, prompt, timeoutSecs });
//   for await (const tok of handle.tokens()) accumulate(tok);
//   const result = await handle.done; // { fullText, durationMs, exitCode }
//   handle.cancel(); // 도중에
//
// 내부적으로:
//   1) listen() 으로 ai:token / ai:done / ai:error 를 invocationId로 필터링
//   2) invoke("ai_invoke", ...) 로 백엔드 trigger
//   3) AbortSignal 또는 cancel() 호출 시 invoke("ai_cancel", ...) 전송

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** 백엔드 ai:token 이벤트 페이로드. (Rust serde rename_all=camelCase) */
interface AiTokenPayload {
  invocationId: string;
  token: string;
}

interface AiDonePayload {
  invocationId: string;
  exitCode: number;
  durationMs: number;
  fullText: string;
}

interface AiErrorPayload {
  invocationId: string;
  message: string;
  stderr: string;
}

export interface StartAiInvocationInput {
  provider: "codex" | "claude-code" | "mock";
  binaryPath: string;
  extraArgs: string[];
  prompt: string;
  timeoutSecs?: number;
  /** 외부 abort. 호출 시 ai_cancel을 전송한다. */
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
  /**
   * 시작된 후 도착한 토큰을 순서대로 yield한다. ai:done 또는 ai:error로
   * 종료될 때까지 await for-of 로 소비.
   * - ai:done 시 정상 완료 (fullText는 done.then 에서 얻을 수 있다).
   * - ai:error 시 throw.
   */
  tokens: () => AsyncIterable<string>;
  /** ai:done의 fullText / 등을 resolve. error면 reject. */
  done: Promise<AiInvocationResult>;
  /** 백엔드에 ai_cancel을 보낸다. */
  cancel: () => Promise<void>;
}

/** crypto.randomUUID()를 그대로 쓰되, 일부 jsdom 환경 호환. */
function newInvocationId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // fallback: 시간 + 난수 16자리
  return `inv-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
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

/**
 * 한 번의 AI 호출을 시작한다. 호출 직후 listener가 등록된 상태로 반환되며,
 * 백엔드는 ai_invoke 응답을 받자마자 비동기로 토큰을 흘려보낸다.
 */
export function startAiInvocation(input: StartAiInvocationInput): StreamingHandle {
  const invocationId = newInvocationId();
  const tokenQueue: string[] = [];
  let tokenResolver: ((v: { value: string; done: false } | { value: undefined; done: true }) => void) | null = null;
  let finished = false;
  let errorState: Error | null = null;

  // done resolver
  let resolveDone: (r: AiInvocationResult) => void;
  let rejectDone: (e: Error) => void;
  const donePromise = new Promise<AiInvocationResult>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  // 일부 호출자(테스트 / 마법사 summarize)가 handle.done 을 await 하지 않을 수 있다.
  // 그 경우 unhandled rejection 으로 보이지 않게 noop catch 를 미리 부착한다.
  // (`.catch()` 는 새 Promise를 반환하므로 원본 Promise 는 그대로 await 가능.)
  donePromise.catch(() => {
    /* swallow — caller is responsible for surfacing the error if they care. */
  });

  let unlistenToken: UnlistenFn | null = null;
  let unlistenDone: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;

  const cleanupListeners = (): void => {
    if (unlistenToken) {
      try {
        unlistenToken();
      } catch {
        /* noop */
      }
      unlistenToken = null;
    }
    if (unlistenDone) {
      try {
        unlistenDone();
      } catch {
        /* noop */
      }
      unlistenDone = null;
    }
    if (unlistenError) {
      try {
        unlistenError();
      } catch {
        /* noop */
      }
      unlistenError = null;
    }
  };

  const finish = (err: Error | null): void => {
    if (finished) return;
    finished = true;
    if (err) errorState = err;
    // 토큰 iterator가 await 중이면 깨운다.
    if (tokenResolver) {
      const fn = tokenResolver;
      tokenResolver = null;
      fn({ value: undefined, done: true });
    }
    cleanupListeners();
  };

  // 1. listener 등록 — invoke 보다 먼저 끝나야 한다.
  const setupPromise = (async () => {
    unlistenToken = await listen<AiTokenPayload>("ai:token", (msg) => {
      if (msg.payload.invocationId !== invocationId) return;
      if (finished) return;
      if (tokenResolver) {
        const fn = tokenResolver;
        tokenResolver = null;
        fn({ value: msg.payload.token, done: false });
      } else {
        tokenQueue.push(msg.payload.token);
      }
    });
    unlistenDone = await listen<AiDonePayload>("ai:done", (msg) => {
      if (msg.payload.invocationId !== invocationId) return;
      if (finished) return;
      const result: AiInvocationResult = {
        fullText: msg.payload.fullText,
        durationMs: msg.payload.durationMs,
        exitCode: msg.payload.exitCode,
      };
      finish(null);
      resolveDone(result);
    });
    unlistenError = await listen<AiErrorPayload>("ai:error", (msg) => {
      if (msg.payload.invocationId !== invocationId) return;
      if (finished) return;
      const err = new AiInvocationErrorImpl(
        msg.payload.message,
        msg.payload.stderr,
      );
      finish(err);
      rejectDone(err);
    });
  })();

  // 2. invoke 호출 — listener 등록 끝난 뒤.
  const invokeStart = async (): Promise<void> => {
    await setupPromise;
    try {
      await invoke("ai_invoke", {
        invocationId,
        provider: input.provider,
        binaryPath: input.binaryPath,
        extraArgs: input.extraArgs,
        prompt: input.prompt,
        timeoutSecs: input.timeoutSecs ?? 180,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const err = new AiInvocationErrorImpl(`AI 호출 시작 실패: ${msg}`, "");
      finish(err);
      rejectDone(err);
    }
  };

  void invokeStart();

  // signal abort → ai_cancel
  if (input.signal) {
    if (input.signal.aborted) {
      void cancel();
    } else {
      input.signal.addEventListener("abort", () => void cancel(), { once: true });
    }
  }

  async function cancel(): Promise<void> {
    if (finished) return;
    try {
      await invoke("ai_cancel", { invocationId });
    } catch {
      /* swallow */
    }
    if (!finished) {
      const err = new AiInvocationErrorImpl("사용자가 취소했습니다.", "");
      finish(err);
      rejectDone(err);
    }
  }

  const tokens = (): AsyncIterable<string> => ({
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          if (errorState) {
            return Promise.reject(errorState);
          }
          if (tokenQueue.length > 0) {
            const value = tokenQueue.shift()!;
            return Promise.resolve({ value, done: false });
          }
          if (finished) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((resolve) => {
            tokenResolver = (r) => {
              if (errorState) {
                // iterator도 에러로 끝낸다.
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
