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

const VOICE_FOLDER_DEFAULT_REL = "_attachments/voice";

/** AppSettings.voiceFolder 절대 경로를 읽음 (없거나 빈 문자열이면 null). */
async function readVoiceFolderAbs(): Promise<string | null> {
  const plugin = getStudioPlugin();
  const store = new ObsidianAppSettingsStore(plugin);
  const settings = await store.load();
  const v = (settings.voiceFolder ?? "").trim();
  return v ? v : null;
}

interface VoiceLoc {
  /** 절대 경로 (Finder/Explorer 열기, 외부 파일 읽기용) */
  abs: string;
  /** vault 안의 상대 경로 (vault.adapter.* 호출 용). 외부 폴더면 null */
  rel: string | null;
  /** 외부 (vault 바깥) 여부 */
  isExternal: boolean;
  /** default 폴더 사용 여부 (사용자가 안 지정) */
  isDefault: boolean;
}

async function resolveVoiceLoc(): Promise<VoiceLoc> {
  const plugin = getStudioPlugin();
  const base = plugin.vaultAdapter.getBasePath();
  const override = await readVoiceFolderAbs();
  if (override) {
    // vault 안인지 확인
    if (base && override.startsWith(base + "/")) {
      const rel = override.slice(base.length + 1);
      return { abs: override, rel, isExternal: false, isDefault: false };
    }
    if (base && override === base) {
      return { abs: override, rel: "", isExternal: false, isDefault: false };
    }
    return { abs: override, rel: null, isExternal: true, isDefault: false };
  }
  const rel = VOICE_FOLDER_DEFAULT_REL;
  return {
    abs: base ? `${base}/${rel}` : rel,
    rel,
    isExternal: false,
    isDefault: true,
  };
}

async function ensureVoiceFolder(): Promise<VoiceLoc> {
  const loc = await resolveVoiceLoc();
  const plugin = getStudioPlugin();
  if (loc.rel !== null) {
    const exists = await plugin.vaultAdapter.fileExists(loc.rel);
    if (!exists) await plugin.vaultAdapter.ensureDir(loc.rel);
  } else {
    // 외부 폴더 — Node fs 로 직접 mkdir
    const fs =
      electronRequire<typeof import("node:fs")>("node:fs") ??
      electronRequire<typeof import("fs")>("fs");
    if (fs) {
      try {
        fs.mkdirSync(loc.abs, { recursive: true });
      } catch {
        /* race */
      }
    }
  }
  return loc;
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
      const loc = await resolveVoiceLoc();
      return loc.abs as unknown as T;
    }
    case "voice_folder_info": {
      const loc = await ensureVoiceFolder();
      return {
        path: loc.abs,
        is_default: loc.isDefault,
        is_external: loc.isExternal,
      } as unknown as T;
    }
    case "voice_set_folder": {
      // 사용자가 지정한 폴더로 변경. abs path 받아 AppSettings.voiceFolder 갱신.
      const newPath = String(a.path);
      const store = new ObsidianAppSettingsStore(plugin);
      const settings = await store.load();
      await store.save({ ...settings, voiceFolder: newPath });
      const loc = await ensureVoiceFolder();
      return {
        path: loc.abs,
        is_default: loc.isDefault,
        is_external: loc.isExternal,
      } as unknown as T;
    }
    case "voice_reset_folder": {
      // default 로 되돌리기 — voiceFolder 를 빈 문자열로 저장.
      const store = new ObsidianAppSettingsStore(plugin);
      const settings = await store.load();
      await store.save({ ...settings, voiceFolder: "" });
      const loc = await ensureVoiceFolder();
      return {
        path: loc.abs,
        is_default: loc.isDefault,
        is_external: loc.isExternal,
      } as unknown as T;
    }
    case "voice_list_files": {
      const loc = await ensureVoiceFolder();
      if (loc.rel !== null) {
        const entries = await va.listDir(loc.rel);
        return entries
          .filter((e) => !e.isDirectory)
          .map((e) => ({
            name: e.name,
            abs_path: `${loc.abs}/${e.name}`,
          })) as unknown as T;
      }
      // 외부 폴더 — Node fs 로 readdir
      const fs =
        electronRequire<typeof import("node:fs")>("node:fs") ??
        electronRequire<typeof import("fs")>("fs");
      if (!fs) return [] as unknown as T;
      try {
        const names = fs.readdirSync(loc.abs, { withFileTypes: true });
        return names
          .filter((d) => d.isFile())
          .map((d) => ({
            name: d.name,
            abs_path: `${loc.abs}/${d.name}`,
          })) as unknown as T;
      } catch {
        return [] as unknown as T;
      }
    }
    case "voice_read_file": {
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
      const loc = await ensureVoiceFolder();
      const name = String(a.name);
      if (name.includes("/") || name.includes("..")) {
        throw new Error(`voice 파일 이름이 안전하지 않습니다: ${name}`);
      }
      if (loc.rel !== null) {
        const target = `${loc.rel}/${name}`;
        await va.writeFile(target, String(a.content));
        return `${loc.abs}/${name}` as unknown as T;
      }
      // 외부 폴더 — Node fs 로 write
      const fs =
        electronRequire<typeof import("node:fs/promises")>(
          "node:fs/promises",
        ) ?? electronRequire<typeof import("fs/promises")>("fs/promises");
      if (!fs) throw new Error("외부 폴더 쓰기 미지원 (Node fs 없음).");
      await fs.writeFile(`${loc.abs}/${name}`, String(a.content), "utf8");
      return `${loc.abs}/${name}` as unknown as T;
    }
    case "voice_delete_file": {
      const loc = await ensureVoiceFolder();
      const name = String(a.name);
      if (name.includes("/") || name.includes("..")) {
        throw new Error(`voice 파일 이름이 안전하지 않습니다: ${name}`);
      }
      if (loc.rel !== null) {
        const target = `${loc.rel}/${name}`;
        const exists = await va.fileExists(target);
        if (exists) await va.deleteFile(target);
        return undefined as unknown as T;
      }
      const fs =
        electronRequire<typeof import("node:fs/promises")>(
          "node:fs/promises",
        ) ?? electronRequire<typeof import("fs/promises")>("fs/promises");
      if (!fs) return undefined as unknown as T;
      try {
        await fs.unlink(`${loc.abs}/${name}`);
      } catch {
        /* not exists */
      }
      return undefined as unknown as T;
    }
    case "voice_open_folder": {
      const loc = await ensureVoiceFolder();
      const shell = electronRequire<{
        shell: { openPath: (p: string) => Promise<string> };
      }>("electron")?.shell;
      if (!shell)
        throw new Error("Electron shell 에 접근할 수 없습니다 (모바일 환경?).");
      await shell.openPath(loc.abs);
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
