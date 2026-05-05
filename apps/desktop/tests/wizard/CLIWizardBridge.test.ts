// CLIWizardBridge.test.ts — askNext 의 토큰 yield + summarize JSON 파싱.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WizardEngine } from "@ai-manuscript-studio/core";
import {
  clearAiScript,
  installTauriMocks,
  setAiScript,
} from "../__mocks__/tauri";

installTauriMocks();

import { CLIWizardBridge, buildMotivePrompt } from "../../src/wizard/CLIWizardBridge";

beforeEach(() => clearAiScript());
afterEach(() => clearAiScript());

describe("CLIWizardBridge", () => {
  it("askNext 가 토큰을 순서대로 yield 한다", async () => {
    setAiScript([
      { kind: "token", token: "안" },
      { kind: "token", token: "녕" },
      { kind: "done", fullText: "안녕", durationMs: 10, exitCode: 0 },
    ]);
    const bridge = new CLIWizardBridge({
      provider: "codex",
      binaryPath: "/c",
      extraArgs: "",
    });
    const engine = new WizardEngine();
    const got: string[] = [];
    for await (const t of bridge.askNext(engine.session)) {
      got.push(t);
    }
    expect(got.join("")).toBe("안녕");
  });

  it("summarize 가 JSON 응답을 파싱한다", async () => {
    setAiScript([
      {
        kind: "done",
        fullText: JSON.stringify({
          summary: "독자: 30대 직장인 / 메시지: AI는 작가를 대체하지 않는다",
          decisions: { motive: "AI 도구 부재" },
        }),
        durationMs: 5,
        exitCode: 0,
      },
    ]);
    const bridge = new CLIWizardBridge({
      provider: "codex",
      binaryPath: "/c",
      extraArgs: "",
    });
    const engine = new WizardEngine();
    engine.addMessage("user", "동기 답변");
    const out = await bridge.summarize(engine.session, "stage");
    expect(out.summary).toMatch(/30대 직장인/);
    expect(out.decisions.motive).toBe("AI 도구 부재");
  });

  it("summarize 가 final 모드에서 structure 배열을 추출한다", async () => {
    const finalJson = JSON.stringify({
      summary: "summary",
      decisions: {
        motive: "m",
        target_reader: "r",
        core_message: "c",
        tone: "t",
      },
      structure: [
        { id: "chap-1", title: "도입", synopsis: "s1" },
        { id: "chap-2", title: "전개", synopsis: "s2" },
        { id: "chap-3", title: "절정", synopsis: "s3" },
        { id: "chap-4", title: "결말", synopsis: "s4" },
      ],
    });
    setAiScript([{ kind: "done", fullText: finalJson, durationMs: 1, exitCode: 0 }]);

    const bridge = new CLIWizardBridge({
      provider: "codex",
      binaryPath: "/c",
      extraArgs: "",
    });
    const engine = new WizardEngine();
    const out = await bridge.summarize(engine.session, "final");
    expect(out.structure).toHaveLength(4);
    expect(out.structure?.[0].title).toBe("도입");
  });

  it("summarize 가 JSON 파싱 실패 시 fallback 으로 mock 사용", async () => {
    setAiScript([{ kind: "done", fullText: "이건 JSON 아니에요", durationMs: 1, exitCode: 0 }]);

    const bridge = new CLIWizardBridge({
      provider: "codex",
      binaryPath: "/c",
      extraArgs: "",
    });
    const engine = new WizardEngine();
    engine.addMessage("user", "사용자 답변");
    const out = await bridge.summarize(engine.session, "stage");
    // mock fallback이 동작했으므로 summary 가 비어 있지 않다.
    expect(typeof out.summary).toBe("string");
    expect(out.summary.length).toBeGreaterThan(0);
  });

  it("buildMotivePrompt 는 transcript / turn count placeholder 를 채운다", () => {
    const engine = new WizardEngine();
    engine.addMessage("user", "이게 첫 답변");
    const p = buildMotivePrompt(engine.session);
    expect(p).toContain("[motive/user] 이게 첫 답변");
    expect(p).toContain("작가가 이번 단계에서 한 답변 수: 1");
  });
});
