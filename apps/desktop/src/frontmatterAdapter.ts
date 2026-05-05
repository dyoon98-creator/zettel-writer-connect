// frontmatterAdapter.ts — VaultAdapter 위에 얹은 YAML frontmatter 헬퍼.
//
// `FrontmatterAdapter` 인터페이스는 `Record<string, unknown>`을 다룬다
// (v1의 typed `WritingProjectFrontmatter` 헬퍼와는 별개).
// Phase C에서는 단순한 라인 기반 YAML 파서/시리얼라이저로 처리한다.
// Phase D에서 SceneIO와 정합되는 정식 구현으로 교체 예정.

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
      const current: Record<string, unknown> = m ? parseFrontmatterBlock(m[1]) : {};
      const body = m ? m[2] : raw;
      const next: Record<string, unknown> = { ...current };
      mutator(next);
      const merged = serializeFrontmatterBlock(next) + body;
      await vault.writeFile(relPath, merged);
    },
  };
}
