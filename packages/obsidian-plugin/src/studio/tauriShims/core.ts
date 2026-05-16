// tauriShims/core.ts — `@tauri-apps/api/core` 의 옵시디언용 stub.
//
// desktop 코드가 `import { invoke } from "@tauri-apps/api/core"` 로 호출하는
// 모든 Tauri 명령을 옵시디언 Vault API + Electron fs + adapters/* 로 dispatch.
// esbuild 의 alias 설정이 이 파일을 가리키게 한다.

import { ObsidianVaultBinaryHelper } from "../../adapters/vaultBinary";
import {
  ObsidianAppSettingsStore,
  type AppSettings,
} from "../../adapters/appSettings";
import { findBinary } from "../../adapters/findBinary";
import { ObsidianVoiceFs } from "../../adapters/voiceFs";
import { electronRequire } from "../../adapters/electronBridge";
import { getStudioPlugin } from "../context";

/** 절대 경로 → vault relative. base path 가 prefix 이면 떼어낸다. */
function absToRel(p: string): string {
  const base = getStudioPlugin().vaultAdapter.getBasePath();
  if (base && p.startsWith(base + "/")) return p.slice(base.length + 1);
  if (base && p === base) return "";
  return p; // 이미 relative
}

const VOICE_FOLDER_DEFAULT = "_attachments/voice";

function getVoiceFolderRel(): string {
  // app 영역에 사용자 지정이 있으면 사용. 없으면 default.
  // 간단히 voice_path/voice_folder_info 에서만 쓰므로 default 사용.
  return VOICE_FOLDER_DEFAULT;
}

async function ensureVoiceFolder(): Promise<string> {
  const plugin = getStudioPlugin();
  const rel = getVoiceFolderRel();
  const exists = await plugin.vaultAdapter.fileExists(rel);
  if (!exists) {
    await plugin.vaultAdapter.ensureDir(rel);
  }
  return rel;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invoke<T = unknown>(cmd: string, args?: any): Promise<T> {
  const plugin = getStudioPlugin();
  const va = plugin.vaultAdapter;
  const a = (args ?? {}) as Record<string, unknown>;

  switch (cmd) {
    // ---- Vault ----
    case "vault_read_file": {
      const rel = absToRel(String(a.path));
      return (await va.readFile(rel)) as unknown as T;
    }
    case "vault_write_file": {
      const rel = absToRel(String(a.path));
      await va.writeFile(rel, String(a.content));
      return undefined as unknown as T;
    }
    case "vault_exists": {
      const rel = absToRel(String(a.path));
      return (await va.fileExists(rel)) as unknown as T;
    }
    case "vault_list_dir": {
      const rel = absToRel(String(a.path));
      const entries = await va.listDir(rel);
      return entries.map((e) => ({
        name: e.name,
        is_directory: e.isDirectory,
      })) as unknown as T;
    }
    case "vault_ensure_dir": {
      const rel = absToRel(String(a.path));
      await va.ensureDir(rel);
      return undefined as unknown as T;
    }
    case "vault_delete_file": {
      const rel = absToRel(String(a.path));
      await va.deleteFile(rel);
      return undefined as unknown as T;
    }
    case "vault_copy_file": {
      const helper = new ObsidianVaultBinaryHelper(plugin.app);
      await helper.copyExternalFile(String(a.src), String(a.dst));
      return undefined as unknown as T;
    }
    case "vault_watch_start":
    case "vault_watch_stop": {
      // 옵시디언 환경에서는 ObsidianVaultAdapter.watch() 가 직접 처리.
      // streamingHandle 같은 비동기 watch 는 별도 라우팅 (이 dispatcher 미사용).
      return 0 as unknown as T;
    }

    // ---- Settings ----
    case "settings_load": {
      const store = new ObsidianAppSettingsStore(plugin);
      return (await store.load()) as unknown as T;
    }
    case "settings_save": {
      const store = new ObsidianAppSettingsStore(plugin);
      await store.save(a.settings as AppSettings);
      return undefined as unknown as T;
    }

    // ---- AI ----
    case "ai_find_binary": {
      return (await findBinary(String(a.name))) as unknown as T;
    }
    case "ai_resolve_binary": {
      // 사용자 지정 경로가 실제 실행 가능한 파일인지 확인.
      const fs =
        electronRequire<typeof import("node:fs")>("node:fs") ??
        electronRequire<typeof import("fs")>("fs");
      if (!fs) return true as unknown as T;
      try {
        const stat = fs.statSync(String(a.path));
        return stat.isFile() as unknown as T;
      } catch {
        return false as unknown as T;
      }
    }
    case "ai_invoke":
    case "ai_cancel": {
      // streamingHandle.ts 는 adapters/aiBridge 의 직접 호출 사용.
      // 이 dispatcher 로 도착할 일 없음. 안전한 no-op.
      return undefined as unknown as T;
    }

    // ---- Voice ----
    case "voice_path": {
      const base = va.getBasePath();
      return `${base}/${getVoiceFolderRel()}` as unknown as T;
    }
    case "voice_folder_info": {
      const rel = await ensureVoiceFolder();
      const base = va.getBasePath();
      return {
        path: `${base}/${rel}`,
        is_default: true,
        is_external: false,
      } as unknown as T;
    }
    case "voice_set_folder":
    case "voice_reset_folder": {
      // 옵시디언 환경에서는 vault 내 폴더만 사용 (외부 폴더 지정 미지원).
      const rel = await ensureVoiceFolder();
      const base = va.getBasePath();
      return {
        path: `${base}/${rel}`,
        is_default: true,
        is_external: false,
      } as unknown as T;
    }
    case "voice_list_files": {
      const rel = await ensureVoiceFolder();
      const entries = await va.listDir(rel);
      const base = va.getBasePath();
      return entries
        .filter((e) => !e.isDirectory)
        .map((e) => ({
          name: e.name,
          abs_path: `${base}/${rel}/${e.name}`,
        })) as unknown as T;
    }
    case "voice_read_file": {
      // abs_path 가 vault 안에 있으면 vault.readFile, 아니면 Node fs.
      const abs = String(a.path);
      const base = va.getBasePath();
      if (base && abs.startsWith(base + "/")) {
        return (await va.readFile(abs.slice(base.length + 1))) as unknown as T;
      }
      const fs =
        electronRequire<typeof import("node:fs/promises")>(
          "node:fs/promises",
        ) ?? electronRequire<typeof import("fs/promises")>("fs/promises");
      if (!fs) throw new Error("외부 경로 읽기 미지원 (Node fs 없음).");
      return (await fs.readFile(abs, "utf8")) as unknown as T;
    }
    case "voice_write_file": {
      const rel = await ensureVoiceFolder();
      const target = `${rel}/${String(a.name)}`;
      await va.writeFile(target, String(a.content));
      const base = va.getBasePath();
      return `${base}/${target}` as unknown as T;
    }
    case "voice_delete_file": {
      const helper = new ObsidianVoiceFs(plugin.app, {
        voiceFolderRelative: getVoiceFolderRel(),
      });
      await helper.deleteFile(String(a.name));
      return undefined as unknown as T;
    }
    case "voice_open_folder": {
      const helper = new ObsidianVoiceFs(plugin.app, {
        voiceFolderRelative: getVoiceFolderRel(),
      });
      await helper.openFolder();
      return undefined as unknown as T;
    }

    default:
      throw new Error(`[tauriShims] 알려지지 않은 invoke 명령: ${cmd}`);
  }
}

/** 절대 경로 → file:// URL. desktop 의 convertFileSrc 대체. */
export function convertFileSrc(p: string): string {
  return `file://${encodeURI(p)}`;
}
