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
