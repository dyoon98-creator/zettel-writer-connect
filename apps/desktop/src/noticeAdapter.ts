// noticeAdapter.ts — Phase C는 console.log로 동작.
// Phase D에서 <ToastContainer /> 와 연결 예정.

import type { NoticeAdapter } from "@ai-manuscript-studio/core";

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
  // TODO(Phase D): 실제 토스트 UI 컴포넌트로 출력.
  // eslint-disable-next-line no-console
  console.log(`[notice:${severity}] ${text}`);
  for (const cb of subscribers) cb(msg);
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
