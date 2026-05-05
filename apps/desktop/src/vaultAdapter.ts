// vaultAdapter.ts — Tauri-backed VaultAdapter 구현.
//
// Rust 측에서 정의한 invoke 명령을 호출하여 파일시스템 접근.
// `getBasePath()`는 deep link로 전달된 vault 경로를 반환한다.
// `watch()`는 백엔드의 watcher_id 기반 노티 이벤트를 구독한다.

import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeFile as fsWriteBinary, mkdir as fsMkdir } from "@tauri-apps/plugin-fs";
import type {
  VaultAdapter,
  VaultDirEntry,
  VaultEvent,
} from "@ai-manuscript-studio/core";

// ---- module-level state ------------------------------------------------

let basePath: string | null = null;

export function setVaultBasePath(path: string): void {
  basePath = path;
}

export function getVaultBasePath(): string | null {
  return basePath;
}

// vault-relative 경로를 절대 경로로 합성.
function abs(rel: string): string {
  if (!basePath) {
    throw new Error(
      "Vault 경로가 설정되지 않았습니다. deep link 호출 전 setVaultBasePath()가 필요합니다.",
    );
  }
  if (rel.startsWith("/")) return rel;
  return `${basePath}/${rel}`;
}

// ---- Rust 명령 시그니처 -------------------------------------------------

interface RustDirEntry {
  name: string;
  is_directory: boolean;
}

interface RustWatchEvent {
  watcher_id: number;
  kind: "create" | "modify" | "delete" | "rename";
  path: string;
  old_path?: string;
}

// ---- VaultAdapter 구현 -------------------------------------------------

export const tauriVaultAdapter: VaultAdapter = {
  async readFile(rel) {
    return await invoke<string>("vault_read_file", { path: abs(rel) });
  },

  async writeFile(rel, content) {
    await invoke("vault_write_file", { path: abs(rel), content });
  },

  async fileExists(rel) {
    return await invoke<boolean>("vault_exists", { path: abs(rel) });
  },

  async listDir(rel): Promise<VaultDirEntry[]> {
    const entries = await invoke<RustDirEntry[]>("vault_list_dir", {
      path: abs(rel),
    });
    return entries.map((e) => ({ name: e.name, isDirectory: e.is_directory }));
  },

  async ensureDir(rel) {
    await invoke("vault_ensure_dir", { path: abs(rel) });
  },

  async deleteFile(rel) {
    await invoke("vault_delete_file", { path: abs(rel) });
  },

  watch(rel, cb) {
    let watcherId: number | null = null;
    let unlistenEvent: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        watcherId = await invoke<number>("vault_watch_start", {
          path: abs(rel),
        });
      } catch (e) {
        console.error("[vaultAdapter] watch start failed", e);
        return;
      }
      if (cancelled) {
        // 시작과 동시에 unsubscribe된 경우 즉시 정리.
        if (watcherId !== null) {
          void invoke("vault_watch_stop", { watcherId });
        }
        return;
      }
      unlistenEvent = await listen<RustWatchEvent>("vault:event", (msg) => {
        const e = msg.payload;
        if (e.watcher_id !== watcherId) return;
        const ev: VaultEvent =
          e.kind === "rename" && e.old_path
            ? { type: "rename", from: e.old_path, to: e.path }
            : (() => {
                if (e.kind === "create") return { type: "create", path: e.path };
                if (e.kind === "delete") return { type: "delete", path: e.path };
                return { type: "modify", path: e.path };
              })();
        cb(ev);
      });
    })();

    return () => {
      cancelled = true;
      if (unlistenEvent) unlistenEvent();
      if (watcherId !== null) {
        void invoke("vault_watch_stop", { watcherId }).catch(() => {});
      }
    };
  },

  getBasePath() {
    if (!basePath) {
      throw new Error("Vault 경로가 설정되지 않았습니다.");
    }
    return basePath;
  },
};

// ---- 첨부 파일 (binary) 보조 API -------------------------------------------
//
// 마크다운 어댑터의 string-only API 와는 별개로, PDF/이미지 등 binary 파일을
// vault 안으로 복사하고 webview 안전 URL 로 변환하는 헬퍼.

/** 절대 경로의 부모 디렉토리를 보장 (없으면 생성). */
async function ensureParentDir(absPath: string): Promise<void> {
  const idx = absPath.lastIndexOf("/");
  if (idx <= 0) return;
  const parent = absPath.slice(0, idx);
  try {
    await fsMkdir(parent, { recursive: true });
  } catch {
    /* already exists */
  }
}

/** vault-relative 경로에 binary 데이터 쓰기 (parents auto-create). */
export async function writeAttachmentBinary(
  rel: string,
  data: Uint8Array,
): Promise<void> {
  const path = abs(rel);
  await ensureParentDir(path);
  await fsWriteBinary(path, data);
}

/** 외부 절대경로의 파일을 vault 안 (또는 임의 절대경로) 으로 복사. binary 안전.
 *  Tauri webview 의 native drag-drop 으로 받은 OS 절대경로를 vault 안으로 가져올 때 사용. */
export async function copyExternalFile(
  srcAbs: string,
  dstAbsOrRel: string,
): Promise<void> {
  const dst = dstAbsOrRel.startsWith("/") ? dstAbsOrRel : abs(dstAbsOrRel);
  await invoke("vault_copy_file", { src: srcAbs, dst });
}

/** 절대 경로를 webview 안전 asset URL 로 변환 (PDF iframe / img src 용). */
export function toAssetUrl(absPathOrRel: string): string {
  const p = absPathOrRel.startsWith("/") ? absPathOrRel : abs(absPathOrRel);
  return convertFileSrc(p);
}

// ---- 옵시디언 노트 컨텍스트 fetch ------------------------------------------
//
// 컨셉 마법사가 작가의 기존 옵시디언 노트를 AI system prompt 컨텍스트로 끌어오기
// 위한 헬퍼. `[[wiki-link]]` 또는 노트 제목/경로를 받아 본문을 concat 한다.

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

/**
 * 사용자 입력 link 를 노트 제목 (확장자 / wiki-link 표기 / 경로 제거) 으로 정규화.
 *  - "[[제목]]" → "제목"
 *  - "제목.md" / "제목.MD" → "제목"
 *  - "폴더/제목.md" → "폴더/제목"
 *  - 양쪽 공백 trim.
 *
 * 슬래시 포함 여부는 호출부에서 별도 분기 — 여기서는 보존한다.
 */
export function normalizeNoteLink(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("[[") && s.endsWith("]]")) {
    s = s.slice(2, -2).trim();
  }
  // 옵시디언 wiki-link alias / 헤딩 표기 ("Note|alias", "Note#heading") 는
  // 파일 식별에 무관하므로 떼어낸다.
  const pipeIdx = s.indexOf("|");
  if (pipeIdx >= 0) s = s.slice(0, pipeIdx).trim();
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0) s = s.slice(0, hashIdx).trim();
  // 끝의 .md (대소문자 무관) 제거.
  if (/\.md$/i.test(s)) s = s.slice(0, -3);
  return s;
}

/**
 * 노트 본문 머리에 있는 YAML frontmatter 블록 제거. 첫 줄이 정확히 "---" 이고
 * 그 다음 "---" 닫힘 마커가 있으면 그 사이를 잘라낸다. 없으면 원본 반환.
 */
export function stripFrontmatter(md: string): string {
  // CRLF 정규화 후 검사. 원본 line endings 는 trim 단계에서 어차피 사라짐.
  const text = md.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return md;
  const closing = text.indexOf("\n---", 4);
  if (closing < 0) return md;
  // "---" 다음 줄 시작 위치까지 잘라냄.
  const after = closing + "\n---".length;
  // 닫힘 마커 뒤의 newline 한 개도 같이 소비.
  const rest = text.slice(after).replace(/^\n/, "");
  return rest;
}

/**
 * vault 전체를 BFS 로 탐색해 첫 매칭 `**\/<name>.md` 의 vault-relative 경로 반환.
 * 못 찾으면 null. 디렉토리 listing 실패는 silent skip.
 */
export async function findNoteFileRecursive(
  name: string,
): Promise<string | null> {
  const target = `${name}.md`;
  // BFS 큐: vault-relative 디렉토리 경로 ("" = vault root).
  const queue: string[] = [""];
  while (queue.length > 0) {
    const dir = queue.shift()!;
    let entries;
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

/**
 * 옵시디언 노트들의 본문을 컨텍스트 문자열로 모은다.
 *
 * 입력 link 형태:
 *   - "[[제목]]"       — wiki-link
 *   - "제목"           — 확장자 없는 제목
 *   - "제목.md"        — 확장자 포함
 *   - "폴더/제목.md"   — vault-relative 경로
 *
 * 동작:
 *   1) 정규화 (wiki-link / .md / alias / heading 제거).
 *   2) 슬래시 포함 → 그 경로 그대로 fileExists 시도.
 *      슬래시 미포함 → root 직속 `<name>.md` 시도 후 실패하면 BFS 재귀 탐색.
 *   3) 본문 read → frontmatter 제거 → trim.
 *   4) `### [[정규화된 제목]]\n<본문>\n\n` 헤더로 concat.
 *
 * 못 찾은 노트는 console.warn 후 notFound 에 추가 (graceful skip).
 */
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

    // 헤더에 보일 "제목" — 슬래시 포함 입력은 마지막 segment 만 노출.
    const displayTitle = normalized.includes("/")
      ? normalized.slice(normalized.lastIndexOf("/") + 1)
      : normalized;

    let resolvedRel: string | null = null;

    if (normalized.includes("/")) {
      // 명시적 경로 — 그대로 시도.
      const candidate = `${normalized}.md`;
      try {
        if (await tauriVaultAdapter.fileExists(candidate)) {
          resolvedRel = candidate;
        }
      } catch {
        /* fall through to not found */
      }
    } else {
      // 1차: vault root 직속.
      const rootCandidate = `${normalized}.md`;
      try {
        if (await tauriVaultAdapter.fileExists(rootCandidate)) {
          resolvedRel = rootCandidate;
        }
      } catch {
        /* try BFS */
      }
      // 2차: 재귀 BFS.
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
