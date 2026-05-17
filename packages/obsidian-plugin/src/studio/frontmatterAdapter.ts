// frontmatterAdapter.ts (옵시디언 shim) — desktop 원본의 단순 YAML 파서를
// 그대로 보존. Tauri 의존성 없음. `createFrontmatterAdapter(vault)` 시그니처
// 를 호출 site 호환을 위해 그대로 유지한다.

import type {
  FrontmatterAdapter,
  VaultAdapter,
} from "@ai-manuscript-studio/core";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function parseFrontmatterBlock(block: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;
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
    obj[key] = unquote(valueRaw);
  }
  return obj;
}

function serializeFrontmatterBlock(fm: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${String(item)}`);
      }
    } else if (v === null || v === undefined) {
      lines.push(`${k}: ""`);
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function createFrontmatterAdapter(
  vault: VaultAdapter,
): FrontmatterAdapter {
  return {
    async read(relPath) {
      const exists = await vault.fileExists(relPath);
      if (!exists) return {};
      const raw = await vault.readFile(relPath);
      const m = raw.match(FRONTMATTER_RE);
      if (!m) return {};
      return parseFrontmatterBlock(m[1]);
    },

    async update(relPath, mutator) {
      const exists = await vault.fileExists(relPath);
      const raw = exists ? await vault.readFile(relPath) : "";
      const m = raw.match(FRONTMATTER_RE);
      const current: Record<string, unknown> = m
        ? parseFrontmatterBlock(m[1])
        : {};
      const body = m ? m[2] : raw;
      const next: Record<string, unknown> = { ...current };
      mutator(next);
      const merged = serializeFrontmatterBlock(next) + body;
      await vault.writeFile(relPath, merged);
    },
  };
}
