// InMemoryNoticeAdapter — collects notices for inspection in tests.

import { NoticeAdapter } from "./NoticeAdapter";

export type NoticeKind = "info" | "warn" | "error";

export interface CapturedNotice {
  kind: NoticeKind;
  message: string;
  durationMs?: number;
}

export class InMemoryNoticeAdapter implements NoticeAdapter {
  readonly notices: CapturedNotice[] = [];

  info(message: string, durationMs?: number): void {
    this.notices.push({ kind: "info", message, durationMs });
  }
  warn(message: string, durationMs?: number): void {
    this.notices.push({ kind: "warn", message, durationMs });
  }
  error(message: string, durationMs?: number): void {
    this.notices.push({ kind: "error", message, durationMs });
  }

  /** Convenience: returns all messages of the given kind in arrival order. */
  byKind(kind: NoticeKind): string[] {
    return this.notices.filter((n) => n.kind === kind).map((n) => n.message);
  }

  /** True iff any notice's message contains `needle`. */
  contains(needle: string): boolean {
    return this.notices.some((n) => n.message.includes(needle));
  }

  clear(): void {
    this.notices.length = 0;
  }
}
