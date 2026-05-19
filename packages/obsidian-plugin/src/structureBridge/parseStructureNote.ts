// parseStructureNote.ts — Extract structured data from a 3.Structure markdown note.
// Pure function; no vault I/O.

import type { ParsedStructureNote } from "./types";

/** Strips YAML frontmatter block and returns { frontmatter raw, body }. */
function splitFrontmatter(md: string): {
  fm: Record<string, unknown>;
  body: string;
} {
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { fm: {}, body: md };
  const raw = fmMatch[1];
  const body = fmMatch[2] ?? "";
  const fm: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const col = line.indexOf(":");
    if (col < 0) continue;
    const key = line.slice(0, col).trim();
    const val = line.slice(col + 1).trim();
    if (!key) continue;
    // Simple list: lines indented under the key parsed separately below.
    fm[key] = val;
  }
  // Re-parse list values (related_notes etc.) via simple multi-line detection.
  const listRe = /^(\w[\w_-]*):\s*\n((?:[ \t]+-[^\n]+\n?)+)/gm;
  let m: RegExpExecArray | null;
  while ((m = listRe.exec(raw)) !== null) {
    const listKey = m[1];
    const listBody = m[2];
    fm[listKey] = listBody
      .split("\n")
      .map((l) => l.replace(/^[ \t]+-\s*/, "").replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }
  return { fm, body };
}

/** Extracts the first H1 heading from markdown body. */
function extractH1(body: string): string | null {
  const m = body.match(/^#{1}\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

/** Extracts claim from "## 🗂 주장" section blockquote. */
function extractClaimFromBody(body: string): string | null {
  // Match the section heading, then find the first blockquote line.
  const sectionRe = /##\s+.*주장[^\n]*\n([\s\S]*?)(?:\n##|\n---|\n$|$)/;
  const section = body.match(sectionRe);
  if (!section) return null;
  const bqMatch = section[1].match(/^>\s+(.+)$/m);
  return bqMatch ? bqMatch[1].trim() : null;
}

/**
 * Parse a vault-relative 3.Structure markdown note.
 * Throws a friendly Error if the path is not under 3.Structure/.
 */
export function parseStructureNote(
  vaultRelPath: string,
  markdown: string,
): ParsedStructureNote {
  if (!vaultRelPath.startsWith("3.Structure/")) {
    throw new Error(
      `parseStructureNote: 경로가 3.Structure/ 아래여야 합니다. (받은 경로: "${vaultRelPath}")`,
    );
  }

  const { fm, body } = splitFrontmatter(markdown);

  // Title: H1 → filename fallback
  const h1 = extractH1(body);
  const filenameStem = vaultRelPath
    .split("/")
    .pop()!
    .replace(/\.md$/, "");
  const title = h1 ?? filenameStem;

  // Claim: frontmatter → ## 🗂 주장 blockquote
  const fmClaim = typeof fm["claim"] === "string" ? fm["claim"] : undefined;
  const bodyClaim = fmClaim ?? extractClaimFromBody(body) ?? undefined;

  // related_notes
  const relatedNotes = Array.isArray(fm["related_notes"])
    ? (fm["related_notes"] as string[])
    : undefined;

  return {
    structureNotePath: vaultRelPath,
    title,
    id: typeof fm["id"] === "string" ? fm["id"] : undefined,
    topic: typeof fm["topic"] === "string" ? fm["topic"] : undefined,
    claim: bodyClaim,
    relatedNotes,
  };
}
