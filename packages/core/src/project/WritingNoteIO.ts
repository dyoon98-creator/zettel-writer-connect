// Frontmatter (de)serialization for writing project notes.
// Hand-rolled YAML. We only emit the keys we own — no third-party dep.

import {
  PLUGIN_ID,
  SCHEMA_VERSION,
  WritingProjectFrontmatter,
} from "../types";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function escapeYamlString(s: string): string {
  // Quote if contains special chars or is empty/whitespace.
  if (s === "") return '""';
  if (/^[\w\-./가-힣ᄀ-ᇿ㄰-㆏\s]+$/.test(s) && !/^\s|\s$/.test(s) && !s.includes(":")) {
    return s;
  }
  // Use double quotes; escape backslash and double-quote.
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function emitArray(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.map(escapeYamlString).join(", ")}]`;
}

/** Serialize frontmatter object → YAML block (with `---` fences). */
export function serialize(fm: WritingProjectFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`type: ${fm.type}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`genre: ${fm.genre}`);
  lines.push(`created: ${fm.created}`);
  lines.push(`updated: ${fm.updated}`);
  lines.push(`word_goal: ${fm.word_goal}`);
  lines.push(`current_words: ${fm.current_words}`);
  lines.push(`target_reader: ${escapeYamlString(fm.target_reader)}`);
  lines.push(`core_message: ${escapeYamlString(fm.core_message)}`);
  lines.push(`source_notes: ${emitArray(fm.source_notes)}`);
  lines.push(`plugin: ${fm.plugin}`);
  lines.push(`schema_version: ${fm.schema_version}`);
  lines.push(`tags: ${emitArray(fm.tags)}`);
  lines.push("---");
  return lines.join("\n") + "\n";
}

interface ParsedNote {
  frontmatter: WritingProjectFrontmatter | null;
  body: string;
  /** Original raw frontmatter block including the fences, or "" if none. */
  rawFrontmatter: string;
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    return v
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function parseInlineArray(value: string): string[] {
  const v = value.trim();
  if (!v.startsWith("[") || !v.endsWith("]")) return [];
  const inner = v.slice(1, -1).trim();
  if (inner === "") return [];
  // Naive split — handles quoted and unquoted entries with commas inside quotes.
  const out: string[] = [];
  let buf = "";
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === "," && !inDouble && !inSingle) {
      out.push(unquote(buf));
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim() !== "") out.push(unquote(buf));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Parse frontmatter + body. Returns null frontmatter if missing/invalid. */
export function parse(raw: string): ParsedNote {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: raw, rawFrontmatter: "" };
  const block = m[1];
  const body = m[2];

  const obj: Record<string, unknown> = {};
  // Simple line-based parse: we don't support nested or block arrays here.
  const blockLines = block.split(/\r?\n/);
  for (let i = 0; i < blockLines.length; i++) {
    const line = blockLines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();

    if (valueRaw === "") {
      // Block-style array: subsequent lines starting with "- "
      const items: string[] = [];
      let j = i + 1;
      while (j < blockLines.length && /^\s*-\s+/.test(blockLines[j])) {
        items.push(unquote(blockLines[j].replace(/^\s*-\s+/, "")));
        j++;
      }
      if (items.length > 0) {
        obj[key] = items;
        i = j - 1;
        continue;
      }
      obj[key] = "";
      continue;
    }

    if (valueRaw.startsWith("[")) {
      obj[key] = parseInlineArray(valueRaw);
      continue;
    }
    obj[key] = unquote(valueRaw);
  }

  // Coerce into our shape — only return frontmatter if it's an AMS writing note.
  const rawAny = obj as Record<string, unknown>;
  if (rawAny.type !== "writing" || rawAny.plugin !== PLUGIN_ID) {
    return { frontmatter: null, body, rawFrontmatter: m[0].slice(0, -m[2].length) };
  }

  const fm: WritingProjectFrontmatter = {
    type: "writing",
    status: (rawAny.status as WritingProjectFrontmatter["status"]) ?? "idea",
    genre: (rawAny.genre as WritingProjectFrontmatter["genre"]) ?? "investment-strategy-memo",
    created: String(rawAny.created ?? ""),
    updated: String(rawAny.updated ?? ""),
    word_goal: Number(rawAny.word_goal ?? 0),
    current_words: Number(rawAny.current_words ?? 0),
    target_reader: String(rawAny.target_reader ?? ""),
    core_message: String(rawAny.core_message ?? ""),
    source_notes: Array.isArray(rawAny.source_notes)
      ? (rawAny.source_notes as string[])
      : [],
    plugin: PLUGIN_ID,
    schema_version: Number(rawAny.schema_version ?? SCHEMA_VERSION),
    tags: Array.isArray(rawAny.tags) ? (rawAny.tags as string[]) : [],
  };

  return {
    frontmatter: fm,
    body,
    rawFrontmatter: m[0].slice(0, m[0].length - m[2].length),
  };
}

/** Re-serialize: replace frontmatter block in `raw` with `fm`. Body preserved. */
export function replaceFrontmatter(
  raw: string,
  fm: WritingProjectFrontmatter,
): string {
  const fmBlock = serialize(fm);
  const m = raw.match(FRONTMATTER_RE);
  if (!m) {
    // No existing frontmatter: prepend.
    return fmBlock + raw;
  }
  return fmBlock + m[2];
}

/** Build a fresh body (frontmatter + H1 + template body). */
export function buildInitialNote(
  fm: WritingProjectFrontmatter,
  title: string,
  templateBody: string,
): string {
  return `${serialize(fm)}\n# ${title}\n\n${templateBody}`;
}

export const WritingNoteIO = {
  serialize,
  parse,
  replaceFrontmatter,
  buildInitialNote,
};
