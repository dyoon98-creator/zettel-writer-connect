// __mocks__/tauri.ts — 테스트용 Tauri 명령 mock.
//
// 메모리 vault를 흉내내어 vault_read_file / write_file / exists / list_dir 등을
// 처리한다. 테스트 안에서 setVaultFile()을 호출해 가상 파일을 미리 채워두고,
// projectStore.loadProject()가 그걸 읽도록 한다.

import { vi } from "vitest";

const files = new Map<string, string>();
let watcherCounter = 1;

export function setVaultFile(absPath: string, content: string): void {
  files.set(absPath, content);
}
export function readVaultFile(absPath: string): string | undefined {
  return files.get(absPath);
}
export function clearVault(): void {
  files.clear();
}
export function listVault(): string[] {
  return [...files.keys()];
}

// 스크립팅된 AI invocation 응답 (테스트가 setAiScript로 주입).
type AiScriptStep =
  | { kind: "token"; token: string }
  | { kind: "done"; fullText?: string; durationMs?: number; exitCode?: number }
  | { kind: "error"; message: string; stderr?: string };

let aiScript: AiScriptStep[] = [];
const aiInFlight = new Set<string>();

export function setAiScript(steps: AiScriptStep[]): void {
  aiScript = steps.slice();
}
export function clearAiScript(): void {
  aiScript = [];
  aiInFlight.clear();
  // 모든 listener도 비워서 이전 테스트의 streamingHandle이 떠돌지 않게 한다.
  listeners.clear();
}

let aiBinaryAvailable = true;
export function setAiBinaryAvailable(available: boolean): void {
  aiBinaryAvailable = available;
}

let savedAppSettings: Record<string, unknown> | null = null;
export function setStoredSettings(s: Record<string, unknown>): void {
  savedAppSettings = s;
}
export function getStoredSettings(): Record<string, unknown> | null {
  return savedAppSettings;
}
export function clearStoredSettings(): void {
  savedAppSettings = null;
}

export const mockInvoke = vi.fn(
  async (cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case "vault_read_file": {
        const p = String(args?.path);
        const v = files.get(p);
        if (v === undefined) throw new Error(`ENOENT: ${p}`);
        return v;
      }
      case "vault_write_file": {
        files.set(String(args?.path), String(args?.content ?? ""));
        return null;
      }
      case "vault_exists": {
        return files.has(String(args?.path));
      }
      case "vault_list_dir": {
        const prefix = String(args?.path).replace(/\/+$/, "") + "/";
        const direct = new Map<string, boolean>();
        for (const k of files.keys()) {
          if (!k.startsWith(prefix)) continue;
          const rest = k.slice(prefix.length);
          const slash = rest.indexOf("/");
          if (slash === -1) direct.set(rest, false);
          else direct.set(rest.slice(0, slash), true);
        }
        return [...direct].map(([name, isDir]) => ({
          name,
          is_directory: isDir,
        }));
      }
      case "vault_ensure_dir":
        return null;
      case "vault_delete_file": {
        files.delete(String(args?.path));
        return null;
      }
      case "vault_watch_start":
        return watcherCounter++;
      case "vault_watch_stop":
        return null;
      case "ai_invoke": {
        const id = String(args?.invocationId);
        aiInFlight.add(id);
        // 스크립트는 invocation 시작 시점의 snapshot을 사용한다.
        // 이후 다른 테스트가 setAiScript로 덮어써도 영향 받지 않게.
        const snapshot = aiScript.slice();
        setTimeout(() => {
          for (const step of snapshot) {
            if (!aiInFlight.has(id)) break;
            if (step.kind === "token") {
              emitAi("ai:token", { invocationId: id, token: step.token });
            } else if (step.kind === "done") {
              aiInFlight.delete(id);
              emitAi("ai:done", {
                invocationId: id,
                fullText: step.fullText ?? "",
                durationMs: step.durationMs ?? 0,
                exitCode: step.exitCode ?? 0,
              });
            } else if (step.kind === "error") {
              aiInFlight.delete(id);
              emitAi("ai:error", {
                invocationId: id,
                message: step.message,
                stderr: step.stderr ?? "",
              });
            }
          }
        }, 0);
        return null;
      }
      case "ai_cancel": {
        const id = String(args?.invocationId);
        const had = aiInFlight.delete(id);
        return had;
      }
      case "ai_resolve_binary": {
        return aiBinaryAvailable;
      }
      case "settings_load": {
        return savedAppSettings ?? {
          aiProvider: "codex",
          codexPath: "",
          codexExtraArgs: "",
          claudeCodePath: "",
          confirmBeforeRun: true,
          enableExecLog: false,
          excludedFolders: "0 raw,3 Archive",
          licenseKey: "",
          skillpackFolder: "_skillpacks",
          useMockBridge: false,
        };
      }
      case "settings_save": {
        savedAppSettings = (args?.settings ?? {}) as Record<string, unknown>;
        return null;
      }
      // voice/* — 글로벌 '내 문체' 폴더. 메모리 voice 맵으로 흉내.
      case "voice_path": {
        return voiceDir;
      }
      case "voice_list_files": {
        const out: VoiceMockEntry[] = [];
        for (const [name, entry] of voiceFiles) {
          out.push({
            name,
            absPath: `${voiceDir}/${name}`,
            modifiedMs: entry.modifiedMs,
            size: entry.content.length,
          });
        }
        return out.sort((a, b) => b.modifiedMs - a.modifiedMs);
      }
      case "voice_read_file": {
        const p = String(args?.path);
        const name = p.startsWith(`${voiceDir}/`)
          ? p.slice(voiceDir.length + 1)
          : p;
        const v = voiceFiles.get(name);
        if (!v) throw new Error(`voice ENOENT: ${p}`);
        return v.content;
      }
      case "voice_write_file": {
        const name = String(args?.name);
        voiceFiles.set(name, {
          content: String(args?.content ?? ""),
          modifiedMs: Date.now(),
        });
        return `${voiceDir}/${name}`;
      }
      case "voice_delete_file": {
        const name = String(args?.name);
        voiceFiles.delete(name);
        return null;
      }
      case "voice_open_folder": {
        return null;
      }
      case "voice_folder_info": {
        return {
          path: voiceDir,
          isCustom: voiceDirIsCustom,
          defaultPath: voiceDirDefault,
        };
      }
      case "voice_set_folder": {
        const p = String(args?.path ?? "").trim();
        if (p.length === 0) {
          voiceDir = voiceDirDefault;
          voiceDirIsCustom = false;
        } else {
          voiceDir = p;
          voiceDirIsCustom = true;
        }
        return {
          path: voiceDir,
          isCustom: voiceDirIsCustom,
          defaultPath: voiceDirDefault,
        };
      }
      case "voice_reset_folder": {
        voiceDir = voiceDirDefault;
        voiceDirIsCustom = false;
        return {
          path: voiceDir,
          isCustom: voiceDirIsCustom,
          defaultPath: voiceDirDefault,
        };
      }
      default:
        throw new Error(`unknown invoke: ${cmd}`);
    }
  },
);

// ---- voice mock state ------------------------------------------------------
const voiceDirDefault = "/mock/voice";
let voiceDir = voiceDirDefault;
let voiceDirIsCustom = false;
interface VoiceMockEntry {
  content: string;
  modifiedMs: number;
}
interface VoiceMockListItem {
  name: string;
  absPath: string;
  modifiedMs: number;
  size: number;
}
const voiceFiles = new Map<string, VoiceMockEntry>();

export function setVoiceDir(dir: string): void {
  voiceDir = dir;
  voiceDirIsCustom = dir !== voiceDirDefault;
}
export function setVoiceFile(
  name: string,
  content: string,
  modifiedMs = Date.now(),
): void {
  voiceFiles.set(name, { content, modifiedMs });
}
export function clearVoice(): void {
  voiceFiles.clear();
}
export function listVoice(): VoiceMockListItem[] {
  return [...voiceFiles.entries()].map(([name, e]) => ({
    name,
    absPath: `${voiceDir}/${name}`,
    modifiedMs: e.modifiedMs,
    size: e.content.length,
  }));
}

// ---- AI event channel mock --------------------------------------------------
//
// listen() 콜은 (channel, handler) 형태. 우리는 channel별 handler 리스트를 보관하고,
// emitAi가 채널 핸들러에 즉시 dispatch한다.

type Handler = (msg: { payload: unknown }) => void;
const listeners = new Map<string, Set<Handler>>();

function emitAi(channel: string, payload: unknown): void {
  const set = listeners.get(channel);
  if (!set) return;
  for (const h of set) {
    try {
      h({ payload });
    } catch {
      /* swallow */
    }
  }
}

export function getMockListeners(channel: string): number {
  return listeners.get(channel)?.size ?? 0;
}

export const mockListen = vi.fn(async (channel: string, handler: Handler) => {
  let set = listeners.get(channel);
  if (!set) {
    set = new Set();
    listeners.set(channel, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
  };
});

export function installTauriMocks(): void {
  vi.mock("@tauri-apps/api/core", () => ({
    invoke: mockInvoke,
  }));
  vi.mock("@tauri-apps/api/event", () => ({
    listen: mockListen,
  }));
  vi.mock("@tauri-apps/plugin-deep-link", () => ({
    onOpenUrl: vi.fn(async () => () => {}),
  }));
  vi.mock("@tauri-apps/plugin-dialog", () => ({
    open: vi.fn(async () => null),
  }));
}
