// vaultAdapter.ts (옵시디언 shim) — desktop 원본의 export 를 동일 시그니처로
// 보존하되, Tauri invoke 호출을 옵시디언 ObsidianVaultAdapter / Electron fs
// 로 라우팅. 모든 desktop UI 코드가 `import "../vaultAdapter"` 그대로 동작.

import type { VaultAdapter, VaultDirEntry } from "@ai-manuscript-studio/core";
import { ObsidianVaultBinaryHelper } from "../adapters/vaultBinary";
import { getStudioPlugin } from "./context";

// ---- 기존 desktop API: setVaultBasePath / getVaultBasePath -----------------
//
// 옵시디언 환경에서는 base path 가 plugin 마운트 시점부터 정해져 있어 setter
// 가 필요 없다. setter 는 no-op, getter 는 옵시디언 어댑터에서 직접 읽는다.

export function setVaultBasePath(_path: string): void {
  /* no-op — 옵시디언 환경에서는 plugin context 가 base path 를 안다 */
}

export function getVaultBasePath(): string | null {
  try {
    return getStudioPlugin().vaultAdapter.getBasePath() || null;
  } catch {
    return null;
  }
}

// ---- 기존 desktop API: tauriVaultAdapter -----------------------------------
//
// proxy 로 옵시디언 plugin 의 ObsidianVaultAdapter 를 그대로 노출. 모든 호출은
// 옵시디언 Vault API 로 라우팅된다.

export const tauriVaultAdapter: VaultAdapter = new Proxy(
  {} as VaultAdapter,
  {
    get(_target, prop: string) {
      const ad = getStudioPlugin().vaultAdapter as unknown as Record<
        string,
        unknown
      >;
      const value = ad[prop];
      if (typeof value === "function") return value.bind(ad);
      return value;
    },
  },
);

// ---- binary 헬퍼 ------------------------------------------------------------

export async function writeAttachmentBinary(
  rel: string,
  data: Uint8Array,
): Promise<void> {
  const plugin = getStudioPlugin();
  const helper = new ObsidianVaultBinaryHelper(plugin.app);
  return helper.writeAttachmentBinary(rel, data);
}

export async function copyExternalFile(
  srcAbs: string,
  dstAbsOrRel: string,
): Promise<void> {
  const plugin = getStudioPlugin();
  const helper = new ObsidianVaultBinaryHelper(plugin.app);
  return helper.copyExternalFile(srcAbs, dstAbsOrRel);
}

export function toAssetUrl(absPathOrRel: string): string {
  const plugin = getStudioPlugin();
  const helper = new ObsidianVaultBinaryHelper(plugin.app);
  return helper.toAssetUrl(absPathOrRel);
}

// ---- 옵시디언 노트 컨텍스트 fetch (desktop 원본 그대로) --------------------

const NOTE_SEARCH_SKIP_DIRS = new Set([
  ".obsidian",
  ".git",
  "node_modules",
  "_attachments",
  "_index",
  "_skillpacks",
  "_templates",
  "4 Archive",
]);

export function normalizeNoteLink(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("[[") && s.endsWith("]]")) {
    s = s.slice(2, -2).trim();
  }
  const pipeIdx = s.indexOf("|");
  if (pipeIdx >= 0) s = s.slice(0, pipeIdx).trim();
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0) s = s.slice(0, hashIdx).trim();
  if (/\.md$/i.test(s)) s = s.slice(0, -3);
  return s;
}

export function stripFrontmatter(md: string): string {
  const text = md.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return md;
  const closing = text.indexOf("\n---", 4);
  if (closing < 0) return md;
  const after = closing + "\n---".length;
  const rest = text.slice(after).replace(/^\n/, "");
  return rest;
}

export async function findNoteFileRecursive(
  name: string,
): Promise<string | null> {
  const target = `${name}.md`;
  const queue: string[] = [""];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries: VaultDirEntry[];
    try {
      entries = await tauriVaultAdapter.listDir(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory) {
        if (NOTE_SEARCH_SKIP_DIRS.has(e.name)) continue;
        queue.push(dir === "" ? e.name : `${dir}/${e.name}`);
      } else if (e.name === target) {
        return dir === "" ? e.name : `${dir}/${e.name}`;
      }
    }
  }
  return null;
}

export async function fetchNotesForContext(
  links: string[],
): Promise<{ context: string; found: string[]; notFound: string[] }> {
  if (links.length === 0) {
    return { context: "", found: [], notFound: [] };
  }

  const found: string[] = [];
  const notFound: string[] = [];
  const parts: string[] = [];

  for (const raw of links) {
    const normalized = normalizeNoteLink(raw);
    if (normalized.length === 0) {
      notFound.push(raw);
      console.warn(`[fetchNotesForContext] empty link after normalize: ${raw}`);
      continue;
    }

    const displayTitle = normalized.includes("/")
      ? normalized.slice(normalized.lastIndexOf("/") + 1)
      : normalized;

    let resolvedRel: string | null = null;

    if (normalized.includes("/")) {
      const candidate = `${normalized}.md`;
      try {
        if (await tauriVaultAdapter.fileExists(candidate)) {
          resolvedRel = candidate;
        }
      } catch {
        /* fall through */
      }
    } else {
      const rootCandidate = `${normalized}.md`;
      try {
        if (await tauriVaultAdapter.fileExists(rootCandidate)) {
          resolvedRel = rootCandidate;
        }
      } catch {
        /* try BFS */
      }
      if (!resolvedRel) {
        resolvedRel = await findNoteFileRecursive(normalized);
      }
    }

    if (!resolvedRel) {
      notFound.push(displayTitle);
      console.warn(`[fetchNotesForContext] note not found: ${raw}`);
      continue;
    }

    let body: string;
    try {
      body = await tauriVaultAdapter.readFile(resolvedRel);
    } catch (e) {
      notFound.push(displayTitle);
      console.warn(
        `[fetchNotesForContext] readFile failed for ${resolvedRel}:`,
        e,
      );
      continue;
    }

    const cleaned = stripFrontmatter(body).trim();
    found.push(displayTitle);
    parts.push(`### [[${displayTitle}]]\n${cleaned}\n`);
  }

  const context = parts.join("\n");
  return { context, found, notFound };
}

const NOTES_AUTOCOMPLETE_SKIP_DIRS = new Set([
  ".obsidian",
  ".git",
  "node_modules",
  "_attachments",
  "_index",
  "_skillpacks",
  "_templates",
  "4 Archive",
  "3 Writing",
]);

export async function listVaultNotes(max = 500): Promise<string[]> {
  const base = getVaultBasePath();
  if (!base) return [];
  const permanent: string[] = [];
  const literature: string[] = [];
  const others: string[] = [];

  async function walk(rel: string): Promise<void> {
    if (permanent.length + literature.length + others.length >= max) return;
    let entries: VaultDirEntry[];
    try {
      entries = await tauriVaultAdapter.listDir(rel);
    } catch {
      return;
    }
    for (const e of entries) {
      if (permanent.length + literature.length + others.length >= max) return;
      if (e.isDirectory) {
        if (NOTES_AUTOCOMPLETE_SKIP_DIRS.has(e.name)) continue;
        const child = rel ? `${rel}/${e.name}` : e.name;
        await walk(child);
      } else if (e.name.toLowerCase().endsWith(".md")) {
        const title = e.name.slice(0, -3);
        if (rel.startsWith("2 Permanent")) permanent.push(title);
        else if (rel.startsWith("1 Literature")) literature.push(title);
        else others.push(title);
      }
    }
  }

  await walk("");
  const sorter = (a: string, b: string): number => a.localeCompare(b, "ko");
  permanent.sort(sorter);
  literature.sort(sorter);
  others.sort(sorter);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...permanent, ...literature, ...others]) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
