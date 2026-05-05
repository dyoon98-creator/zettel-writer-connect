// Folder path constants used to bucket source notes.
// Keep raw strings here — settings can override writingFolder.

export const FOLDER_RAW = "0 raw";
export const FOLDER_INBOX = "0 Inbox";
export const FOLDER_LITERATURE = "1 Literature";
export const FOLDER_WIKI = "1 wiki";
export const FOLDER_PERMANENT = "2 Permanent";

export type SourceBucket =
  | "raw"
  | "literature"
  | "wiki"
  | "permanent"
  | "other";

export function classifyPath(path: string): SourceBucket {
  if (path.startsWith(`${FOLDER_RAW}/`) || path.startsWith(`${FOLDER_INBOX}/`)) {
    return "raw";
  }
  if (path.startsWith(`${FOLDER_LITERATURE}/`)) return "literature";
  if (path.startsWith(`${FOLDER_WIKI}/`)) return "wiki";
  if (path.startsWith(`${FOLDER_PERMANENT}/`)) return "permanent";
  return "other";
}

/** Slugify a Korean/English title for a filename. */
export function slugify(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "untitled";
  // Allow Hangul (U+AC00-U+D7A3, U+1100-U+11FF, U+3130-U+318F), latin, digits.
  // Replace whitespace with hyphen, drop everything else.
  const out = trimmed
    .replace(/\s+/g, "-")
    .replace(
      /[^ᄀ-ᇿ㄰-㆏가-힣a-zA-Z0-9\-_]/g,
      "",
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return out || "untitled";
}

/** YYYYMMDD for filename prefix. */
export function todayDateStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** YYYY-MM-DD for frontmatter date fields. */
export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
