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
//
// ---------------------------------------------------------------------------
// 수명(lifecycle) 계약 — 「영원히 안 끝나는 경로」를 남기지 않는다
// ---------------------------------------------------------------------------
// `done` 과 `tokens()` 는 «반드시» 유한 시간 안에 정착한다. 상한은
//   timeoutSecs + KILL_GRACE_MS + KILL_CONFIRM_MS + DRAIN_GRACE_MS + DRAIN_HARD_MS
// 이며, 아래 사실들을 실측(Node v26, macOS)해 그에 맞춰 설계했다.
//
//   1) spawn 실패(ENOENT)는 `'error'` 만 오고 `'exit'` 은 «절대» 안 온다.
//      → `'exit'` 만 기다리면 영구 대기. `'error'` 리스너가 없으면 그 예외는
//        EventEmitter 가 throw 해 renderer 의 uncaught 로 새고, 우리 async
//        IIFE 밖에서 터지므로 `done` 은 정착하지 않는다.
//   2) EPIPE 는 `write()` 의 동기 throw 가 아니라 stdin 의 `'error'` 이벤트다.
//      → try/catch 로는 절대 못 잡는다. 리스너가 있어야 uncaught 를 막는다.
//   3) 손자 프로세스가 stdout 파이프를 상속해 살아 있으면 자식이 죽어도
//      스트림이 안 닫힌다(실측: 자식 exit +4ms, 파이프 해제 +6,010ms).
//      `'close'` 도 그때까지 안 온다. → `await stdoutTask` 는 영구 대기.
//      그래서 (a) detached 프로세스 «그룹» kill 로 손자까지 정리하고,
//      (b) exit 관측 «후에만» 배수 마감(DRAIN_GRACE_MS)을 건다.
//      배수 마감은 exit 이후에만 켜지므로 살아 있는 호출을 자르지 않는다
//      (정상 배수 실측 1~4ms 대 마감 5,000ms).
//   4) 스트림을 destroy 하면 진행 중인 `for await` 는 끝나는 게 아니라
//      ERR_STREAM_PREMATURE_CLOSE 를 «throw» 한다. 그 예외가 IIFE 로 새면
//      `void (async…)()` 가 삼켜 `done` 이 영구 pending 이 된다.
//      → 스트림 소비 태스크는 자체 try/catch 로 절대 reject 하지 않는다.

import { electronRequire } from "./electronBridge";
import { getExpandedPathString } from "./findBinary";
import { getCodexArgSettings, type CodexArgSettings } from "./appSettings";

const STDERR_TAIL_BYTES = 2 * 1024;
/** SIGTERM 이후 SIGKILL 로 승급하기까지의 유예. */
const KILL_GRACE_MS = 2_000;
/** SIGKILL 이후에도 종료 신호를 못 받았다고 판정하기까지의 마지막 유예. */
const KILL_CONFIRM_MS = 3_000;
/** 프로세스 종료를 «관측한 뒤» stdout/stderr 배수를 기다리는 마감. */
const DRAIN_GRACE_MS = 5_000;
/** 배수 마감 후 스트림을 destroy 하고 태스크 회수를 기다리는 최후 상한. */
const DRAIN_HARD_MS = 1_000;
/**
 * 기본 모델 slug. **한 글자라도 틀리면 턴이 HTTP 400 으로 실패한다** — codex 는
 * 없는 slug 를 조용히 대체하지 않는다. 카탈로그(`codex debug models --bundled`)에
 * `gpt-5.6` 단독은 «없고» `gpt-5.6-sol`·`gpt-5.6-terra`·`gpt-5.6-luna` 셋뿐이다.
 * 이 값(`terra`)은 대표 확정값이라 실행자가 다른 변종으로 바꾸지 않는다.
 * 테스트가 문자열을 그대로 고정한다(`tests/adapters/aiBridge.test.ts`).
 */
const CODEX_DEFAULT_MODEL = "gpt-5.6-terra";

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
  /** 종료 처리 판정 문면 (아래 `classifyOutcome` 의 다섯 칸 중 하나). */
  verdict?: string;
}

/**
 * 실패의 «종류». 아래 `AiOutcomeKind`(종료 처리 판정)와 «같은 방식» 으로 둔다 —
 * 문자열 리터럴 합집합 + 사람이 읽는 문면을 나란히. 새 체계가 아니라 이 파일이
 * 이미 쓰던 방식의 두 번째 적용이다.
 *
 * 왜 필요한가 — 종전에는 실패를 «문면» 으로만 표현했다. 그래서 화면과 상위
 * 어댑터가 한국어 문장을 문자열 매칭해 종류를 되짚었고(`"사용자가 취소했습니다"`
 * 포함 검사, `/시간 초과/`·`/CLI 종료 코드/` 정규식), 문면을 한 글자만 고치면
 * 판별이 «조용히» 깨졌다. 사용자는 자기가 누른 그만두기에 빨간 오류 배너를 다시
 * 보게 된다.
 *
 * 왜 다섯인가 — 실제 실패 «경로» 는 아홉이지만, 소비처가 «구별해야 하는» 것만
 * 종류로 올렸다. 구별할 필요 없는 것을 나누면 소비처의 분기만 늘어난다.
 *
 *   - `canceled`  사용자가 그만뒀다. 화면이 이것만은 «고장» 과 갈라야 한다
 *                 (그만두기는 오류가 아니다).
 *   - `timeout`   한계 시간을 넘겨 우리가 끊었다. 사용자에게 「다시, 더 짧게」를
 *                 권해야 하는 유일한 칸.
 *   - `exit`      떴고 끝났는데 종료 코드가 0이 아니다. 상위가 종료 코드·stderr
 *                 를 함께 실어 보내는 칸(core `AIBridgeError.kind === "exit"`).
 *   - `no-output` 떴고 «0으로» 끝났는데 본문이 없다. 위 `exit` 과 갈라야 한다 —
 *                 CLI 는 성공했고 원고만 없는 것이라 사유가 다르다.
 *   - `process`   그 밖에 「프로세스를 온전히 돌리지 못함」 전부: 작업 디렉터리
 *                 실패·spawn 실패(ENOENT 포함)·stdin 쓰기 실패·종료 미확인·내부
 *                 오류. 상위는 이 다섯을 모두 같은 칸(core `"spawn"`)으로 옮기고
 *                 사용자에게도 같은 말을 한다 — 나눠도 쓸 데가 없다.
 *
 * 종료를 «확인하지 못함» 을 따로 두지 않은 이유: 그 사실은 이미 `AiOutcomeKind`
 * 의 `no-exit` 칸과 `verdict` 문면이 보유한다. 여기 또 두면 같은 사실이 두 곳에
 * 산다.
 */
export type AiFailureKind =
  | "canceled"
  | "timeout"
  | "exit"
  | "no-output"
  | "process";

export interface AiInvocationError extends Error {
  kind: "ai-error";
  /**
   * 실패의 종류. 문면과 «나란히» 산다 — 문면은 그대로 남는다(더하되 빼지 않음).
   * 종류가 없는 옛 오류 객체가 흘러들 수 있으므로, 읽는 쪽은 `readAiFailureKind`
   * 를 써서 «종류 먼저, 없으면 문면» 순서로 본다.
   */
  failure: AiFailureKind;
  message: string;
  stderr: string;
}

const ALL_FAILURE_KINDS: readonly AiFailureKind[] = [
  "canceled",
  "timeout",
  "exit",
  "no-output",
  "process",
];

/**
 * 오류에 «실려 온» 실패 종류를 읽는다. 실려 있지 않으면 `null`.
 *
 * 이것은 판별의 **1차** 층이다. `null` 을 받은 쪽은 그 자리에 원래 있던 **2차**
 * 층(문면 판별)으로 떨어진다 — 2차를 여기로 끌어오지 않는 이유는, 소비처마다
 * 알아보는 문면이 다르고(`AiWaitBar` 는 취소 문면, `tauriAIBridge` 는 시간
 * 초과·종료 코드) 그 문면 판별을 «지우지 않는 것» 이 이 변경의 조건이기 때문이다.
 * 여기로 옮기면 소비처의 그 줄이 사라진다.
 *
 * 모르는 문자열이 `failure` 자리에 들어와도 종류로 인정하지 않는다 — 다섯 칸에
 * 없으면 `null` 이다. 오타난 값이 종류인 척하고 지나가면 처음 문제로 되돌아간다.
 */
export function readAiFailureKind(e: unknown): AiFailureKind | null {
  if (e === null || e === undefined) return null;
  if (typeof e !== "object" && typeof e !== "function") return null;
  const tagged = (e as { failure?: unknown }).failure;
  if (
    typeof tagged === "string" &&
    (ALL_FAILURE_KINDS as readonly string[]).includes(tagged)
  ) {
    return tagged as AiFailureKind;
  }
  return null;
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
  failure: AiFailureKind;
  // `failure` 는 «필수» 인자다. 새 실패 경로를 만들면서 종류를 빠뜨리면
  // 컴파일이 막힌다 — 문면만 있고 종류가 없는 오류를 다시 만들지 않기 위해서다.
  constructor(message: string, stderr: string, failure: AiFailureKind) {
    super(message);
    this.name = "AiInvocationError";
    this.stderr = stderr;
    this.failure = failure;
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

/**
 * 호출에서 «남의 짐» 을 떼는 두 플래그. 둘 다 기본으로 붙고, 설정에서 각각
 * 되돌릴 수 있다(`AppSettings.codexIgnoreUserConfig` / `codexDisableShellTool`).
 *
 * 실측(2026-08-31, 같은 프롬프트 열 글자):
 *   현재 인자만            → 입력 34,418 토큰 / 9초
 *   두 플래그 추가         → 입력 22,932 토큰 / 6초, `command_execution` 0건
 *
 * - `--ignore-user-config` — `$CODEX_HOME/config.toml` 을 «안 읽는다».
 *   `codex exec --help` 원문: "Do not load `$CODEX_HOME/config.toml`; auth still
 *   uses `CODEX_HOME`". 즉 **로그인(auth)은 그대로 유지된다.**
 * - `--disable shell_tool` — 셸 도구를 끈다. `codex features list` 기준
 *   `shell_tool stable true` 로 «기본이 켜짐» 이라, 텍스트 생성 요청에도
 *   codex 가 `command_execution` 을 실행했다. `--help` 원문상 `--disable` 은
 *   repeatable 이며 `-c features.<name>=false` 와 같다.
 */
export function buildCodexArgs(
  ctx: CodexCtx,
  extra: string[],
  opts: CodexArgSettings = getCodexArgSettings(),
): string[] {
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
  if (opts.codexIgnoreUserConfig) args.push("--ignore-user-config");
  if (opts.codexDisableShellTool) args.push("--disable", "shell_tool");
  const userHasModel = extra.some((a) => a === "-m" || a === "--model");
  if (!userHasModel) args.push("-m", CODEX_DEFAULT_MODEL);
  for (const a of extra) if (a) args.push(a);
  args.push("-");
  return args;
}

/** JSONL 한 줄을 객체로. 빈 줄·비 JSON 은 null. */
function parseJsonLine(line: string): Record<string, unknown> | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const v = JSON.parse(t) as unknown;
    if (!v || typeof v !== "object") return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 비어 있지 않은 문자열이면 그대로, 아니면 "". */
function strField(o: Record<string, unknown> | undefined, key: string): string {
  if (!o) return "";
  const v = o[key];
  return typeof v === "string" && v.length > 0 ? v : "";
}

/**
 * `item` 이벤트의 종류. codex 0.151 은 `item.type`, 구 codex 는 `item.item_type`
 * 을 쓴다. 둘 다 받는다 — «더하되 빼지 않는다».
 */
function itemKind(item: Record<string, unknown> | undefined): string {
  return strField(item, "type") || strField(item, "item_type");
}

/**
 * 이 이벤트는 «오류» 인가. 본문 후보에서 빼기 위한 판정이다.
 *
 * 오류 이벤트도 `message` 필드를 가진다. 그래서 옛 필드명 경로(2차)의 역방향
 * 스캔이 턴 «맨 뒤» 에 있는 오류를 먼저 만나 그 문면을 원고로 돌려줬다.
 * 사용자는 자기가 주문한 글 대신 `stream disconnected before completion`
 * 같은 영어 오류를 원고 칸에서 보게 된다.
 *
 * 세 모양을 오류로 본다 (셋 다 실물 관측 또는 원본 구현이 이미 오류로 다루던 것):
 *   - `{"type":"error","message":"…"}`
 *   - `{"type":"turn.failed", …}`
 *   - `{"type":"item.completed","item":{"type":"error","message":"…"}}`
 *
 * 이 판정과 `extractCodexFailureReason` 의 1·2차 인식 범위는 «같은 집합» 이다.
 * 한쪽이 오류로 읽는 것을 다른 쪽이 본문으로 읽으면 안 된다.
 */
function isErrorEvent(v: Record<string, unknown>): boolean {
  const ty = typeof v.type === "string" ? v.type : "";
  if (ty === "error" || ty === "turn.failed") return true;
  const item = v.item as Record<string, unknown> | undefined;
  if (item && typeof item === "object" && itemKind(item) === "error") {
    return true;
  }
  return false;
}

/**
 * stdout JSONL 의 역방향 스캔으로 마지막 «본문» 텍스트 추출.
 *
 * 두 벌을 순서대로 본다. 실물이 먼저다.
 *
 * 1차 — codex 0.151 의 실제 모양:
 *   `{"type":"item.completed","item":{"type":"agent_message","text":"…"}}`
 *   본문은 `item.text` 에 들어 있고 최상위에는 `message` 도 `output` 도 없다.
 *   그래서 2차만 있던 종전 구현은 **한 건도 못 걸러 언제나 `null`** 이었고,
 *   그 결과 호출부의 `?? stdoutAcc` 가 발동해 raw JSONL 전문이 원고로 갔다.
 *
 * 2차 — 옛 필드명 경로(`message` / `output` / `turn.message`). 다른 provider·
 *   구버전 호환이라 «그대로» 남긴다.
 *
 * 무엇이 본문인가 — 두 가지를 뺀다. «지원 경로» 를 빼는 것이 아니라 «본문의
 * 정의» 를 좁히는 것이다.
 *   (가) `agent_message` 만 본문으로 인정한다. `reasoning` 도 `text` 를 갖지만
 *        그것은 생각의 요약이지 사용자가 주문한 원고가 아니다.
 *   (나) 오류 이벤트(`isErrorEvent`)는 어느 경로로도 본문이 되지 못한다.
 *        오류는 `extractCodexFailureReason` 이 «실패 사유» 로 따로 다룬다.
 *
 * 여러 개의 `agent_message` 가 온 턴에서는 «마지막» 것이 원고다. 1차 경로인
 * `--output-last-message` 파일의 정의와 같게 맞춘 것이다 — `codex exec --help`
 * 원문(codex-cli 0.151.0): "Specifies file where **the last message from the
 * agent** should be written". 여기서만 이어붙이면 같은 턴이 파일을 읽었느냐
 * 못 읽었느냐에 따라 다른 원고를 낸다.
 */
export function extractLastCodexMessage(stdout: string): string | null {
  const lines = stdout.split("\n");

  // 1차: item.* 이벤트의 agent_message.
  for (let i = lines.length - 1; i >= 0; i--) {
    const v = parseJsonLine(lines[i]);
    if (!v) continue;
    const item = v.item as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") continue;
    if (itemKind(item) !== "agent_message") continue;
    const text = strField(item, "text") || strField(item, "message");
    if (text) return text;
  }

  // 2차: 옛 필드명 경로 (필드 선택 규칙은 원본 그대로 — 오류만 후보에서 뺀다).
  for (let i = lines.length - 1; i >= 0; i--) {
    const v = parseJsonLine(lines[i]);
    if (!v) continue;
    if (isErrorEvent(v)) continue;
    const msg =
      (typeof v.message === "string" && v.message) ||
      (typeof v.output === "string" && v.output) ||
      (typeof (v.turn as { message?: unknown } | undefined)?.message ===
        "string"
        ? ((v.turn as { message: string }).message as string)
        : "");
    if (msg) return msg;
  }
  return null;
}

/** 240자 초과분을 자르고, 중첩 JSON 이면 안쪽 사유를 꺼낸다. */
function normalizeFailureMessage(msg: string): string {
  try {
    const inner = JSON.parse(msg) as Record<string, unknown>;
    const innerMsg = (inner.error as { message?: unknown } | undefined)?.message;
    if (typeof innerMsg === "string") return innerMsg;
  } catch {
    /* msg 는 평문 */
  }
  return msg.length > 240 ? `${msg.slice(0, 240)}...` : msg;
}

/**
 * 실패 사유 추출. 두 벌을 «순서대로» 본다.
 *
 * 1차 — 최상위 `type` 이 `error` / `turn.failed` 인 이벤트 (원본 동작 그대로).
 * 2차 — `{"type":"item.completed","item":{"type":"error","message":"…"}}`.
 *   codex 가 item 오류만 내고 0이 아닌 코드로 죽는 경우가 있는데, 1차만 있던
 *   종전 구현은 이걸 못 봐서 사용자에게 「사유 미상」이 떴다.
 *
 * 순서가 뒤집히면 안 된다. 2차를 먼저 보면 시작 무렵의 무해한 안내(스킬 설명
 * 예산 등)가 «진짜» 실패 사유를 밀어내고, `?? stderrTail` 로 가야 할 경로까지
 * 막는다.
 */
export function extractCodexFailureReason(stdout: string): string | null {
  const lines = stdout.split("\n");

  // 1차: 최상위 오류 이벤트.
  for (let i = lines.length - 1; i >= 0; i--) {
    const v = parseJsonLine(lines[i]);
    if (!v) continue;
    const ty = typeof v.type === "string" ? v.type : "";
    if (ty !== "error" && ty !== "turn.failed") continue;
    const msg =
      strField(v, "message") ||
      (typeof (v.error as { message?: unknown } | undefined)?.message ===
        "string"
        ? ((v.error as { message: string }).message as string)
        : "");
    if (!msg) continue;
    return normalizeFailureMessage(msg);
  }

  // 2차: item 단위 오류.
  for (let i = lines.length - 1; i >= 0; i--) {
    const v = parseJsonLine(lines[i]);
    if (!v) continue;
    const item = v.item as Record<string, unknown> | undefined;
    if (!item || typeof item !== "object") continue;
    if (itemKind(item) !== "error") continue;
    const msg = strField(item, "message") || strField(item, "text");
    if (!msg) continue;
    return normalizeFailureMessage(msg);
  }
  return null;
}

interface SpawnedProcess {
  pid?: number;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill: (signal?: string) => boolean;
  on(
    event: "exit" | "close",
    listener: (code: number | null, signal: string | null) => void,
  ): void;
  on(event: "error", listener: (err: Error) => void): void;
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
    // detached:true 로 자식을 프로세스 «그룹 리더» 로 만든다. codex CLI 는
    // command_execution 이벤트로 손자를 만드는데, detached:false 면 자식은
    // 옵시디언과 같은 그룹이라 그룹 kill 을 쓸 수 없고(옵시디언 자신을 죽인다)
    // child.kill() 은 손자를 남긴다. 남은 손자는 stdout 파이프를 계속 붙들어
    // 스트림이 안 닫히고, 그게 `done` 영구 대기의 근원이었다.
    // unref() 는 하지 않는다 — 부모는 끝까지 자식을 기다린다.
    detached: true,
    env: baseEnv,
  });
  return child as unknown as SpawnedProcess;
}

function byteLen(s: string): number {
  const B = (globalThis as {
    Buffer?: { byteLength?: (x: string, enc: string) => number };
  }).Buffer;
  if (B && typeof B.byteLength === "function") return B.byteLength(s, "utf8");
  const TE = (globalThis as {
    TextEncoder?: new () => { encode: (x: string) => { length: number } };
  }).TextEncoder;
  if (TE) return new TE().encode(s).length;
  return s.length;
}

interface ReadCounters {
  /** 스트림에서 실제로 받은 바이트 총량. */
  bytesIn: number;
}

interface LinePiece {
  text: string;
  /** 개행으로 «완결된» 줄인가. 스트림이 잘리면 마지막 조각은 false. */
  hadNewline: boolean;
}

/**
 * 청크 «경계를 넘어» UTF-8 을 이어서 해독하는 디코더.
 *
 * 왜 필요한가 — 파이프는 문자 경계가 아니라 «바이트» 경계에서 잘린다. 한글
 * 한 글자는 UTF-8 3바이트라, 청크가 그 가운데를 지나면 종전의
 * `chunk.toString("utf8")` 은 남은 조각을 각각 독립적으로 해독해 U+FFFD 로
 * 바꿔 버린다. 실측(Node v26): `"한"` 의 첫 1바이트에서 자르면 `"한"` 이
 * `"���"` 셋이 된다. **더 나쁜 것은 그래도 `JSON.parse` 가
 * 성공한다는 점이다** — U+FFFD 는 JSON 문자열 안에서 합법이라, 깨진 글자가
 * 조용히 파싱을 통과해 화면과 원고로 흘러간다.
 *
 * 우선순위: Node `StringDecoder`(Electron renderer — codex 가 도는 유일한
 * 환경) → 표준 `TextDecoder`(모바일 webview) → 종전 방식(마지막 수단).
 */
interface IncrementalDecoder {
  write(chunk: Buffer | Uint8Array): string;
  /** 스트림 끝. 미완성 바이트열이 남아 있으면 그 잔여를 문자로 마감한다. */
  end(): string;
}

function createIncrementalDecoder(): IncrementalDecoder {
  const sdMod =
    electronRequire<typeof import("node:string_decoder")>(
      "node:string_decoder",
    ) ?? electronRequire<typeof import("string_decoder")>("string_decoder");
  if (sdMod && typeof sdMod.StringDecoder === "function") {
    const sd = new sdMod.StringDecoder("utf8");
    return {
      write: (c) => sd.write(c as Buffer),
      end: () => sd.end(),
    };
  }
  const TD = (globalThis as {
    TextDecoder?: new (
      label?: string,
    ) => {
      decode: (input?: Uint8Array, opts?: { stream?: boolean }) => string;
    };
  }).TextDecoder;
  if (TD) {
    const td = new TD("utf-8");
    return {
      write: (c) => td.decode(c as Uint8Array, { stream: true }),
      end: () => td.decode(),
    };
  }
  return {
    write: (c) =>
      typeof (c as Buffer).toString === "function"
        ? (c as Buffer).toString("utf8")
        : String(c),
    end: () => "",
  };
}

/** stdout 을 line 단위로 yield 하는 비동기 generator. */
async function* readLines(
  stream: NodeJS.ReadableStream,
  counters?: ReadCounters,
): AsyncGenerator<LinePiece> {
  const decoder = createIncrementalDecoder();
  let buf = "";
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    if (counters) {
      counters.bytesIn += typeof chunk === "string"
        ? byteLen(chunk)
        : chunk.length;
    }
    buf += typeof chunk === "string" ? chunk : decoder.write(chunk);
    let idx = buf.indexOf("\n");
    while (idx >= 0) {
      yield { text: buf.slice(0, idx), hadNewline: true };
      buf = buf.slice(idx + 1);
      idx = buf.indexOf("\n");
    }
  }
  // 스트림이 «글자 가운데» 에서 끊겼다면 그 잔여가 여기서 나온다. 버리지 않는다
  // — 버리면 바이트 수(`bytesIn`)와 내보낸 양이 어긋나 판정이 흔들린다.
  buf += decoder.end();
  if (buf.length > 0) yield { text: buf, hadNewline: false };
}

export type AiOutcomeKind = "ok-empty" | "ok" | "partial" | "zero" | "no-exit";

export interface AiOutcome {
  kind: AiOutcomeKind;
  /** 사람이 읽는 판정 문면. */
  verdict: string;
}

/**
 * 종료 처리 결과를 다섯 칸으로 «구분» 한다. 첫 칸(정상 — 출력 없음)과
 * 마지막 칸(종료를 확인하지 못함)을 같은 말로 내지 않는 것이 이 함수의
 * 존재 이유다. 종료를 못 본 경우를 먼저 판정하지 않으면, 매달린 호출이
 * 「정상 — 출력 없음」으로 보고돼 「돌았는데 결과가 0」을 부른다.
 */
function classifyOutcome(p: {
  exitObserved: boolean;
  bytesIn: number;
  bytesEmitted: number;
  /** exitObserved=false 일 때 어느 경로에서 못 받았는지. */
  path?: string;
  /** 미처리·부분 처리 사유. */
  reason?: string;
}): AiOutcome {
  if (!p.exitObserved) {
    return {
      kind: "no-exit",
      verdict:
        `이상 — 프로세스 종료를 확인하지 못함 (경로: ${p.path ?? "미상"})`,
    };
  }
  if (p.bytesIn === 0) return { kind: "ok-empty", verdict: "정상 — 출력 없음" };
  if (p.bytesEmitted >= p.bytesIn) {
    return { kind: "ok", verdict: `정상 — ${p.bytesIn}바이트` };
  }
  const why = p.reason ? ` (${p.reason})` : "";
  if (p.bytesEmitted === 0) {
    return { kind: "zero", verdict: `이상 — ${p.bytesIn} 중 0건${why}` };
  }
  return {
    kind: "partial",
    verdict: `부분 — ${p.bytesIn} 중 ${p.bytesEmitted}${why || " (사유 미상)"}`,
  };
}

function logLifecycle(invocationId: string, verdict: string): void {
  try {
    // eslint-disable-next-line no-console
    console.info(`[aiBridge] ${invocationId} 판정: ${verdict}`);
  } catch {
    /* 로깅 실패가 호출을 막지 않는다 */
  }
}

/**
 * 본문이 하나도 없는 턴의 «원본» stdout 을 진단용으로 남긴다.
 *
 * 어디에 남기나 — 화면이 아니라 개발자 도구 콘솔이다. 옵시디언에서 `Cmd+Opt+I`
 * 로 여는 그 창이 이 저장소가 이미 쓰는 진단 경로다(`CLAUDE.md` §5). 원고 칸에
 * JSONL 을 붓지 않으면서도, 「무엇이 왔길래 본문이 없었나」를 그 자리에서 볼 수
 * 있어야 재현이 된다.
 *
 * 왜 통째로 안 남기나 — 한 턴의 stdout 은 수백 KB 가 될 수 있다. stderr 와 같은
 * 상한(마지막 2KB)을 쓴다. 본문 없는 턴의 «끝» 이 대개 사유를 쥐고 있다.
 */
function logEmptyTurnStdout(invocationId: string, stdout: string): void {
  try {
    const tail = stdout.length > STDERR_TAIL_BYTES
      ? stdout.slice(-STDERR_TAIL_BYTES)
      : stdout;
    // eslint-disable-next-line no-console
    console.info(
      `[aiBridge] ${invocationId} 본문 없음 — 원본 stdout 마지막 ${tail.length}자: ${tail}`,
    );
  } catch {
    /* 로깅 실패가 호출을 막지 않는다 */
  }
}

/** 프로세스 «그룹» 으로 신호를 보낸다. 실패하면 자식 하나로 강등. */
function signalTree(target: SpawnedProcess, signal: "SIGTERM" | "SIGKILL"): void {
  const proc = electronRequire<{ kill?: (pid: number, sig: string) => void }>(
    "process",
  );
  if (
    typeof target.pid === "number" && target.pid > 0 && proc &&
    typeof proc.kill === "function"
  ) {
    try {
      // 음수 pid = 프로세스 그룹 전체 (detached:true 라 자식이 그룹 리더).
      proc.kill(-target.pid, signal);
      return;
    } catch {
      /* 그룹이 없거나 이미 죽었다 → 단일 kill 로 강등 */
    }
  }
  try {
    target.kill(signal);
  } catch {
    /* swallow */
  }
}

function destroyStream(s: NodeJS.ReadableStream | null): void {
  if (!s) return;
  try {
    (s as unknown as { destroy?: () => void }).destroy?.();
  } catch {
    /* swallow */
  }
}

type EndVia = "exit" | "error" | "close-no-exit" | "no-exit";

export function startAiInvocation(input: StartAiInvocationInput): StreamingHandle {
  const invocationId = newInvocationId();
  const tokenQueue: string[] = [];
  type TokenResolver = (
    v: { value: string; done: false } | { value: undefined; done: true },
  ) => void;
  // 소비자가 둘 이상일 수 있다. 슬롯 하나만 두면 나중 소비자가 앞 소비자의
  // 대기 promise 를 덮어써 그쪽이 영원히 정착하지 않는다.
  const tokenResolvers: TokenResolver[] = [];
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
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  let exitObserved = false;
  let timedOut = false;
  let aborted = false;
  /** child 가 아직 없을 때 취소가 들어왔는지. */
  let cancelBeforeSpawn = false;
  /** 종료 신호를 못 받았을 때, 어느 경로였는지. */
  let noExitPath = "미상";
  let onNoExit: ((path: string) => void) | null = null;

  const finish = (err: Error | null): void => {
    if (finished) return;
    finished = true;
    if (err) errorState = err;
    // 대기 중인 «모든» 소비자를 깨운다.
    const pending = tokenResolvers.splice(0, tokenResolvers.length);
    for (const fn of pending) fn({ value: undefined, done: true });
    // 주의: kill 승급 타이머(killTimer/confirmTimer)는 여기서 «지우지 않는다».
    // 지우면 SIGTERM 을 무시하는 자식이 영영 SIGKILL 을 못 받아 좀비로 남는다.
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  /** SIGTERM → (2s) SIGKILL → (3s) 「종료 확인 못 함」 판정까지의 사다리. */
  const killTree = (why: string): void => {
    noExitPath = why;
    const target = child;
    if (!target) {
      // 아직 프로세스가 없다 — spawn 자체를 막는다.
      cancelBeforeSpawn = true;
      return;
    }
    signalTree(target, "SIGTERM");
    if (killTimer) clearTimeout(killTimer);
    killTimer = setTimeout(() => {
      killTimer = null;
      if (exitObserved) return;
      signalTree(target, "SIGKILL");
    }, KILL_GRACE_MS);
    if (confirmTimer) clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      confirmTimer = null;
      if (exitObserved) return;
      // SIGKILL 을 보내고도 종료 신호가 없다 — 다섯째 칸.
      onNoExit?.(why);
    }, KILL_GRACE_MS + KILL_CONFIRM_MS);
  };

  const clearKillLadder = (): void => {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    if (confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
  };

  const cancel = async (): Promise<void> => {
    if (finished) return;
    aborted = true;
    killTree("cancel");
    const err = new AiInvocationErrorImpl(
      "사용자가 취소했습니다.",
      "",
      "canceled",
    );
    finish(err);
    rejectDone(err);
  };

  // abort 배선은 spawn «이전» 에 끝낸다. 이미 abort 된 signal 이면 프로세스를
  // 아예 만들지 않는다.
  const abortHandler = (): void => {
    void cancel();
  };
  if (input.signal) {
    if (input.signal.aborted) abortHandler();
    else input.signal.addEventListener("abort", abortHandler, { once: true });
  }

  void (async () => {
    const start = Date.now();
    const timeoutSecs = Math.max(1, input.timeoutSecs ?? 180);

    if (finished || cancelBeforeSpawn) {
      logLifecycle(invocationId, "취소 — 프로세스 생성 전");
      return;
    }

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
        "process",
      );
      logLifecycle(
        invocationId,
        "이상 — 프로세스 종료를 확인하지 못함 (경로: 작업디렉터리-실패)",
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
        "process",
      );
      logLifecycle(
        invocationId,
        "이상 — 프로세스 종료를 확인하지 못함 (경로: spawn-동기실패)",
      );
      finish(err);
      rejectDone(err);
      return;
    }

    const target = child;
    const stdoutStream = target.stdout;
    const stderrStream = target.stderr;

    let stdoutAcc = "";
    let stderrTail = "";
    let exitCode = -1;
    // 콜백 안에서만 쓰이므로 홀더 객체에 담는다 (지역 let 은 TS 흐름분석이
    // 콜백 대입을 못 봐 읽는 쪽에서 never 로 좁혀진다).
    const faults: {
      spawn: Error | null;
      stdin: Error | null;
      stream: Error | null;
    } = { spawn: null, stdin: null, stream: null };

    try {
      /* --- 프로세스 수명 이벤트 ------------------------------------- */
      let endedSettled = false;
      let endedResolve!: (via: EndVia) => void;
      const ended = new Promise<EndVia>((res) => {
        endedResolve = (via: EndVia): void => {
          if (endedSettled) return;
          endedSettled = true;
          res(via);
        };
      });
      onNoExit = (path: string): void => {
        noExitPath = path;
        endedResolve("no-exit");
      };

      // (1) 'error' — ENOENT 등. 이게 없으면 renderer uncaught 로 새고
      //     'exit' 은 영영 안 와서 done 이 정착하지 않는다.
      target.on("error", (e: Error) => {
        if (!faults.spawn) faults.spawn = e;
        clearKillLadder();
        endedResolve("error");
      });
      // (2) 'exit' — 종료 «코드» 의 유일한 출처. close 보다 먼저 온다.
      target.on("exit", (code: number | null) => {
        exitObserved = true;
        exitCode = typeof code === "number" ? code : -1;
        clearKillLadder();
        endedResolve("exit");
      });
      // (3) 'close' — 모든 stdio 가 닫혔다는 뜻. 손자가 파이프를 물고 있으면
      //     영영 안 오므로 «이것만» 기다리면 안 된다. exit 없이 close 만
      //     오는 경우(= spawn 실패 계열)를 잡는 용도로만 쓴다.
      target.on("close", () => {
        if (!exitObserved) {
          clearKillLadder();
          endedResolve("close-no-exit");
        }
      });

      /* --- stdin 주입 ------------------------------------------------ */
      if (target.stdin) {
        const stdin = target.stdin;
        // EPIPE 는 여기로 온다. 리스너가 없으면 renderer 가 uncaught 로 죽는다.
        stdin.on("error", (e: Error) => {
          if (!faults.stdin) faults.stdin = e;
        });
        try {
          stdin.write(input.prompt, (e?: Error | null) => {
            if (e && !faults.stdin) faults.stdin = e;
          });
          stdin.end();
        } catch (e) {
          // 동기 throw = 쓰기가 아예 시작도 못 했다. 되돌릴 수 없으니 즉시 실패.
          const err = new AiInvocationErrorImpl(
            `stdin 쓰기 실패: ${(e as Error).message}`,
            "",
            "process",
          );
          killTree("stdin-동기실패");
          logLifecycle(
            invocationId,
            "이상 — 프로세스 종료를 확인하지 못함 (경로: stdin-동기실패)",
          );
          finish(err);
          rejectDone(err);
          return;
        }
      }

      /* --- 스트림 소비 ------------------------------------------------ */
      const counters: ReadCounters = { bytesIn: 0 };
      let bytesEmitted = 0;

      const pushToken = (token: string): void => {
        if (finished) return;
        const fn = tokenResolvers.shift();
        if (fn) fn({ value: token, done: false });
        else tokenQueue.push(token);
      };

      // 이 두 태스크는 «절대» reject 하지 않는다. reject 하면 아래 await 가
      // IIFE 밖으로 예외를 던지고, void 가 그걸 삼켜 done 이 영구 pending 이 된다.
      const stdoutTask = (async (): Promise<void> => {
        if (!stdoutStream) return;
        try {
          for await (const piece of readLines(stdoutStream, counters)) {
            if (finished) break;
            const token = `${piece.text}\n`;
            stdoutAcc += token;
            bytesEmitted += byteLen(piece.text) + (piece.hadNewline ? 1 : 0);
            pushToken(token);
          }
        } catch (e) {
          if (!faults.stream) faults.stream = e as Error;
        }
      })();

      const stderrTask = (async (): Promise<void> => {
        if (!stderrStream) return;
        try {
          for await (const piece of readLines(stderrStream)) {
            stderrTail += `${piece.text}\n`;
            if (stderrTail.length > STDERR_TAIL_BYTES * 2) {
              stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
            }
          }
          if (stderrTail.length > STDERR_TAIL_BYTES) {
            stderrTail = stderrTail.slice(-STDERR_TAIL_BYTES);
          }
        } catch {
          /* stderr 는 부가 정보다. 실패해도 본 경로를 막지 않는다 */
        }
      })();

      /* --- 타임아웃 가드 ---------------------------------------------- */
      timeoutTimer = setTimeout(() => {
        timeoutTimer = null;
        if (exitObserved) return;
        timedOut = true;
        killTree("timeout");
      }, timeoutSecs * 1_000);

      /* --- 종료 대기 --------------------------------------------------- */
      const via = await ended;

      /* --- 배수(drain): 종료를 «본 뒤에만» 마감을 건다 ------------------ */
      let drainCut = false;
      const streamsDone = Promise.all([stdoutTask, stderrTask]).then(() => true);
      if (via === "exit" || via === "close-no-exit") {
        // 프로세스가 실제로 끝났다 — 남은 버퍼가 빠질 시간을 준다.
        // (정상 배수 실측 1~4ms. 마감 5,000ms 는 그보다 세 자릿수 넉넉하다.)
        const drainDeadline = new Promise<boolean>((res) => {
          drainTimer = setTimeout(() => {
            drainTimer = null;
            res(false);
          }, DRAIN_GRACE_MS);
        });
        const drained = await Promise.race([streamsDone, drainDeadline]);
        if (drainTimer) {
          clearTimeout(drainTimer);
          drainTimer = null;
        }
        // 안 빠졌다 = 손자가 파이프를 붙들고 있다.
        if (!drained) drainCut = true;
      } else {
        // via = "error"(프로세스가 아예 안 떴다) 또는 "no-exit"(안 죽었다).
        // 스트림이 «스스로» 닫힐 이유가 없는 상태라 배수 마감을 기다리는 것은
        // 의미 없이 사용자를 더 세우는 일이다. 바로 끊는다.
        drainCut = true;
      }
      if (drainCut) {
        // 우리 파이프를 아직 붙들고 있다 = 그 프로세스 «그룹» 이 살아 있다는
        // 뜻이다(파이프가 닫혔다면 배수가 끝났을 것이다). 자식이 이미 정상
        // 종료했더라도 손자는 남아 계속 돈다 — 실측으로 ppid=1 로 재부모화된
        // 손자가 생존하는 것을 확인했다. 파이프를 끊기 전에 그룹째 정리한다.
        signalTree(target, "SIGKILL");
        destroyStream(stdoutStream);
        destroyStream(stderrStream);
        let hardTimer: ReturnType<typeof setTimeout> | null = null;
        await Promise.race([
          streamsDone,
          new Promise<boolean>((res) => {
            hardTimer = setTimeout(() => res(false), DRAIN_HARD_MS);
          }),
        ]);
        if (hardTimer) clearTimeout(hardTimer);
      }

      /* --- 판정 -------------------------------------------------------- */
      const durationMs = Date.now() - start;
      const reasonNote = drainCut
        ? "스트림 드레인 마감 초과"
        : faults.stream
        ? `스트림 오류: ${faults.stream.message}`
        : undefined;
      const outcome = classifyOutcome({
        exitObserved,
        bytesIn: counters.bytesIn,
        bytesEmitted,
        path: via === "no-exit"
          ? noExitPath
          : via === "error"
          ? "spawn-error"
          : via === "close-no-exit"
          ? "close-무exit"
          : noExitPath,
        reason: reasonNote,
      });
      // 다섯 칸 문면은 «종료 처리» 만 말한다. 왜 그렇게 끝났는지(타임아웃·취소·
      // 손자 절단)를 함께 안 적으면, 강제 종료된 호출이 로그에선 「정상 — 출력
      // 없음」으로만 보인다.
      const killNote = timedOut
        ? " — 타임아웃 강제 종료"
        : aborted
        ? " — 사용자 취소"
        : drainCut && exitObserved
        ? " — 손자 점유로 스트림 절단"
        : "";
      logLifecycle(invocationId, `${outcome.verdict}${killNote}`);

      if (finished) {
        // 취소(cancel/abort)는 그 자리에서 즉시 정착시킨다 — 사용자를 기다리게
        // 하지 않기 위해서다. 그래서 여기 도달했을 때 `finished` 면 이미 끝난
        // 호출이고, 아래 분기들은 취소를 다시 다루지 않는다(죽은 분기 금지).
        return;
      }

      // codex 인 경우 진짜 응답은 last-message.txt 에 있다.
      //
      // ── 본문 후보가 «하나도 없을» 때 무엇을 내는가 (판정 2026-08-31) ────────
      // 종전 세 자리가 `extractLastCodexMessage(stdoutAcc) ?? stdoutAcc` 였다.
      // 후보가 없으면 stdout JSONL 전문이 그대로 «원고» 가 된다는 뜻이다. 그것은
      // 답이 아니라 기계 로그이고, 사용자는 자기가 주문한 글 자리에서 그것을 본다.
      //
      // 그렇다고 «빈 글자» 를 성공으로 내보내도 안 된다 — 화면 쪽
      // (`useStreamingChat`)은 `result.fullText` 가 비면 buffer 를 덮어쓰지 «않고»
      // 스트리밍 중에 쌓인 진행 영역을 그대로 남긴다. 그 안에 든 것은
      // `extractDisplayText` 기준으로 `reasoning` 의 «생각 요약» 텍스트와
      // `[AI 오류]`·`[AI 알림]` 줄이다(직접 확인). 원고 칸에 JSONL 대신 남의
      // 생각이 박힐 뿐 달라지는 게 없고, 그러면서 `run()` 은 공백을 돌려줘
      // «화면에 보이는 것»과 «저장되는 것»이 갈린다.
      //
      // 그래서 본문 없는 턴은 «실패» 로 낸다(`no-output`). 종료 코드가 0이어도
      // 그렇다 — CLI 는 성공했지만 사용자가 주문한 것은 오지 않았다. 실패로 내면
      // 화면은 오류 한 줄을 보이고 쓰던 내용을 그대로 둔다(같은 저장소의
      // `voiceRewriter` 도 빈 결과를 삽입하지 않고 안내만 띄운다).
      //
      // 원본 JSONL 은 버리지 않는다. 화면이 아닌 곳(개발자 도구 콘솔)에 마지막
      // 2KB 를 남긴다 — `logEmptyTurnStdout`.
      let fullText = stdoutAcc;
      /** codex 인데 «본문 후보» 가 파일에도 stdout 에도 없었는가. */
      let codexNoBody = false;
      if (codexCtx) {
        let fromFile = "";
        try {
          const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
            electronRequire<typeof import("fs")>("fs");
          if (fs) fromFile = fs.readFileSync(codexCtx.lastMsgPath, "utf8");
        } catch {
          /* 파일이 없거나 못 읽는다 — stdout 경로로 떨어진다 */
        }
        if (fromFile.trim()) {
          fullText = fromFile;
        } else {
          const fromStdout = extractLastCodexMessage(stdoutAcc);
          if (fromStdout && fromStdout.trim()) {
            fullText = fromStdout;
          } else {
            fullText = "";
            codexNoBody = true;
          }
        }
      }

      const stdinNote = faults.stdin
        ? ` (stdin 오류: ${faults.stdin.message})`
        : "";

      // 정착 우선순위: spawn 오류 > 타임아웃 > 종료 미확인 > 종료 코드.
      // (취소는 위 `finished` 관문에서 이미 걸러졌다.)
      if (via === "error") {
        const cause = faults.spawn?.message ?? "사유 미상";
        const err = new AiInvocationErrorImpl(
          exitObserved
            ? `프로세스 오류: ${cause} — ${outcome.verdict}`
            : `프로세스 시작 실패: ${cause} — ${outcome.verdict}`,
          stderrTail,
          "process",
        );
        finish(err);
        rejectDone(err);
        return;
      }
      if (timedOut) {
        const err = new AiInvocationErrorImpl(
          `AI 호출 시간 초과 (${timeoutSecs}s) · 수집 판정: ${outcome.verdict}${stdinNote}`,
          stderrTail,
          "timeout",
        );
        finish(err);
        rejectDone(err);
        return;
      }
      if (!exitObserved) {
        const err = new AiInvocationErrorImpl(
          `AI 호출 실패 — ${outcome.verdict}${stdinNote}`,
          stderrTail,
          "process",
        );
        finish(err);
        rejectDone(err);
        return;
      }

      if (exitCode === 0 && codexNoBody) {
        // 종료 코드는 0이다. 그런데 원고가 없다. 원본은 콘솔에만 남긴다.
        logEmptyTurnStdout(invocationId, stdoutAcc);
        const reason = extractCodexFailureReason(stdoutAcc);
        const err = new AiInvocationErrorImpl(
          `AI가 답을 주지 않았습니다${
            reason ? ` (${reason})` : ""
          }${stdinNote} — ${outcome.verdict}`,
          stderrTail,
          "no-output",
        );
        finish(err);
        rejectDone(err);
        return;
      }

      if (exitCode === 0) {
        const result: AiInvocationResult = {
          fullText,
          durationMs,
          exitCode,
          verdict: outcome.verdict,
        };
        finish(null);
        resolveDone(result);
      } else {
        const reason = codexCtx
          ? extractCodexFailureReason(stdoutAcc) ?? stderrTail
          : stderrTail;
        const err = new AiInvocationErrorImpl(
          `AI 호출 실패 (CLI 종료 코드 ${exitCode}): ${
            reason || "사유 미상"
          }${stdinNote} — ${outcome.verdict}`,
          stderrTail,
          "exit",
        );
        finish(err);
        rejectDone(err);
      }
    } catch (e) {
      // 여기까지 새는 예외가 있어도 done 은 반드시 정착시킨다.
      const err = new AiInvocationErrorImpl(
        `AI 호출 내부 오류: ${(e as Error).message}`,
        stderrTail,
        "process",
      );
      logLifecycle(invocationId, `이상 — 내부 오류 (${(e as Error).message})`);
      finish(err);
      rejectDone(err);
    } finally {
      if (input.signal) {
        input.signal.removeEventListener("abort", abortHandler);
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (drainTimer) {
        clearTimeout(drainTimer);
        drainTimer = null;
      }
      // kill 사다리는 exit 을 본 경우에만 정리한다. 아직 못 봤다면 SIGKILL
      // 승급이 남아 있어야 좀비가 안 생긴다.
      if (exitObserved) clearKillLadder();
      destroyStream(stdoutStream);
      destroyStream(stderrStream);
    }
  })();

  const tokens = (): AsyncIterable<string> => ({
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<string>> {
          // 이미 받아 둔 토큰이 먼저다 — 실패로 끝나도 «받은 것» 은 준다.
          if (tokenQueue.length > 0) {
            const value = tokenQueue.shift()!;
            return Promise.resolve({ value, done: false });
          }
          if (errorState) return Promise.reject(errorState);
          if (finished) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => {
            tokenResolvers.push((r) => {
              if (errorState && r.done) {
                resolve({ value: undefined, done: true });
                return;
              }
              resolve(r as IteratorResult<string>);
            });
          });
        },
        return(): Promise<IteratorResult<string>> {
          return Promise.resolve({ value: undefined, done: true });
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
