// streamingChat.ts — 다턴 chat 용 streaming wrapper.
//
// 기존 streamingHandle (단일 prompt → token stream) 위에:
//   1) ChatMessage[] (role/content) 직렬화
//   2) systemPrompt + 옵시디언 노트 본문 컨텍스트 주입
//   3) Settings store 에서 provider/binary 자동 결정
// 을 얹은 얇은 어댑터.
//
// Rust 측 변경 없음 — 기존 ai_invoke 그대로 호출한다.

import { useSettingsStore } from "../state/settingsStore";
import {
  startAiInvocation,
  type StreamingHandle,
} from "./streamingHandle";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface StreamingChatOptions {
  messages: ChatMessage[];
  /** 자유 텍스트 system prompt. */
  systemPrompt?: string;
  /** 옵시디언 노트 본문 concat (P1-T3 fetchNotesForContext 가 만들어 줌). */
  notesContext?: string;
  /** Rust ai_invoke 의 timeout. 기본 180초 (streamingHandle 기본값과 동일). */
  timeoutSecs?: number;
  /** 외부 abort. */
  signal?: AbortSignal;
}

/** "--model gpt-5 --foo bar" → ["--model", "gpt-5", "--foo", "bar"]. */
function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * messages + systemPrompt + notesContext 를 단일 prompt 텍스트로 직렬화.
 *
 * 포맷:
 *   <system>
 *   {systemPrompt}
 *
 *   ## 참고 노트 (옵시디언 볼트)
 *   {notesContext}
 *   </system>
 *   <user>...</user>
 *   <assistant>...</assistant>
 *   ...
 *
 * - notesContext 가 비어있으면 "## 참고 노트" 섹션 통째 생략.
 * - systemPrompt + notesContext 둘 다 비어있으면 <system> 블록 통째 생략.
 * - messages.length === 0 이면 throw.
 * - 마지막 메시지가 assistant 여도 그대로 직렬화 (작가 차례 대기 패턴).
 */
export function buildChatPrompt(opts: StreamingChatOptions): string {
  if (!opts.messages || opts.messages.length === 0) {
    throw new Error("messages 가 비어있음");
  }

  const sections: string[] = [];

  const sys = (opts.systemPrompt ?? "").trim();
  const notes = (opts.notesContext ?? "").trim();
  const hasSystem = sys.length > 0 || notes.length > 0;

  if (hasSystem) {
    const parts: string[] = [];
    if (sys.length > 0) parts.push(sys);
    if (notes.length > 0) {
      parts.push(`## 참고 노트 (옵시디언 볼트)\n${notes}`);
    }
    sections.push(`<system>\n${parts.join("\n\n")}\n</system>`);
  }

  for (const m of opts.messages) {
    sections.push(`<${m.role}>\n${m.content}\n</${m.role}>`);
  }

  return sections.join("\n");
}

/**
 * Settings 에서 provider/binary/extraArgs 를 읽어 startAiInvocation 호출.
 *
 * mock provider 또는 binary 경로가 비어있으면 즉시 throw — 호출자는 미리
 * settings.useMockBridge / aiProvider 를 확인하거나 catch 해서 mock fallback 결정.
 */
export function startStreamingChat(opts: StreamingChatOptions): StreamingHandle {
  const settings = useSettingsStore.getState().settings;

  if (settings.useMockBridge || settings.aiProvider === "mock") {
    throw new Error(
      "AI 미설정: mock 모드입니다. 설정 → AI 호출 → CLI 경로를 입력하세요.",
    );
  }

  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;

  if (!binaryPath.trim()) {
    throw new Error(
      `AI 미설정: ${
        settings.aiProvider === "claude-code" ? "Claude Code" : "Codex"
      } CLI 경로가 비어있습니다.`,
    );
  }

  const prompt = buildChatPrompt(opts);

  return startAiInvocation({
    provider: settings.aiProvider,
    binaryPath,
    extraArgs: splitArgs(settings.codexExtraArgs),
    prompt,
    timeoutSecs: opts.timeoutSecs,
    signal: opts.signal,
  });
}

/**
 * non-streaming 단일 응답 헬퍼. handle.done 을 await 한 뒤 fullText 반환.
 * 토큰 스트림이 필요 없는 호출자 (간단한 한 번의 LLM 응답) 용 편의 함수.
 */
export async function chatToFullText(
  opts: StreamingChatOptions,
): Promise<string> {
  const handle = startStreamingChat(opts);
  const result = await handle.done;
  return result.fullText;
}

/* ---------------------------------------------------------------------------
 * codex JSONL 이벤트 → 사용자 화면 문면
 *
 * 이 화면(useStreamingChat.buffer)은 «스트리밍 중에만» 보이는 진행 영역이다.
 * 턴이 끝나면 호출자가 last-message 기반 fullText 로 갈아끼우므로, 여기 넣은
 * 진행·알림 줄은 원고 본문에 남지 않는다. 그래서 「본문을 더럽힌다」는 이유로
 * 침묵할 근거는 없고, 반대로 codex 가 --json 에 글자 단위 델타를 주지 않으므로
 * (본문은 턴이 끝난 뒤 통째로 한 번 온다) 이 영역이 비어 있으면 사용자는
 * 「멈춘 것」과 「일하는 중」을 구별할 방법이 아예 없다.
 *
 * 그어 놓은 선 — 「지금 하는 일(원고)에 영향을 주는가」 + 「사용자가 손쓸 수
 * 있는가」 둘 중 하나라도 예면 보인다. 둘 다 아니고 매 턴 반복되는 것만 감춘다.
 * ------------------------------------------------------------------------- */

/**
 * 본문이 아닌 줄임을 알리는 표식. 진행 영역은 pre-wrap 평문이라 표식 말고는
 * 본문과 구별할 수단이 없다(UI 컴포넌트는 이 발주의 수정 범위 밖).
 */
const MARK_PROGRESS = "[AI 진행]";
const MARK_WARN = "[AI 알림]";
const MARK_ERROR = "[AI 오류]";

/** 사용자에게 알릴 내용이 없는 최상위 이벤트 (사이드카). */
const NOISE_EVENT_TYPES = new Set([
  "thread.started",
  "turn.started",
  "turn.completed",
]);

/**
 * 「매 턴 반드시 뜨고 · 출력에 영향이 없고 · 이 앱 안에서는 손쓸 수 없는」
 * codex 내부 설정 안내. 그대로 흘리면 생성할 때마다 경고가 떠서 «진짜» 경고까지
 * 무시하게 된다. 그래서 화면에서만 감추고 devtools 콘솔에는 남긴다 —
 * 감춘 것을 추적 불가능하게 만들지 않는다.
 *
 * 실측 원문(codex 0.151.0): "Skill descriptions were shortened to fit the
 * skills context budget. Codex can still see every skill, but some descriptions
 * are shorter. ..." — 스스로 「still see every skill」이라고 말하는, 영향 없는 안내다.
 */
const BENIGN_ITEM_ERROR_PATTERNS = [
  "skills context budget",
  "skill descriptions were shortened",
];

/**
 * 자주 나오는 영어 사유를 «사용자가 할 수 있는 일» 이 담긴 한국어로 옮긴다.
 * 부분 문자열 heuristic 이고, 못 맞히면 일반 문면으로 떨어진다(fail-open).
 * 원문은 언제나 뒤에 붙이므로 오역이 정보를 지우지는 않는다.
 */
const REASON_HINTS: ReadonlyArray<{ match: string[]; ko: string }> = [
  {
    match: ["usage limit", "rate limit", "quota"],
    ko: "AI 사용량 한도에 걸렸습니다. 잠시 뒤에 다시 시도해 주세요.",
  },
  {
    match: ["unauthorized", "not logged in", "authentication", "401"],
    ko: "AI 계정 인증이 풀렸습니다. AI CLI 로그인을 다시 해 주세요.",
  },
  {
    match: ["timed out", "timeout"],
    ko: "AI 응답이 제한 시간 안에 오지 않았습니다.",
  },
  {
    match: ["disconnect", "connection", "network", "stream"],
    ko: "AI 서버와 연결이 끊겼습니다. 다시 시도해 주세요.",
  },
];

function isBenignItemError(message: string): boolean {
  const m = message.toLowerCase();
  return BENIGN_ITEM_ERROR_PATTERNS.some((p) => m.includes(p));
}

function koreanHint(message: string): string | null {
  const m = message.toLowerCase();
  for (const h of REASON_HINTS) {
    if (h.match.some((k) => m.includes(k))) return h.ko;
  }
  return null;
}

function pickString(
  o: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!o) return null;
  const v = o[key];
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/** 표식 + 한국어 설명 (+ 있으면 영어 원문). 원문은 «뒤에» 붙인다. */
function formatNotice(mark: string, fallbackKo: string, raw: string): string {
  const head = `${mark} ${(raw && koreanHint(raw)) || fallbackKo}`;
  return raw ? `${head} (원문: ${raw})\n` : `${head}\n`;
}

function logSuppressed(message: string): void {
  try {
    // eslint-disable-next-line no-console
    console.debug("[Studio] codex 내부 안내를 화면에서 숨김:", message);
  } catch {
    /* 로깅 실패가 표시 경로를 막지 않는다 */
  }
}

/**
 * 한 줄(라인) 토큰을 사용자 표시용 텍스트로 변환.
 *
 * Codex CLI 는 stdout 에 JSONL 이벤트를 흘리므로 (`{"type":"thread.started"}`,
 * `{"type":"item.completed","item":{"type":"agent_message","text":"..."}}` 등),
 * raw 토큰을 그대로 화면에 누적하면 사용자에게는 디버그 로그처럼 보인다.
 *
 * 판정(무엇을 보이고 무엇을 감추나):
 * - `item.type === "agent_message"` → 본문 그대로. 이게 사용자가 주문한 것이다.
 * - `item.type === "error"` → `[AI 알림]` 한 줄로 보인다. 단 위 benign 목록에
 *   걸리는 codex 내부 안내만 감추고 콘솔로 돌린다.
 * - `item.type === "command_execution"` → `item.started` 때 `[AI 진행]` 한 줄.
 *   명령 문자열 자체는 구현 세부라 감춘다. 같은 명령이 started/updated/completed
 *   로 세 번 오므로 시작 한 번만 낸다(이 함수는 상태가 없어 dedup 이 불가능).
 * - `type === "error"` / `"turn.failed"` → `[AI 오류]`. 본문인 척 섞이면 안 된다.
 * - `thread.started`·`turn.started`·`turn.completed` → "" (소음).
 * - JSON 이 아닌 일반 텍스트 → 원본 그대로 (claude-code 등 다른 provider 호환).
 */
export function extractDisplayText(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length === 0) return "";
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return token;

  let v: unknown;
  try {
    v = JSON.parse(trimmed);
  } catch {
    return token;
  }
  if (!v || typeof v !== "object") return "";

  const obj = v as Record<string, unknown>;
  const eventType = typeof obj.type === "string" ? obj.type : "";

  // (1) 턴 자체가 깨졌다 — 본문과 섞이지 않게 표식을 붙여 낸다.
  if (eventType === "error" || eventType === "turn.failed") {
    const errObj = obj.error as Record<string, unknown> | undefined;
    const raw =
      pickString(obj, "message") ??
      (errObj ? pickString(errObj, "message") : null) ??
      (typeof obj.error === "string" ? obj.error : null) ??
      "";
    return formatNotice(MARK_ERROR, "생성이 중단됐습니다.", raw);
  }

  // (2) item 이벤트 — item.type 으로 본문·경고·도구실행을 가른다.
  //     codex JSONL: { type: "item.completed", item: { type: "...", ... } }
  const item = obj.item as Record<string, unknown> | undefined;
  if (item) {
    // `item_type` 은 구 codex 필드명. 둘 다 받아 준다.
    const itemType = pickString(item, "type") ?? pickString(item, "item_type") ??
      "";

    if (itemType === "error") {
      const raw = pickString(item, "message") ?? pickString(item, "text") ?? "";
      if (raw && isBenignItemError(raw)) {
        logSuppressed(raw);
        return "";
      }
      return formatNotice(MARK_WARN, "AI 도구가 알림을 보냈습니다.", raw);
    }

    if (itemType === "command_execution") {
      if (eventType === "item.started") {
        return `${MARK_PROGRESS} 자료를 확인하려고 도구를 실행하는 중입니다. 잠시만 기다려 주세요.\n`;
      }
      return "";
    }

    if (typeof item.text === "string") return `${item.text}\n`;
    // 텍스트가 없는 item 이벤트(agent_message 의 started 등) = 사이드카.
    if (itemType) return "";
  }

  if (NOISE_EVENT_TYPES.has(eventType)) return "";

  // 다양한 fallback 키 (codex 외 provider 의 JSON 출력 호환).
  for (const key of ["text", "message", "output", "delta", "content"] as const) {
    const val = obj[key];
    if (typeof val === "string") return `${val}\n`;
  }

  // turn.message.text 같은 중첩.
  const turn = obj.turn as Record<string, unknown> | undefined;
  if (turn && typeof turn.message === "string") return `${turn.message}\n`;

  // 아무것도 없으면 이벤트 사이드카로 간주, skip.
  return "";
}
