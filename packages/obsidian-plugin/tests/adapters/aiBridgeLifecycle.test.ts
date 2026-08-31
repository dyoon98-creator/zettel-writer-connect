// aiBridgeLifecycle — startAiInvocation() 의 «유한 정착» 증명.
//
// 이 파일이 증명하는 것 하나: 어떤 경로로 끝나든 `done` 과 `tokens()` 가
// «유한 시간 안에» 정착한다. 실제 codex 는 부르지 않는다 — electronBridge 를
// mock 해 진짜 Node EventEmitter/PassThrough 로 만든 가짜 프로세스를 주입하고,
// aiBridge 의 실제 코드 경로(스트림 파싱·타이머·kill 승급·판정)를 그대로 태운다.
//
// 검사 방식 주의: 「timeout 으로 실패」가 아니라 `track()` 이 들고 있는
// settled 플래그를 직접 본다. 미정착이면 그 자리에서 즉시 FAIL 한다.

import { EventEmitter } from "events";
import { PassThrough } from "stream";
// jsdom 환경에는 전역 setImmediate 가 없다. Node 의 진짜 macrotask 를 쓴다
// (fake timer 로 대체되지 않아야 스트림 전달을 그대로 관찰할 수 있다).
import { setImmediate as realSetImmediate } from "timers";
import { readFileSync } from "fs";
import { join } from "path";

import { startAiInvocation } from "../../src/adapters/aiBridge";

/* ------------------------------------------------------------------ */
/* 가짜 프로세스 주입                                                    */
/* ------------------------------------------------------------------ */

interface SpawnRecord {
  binary: string;
  args: string[];
  opts: Record<string, unknown>;
}

class FakeChild extends EventEmitter {
  pid = 90210;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  killSignals: string[] = [];
  killed = false;

  kill(signal = "SIGTERM"): boolean {
    this.killSignals.push(signal);
    this.killed = true;
    return true;
  }

  /** 죽으라는 신호를 받으면 실제로 죽는 «착한» 자식. */
  dieOnSignal(code: number | null = null, sig: string | null = "SIGTERM"): void {
    const orig = this.kill.bind(this);
    this.kill = (s = "SIGTERM"): boolean => {
      const r = orig(s);
      realSetImmediate(() => this.endProcess(code, sig ?? s));
      return r;
    };
  }

  /**
   * spawn 자체가 실패한 경우의 «실측» 이벤트 순서 (Node v26, probe):
   *   ["error:ENOENT", "stdout-iter-ended", "stderr-iter-ended", "close:-2/null"]
   * — 'exit' 은 끝내 오지 않는다.
   */
  failSpawn(err: Error): void {
    this.emit("error", err);
    this.stdout.end();
    this.stderr.end();
    realSetImmediate(() => this.emit("close", -2, null));
  }

  /** exit + close + 스트림 종료까지 정상적으로 마치는 종료. */
  endProcess(code: number | null, signal: string | null = null): void {
    if (!this.stdout.writableEnded) this.stdout.end();
    if (!this.stderr.writableEnded) this.stderr.end();
    this.emit("exit", code, signal);
    realSetImmediate(() => this.emit("close", code, signal));
  }
}

let mockChild: FakeChild | null = null;
let mockSpawns: SpawnRecord[] = [];
let mockGroupKills: Array<{ pid: number; signal: string }> = [];
let mockGroupKillWorks = true;
let mockSpawnThrows: Error | null = null;

function mockElectronRequire(name: string): unknown {
  if (name === "node:child_process" || name === "child_process") {
    return {
      spawn: (
        binary: string,
        args: string[],
        opts: Record<string, unknown>,
      ): FakeChild => {
        mockSpawns.push({ binary, args, opts });
        if (mockSpawnThrows) throw mockSpawnThrows;
        mockChild = new FakeChild();
        return mockChild;
      },
      execSync: (): string => "/usr/bin:/bin",
    };
  }
  if (name === "process") {
    return {
      env: { PATH: "/usr/bin:/bin", HOME: "/home/tester", SHELL: "/bin/zsh" },
      kill: (pid: number, signal: string): void => {
        mockGroupKills.push({ pid, signal });
        if (!mockGroupKillWorks) {
          throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
        }
        // 그룹 kill 이 통하면 자식도 같이 죽는다 (probe: detached 그룹 kill).
        if (mockChild) mockChild.kill(signal);
      },
    };
  }
  return null;
}

jest.mock("../../src/adapters/electronBridge", () => ({
  electronAvailable: (): boolean => true,
  electronRequire: (name: string): unknown => mockElectronRequire(name),
}));

// tauriAIBridge 가 끌어오는 Tauri 모듈은 jest 에 없다 — virtual mock.
jest.mock(
  "@tauri-apps/api/core",
  () => ({ invoke: jest.fn(async () => true) }),
  { virtual: true },
);

/* ------------------------------------------------------------------ */
/* 정착 추적 도구                                                       */
/* ------------------------------------------------------------------ */

interface Tracked<T> {
  settled: boolean;
  value?: T;
  error?: unknown;
}

function track<T>(p: Promise<T>): Tracked<T> {
  const state: Tracked<T> = { settled: false };
  p.then(
    (v) => {
      state.settled = true;
      state.value = v;
    },
    (e) => {
      state.settled = true;
      state.error = e;
    },
  );
  return state;
}

/** 실제 macrotask 를 n 번 돌린다 (스트림 전달은 fake timer 를 안 쓴다). */
async function tick(times = 8): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => realSetImmediate(r));
  }
}

async function advance(ms: number): Promise<void> {
  await jest.advanceTimersByTimeAsync(ms);
  await tick(4);
}

interface TokenRun {
  tokens: string[];
  error: unknown;
}

function collectTokens(
  handle: { tokens: () => AsyncIterable<string> },
): { state: Tracked<TokenRun>; out: string[] } {
  const out: string[] = [];
  const state = track(
    (async (): Promise<TokenRun> => {
      try {
        for await (const t of handle.tokens()) out.push(t);
        return { tokens: out, error: null };
      } catch (e) {
        return { tokens: out, error: e };
      }
    })(),
  );
  return { state, out };
}

let infoLogs: string[] = [];
let infoSpy: jest.SpyInstance;

function loggedVerdict(): string {
  return infoLogs.join("\n");
}

function start(over: Partial<Parameters<typeof startAiInvocation>[0]> = {}) {
  return startAiInvocation({
    provider: "claude-code",
    binaryPath: "/fake/bin/cli",
    extraArgs: [],
    prompt: "안녕",
    timeoutSecs: 30,
    ...over,
  });
}

beforeEach(() => {
  jest.useFakeTimers({
    doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "performance"],
  });
  mockChild = null;
  mockSpawns = [];
  mockGroupKills = [];
  mockGroupKillWorks = true;
  mockSpawnThrows = null;
  infoLogs = [];
  infoSpy = jest.spyOn(console, "info").mockImplementation((...a: unknown[]) => {
    infoLogs.push(a.map(String).join(" "));
  });
});

afterEach(() => {
  infoSpy.mockRestore();
  jest.useRealTimers();
});

/* ================================================================== */
/* P1 — 없는 바이너리: 'error' 는 오고 'exit' 은 영영 안 온다             */
/* ================================================================== */

describe("P1 spawn 'error' (ENOENT) — 'exit' 없음", () => {
  test("done 은 reject 하고 tokens() 는 끝난다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    // 실측(probe): ENOENT 는 'error' 만 오고 'exit' 은 절대 안 온다.
    const err = Object.assign(new Error("spawn /fake/bin/cli ENOENT"), {
      code: "ENOENT",
    });
    mockChild!.failSpawn(err);
    await tick();

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(/ENOENT/);
    expect(String((done.error as Error).message)).toMatch(/프로세스 시작 실패/);
    expect(toks.state.settled).toBe(true);
  });

  test("'error' 리스너가 있어 uncaught 로 새지 않는다", () => {
    const handle = start();
    track(handle.done);
    // 리스너가 없으면 EventEmitter 가 여기서 throw 한다.
    expect(() =>
      mockChild!.emit("error", new Error("spawn ENOENT")),
    ).not.toThrow();
  });
});

/* ================================================================== */
/* P2 — stdin EPIPE                                                    */
/* ================================================================== */

describe("P2 stdin EPIPE", () => {
  test("자식이 죽은 뒤 stdin 오류가 나도 uncaught 없이 정착한다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    mockChild!.endProcess(0, null);
    await tick();

    // 실측(probe): EPIPE 는 sync throw 가 아니라 stream 'error' 이벤트다.
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    expect(() => mockChild!.stdin.emit("error", epipe)).not.toThrow();
    await tick();

    expect(done.settled).toBe(true);
    expect(toks.state.settled).toBe(true);
  });

  test("자식이 살아있을 때 난 stdin 오류는 실패 문면에 남는다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    mockChild!.stdin.emit("error", epipe);
    await tick();
    mockChild!.endProcess(1, null);
    await tick();

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(/EPIPE/);
    expect(toks.state.settled).toBe(true);
  });
});

/* ================================================================== */
/* P3 — 타임아웃                                                        */
/* ================================================================== */

describe("P3 타임아웃", () => {
  test("SIGTERM 에 죽는 자식 — '시간 초과' 문면으로 reject", async () => {
    const handle = start({ timeoutSecs: 30 });
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();
    mockChild!.dieOnSignal(null, "SIGTERM");

    await advance(30_000);
    await advance(100);

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(/시간 초과/);
    expect(toks.state.settled).toBe(true);
  });

  test("신호를 무시하는 자식 — '프로세스 종료를 확인하지 못함' 으로 reject", async () => {
    const handle = start({ timeoutSecs: 30 });
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();
    // dieOnSignal 을 안 건다 = SIGTERM/SIGKILL 다 무시하는 자식.

    await advance(30_000); // 타임아웃
    await advance(2_000); // SIGKILL 승급
    await advance(3_100); // 마지막 확인 유예

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(
      /프로세스 종료를 확인하지 못함/,
    );
    expect(toks.state.settled).toBe(true);
    expect(mockChild!.killSignals).toContain("SIGKILL");
  });
});

/* ================================================================== */
/* P4 — 손자 프로세스가 stdout 파이프를 물고 있다                         */
/* ================================================================== */

describe("P4 손자가 stdout 을 붙들고 있음", () => {
  test("'exit' 은 왔는데 stdout 이 안 닫혀도 유한 시간에 정착한다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    mockChild!.stdout.write("hello\n");
    await tick();
    // 자식은 죽었지만 손자가 파이프를 물고 있어 stdout/close 가 안 온다.
    mockChild!.emit("exit", 0, null);
    await tick();

    expect(done.settled).toBe(false); // 아직은 배수 대기 중

    await advance(5_000); // 드레인 마감
    await advance(1_100); // 강제 destroy 후 마무리

    expect(done.settled).toBe(true);
    expect(done.error).toBeUndefined();
    expect(toks.state.settled).toBe(true);
    expect(toks.out).toEqual(["hello\n"]);
  });

  test("손자까지 잡도록 프로세스 그룹으로 kill 을 보낸다", async () => {
    const handle = start({ timeoutSecs: 10 });
    track(handle.done);
    collectTokens(handle);
    await tick();

    expect(mockSpawns[0].opts.detached).toBe(true);

    await advance(10_000);
    expect(mockGroupKills.some((k) => k.pid === -90210)).toBe(true);
  });
});

/* ================================================================== */
/* P5 — 취소                                                           */
/* ================================================================== */

describe("P5 취소", () => {
  test("cancel() 은 취소 사유로 reject 하고 tokens() 를 끝낸다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    void handle.cancel();
    await tick();

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(/취소/);
    expect(toks.state.settled).toBe(true);
  });

  test("cancel 후에도 SIGKILL 승급이 살아있다", async () => {
    const handle = start();
    track(handle.done);
    collectTokens(handle);
    await tick();

    void handle.cancel();
    await tick();
    expect(mockChild!.killSignals).toContain("SIGTERM");

    await advance(2_100);
    expect(mockChild!.killSignals).toContain("SIGKILL");
  });

  test("이미 abort 된 signal 이면 프로세스를 아예 만들지 않는다", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const handle = start({ signal: ctrl.signal });
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    expect(mockSpawns.length).toBe(0);
    expect(done.settled).toBe(true);
    expect(toks.state.settled).toBe(true);
  });

  test("AbortSignal 로도 같은 경로를 탄다", async () => {
    const ctrl = new AbortController();
    const handle = start({ signal: ctrl.signal });
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    ctrl.abort();
    await tick();

    expect(done.settled).toBe(true);
    expect(toks.state.settled).toBe(true);
  });
});

/* ================================================================== */
/* 추가 경로 — 발주 E1~E5 에 없던 것들                                    */
/* ================================================================== */

describe("추가로 찾은 미정착 경로", () => {
  test("stdout 스트림 자체가 error 를 내도 done 이 정착한다", async () => {
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    mockChild!.stdout.destroy(new Error("EIO: stdout 폭발"));
    await tick();
    mockChild!.emit("exit", 0, null);
    await tick();
    await advance(5_100);
    await advance(1_100);

    expect(done.settled).toBe(true);
    expect(toks.state.settled).toBe(true);
  });

  test("tokens() 를 둘이 동시에 소비해도 둘 다 끝난다", async () => {
    const handle = start();
    const done = track(handle.done);
    const a = collectTokens(handle);
    const b = collectTokens(handle);
    await tick();

    mockChild!.stdout.write("x\n");
    await tick();
    mockChild!.endProcess(0, null);
    await tick();

    expect(done.settled).toBe(true);
    expect(a.state.settled).toBe(true);
    expect(b.state.settled).toBe(true);
  });

  test("자식이 exit 없이 close 만 내도 정착한다", async () => {
    const handle = start({ timeoutSecs: 30 });
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    mockChild!.stdout.end();
    mockChild!.stderr.end();
    mockChild!.emit("close", 0, null);
    await tick();
    await advance(30_000);
    await advance(5_200);

    expect(done.settled).toBe(true);
    expect(toks.state.settled).toBe(true);
  });

  test("spawn 이 동기 throw 해도 정착한다", async () => {
    mockSpawnThrows = new Error("EACCES");
    const handle = start();
    const done = track(handle.done);
    const toks = collectTokens(handle);
    await tick();

    expect(done.settled).toBe(true);
    expect(String((done.error as Error).message)).toMatch(/EACCES/);
    expect(toks.state.settled).toBe(true);
  });
});

/* ================================================================== */
/* C3 — 판정 다섯 칸                                                    */
/* ================================================================== */

describe("C3 판정 다섯 칸", () => {
  test("① 종료 확인 · 출력 0바이트 → 정상 — 출력 없음", async () => {
    const handle = start();
    const done = track(handle.done);
    collectTokens(handle);
    await tick();
    mockChild!.endProcess(0, null);
    await tick();

    expect(done.settled).toBe(true);
    expect(loggedVerdict()).toContain("판정: 정상 — 출력 없음");
  });

  test("② 종료 확인 · 전부 처리 → 정상 — N바이트", async () => {
    const handle = start();
    const done = track(handle.done);
    collectTokens(handle);
    await tick();
    mockChild!.stdout.write("hello\n");
    await tick();
    mockChild!.endProcess(0, null);
    await tick();

    expect(done.settled).toBe(true);
    expect(loggedVerdict()).toContain("판정: 정상 — 6바이트");
  });

  test("③ 종료 확인 · 일부만 처리 → 부분 — N 중 M + 사유", async () => {
    const handle = start();
    const done = track(handle.done);
    collectTokens(handle);
    await tick();
    // "line1\npart" = 10바이트, 완결된 줄은 6바이트뿐. 나머지는 스트림이
    // 안 닫혀 영영 안 온다 → 드레인 마감이 잘라낸다.
    mockChild!.stdout.write("line1\npart");
    await tick();
    mockChild!.emit("exit", 0, null);
    await tick();
    await advance(5_100);
    await advance(1_100);

    expect(done.settled).toBe(true);
    expect(loggedVerdict()).toContain("판정: 부분 — 10 중 6");
    expect(loggedVerdict()).toContain("드레인 마감 초과");
  });

  test("④ 종료 확인 · 0건 처리 → 이상 — N 중 0건", async () => {
    const handle = start();
    const done = track(handle.done);
    collectTokens(handle);
    await tick();
    mockChild!.stdout.write("partial"); // 7바이트, 완결된 줄 없음
    await tick();
    mockChild!.emit("exit", 0, null);
    await tick();
    await advance(5_100);
    await advance(1_100);

    expect(done.settled).toBe(true);
    expect(loggedVerdict()).toContain("판정: 이상 — 7 중 0건");
  });

  test("⑤ 종료 신호 못 받음 → 이상 — 프로세스 종료를 확인하지 못함 + 경로", async () => {
    const handle = start({ timeoutSecs: 30 });
    const done = track(handle.done);
    collectTokens(handle);
    await tick();

    await advance(30_000);
    await advance(2_000);
    await advance(3_100);

    expect(done.settled).toBe(true);
    expect(loggedVerdict()).toContain(
      "판정: 이상 — 프로세스 종료를 확인하지 못함",
    );
    expect(loggedVerdict()).toContain("경로: timeout");
  });

  test("첫 칸과 마지막 칸은 서로 다른 말이다", async () => {
    // ① 출력 0바이트 · 정상 종료
    const h1 = start();
    const d1 = track(h1.done);
    collectTokens(h1);
    await tick();
    mockChild!.endProcess(0, null);
    await tick();
    const firstLogs = infoLogs.join("\n");
    expect(d1.settled).toBe(true);

    infoLogs = [];

    // ⑤ 종료 신호 못 받음
    const h2 = start({ timeoutSecs: 30 });
    const d2 = track(h2.done);
    collectTokens(h2);
    await tick();
    await advance(30_000);
    await advance(2_000);
    await advance(3_100);
    const lastLogs = infoLogs.join("\n");
    expect(d2.settled).toBe(true);

    expect(firstLogs).toContain("정상 — 출력 없음");
    expect(lastLogs).toContain("이상 — 프로세스 종료를 확인하지 못함");
    expect(firstLogs).not.toContain("이상");
    expect(lastLogs).not.toContain("정상 — 출력 없음");
  });
});

/* ================================================================== */
/* C2 — 저장한 값을 읽는 쪽까지 이어지는가                                */
/* ================================================================== */

describe("C2 tauriAIBridge 의 분기 도달 가능성", () => {
  // tauriAIBridge.ts 는 이 발주에서 «고치지 않는다». 대신 그 파일의 «진짜»
  // 분기 조건을 소스에서 읽어와, aiBridge 가 실제로 만드는 문면이 그 조건에
  // 걸리는지 본다. 여기 정규식을 손으로 베껴 적으면 소비자 쪽이 바뀔 때
  // 조용히 어긋나므로, 반드시 소스에서 추출한다.
  //
  // 직접 import 를 안 쓰는 이유: tauriAIBridge 는 `@tauri-apps/api/core` 를
  // import 하는데 tsconfig.test.json / jest moduleNameMapper 에 그 경로 매핑이
  // 없어 ts-jest 가 TS2307 로 컴파일을 거부한다. 매핑 추가는 이 발주의 허용
  // 파일 넷 밖이라 손대지 않았다(보고서 7항).
  const consumerSrc = readFileSync(
    join(__dirname, "..", "..", "src", "studio", "ai", "tauriAIBridge.ts"),
    "utf8",
  );

  function branchRegexFor(kind: string): RegExp {
    const m = consumerSrc.match(
      new RegExp(
        String.raw`if \(\/([^/]+)\/\.test\(msg\)\)[\s\S]{0,160}?kind: "${kind}"`,
      ),
    );
    if (!m) {
      throw new Error(`tauriAIBridge 에서 kind:"${kind}" 분기 정규식을 못 찾았다`);
    }
    return new RegExp(m[1]);
  }

  async function messageOf(run: () => Promise<void>): Promise<string> {
    const handle = start({ timeoutSecs: 30 });
    const done = track(handle.done);
    collectTokens(handle);
    await tick();
    await run();
    expect(done.settled).toBe(true);
    return String((done.error as Error).message);
  }

  test("타임아웃 문면이 kind:'timeout' 분기에 걸린다 (이전엔 죽은 코드)", async () => {
    const msg = await messageOf(async () => {
      mockChild!.dieOnSignal(null, "SIGTERM");
      await advance(30_000);
      await advance(200);
    });

    expect(msg).toMatch(/시간 초과/);
    expect(branchRegexFor("timeout").test(msg)).toBe(true);
    // exit 분기보다 먼저 걸려야 timeout 으로 분류된다.
    expect(branchRegexFor("exit").test(msg)).toBe(false);
  });

  test("0 아닌 종료 코드 문면이 kind:'exit' 분기에 걸린다 (이전엔 죽은 코드)", async () => {
    const msg = await messageOf(async () => {
      mockChild!.stderr.write("boom\n");
      await tick();
      mockChild!.endProcess(3, null);
      await tick();
    });

    expect(branchRegexFor("exit").test(msg)).toBe(true);
    expect(branchRegexFor("timeout").test(msg)).toBe(false);
  });
});
