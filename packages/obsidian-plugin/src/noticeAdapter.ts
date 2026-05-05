// noticeAdapter.ts — Obsidian-side implementation of core's NoticeAdapter.
//
// Phase G keeps this absolutely minimal — `info/warn/error` all surface as
// `Notice`. error/warn add a short prefix so the user can distinguish them
// at a glance.

import { Notice } from "obsidian";
import type { NoticeAdapter } from "@ai-manuscript-studio/core/adapters";

const DEFAULT_DURATION_MS = 4000;

export class ObsidianNoticeAdapter implements NoticeAdapter {
  info(message: string, durationMs?: number): void {
    new Notice(message, durationMs ?? DEFAULT_DURATION_MS);
  }

  warn(message: string, durationMs?: number): void {
    new Notice(`⚠ ${message}`, durationMs ?? DEFAULT_DURATION_MS);
  }

  error(message: string, durationMs?: number): void {
    new Notice(`✕ ${message}`, durationMs ?? DEFAULT_DURATION_MS);
  }
}
