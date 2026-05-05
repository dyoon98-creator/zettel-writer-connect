// Integration tests for CodexCLIAdapter using a dummy CLI that mimics codex.

import * as path from "node:path";
import {
  AIBridgeInvocationError,
  CodexCLIAdapter,
} from "../src/ai";

const FIXTURE = path.join(
  __dirname,
  "fixtures",
  "dummy-codex.mjs",
);

function makeAdapter(extraArgs: string, timeoutMs?: number): CodexCLIAdapter {
  return new CodexCLIAdapter({
    binaryPath: FIXTURE,
    extraArgs,
    timeoutMs,
  });
}

describe("CodexCLIAdapter", () => {
  it("captures stdout on a successful invocation", async () => {
    const a = makeAdapter("--ok");
    const r = await a.invoke({
      prompt: "ignored",
      actionId: "test.ok",
      projectPath: "x.md",
    });
    expect(r.exitCode).toBe(0);
    expect(r.text).toContain("OK output");
    expect(r.text).toContain("line2");
    expect(typeof r.durationMs).toBe("number");
  });

  it("rejects with an exit error when the CLI exits non-zero", async () => {
    const a = makeAdapter("--fail");
    await expect(
      a.invoke({ prompt: "x", actionId: "test.fail", projectPath: "x.md" }),
    ).rejects.toMatchObject({
      detail: expect.objectContaining({ kind: "exit", exitCode: 2 }),
    });
    try {
      await a.invoke({ prompt: "x", actionId: "test.fail", projectPath: "x.md" });
    } catch (e) {
      expect(e).toBeInstanceOf(AIBridgeInvocationError);
      const detail = (e as AIBridgeInvocationError).detail;
      if (detail.kind !== "exit") throw new Error("expected exit kind");
      expect(detail.stderrTail).toContain("boom");
    }
  });

  it("rejects with timeout when the CLI runs too long", async () => {
    const a = makeAdapter("--slow", 500);
    await expect(
      a.invoke({ prompt: "x", actionId: "test.slow", projectPath: "x.md" }),
    ).rejects.toMatchObject({
      detail: expect.objectContaining({ kind: "timeout" }),
    });
  }, 8000);

  it("aborts mid-flight when the AbortSignal fires", async () => {
    const a = makeAdapter("--slow");
    const ctrl = new AbortController();
    const promise = a.invoke({
      prompt: "x",
      actionId: "test.abort",
      projectPath: "x.md",
      signal: ctrl.signal,
    });
    setTimeout(() => ctrl.abort(), 100);
    await expect(promise).rejects.toMatchObject({
      detail: expect.objectContaining({ kind: "aborted" }),
    });
  }, 8000);

  it("round-trips the prompt through stdin (--echo)", async () => {
    const a = makeAdapter("--echo");
    const prompt = "안녕하세요\n두 번째 줄";
    const r = await a.invoke({
      prompt,
      actionId: "test.echo",
      projectPath: "x.md",
    });
    expect(r.text).toBe(prompt);
  });

  it("isAvailable returns true for an explicit, valid binary path", async () => {
    const a = makeAdapter("");
    expect(await a.isAvailable()).toBe(true);
  });

  it("isAvailable returns false for a bogus binary path", async () => {
    const a = new CodexCLIAdapter({
      binaryPath: "/no/such/path/__not_a_binary__",
      extraArgs: "",
    });
    expect(await a.isAvailable()).toBe(false);
  });
});
