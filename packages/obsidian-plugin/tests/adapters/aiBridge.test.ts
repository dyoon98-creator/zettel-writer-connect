// aiBridge — codex 응답 파서 + 인자 조립 테스트.
//
// 입력 표기 규칙:
//   [실물] — codex 0.151.0 이 실제로 내는 문자열. 한 글자도 고치지 않았다.
//   [합성] — 이 테스트가 만든 문자열. 최상위 `type` / `item.type` 값만 실물의
//            관측값을 쓰고 나머지 필드는 테스트가 채웠다.
//
// 실제 codex 는 부르지 않는다. 프로세스가 필요한 검사(C2·F10)는 electronBridge
// 를 mock 해 진짜 Node `PassThrough` 로 만든 가짜 자식 프로세스를 주입하고,
// aiBridge 의 실제 코드 경로(스트림 해독·줄 분리·last-message 읽기·파서)를
// 그대로 태운다.

import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { join } from "path";
import { PassThrough } from "stream";
import { setImmediate as realSetImmediate } from "timers";
import { StringDecoder } from "string_decoder";

/* ------------------------------------------------------------------ */
/* 가짜 프로세스 · 가짜 파일시스템 주입                                   */
/* ------------------------------------------------------------------ */

class FakeChild extends EventEmitter {
  pid = 4242;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();

  kill(): boolean {
    return true;
  }

  finish(code: number): void {
    if (!this.stdout.writableEnded) this.stdout.end();
    if (!this.stderr.writableEnded) this.stderr.end();
    this.emit("exit", code, null);
    realSetImmediate(() => this.emit("close", code, null));
  }
}

let mockChild: FakeChild | null = null;
let mockSpawnArgs: string[] = [];
/** null 이면 `readFileSync` 가 ENOENT 로 던진다 (파일 자체가 없는 경우). */
let mockLastMessageFile: string | null = "";

function mockElectronRequire(name: string): unknown {
  if (name === "node:child_process" || name === "child_process") {
    return {
      spawn: (_bin: string, args: string[]): FakeChild => {
        mockSpawnArgs = args;
        mockChild = new FakeChild();
        return mockChild;
      },
      execSync: (): string => "/usr/bin:/bin",
    };
  }
  if (name === "node:os" || name === "os") {
    return { tmpdir: (): string => "/tmp" };
  }
  if (name === "node:path" || name === "path") {
    return { join: (...p: string[]): string => p.join("/") };
  }
  if (name === "node:fs" || name === "fs") {
    return {
      mkdirSync: (): void => undefined,
      readFileSync: (): string => {
        if (mockLastMessageFile === null) {
          throw Object.assign(new Error("ENOENT: no such file"), {
            code: "ENOENT",
          });
        }
        return mockLastMessageFile;
      },
    };
  }
  if (name === "node:string_decoder" || name === "string_decoder") {
    return { StringDecoder };
  }
  if (name === "process") {
    return {
      env: { PATH: "/usr/bin:/bin", HOME: "/home/tester" },
      kill: (): void => undefined,
    };
  }
  return null;
}

jest.mock("../../src/adapters/electronBridge", () => ({
  electronAvailable: (): boolean => true,
  electronRequire: (name: string): unknown => mockElectronRequire(name),
}));

import {
  buildCodexArgs,
  extractLastCodexMessage,
  extractCodexFailureReason,
  readAiFailureKind,
  startAiInvocation,
} from "../../src/adapters/aiBridge";
import {
  DEFAULT_APP_SETTINGS,
  ObsidianAppSettingsStore,
  getCodexArgSettings,
} from "../../src/adapters/appSettings";
import type AIManuscriptStudioPlugin from "../../src/main";

/* ------------------------------------------------------------------ */
/* 실물 이벤트 문자열 (F9 · F11)                                         */
/* ------------------------------------------------------------------ */

/** [실물] codex 0.151 의 본문 이벤트. 지시서 F9 그대로. */
const REAL_AGENT_MESSAGE_EVENT =
  '{"type":"item.completed","item":{"type":"agent_message","text":"안녕하세요. 요청하신 원고입니다."}}';

/** [실물] codex 0.151 의 item 단위 오류 이벤트 (스킬 예산 안내). */
const REAL_ITEM_ERROR_EVENT =
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Skill descriptions were shortened to fit the skills context budget. Codex can still see every skill, but some descriptions are shorter."}}';

/** [합성] 한 턴의 전형적인 이벤트 흐름. 각 줄의 `type` 값은 실물 관측값. */
const REAL_TURN_JSONL = [
  '{"type":"thread.started","thread_id":"th_1"}',
  '{"type":"turn.started"}',
  '{"type":"item.started","item":{"id":"item_0","type":"reasoning"}}',
  '{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"먼저 구조를 잡는다"}}',
  '{"type":"item.started","item":{"id":"item_1","type":"agent_message"}}',
  REAL_AGENT_MESSAGE_EVENT,
  '{"type":"turn.completed","usage":{"input_tokens":24967}}',
  "",
].join("\n");

/* ------------------------------------------------------------------ */
/* 설정 스냅숏 조작 (C3-4 — 「읽는 쪽까지 잇는다」)                        */
/* ------------------------------------------------------------------ */

class FakePlugin {
  private data: Record<string, unknown> | null = null;
  constructor(app?: Record<string, unknown>) {
    if (app) this.data = { app };
  }
  async loadData(): Promise<Record<string, unknown> | null> {
    return this.data;
  }
  async saveData(data: Record<string, unknown>): Promise<void> {
    this.data = data;
  }
}

/** 저장된 설정을 «실제 store 를 통해» 읽어 브리지 스냅숏을 갱신한다. */
async function loadStoredSettings(
  app?: Record<string, unknown>,
): Promise<void> {
  const store = new ObsidianAppSettingsStore(
    new FakePlugin(app) as unknown as AIManuscriptStudioPlugin,
  );
  await store.load();
}

afterEach(async () => {
  // 스냅숏은 모듈 전역이다. 매 테스트 뒤 기본값으로 되돌린다.
  await loadStoredSettings();
});

/* ================================================================== */
/* buildCodexArgs                                                      */
/* ================================================================== */

describe("buildCodexArgs", () => {
  const ctx = {
    workDir: "/tmp/codex-xx",
    lastMsgPath: "/tmp/codex-xx/last-message.txt",
  };

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

  // ---- C3-0. 모델 slug 를 «문자 그대로» 고정한다 --------------------
  // 없는 slug 를 주면 codex 가 조용히 대체하지 않고 HTTP 400 으로 턴이
  // 실패한다. 카탈로그에 `gpt-5.6` 단독은 없고 `-sol`/`-terra`/`-luna` 뿐이다.
  test("사용자가 -m 을 안 주면 기본 모델 gpt-5.6-terra 가 추가된다", () => {
    const args = buildCodexArgs(ctx, []);
    const mIdx = args.indexOf("-m");
    expect(mIdx).toBeGreaterThanOrEqual(0);
    expect(args[mIdx + 1]).toBe("gpt-5.6-terra");
  });

  test("기본 모델 slug 오타 방지 — 변종 없는 이름은 쓰지 않는다", () => {
    const model = buildCodexArgs(ctx, [])[buildCodexArgs(ctx, []).indexOf("-m") + 1];
    expect(model).toBe("gpt-5.6-terra");
    expect(model).not.toBe("gpt-5.6");
    expect(model).not.toBe("gpt-5.5");
    // 카탈로그에 있는 세 변종 중 하나여야 한다.
    expect(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]).toContain(model);
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

  // ---- C3-1. 두 플래그가 «기본으로» 붙는다 ---------------------------
  test("기본으로 --ignore-user-config 가 붙는다", () => {
    expect(buildCodexArgs(ctx, [])).toContain("--ignore-user-config");
  });

  test("기본으로 --disable shell_tool 이 인접한 쌍으로 붙는다", () => {
    const args = buildCodexArgs(ctx, []);
    const i = args.indexOf("--disable");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toBe("shell_tool");
  });

  test("두 플래그는 prompt 표시자(-) 앞에 온다", () => {
    const args = buildCodexArgs(ctx, []);
    const iCfg = args.indexOf("--ignore-user-config");
    const iDis = args.indexOf("--disable");
    expect(iCfg).toBeGreaterThanOrEqual(0);
    expect(iDis).toBeGreaterThanOrEqual(0);
    expect(iCfg).toBeLessThan(args.length - 1);
    expect(iDis).toBeLessThan(args.length - 1);
  });

  // ---- C3-5. 되돌림 스위치 — 켠 경우와 기본 경우 양쪽 ------------------
  test("되돌림 스위치를 둘 다 끄면 두 플래그가 안 나온다", () => {
    const args = buildCodexArgs(ctx, [], {
      codexIgnoreUserConfig: false,
      codexDisableShellTool: false,
    });
    expect(args).not.toContain("--ignore-user-config");
    expect(args).not.toContain("--disable");
    expect(args).not.toContain("shell_tool");
    // 나머지 인자는 그대로다.
    expect(args).toContain("--json");
    expect(args[args.length - 1]).toBe("-");
  });

  test("개인 설정 스위치만 끄면 그것만 빠진다", () => {
    const args = buildCodexArgs(ctx, [], {
      codexIgnoreUserConfig: false,
      codexDisableShellTool: true,
    });
    expect(args).not.toContain("--ignore-user-config");
    expect(args).toContain("--disable");
  });

  test("셸 도구 스위치만 끄면 그것만 빠진다", () => {
    const args = buildCodexArgs(ctx, [], {
      codexIgnoreUserConfig: true,
      codexDisableShellTool: false,
    });
    expect(args).toContain("--ignore-user-config");
    expect(args).not.toContain("--disable");
  });
});

/* ================================================================== */
/* C3-4 — 저장한 값이 «읽는 쪽» 까지 이어지는가                          */
/* ================================================================== */

describe("설정 → buildCodexArgs 연결", () => {
  const ctx = {
    workDir: "/tmp/codex-xx",
    lastMsgPath: "/tmp/codex-xx/last-message.txt",
  };

  test("기본값은 「플래그가 붙은 상태」다", () => {
    expect(DEFAULT_APP_SETTINGS.codexIgnoreUserConfig).toBe(true);
    expect(DEFAULT_APP_SETTINGS.codexDisableShellTool).toBe(true);
  });

  test("아무것도 저장된 적 없으면 두 플래그가 붙는다", async () => {
    await loadStoredSettings();
    expect(getCodexArgSettings()).toEqual({
      codexIgnoreUserConfig: true,
      codexDisableShellTool: true,
    });
    const args = buildCodexArgs(ctx, []);
    expect(args).toContain("--ignore-user-config");
    expect(args).toContain("--disable");
  });

  test("저장된 false 를 load 하면 그 플래그가 실제로 빠진다", async () => {
    await loadStoredSettings({
      codexIgnoreUserConfig: false,
      codexDisableShellTool: false,
    });
    expect(getCodexArgSettings()).toEqual({
      codexIgnoreUserConfig: false,
      codexDisableShellTool: false,
    });
    const args = buildCodexArgs(ctx, []);
    expect(args).not.toContain("--ignore-user-config");
    expect(args).not.toContain("--disable");
  });

  test("save 한 값도 즉시 읽는 쪽에 반영된다", async () => {
    const plugin = new FakePlugin() as unknown as AIManuscriptStudioPlugin;
    const store = new ObsidianAppSettingsStore(plugin);
    await store.save({
      ...DEFAULT_APP_SETTINGS,
      codexDisableShellTool: false,
    });
    expect(getCodexArgSettings().codexDisableShellTool).toBe(false);
    expect(buildCodexArgs(ctx, [])).not.toContain("--disable");
  });

  test("실제 spawn 인자에도 두 플래그가 실린다", async () => {
    mockLastMessageFile = "본문";
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/fake/bin/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 30,
    });
    await tick();
    mockChild!.finish(0);
    await handle.done;
    expect(mockSpawnArgs).toContain("--ignore-user-config");
    const i = mockSpawnArgs.indexOf("--disable");
    expect(mockSpawnArgs[i + 1]).toBe("shell_tool");
    expect(mockSpawnArgs[mockSpawnArgs.indexOf("-m") + 1]).toBe("gpt-5.6-terra");
  });
});

/* ================================================================== */
/* extractLastCodexMessage                                             */
/* ================================================================== */

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

  // ---- C1. 실물을 읽는다 --------------------------------------------
  test("[실물] item.completed / agent_message 의 text 를 꺼낸다 (F9)", () => {
    expect(extractLastCodexMessage(`${REAL_AGENT_MESSAGE_EVENT}\n`)).toBe(
      "안녕하세요. 요청하신 원고입니다.",
    );
  });

  test("[실물] 한 턴 전문에서 본문만 꺼낸다 — raw JSONL 이 아니다", () => {
    const got = extractLastCodexMessage(REAL_TURN_JSONL);
    expect(got).toBe("안녕하세요. 요청하신 원고입니다.");
    expect(got).not.toContain("item.completed");
    expect(got).not.toContain("{");
  });

  test("[실물] reasoning 의 text 는 본문으로 집지 않는다", () => {
    const onlyReasoning = [
      '{"type":"thread.started","thread_id":"th_1"}',
      '{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"먼저 구조를 잡는다"}}',
      '{"type":"turn.completed","usage":{}}',
      "",
    ].join("\n");
    expect(extractLastCodexMessage(onlyReasoning)).toBeNull();
  });

  test("[합성] 구 필드명 item_type 도 그대로 받는다", () => {
    const stdout =
      '{"type":"item.completed","item":{"item_type":"agent_message","text":"구버전 본문"}}\n';
    expect(extractLastCodexMessage(stdout)).toBe("구버전 본문");
  });

  test("[실물] agent_message 가 옛 필드명 경로보다 우선한다", () => {
    const stdout = `{"message":"옛 경로"}\n${REAL_AGENT_MESSAGE_EVENT}\n`;
    expect(extractLastCodexMessage(stdout)).toBe(
      "안녕하세요. 요청하신 원고입니다.",
    );
  });
});

/* ================================================================== */
/* extractCodexFailureReason                                           */
/* ================================================================== */

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

  // ---- C1. 실물 item 오류를 읽는다 (F11) ------------------------------
  test("[실물] item.type === error 의 message 를 꺼낸다 (F11)", () => {
    const got = extractCodexFailureReason(`${REAL_ITEM_ERROR_EVENT}\n`);
    expect(got).not.toBeNull();
    expect(got).toContain("Skill descriptions were shortened");
  });

  test("[합성] item 오류의 text 필드도 받는다", () => {
    const stdout =
      '{"type":"item.completed","item":{"type":"error","text":"tool crashed"}}\n';
    expect(extractCodexFailureReason(stdout)).toBe("tool crashed");
  });

  test("[합성] 최상위 오류가 item 오류보다 «먼저» 채택된다", () => {
    // 순서가 뒤집히면 시작 무렵의 무해한 안내가 진짜 사유를 밀어낸다.
    const stdout = [
      REAL_ITEM_ERROR_EVENT,
      '{"type":"turn.failed","error":{"message":"usage limit reached"}}',
      "",
    ].join("\n");
    expect(extractCodexFailureReason(stdout)).toBe("usage limit reached");
  });

  test("[실물] item 오류만 있고 최상위 오류가 없으면 「사유 미상」이 아니다", () => {
    const stdout = [
      '{"type":"thread.started","thread_id":"th_1"}',
      REAL_ITEM_ERROR_EVENT,
      "",
    ].join("\n");
    expect(extractCodexFailureReason(stdout)).not.toBeNull();
  });
});

/* ================================================================== */
/* C2 — 한글이 청크 경계에서 안 깨진다 (F12)                             */
/* ================================================================== */

/** 실제 macrotask 를 n 번 돌린다 — 청크가 «따로» 전달되게 만든다. */
async function tick(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => realSetImmediate(r));
  }
}

interface SplitRun {
  tokens: string[];
  fullText: string;
}

/**
 * `line` 을 UTF-8 바이트열로 만들어 `cuts` 위치에서 «바이트 단위» 로 쪼개
 * 가짜 codex stdout 으로 흘린다. 청크 사이마다 macrotask 를 돌려 브리지가
 * 조각을 따로 받게 한다.
 */
async function runWithByteChunks(
  line: string,
  cuts: number[],
): Promise<SplitRun> {
  const buf = Buffer.from(line, "utf8");
  const handle = startAiInvocation({
    provider: "codex",
    binaryPath: "/fake/bin/codex",
    extraArgs: [],
    prompt: "열 글자입니다",
    timeoutSecs: 30,
  });
  const tokens: string[] = [];
  const drain = (async (): Promise<void> => {
    try {
      for await (const t of handle.tokens()) tokens.push(t);
    } catch {
      /* 이 테스트는 정착 경로가 아니라 «해독» 을 본다 */
    }
  })();

  await tick();
  const bounds = [0, ...cuts, buf.length];
  for (let i = 0; i < bounds.length - 1; i++) {
    const piece = buf.subarray(bounds[i], bounds[i + 1]);
    if (piece.length > 0) mockChild!.stdout.write(piece);
    await tick(2);
  }
  mockChild!.finish(0);
  const result = await handle.done;
  await drain;
  return { tokens, fullText: result.fullText };
}

describe("한글 청크 경계 (F12)", () => {
  const KO = "안녕하세요. 요청하신 원고입니다.";

  beforeEach(() => {
    // 이 묶음은 stdout 해독만 본다 — last-message 파일은 비어 있게 둔다.
    mockLastMessageFile = "";
  });

  test("재현 조건 확인 — '안' 의 첫 바이트 뒤에서 자르면 문자 가운데다", () => {
    const prefix = '{"type":"item.completed","item":{"type":"agent_message","text":"';
    const at = Buffer.from(prefix, "utf8").length;
    const b = Buffer.from(REAL_AGENT_MESSAGE_EVENT, "utf8");
    // U+AC00('안')은 UTF-8 3바이트이며 첫 바이트는 0xEA~0xED 대역이다.
    expect(b[at]).toBeGreaterThanOrEqual(0xe0);
    // 그 다음 두 바이트는 continuation byte (10xxxxxx).
    expect(b[at + 1] & 0xc0).toBe(0x80);
    expect(b[at + 2] & 0xc0).toBe(0x80);
  });

  test("[실물] 한 글자가 두 청크에 걸쳐도 토큰이 안 깨진다", async () => {
    const prefix = '{"type":"item.completed","item":{"type":"agent_message","text":"';
    const cut = Buffer.from(prefix, "utf8").length + 1; // '안' 3바이트 중 1바이트만
    const { tokens } = await runWithByteChunks(
      `${REAL_AGENT_MESSAGE_EVENT}\n`,
      [cut],
    );
    const joined = tokens.join("");
    expect(joined).not.toContain("�");
    expect(joined.trim()).toBe(REAL_AGENT_MESSAGE_EVENT);
    // 깨진 글자도 JSON.parse 는 통과한다 — 그래서 파싱 성공만으로는 증거가
    // 안 된다. 본문 문자열 자체를 확인한다.
    const parsed = JSON.parse(joined.trim()) as {
      item: { text: string };
    };
    expect(parsed.item.text).toBe(KO);
  });

  test("[실물] 1바이트씩 쪼개도 안 깨진다", async () => {
    const buf = Buffer.from(`${REAL_AGENT_MESSAGE_EVENT}\n`, "utf8");
    const cuts = Array.from({ length: buf.length - 1 }, (_, i) => i + 1);
    const { tokens } = await runWithByteChunks(
      `${REAL_AGENT_MESSAGE_EVENT}\n`,
      cuts,
    );
    const joined = tokens.join("");
    expect(joined).not.toContain("�");
    expect(joined.trim()).toBe(REAL_AGENT_MESSAGE_EVENT);
  }, 20_000);

  test("[실물] 개행 없이 끝나는 마지막 조각도 안 깨진다", async () => {
    const prefix = '{"type":"item.completed","item":{"type":"agent_message","text":"';
    const cut = Buffer.from(prefix, "utf8").length + 2;
    const { tokens } = await runWithByteChunks(REAL_AGENT_MESSAGE_EVENT, [cut]);
    const joined = tokens.join("");
    expect(joined).not.toContain("�");
    expect(joined.trim()).toBe(REAL_AGENT_MESSAGE_EVENT);
  });
});

/* ================================================================== */
/* F10 — last-message 가 비면 원고에 JSON 덩어리가 박히는가              */
/* ================================================================== */

describe("last-message 대체 경로 (F10)", () => {
  async function runTurn(): Promise<string> {
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/fake/bin/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 30,
    });
    await tick();
    mockChild!.stdout.write(Buffer.from(REAL_TURN_JSONL, "utf8"));
    await tick(2);
    mockChild!.finish(0);
    const r = await handle.done;
    return r.fullText;
  }

  test("파일이 비어 있으면 stdout 에서 «본문» 을 꺼낸다 (raw JSONL 아님)", async () => {
    mockLastMessageFile = "";
    const fullText = await runTurn();
    expect(fullText.trim()).toBe("안녕하세요. 요청하신 원고입니다.");
    expect(fullText).not.toContain('"type":"item.completed"');
    expect(fullText).not.toContain("thread.started");
  });

  test("파일이 아예 없어(ENOENT) 읽기가 실패해도 마찬가지다", async () => {
    mockLastMessageFile = null;
    const fullText = await runTurn();
    expect(fullText.trim()).toBe("안녕하세요. 요청하신 원고입니다.");
    expect(fullText).not.toContain('"type":"item.completed"');
  });

  test("파일에 본문이 있으면 그 값이 그대로 쓰인다 (기존 보장)", async () => {
    mockLastMessageFile = "파일에서 온 본문";
    const fullText = await runTurn();
    expect(fullText).toBe("파일에서 온 본문");
  });
});

/* ================================================================== */
/* C1 — 오류 이벤트는 «본문» 이 아니다                                     */
/*                                                                     */
/* 좁히는 것은 「무엇이 본문인가」 하나뿐이다. 옛 필드명(`message` /       */
/* `output` / `turn.message`) «지원 경로» 는 그대로 산다 — 위 묶음의       */
/* 기존 테스트 넷이 그것을 지킨다. 여기서 빼는 것은 그 경로를 타고 들어오던 */
/* «오류 이벤트» 뿐이다.                                                  */
/* ================================================================== */

/** [실물] codex 0.151 의 최상위 오류 이벤트. */
const REAL_TOP_ERROR_EVENT =
  '{"type":"error","message":"stream disconnected before completion"}';

describe("C1 — 오류 이벤트가 본문으로 채택되지 않는다", () => {
  test("① type=error 만 있고 agent_message 가 없으면 본문이 «아니다»", () => {
    const stdout = [
      '{"type":"thread.started","thread_id":"th_1"}',
      '{"type":"turn.started"}',
      REAL_TOP_ERROR_EVENT,
      "",
    ].join("\n");
    expect(extractLastCodexMessage(stdout)).toBeNull();
  });

  test("① turn.failed 의 message 도 본문이 «아니다»", () => {
    const stdout = '{"type":"turn.failed","message":"usage limit reached"}\n';
    expect(extractLastCodexMessage(stdout)).toBeNull();
  });

  test("② agent_message «뒤에» error 가 와도 agent_message 가 채택된다", () => {
    const stdout = `${REAL_AGENT_MESSAGE_EVENT}\n${REAL_TOP_ERROR_EVENT}\n`;
    expect(extractLastCodexMessage(stdout)).toBe(
      "안녕하세요. 요청하신 원고입니다.",
    );
  });

  test("③ item.type === error 인 item.completed 는 본문이 «아니다»", () => {
    const stdout = `{"type":"thread.started","thread_id":"th_1"}\n${REAL_ITEM_ERROR_EVENT}\n`;
    expect(extractLastCodexMessage(stdout)).toBeNull();
  });

  test("③ item 오류가 text 필드로 와도 본문이 «아니다»", () => {
    const stdout =
      '{"type":"item.completed","item":{"type":"error","text":"tool crashed"}}\n';
    expect(extractLastCodexMessage(stdout)).toBeNull();
  });

  // ---- 좁힘과 호환이 «동시에» 성립하는지 -----------------------------
  test("옛 필드명으로 온 본문 뒤에 오류가 와도 «본문» 이 이긴다", () => {
    // 역방향 스캔이라 종전 구현은 마지막 줄(오류)을 집었다. 옛 경로는 살리고
    // 오류만 후보에서 뺀다.
    const stdout = [
      '{"turn":{"message":"옛 경로로 온 진짜 본문"}}',
      REAL_TOP_ERROR_EVENT,
      "",
    ].join("\n");
    expect(extractLastCodexMessage(stdout)).toBe("옛 경로로 온 진짜 본문");
  });

  test("오류가 아닌 이벤트의 옛 필드명 경로는 그대로 산다 (호환 회귀)", () => {
    expect(extractLastCodexMessage('{"type":"turn.message","message":"a"}\n'))
      .toBe("a");
    expect(extractLastCodexMessage('{"output":"b"}\n')).toBe("b");
    expect(extractLastCodexMessage('{"turn":{"message":"c"}}\n')).toBe("c");
  });
});

/* ================================================================== */
/* C2 — 「무엇이 원고인가」 조립 판정                                      */
/*                                                                     */
/* 판정 근거(물음 1): codex 자신이 답을 «마지막 것» 으로 정의한다.         */
/*   `codex exec --help` 원문 (codex-cli 0.151.0):                      */
/*   "-o, --output-last-message <FILE>  Specifies file where the last   */
/*    message from the agent should be written"                        */
/* 1차 경로가 그 파일이므로, stdout 대체 경로도 «마지막 agent_message» 를  */
/* 집어야 한다. 이어붙이면 같은 턴이 파일 유무에 따라 다른 원고가 된다.     */
/*                                                                     */
/* 판정 근거(물음 2): 파일이 이긴다. 파일은 codex 가 «스스로 확정해» 쓴    */
/* 것이고, stdout 은 우리 파이프가 잘릴 수 있다(손자 점유 → drainCut →     */
/* destroyStream). 잘린 stdout 으로 온전한 파일을 덮으면 원고가 깎인다.    */
/* ================================================================== */

/** [합성] F1 이 관측한 「짧은 예고 + 긴 본문」의 앞줄. */
const PREAMBLE_MESSAGE_EVENT =
  '{"type":"item.completed","item":{"type":"agent_message","text":"요청 확인했습니다. 지금부터 원고를 작성하겠습니다."}}';

/** [합성] 본문이 «먼저» 오고 짧은 마무리가 «나중» 인 뒤집힌 턴. */
const CLOSING_MESSAGE_EVENT =
  '{"type":"item.completed","item":{"type":"agent_message","text":"이상입니다."}}';

describe("C2 — 한 턴에서 「원고」를 고르는 규칙", () => {
  test("agent_message 가 «하나» 인 턴 — 그 하나가 원고다", () => {
    expect(extractLastCodexMessage(REAL_TURN_JSONL)).toBe(
      "안녕하세요. 요청하신 원고입니다.",
    );
  });

  test("agent_message 가 «둘» 인 턴 — 마지막 하나만. 이어붙이지 않는다", () => {
    const stdout = [
      '{"type":"thread.started","thread_id":"th_1"}',
      PREAMBLE_MESSAGE_EVENT,
      REAL_AGENT_MESSAGE_EVENT,
      '{"type":"turn.completed","usage":{}}',
      "",
    ].join("\n");
    const got = extractLastCodexMessage(stdout);
    expect(got).toBe("안녕하세요. 요청하신 원고입니다.");
    // 예고 문면이 원고에 섞이면 안 된다.
    expect(got).not.toContain("작성하겠습니다");
  });

  test("본문이 먼저·마무리가 나중인 뒤집힌 턴에서도 «마지막» 을 집는다", () => {
    // 이 순서가 사용자에게 손해로 보일 수 있으나, 1차 경로인
    // `--output-last-message` 파일도 똑같이 마지막 것을 담는다. 여기서만
    // 다른 규칙을 쓰면 파일이 읽히느냐 마느냐로 원고가 갈린다.
    const stdout = [
      REAL_AGENT_MESSAGE_EVENT,
      CLOSING_MESSAGE_EVENT,
      "",
    ].join("\n");
    expect(extractLastCodexMessage(stdout)).toBe("이상입니다.");
  });

  test("reasoning·command_execution 은 몇 개가 끼어도 원고를 밀어내지 못한다", () => {
    const stdout = [
      REAL_AGENT_MESSAGE_EVENT,
      '{"type":"item.completed","item":{"type":"reasoning","text":"마무리 점검"}}',
      '{"type":"item.completed","item":{"type":"command_execution","text":"ls -al"}}',
      "",
    ].join("\n");
    expect(extractLastCodexMessage(stdout)).toBe(
      "안녕하세요. 요청하신 원고입니다.",
    );
  });
});

describe("C2 — last-message 파일과 stdout 이 어긋날 때", () => {
  /** 주어진 JSONL 을 한 턴으로 흘리고 fullText 를 받는다. */
  async function runTurnWith(jsonl: string): Promise<string> {
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/fake/bin/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 30,
    });
    await tick();
    mockChild!.stdout.write(Buffer.from(jsonl, "utf8"));
    await tick(2);
    mockChild!.finish(0);
    const r = await handle.done;
    return r.fullText;
  }

  const TWO_MESSAGE_TURN = [
    '{"type":"thread.started","thread_id":"th_1"}',
    PREAMBLE_MESSAGE_EVENT,
    REAL_AGENT_MESSAGE_EVENT,
    '{"type":"turn.completed","usage":{}}',
    "",
  ].join("\n");

  test("파일이 비면 stdout 의 «마지막» agent_message 가 원고가 된다", async () => {
    mockLastMessageFile = "";
    const fullText = await runTurnWith(TWO_MESSAGE_TURN);
    expect(fullText.trim()).toBe("안녕하세요. 요청하신 원고입니다.");
    expect(fullText).not.toContain("작성하겠습니다");
  });

  test("파일이 공백뿐이어도 stdout 경로로 떨어진다", async () => {
    mockLastMessageFile = "   \n";
    const fullText = await runTurnWith(TWO_MESSAGE_TURN);
    expect(fullText.trim()).toBe("안녕하세요. 요청하신 원고입니다.");
  });

  test("파일 내용이 stdout 마지막과 «달라도» 파일이 이긴다", async () => {
    // 어긋나는 실제 경로: 손자 프로세스가 파이프를 붙들어 stdout 이 잘린 턴.
    // 파일은 codex 가 확정해 쓴 것이라 잘림에 면역이다.
    mockLastMessageFile = "파일에만 있는 최종 원고";
    const fullText = await runTurnWith(TWO_MESSAGE_TURN);
    expect(fullText).toBe("파일에만 있는 최종 원고");
  });

  test("오류만 있는 턴이 종료코드 0 이어도 오류 문면이 원고가 되지 않는다", async () => {
    mockLastMessageFile = "";
    const settled = await runTurnSettled(
      [
        '{"type":"thread.started","thread_id":"th_1"}',
        REAL_TOP_ERROR_EVENT,
        "",
      ].join("\n"),
    );
    // 오류 문면이 «본문인 척» 서지 않는다. 그리고 이제는 여기서 멈추지 않는다 —
    // 본문 후보가 하나도 없으므로 raw stdout 으로 떨어지는 대신 «실패» 로 갈린다.
    expect(settled.fullText).toBeUndefined();
    expect(readAiFailureKind(settled.error)).toBe("no-output");
    expect(String((settled.error as Error).message)).not.toContain(
      '"type":"thread.started"',
    );
  });
});

/* ================================================================== */
/* 과제 A — 실패를 «문장» 이 아니라 «종류» 로 말한다                       */
/*                                                                     */
/* 합격선은 하나다: 문면을 바꿔도 판별이 안 깨진다. 그러려면 브리지가 만드는  */
/* 실패마다 종류가 «실려» 있어야 한다. 아래는 그 다섯 칸이 실제 실행 경로에서 */
/* 붙는지를 본다 — 문자열을 비교하지 않는다.                                */
/* ================================================================== */

interface SettledTurn {
  fullText?: string;
  error?: unknown;
}

/**
 * 한 턴을 흘리고 «성공이든 실패든» 정착 결과를 그대로 돌려준다.
 * (기존 `runTurnWith` 는 성공만 다뤄서 실패 경로를 볼 수 없다.)
 */
async function runTurnSettled(
  jsonl: string,
  opts: { exitCode?: number; provider?: "codex" | "claude-code" } = {},
): Promise<SettledTurn> {
  const handle = startAiInvocation({
    provider: opts.provider ?? "codex",
    binaryPath: "/fake/bin/codex",
    extraArgs: [],
    prompt: "열 글자입니다",
    timeoutSecs: 30,
  });
  const settled: Promise<SettledTurn> = handle.done.then(
    (r) => ({ fullText: r.fullText }),
    (e) => ({ error: e }),
  );
  await tick();
  if (jsonl) mockChild!.stdout.write(Buffer.from(jsonl, "utf8"));
  await tick(2);
  mockChild!.finish(opts.exitCode ?? 0);
  return settled;
}

/** [합성] 본문 후보가 «하나도 없는» 턴. 종료 코드는 0으로 끝난다. */
const NO_BODY_TURN = [
  '{"type":"thread.started","thread_id":"th_1"}',
  '{"type":"turn.started"}',
  '{"type":"item.started","item":{"id":"item_0","type":"reasoning"}}',
  '{"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"먼저 구조를 잡는다"}}',
  '{"type":"turn.completed","usage":{"input_tokens":24967}}',
  "",
].join("\n");

describe("과제 A — readAiFailureKind (1차 층: 실려 온 종류)", () => {
  test("다섯 칸을 그대로 읽는다", () => {
    for (const kind of ["canceled", "timeout", "exit", "no-output", "process"]) {
      expect(readAiFailureKind({ failure: kind })).toBe(kind);
    }
  });

  test("종류가 없으면 null — 부르는 쪽이 «문면» 2차로 떨어지라는 뜻이다", () => {
    // 문면이 아무리 그럴듯해도 이 함수는 종류만 본다. 문면 판별은 소비처가
    // 제자리에 그대로 들고 있다(그 줄을 지우지 않는 것이 이 변경의 조건).
    expect(readAiFailureKind(new Error("AI 호출 시간 초과 (180s)"))).toBeNull();
    expect(readAiFailureKind({ message: "사용자가 취소했습니다." })).toBeNull();
    expect(readAiFailureKind("사용자가 취소했습니다.")).toBeNull();
  });

  test("모르는 값이 종류인 척 지나가지 못한다", () => {
    expect(readAiFailureKind({ failure: "cancelled" })).toBeNull(); // 오타
    expect(readAiFailureKind({ failure: "" })).toBeNull();
    expect(readAiFailureKind({ failure: 3 })).toBeNull();
    expect(readAiFailureKind(null)).toBeNull();
    expect(readAiFailureKind(undefined)).toBeNull();
  });
});

describe("과제 A — 실제 실행 경로마다 종류가 실린다", () => {
  test("사용자 취소 → canceled (문면은 그대로 남는다)", async () => {
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/fake/bin/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 30,
    });
    const settled: Promise<SettledTurn> = handle.done.then(
      (r) => ({ fullText: r.fullText }),
      (e) => ({ error: e }),
    );
    await tick();
    await handle.cancel();
    const { error } = await settled;
    expect(readAiFailureKind(error)).toBe("canceled");
    // 더하되 빼지 않았다 — 사람이 읽는 문장은 그 자리에 그대로 있다.
    expect(String((error as Error).message)).toContain("사용자가 취소했습니다");
  });

  test("0 아닌 종료 코드 → exit", async () => {
    mockLastMessageFile = "";
    const { error } = await runTurnSettled(
      '{"type":"error","message":"boom"}\n',
      { exitCode: 3 },
    );
    expect(readAiFailureKind(error)).toBe("exit");
    expect(String((error as Error).message)).toContain("CLI 종료 코드 3");
  });

  test("프로세스가 아예 안 뜸(ENOENT) → process", async () => {
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/없는/경로/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 30,
    });
    const settled: Promise<SettledTurn> = handle.done.then(
      (r) => ({ fullText: r.fullText }),
      (e) => ({ error: e }),
    );
    await tick();
    mockChild!.emit("error", new Error("spawn ENOENT"));
    const { error } = await settled;
    expect(readAiFailureKind(error)).toBe("process");
    expect(String((error as Error).message)).toContain("프로세스 시작 실패");
  });

  test("한계 시간 초과 → timeout", async () => {
    mockLastMessageFile = "";
    const handle = startAiInvocation({
      provider: "codex",
      binaryPath: "/fake/bin/codex",
      extraArgs: [],
      prompt: "열 글자입니다",
      timeoutSecs: 1, // 브리지가 받는 최소값
    });
    const settled: Promise<SettledTurn> = handle.done.then(
      (r) => ({ fullText: r.fullText }),
      (e) => ({ error: e }),
    );
    await tick();
    // 이 파일의 스트림 도우미는 «진짜» macrotask 를 쓴다. 여기만 가짜 시계를
    // 섞으면 청크 전달이 멈추므로, 1초를 실제로 흘려보낸다.
    await new Promise((r) => setTimeout(r, 1_100));
    mockChild!.finish(143); // SIGTERM 을 받고 죽은 자식
    const { error } = await settled;
    expect(readAiFailureKind(error)).toBe("timeout");
    expect(String((error as Error).message)).toContain("시간 초과");
  }, 15_000);

  test("본문 없이 정상 종료 → no-output (exit 와 «다른» 칸이다)", async () => {
    mockLastMessageFile = "";
    const { error } = await runTurnSettled(NO_BODY_TURN);
    expect(readAiFailureKind(error)).toBe("no-output");
    expect(readAiFailureKind(error)).not.toBe("exit");
  });

  test("성공한 턴은 실패 종류를 만들지 않는다 (반대 방향 확인)", async () => {
    mockLastMessageFile = "파일에서 온 본문";
    const { fullText, error } = await runTurnSettled(REAL_TURN_JSONL);
    expect(error).toBeUndefined();
    expect(fullText).toBe("파일에서 온 본문");
  });
});

/* ================================================================== */
/* 과제 B — 본문 후보가 없을 때 무엇을 내는가                              */
/*                                                                     */
/* 판정: 종료 코드가 0이어도 «실패» 로 낸다(`no-output`). 근거는            */
/*   (가) raw JSONL 을 원고 칸에 붓지 않는다,                              */
/*   (나) 빈 글자를 «성공» 으로 내면 화면(useStreamingChat)이 buffer 를     */
/*        덮어쓰지 않아 스트리밍 중 쌓인 `[AI 진행]` 표식이 원고에 남는다.   */
/* 원본 JSONL 은 버리지 않되 «화면이 아닌 곳»(개발자 도구 콘솔)에 남긴다.    */
/* ================================================================== */

describe("과제 B — raw JSONL 이 원고로 가지 않는다", () => {
  test("① 본문 후보 0 + 종료코드 0 + last-message 파일 없음 → 원고에 JSONL 이 없다", async () => {
    mockLastMessageFile = null; // ENOENT
    const settled = await runTurnSettled(NO_BODY_TURN);
    // 성공으로 서지 않는다 — 원고 자리에 아무것도 실어 보내지 않는다.
    expect(settled.fullText).toBeUndefined();
    expect(readAiFailureKind(settled.error)).toBe("no-output");
    const msg = String((settled.error as Error).message);
    expect(msg).not.toContain('"type":"thread.started"');
    expect(msg).not.toContain('"type":"item.completed"');
    expect(msg).toContain("AI가 답을 주지 않았습니다");
  });

  test("② 같은 조건 + last-message 파일이 공백뿐 → 같은 판정", async () => {
    mockLastMessageFile = "   \n\t ";
    const settled = await runTurnSettled(NO_BODY_TURN);
    expect(settled.fullText).toBeUndefined();
    expect(readAiFailureKind(settled.error)).toBe("no-output");
    expect(String((settled.error as Error).message)).not.toContain(
      "turn.completed",
    );
  });

  test("③ 본문 후보가 있으면 평소대로 본문이 나온다 (회귀 방지)", async () => {
    mockLastMessageFile = "";
    const settled = await runTurnSettled(REAL_TURN_JSONL);
    expect(settled.error).toBeUndefined();
    expect(settled.fullText?.trim()).toBe("안녕하세요. 요청하신 원고입니다.");
  });

  test("원본 JSONL 은 화면이 아니라 진단 로그에 남는다", async () => {
    mockLastMessageFile = "";
    const infoLogs: string[] = [];
    const spy = jest
      .spyOn(console, "info")
      .mockImplementation((...a: unknown[]) => {
        infoLogs.push(a.map(String).join(" "));
      });
    try {
      const settled = await runTurnSettled(NO_BODY_TURN);
      const logged = infoLogs.join("\n");
      // 진단은 남는다 — 「무엇이 왔길래 본문이 없었나」를 볼 수 있어야 한다.
      expect(logged).toContain("본문 없음");
      expect(logged).toContain('"type":"turn.completed"');
      // 그러나 사용자가 읽는 문면에는 없다.
      expect(String((settled.error as Error).message)).not.toContain(
        '"type":"turn.completed"',
      );
    } finally {
      spy.mockRestore();
    }
  });

  test("오류 이벤트가 있으면 그 사유를 사람 말 옆에 붙인다", async () => {
    mockLastMessageFile = "";
    const settled = await runTurnSettled(
      [
        '{"type":"thread.started","thread_id":"th_1"}',
        REAL_TOP_ERROR_EVENT,
        "",
      ].join("\n"),
    );
    const msg = String((settled.error as Error).message);
    expect(msg).toContain("AI가 답을 주지 않았습니다");
    expect(msg).toContain("stream disconnected before completion");
    // 사유는 «괄호 안 부연» 이지 원고가 아니다.
    expect(settled.fullText).toBeUndefined();
  });

  test("codex 가 아닌 provider 는 종전대로 stdout 이 결과다 (범위 고정)", async () => {
    // 이 규칙은 codex 전용이다. claude-code 는 stdout 자체가 답이라
    // 「본문 후보」라는 개념이 없다 — 여기까지 넓히면 멀쩡한 경로가 깨진다.
    mockLastMessageFile = null;
    const settled = await runTurnSettled("사람이 읽는 답입니다.\n", {
      provider: "claude-code",
    });
    expect(settled.error).toBeUndefined();
    expect(settled.fullText?.trim()).toBe("사람이 읽는 답입니다.");
  });
});
/* ================================================================== */
/* C1 — 상위 소비자(tauriAIBridge)도 «종류» 로 가른다                     */
/*                                                                     */
/* 직접 import 를 못 하는 이유: 그 파일은 `@tauri-apps/api/core` 를 import  */
/* 하는데 tsconfig.test.json / jest moduleNameMapper 에 매핑이 없어 ts-jest  */
/* 가 TS2307 로 컴파일을 거부한다(직접 확인). 매핑을 더하려면 이 발주가 손대지 */
/* 말라고 못 박은 두 설정 파일을 고쳐야 하므로, 옆 묶음                      */
/* (aiBridgeLifecycle.test.ts 의 「분기 도달 가능성」)이 이미 쓰는 방식대로    */
/* «소스 계약» 으로 본다. 종류 이름과 순서를 손으로 베끼지 않고 소스에서 찾는다.*/
/* ================================================================== */

describe("C1 — tauriAIBridge 가 종류를 «먼저» 본다", () => {
  const consumerSrc = readFileSync(
    join(__dirname, "..", "..", "src", "studio", "ai", "tauriAIBridge.ts"),
    "utf8",
  );

  test("오류에서 종류를 읽는다", () => {
    expect(consumerSrc).toContain("readAiFailureKind(e)");
  });

  test("네 종류가 각자의 칸으로 간다", () => {
    const table: Array<[string, string]> = [
      ["canceled", "aborted"],
      ["timeout", "timeout"],
      ["exit", "exit"],
      ["no-output", "exit"],
    ];
    for (const [failure, coreKind] of table) {
      const re = new RegExp(
        String.raw`failure === "${failure}"[\s\S]{0,400}?kind: "${coreKind}"`,
      );
      expect(re.test(consumerSrc)).toBe(true);
    }
  });

  test("종류 판별이 문면 판별보다 «먼저» 온다", () => {
    const firstKind = consumerSrc.indexOf('failure === "');
    const firstText = consumerSrc.search(/if \(\/[^/]+\/\.test\(msg\)\)/);
    expect(firstKind).toBeGreaterThanOrEqual(0);
    expect(firstText).toBeGreaterThanOrEqual(0);
    expect(firstKind).toBeLessThan(firstText);
  });

  test("문면 판별을 지우지 않았다 — 종류 없는 옛 오류 객체용 2차 층", () => {
    expect(consumerSrc).toContain("if (/시간 초과/.test(msg))");
    expect(consumerSrc).toContain("if (/CLI 종료 코드/.test(msg))");
  });
});
