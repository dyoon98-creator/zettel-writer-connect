// tauriAIBridge.test.ts — TauriAIBridge / streamingHandle 행동 검증.
//
// mockInvoke 가 ai_invoke 호출 시 setTimeout 으로 ai:token / ai:done 을 emit.
// listen() 은 채널 + 핸들러를 등록하므로, 실제 Rust 백엔드 없이도 토큰 흐름을
// 시뮬레이션할 수 있다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAiScript,
  installTauriMocks,
  mockInvoke,
  setAiBinaryAvailable,
  setAiScript,
} from "../__mocks__/tauri";

installTauriMocks();

import { startAiInvocation } from "../../src/ai/streamingHandle";
import { TauriAIBridge } from "../../src/ai/tauriAIBridge";

beforeEach(() => {
  clearAiScript();
  setAiBinaryAvailable(true);
  mockInvoke.mockClear();
});

afterEach(() => {
  clearAiScript();
});

describe("streamingHandle", () => {
  it("yields tokens in order and resolves done with fullText", async () => {
    setAiScript([
      { kind: "token", token: "안" },
      { kind: "token", token: "녕" },
      { kind: "done", fullText: "안녕", durationMs: 42, exitCode: 0 },
    ]);

    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/usr/local/bin/codex",
      extraArgs: [],
      prompt: "hi",
    });

    const tokens: string[] = [];
    for await (const t of handle.tokens()) {
      tokens.push(t);
    }
    const result = await handle.done;

    expect(tokens).toEqual(["안", "녕"]);
    expect(result.fullText).toBe("안녕");
    expect(result.exitCode).toBe(0);
  });

  it("rejects done on error event", async () => {
    setAiScript([
      { kind: "error", message: "프로세스 시작 실패" },
    ]);

    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/x/y",
      extraArgs: [],
      prompt: "hi",
    });

    let caught: Error | null = null;
    try {
      await handle.done;
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught?.message).toMatch(/프로세스 시작 실패/);
  });

  it("cancel() invokes ai_cancel and rejects done", async () => {
    setAiScript([{ kind: "token", token: "x" }]); // never-ending stream-ish

    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/x",
      extraArgs: [],
      prompt: "hi",
    });
    await handle.cancel();
    await expect(handle.done).rejects.toThrow();
    expect(mockInvoke).toHaveBeenCalledWith(
      "ai_cancel",
      expect.objectContaining({ invocationId: handle.invocationId }),
    );
  });

  it("AbortSignal abort triggers ai_cancel", async () => {
    setAiScript([{ kind: "token", token: "x" }]);
    const ctrl = new AbortController();
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/x",
      extraArgs: [],
      prompt: "hi",
      signal: ctrl.signal,
    });
    ctrl.abort();
    await expect(handle.done).rejects.toThrow();
    const cancelCalled = mockInvoke.mock.calls.some(
      (c) => c[0] === "ai_cancel" && (c[1] as { invocationId: string }).invocationId === handle.invocationId,
    );
    expect(cancelCalled).toBe(true);
  });
});

describe("TauriAIBridge", () => {
  it("isAvailable() honors ai_resolve_binary", async () => {
    setAiBinaryAvailable(true);
    const bridge = new TauriAIBridge({
      providerId: "codex",
      displayName: "Codex CLI",
      binaryPath: "/usr/bin/codex",
      extraArgs: "",
    });
    expect(await bridge.isAvailable()).toBe(true);

    // 5초 캐시를 우회하기 위해 새 인스턴스로 false 검증.
    setAiBinaryAvailable(false);
    const bridge2 = new TauriAIBridge({
      providerId: "codex",
      displayName: "Codex CLI",
      binaryPath: "/missing",
      extraArgs: "",
    });
    expect(await bridge2.isAvailable()).toBe(false);
  });

  it("invoke() returns AIResult on done", async () => {
    setAiScript([
      { kind: "token", token: "hi " },
      { kind: "token", token: "there" },
      { kind: "done", fullText: "hi there", durationMs: 100, exitCode: 0 },
    ]);
    const bridge = new TauriAIBridge({
      providerId: "codex",
      displayName: "Codex CLI",
      binaryPath: "/c",
      extraArgs: "",
    });
    const r = await bridge.invoke({
      prompt: "p",
      actionId: "phase2.first-sentence",
      projectPath: "demo/scene.md",
    });
    expect(r.text).toBe("hi there");
    expect(r.durationMs).toBe(100);
    expect(r.exitCode).toBe(0);
  });

  it("invoke() throws AIBridgeInvocationError on error event", async () => {
    setAiScript([{ kind: "error", message: "CLI 종료 코드 2" }]);
    const bridge = new TauriAIBridge({
      providerId: "codex",
      displayName: "Codex CLI",
      binaryPath: "/c",
      extraArgs: "",
    });
    await expect(
      bridge.invoke({
        prompt: "p",
        actionId: "x",
        projectPath: "demo/a.md",
      }),
    ).rejects.toThrow(/CLI 종료 코드/);
  });
});
