// NoticeAdapter — environment-neutral surface for transient user-facing
// messages. Obsidian plugin maps to `Notice`; Tauri maps to its native toast.

export interface NoticeAdapter {
  info(message: string, durationMs?: number): void;
  warn(message: string, durationMs?: number): void;
  error(message: string, durationMs?: number): void;
}
