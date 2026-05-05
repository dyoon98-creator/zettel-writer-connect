// InMemoryFrontmatterAdapter — backed by InMemoryVaultAdapter; uses the
// hand-rolled YAML serializer in WritingNoteIO so that frontmatter writes
// produce the same shape the Obsidian adapter would produce in production.

import { FrontmatterAdapter } from "./FrontmatterAdapter";
import { InMemoryVaultAdapter } from "./InMemoryVaultAdapter";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

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

function parseFrontmatterBlock(block: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();

    if (valueRaw === "") {
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(unquote(lines[j].replace(/^\s*-\s+/, "")));
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
    // Number coercion for plain numerics
    if (/^-?\d+(\.\d+)?$/.test(valueRaw)) {
      obj[key] = Number(valueRaw);
      continue;
    }
    obj[key] = unquote(valueRaw);
  }
  return obj;
}

function escapeYamlString(s: string): string {
  if (s === "") return '""';
  if (
    /^[\w\-./가-힣ᄀ-ᇿ㄰-㆏\s]+$/.test(s) &&
    !/^\s|\s$/.test(s) &&
    !s.includes(":")
  ) {
    return s;
  }
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function emitArray(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.map(escapeYamlString).join(", ")}]`;
}

function serializeValue(v: unknown): string {
  if (v === null || v === undefined) return '""';
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return emitArray((v as unknown[]).map((x) => String(x)));
  }
  return escapeYamlString(String(v));
}

function serializeFrontmatterBlock(fm: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

export class InMemoryFrontmatterAdapter implements FrontmatterAdapter {
  constructor(private vault: InMemoryVaultAdapter) {}

  async read(relPath: string): Promise<Record<string, unknown>> {
    const raw = await this.vault.readFile(relPath);
    const m = raw.match(FRONTMATTER_RE);
    if (!m) return {};
    return parseFrontmatterBlock(m[1]);
  }

  async update(
    relPath: string,
    mutator: (fm: Record<string, unknown>) => void,
  ): Promise<void> {
    const raw = await this.vault.readFile(relPath);
    const m = raw.match(FRONTMATTER_RE);
    const current = m ? parseFrontmatterBlock(m[1]) : {};
    mutator(current);
    const block = serializeFrontmatterBlock(current);
    const body = m ? m[2] : raw;
    await this.vault.writeFile(relPath, block + body);
  }
}
