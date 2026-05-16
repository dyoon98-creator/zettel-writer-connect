// noticeAdapter.ts (옵시디언 shim) — toast 구독 시스템은 desktop 원본 그대로
// 유지하되, tauriNoticeAdapter 는 옵시디언 Notice 와도 함께 alert.

import type { NoticeAdapter } from "@ai-manuscript-studio/core";
import { Notice } from "obsidian";

type Severity = "info" | "warn" | "error";

export interface ToastMessage {
  id: number;
  severity: Severity;
  text: string;
  durationMs: number;
}

type Subscriber = (msg: ToastMessage) => void;

let nextId = 1;
const subscribers = new Set<Subscriber>();

export function subscribeToasts(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function emit(severity: Severity, text: string, durationMs: number): void {
  const msg: ToastMessage = { id: nextId++, severity, text, durationMs };
  // 1) 자체 toast 구독자(내부 UI) 에 broadcast
  for (const cb of subscribers) cb(msg);
  // 2) 옵시디언 Notice 로 즉시 alert. info 는 짧게, error 는 길게.
  try {
    new Notice(text, durationMs);
  } catch {
    /* test/non-Notice env */
  }
  // eslint-disable-next-line no-console
  console.log(`[notice:${severity}] ${text}`);
}

export const tauriNoticeAdapter: NoticeAdapter = {
  info(message, durationMs = 4000) {
    emit("info", message, durationMs);
  },
  warn(message, durationMs = 6000) {
    emit("warn", message, durationMs);
  },
  error(message, durationMs = 8000) {
    emit("error", message, durationMs);
  },
};
