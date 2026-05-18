// aiBridge — codex 응답 파서 순수 함수 단위 테스트.
// 실제 child_process.spawn 호출은 Phase 4 통합 테스트에서 검증.

import {
  buildCodexArgs,
  extractLastCodexMessage,
  extractCodexFailureReason,
} from "../../src/adapters/aiBridge";

describe("buildCodexArgs", () => {
  const ctx = { workDir: "/tmp/codex-xx", lastMsgPath: "/tmp/codex-xx/last-message.txt" };

  test("필수 옵션이 모두 들어간다", () => {
    const args = buildCodexArgs(ctx, []);
    expect(args).toContain("exec");
    expect(args).toContain("--json");
    expect(args).toContain("--ephemeral");
    expect(args).toContain("--skip-git-repo-check");
    expect(args).toContain("-s");
    expect(args).toContain("read-only");
    expect(args).toContain("-C");
    expect(args).toContain("/tmp/codex-xx");
    expect(args).toContain("--output-last-message");
    expect(args).toContain("/tmp/codex-xx/last-message.txt");
    // stdin 표시자
    expect(args[args.length - 1]).toBe("-");
  });

  test("사용자가 -m 을 안 주면 기본 모델 gpt-5.5 가 추가된다", () => {
    const args = buildCodexArgs(ctx, []);
    const mIdx = args.indexOf("-m");
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(args[mIdx + 1]).toBe("gpt-5.5");
  });

  test("사용자가 -m 을 명시하면 기본 모델은 추가되지 않는다", () => {
    const args = buildCodexArgs(ctx, ["-m", "gpt-5"]);
    // -m 은 한 번만, 그리고 user 가 준 값이 사용됨
    const mIndices = args
      .map((a, i) => (a === "-m" ? i : -1))
      .filter((i) => i >= 0);
    expect(mIndices.length).toBe(1);
    expect(args[mIndices[0] + 1]).toBe("gpt-5");
  });

  test("--model 을 줘도 default 가 추가되지 않는다", () => {
    const args = buildCodexArgs(ctx, ["--model", "gpt-4o"]);
    expect(args.includes("-m")).toBe(false);
    const idx = args.indexOf("--model");
    expect(args[idx + 1]).toBe("gpt-4o");
  });

  test("빈 문자열은 인자에 추가되지 않는다", () => {
    const args = buildCodexArgs(ctx, ["", "-x", ""]);
    expect(args).not.toContain("");
  });
});

describe("extractLastCodexMessage", () => {
  test("빈 문자열 → null", () => {
    expect(extractLastCodexMessage("")).toBeNull();
  });

  test("message 필드가 있는 마지막 JSONL 라인을 채택", () => {
    const stdout =
      '{"type":"thinking"}\n{"type":"turn.message","message":"hello"}\n';
    expect(extractLastCodexMessage(stdout)).toBe("hello");
  });

  test("output 필드도 채택", () => {
    const stdout = '{"output":"the answer"}\n';
    expect(extractLastCodexMessage(stdout)).toBe("the answer");
  });

  test("turn.message 중첩도 채택", () => {
    const stdout = '{"turn":{"message":"nested ok"}}\n';
    expect(extractLastCodexMessage(stdout)).toBe("nested ok");
  });

  test("뒤에 있는 라인을 우선", () => {
    const stdout =
      '{"message":"first"}\n{"message":"second"}\n{"message":"third"}\n';
    expect(extractLastCodexMessage(stdout)).toBe("third");
  });

  test("의미 있는 message 없음 → null", () => {
    const stdout = '{"type":"thinking"}\n{"type":"reasoning"}\n';
    expect(extractLastCodexMessage(stdout)).toBeNull();
  });

  test("JSON 아닌 라인은 무시", () => {
    const stdout = 'not json\n{"message":"ok"}\nalso not json\n';
    expect(extractLastCodexMessage(stdout)).toBe("ok");
  });
});

describe("extractCodexFailureReason", () => {
  test("type=error 라인의 message 채택", () => {
    const stdout =
      '{"type":"thinking"}\n{"type":"error","message":"quota exceeded"}\n';
    expect(extractCodexFailureReason(stdout)).toBe("quota exceeded");
  });

  test("type=turn.failed + 중첩 error.message 채택", () => {
    const stdout =
      '{"type":"turn.failed","error":{"message":"rate limited"}}\n';
    expect(extractCodexFailureReason(stdout)).toBe("rate limited");
  });

  test("중첩 JSON 메시지(stringified) 도 풀어서 채택", () => {
    const inner = JSON.stringify({ error: { message: "deepest reason" } });
    const stdout = `{"type":"error","message":${JSON.stringify(inner)}}\n`;
    expect(extractCodexFailureReason(stdout)).toBe("deepest reason");
  });

  test("긴 메시지는 240자로 잘리고 '...' 가 붙는다", () => {
    const long = "x".repeat(500);
    const stdout = `{"type":"error","message":${JSON.stringify(long)}}\n`;
    const out = extractCodexFailureReason(stdout);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(243); // 240 + "..."
    expect(out!.endsWith("...")).toBe(true);
  });

  test("실패 라인이 없으면 null", () => {
    const stdout = '{"type":"turn.message","message":"ok"}\n';
    expect(extractCodexFailureReason(stdout)).toBeNull();
  });
});
