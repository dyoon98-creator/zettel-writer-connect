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

/**
 * 한 줄(라인) 토큰을 사용자 표시용 텍스트로 변환.
 *
 * Codex CLI 는 stdout 에 JSONL 이벤트를 흘리므로 (`{"type":"thread.started"}`,
 * `{"type":"item.completed","item":{"item_type":"agent_message","text":"..."}}` 등),
 * raw 토큰을 그대로 화면에 누적하면 사용자에게는 디버그 로그처럼 보인다.
 *
 * 동작:
 * - JSON 파싱 시도 → 의미 있는 text 필드 발견 시 그것 + "\n" 반환.
 * - JSON 인데 텍스트 필드 없음 (이벤트 사이드카) → "" 반환 (skip).
 * - JSON 이 아닌 일반 텍스트 → 원본 반환 (claude-code 등 다른 provider 호환).
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

  // codex JSONL: { type: "item.completed", item: { item_type: "agent_message", text: "..." } }
  const item = obj.item as Record<string, unknown> | undefined;
  if (item && typeof item.text === "string") {
    return `${item.text}\n`;
  }

  // 다양한 fallback 키.
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
