// settingsStore.ts (옵시디언 shim) — Tauri settings_load/save 대신
// ObsidianAppSettingsStore + plugin.loadData/saveData 를 백엔드로 쓰는 Zustand store.
//
// 원본 desktop 의 export 시그니처를 그대로 보존:
//   AIProvider / AppSettings / DEFAULT_SETTINGS / SettingsStoreState
//   useSettingsStore / useSettingsBootstrap

import { create } from "zustand";
import { useEffect } from "react";
import {
  DEFAULT_APP_SETTINGS,
  ObsidianAppSettingsStore,
  type AppSettings,
  type AIProvider,
} from "../../adapters/appSettings";
import { findBinary } from "../../adapters/findBinary";
import { electronRequire } from "../../adapters/electronBridge";
import { getStudioPlugin } from "../context";

/**
 * 첫 load 시 옛 Tauri 데스크톱 앱의 settings.json 에서 voiceFolder /
 * codexPath 등 사용자 데이터를 1회 흡수한다. 이미 plugin data.json 에
 * 값이 있으면 덮어쓰지 않는다 (사용자가 옵시디언에서 새로 설정한 값을
 * 보호).
 */
async function migrateFromLegacyDesktopSettings(
  current: AppSettings,
): Promise<AppSettings> {
  const fs =
    electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  if (!fs || !proc) return current;
  const home = proc.env.HOME;
  if (!home) return current;
  const legacyPath = `${home}/Library/Application Support/ai-manuscript-studio/settings.json`;
  try {
    if (!fs.statSync(legacyPath).isFile()) return current;
    const raw = fs.readFileSync(legacyPath, "utf8");
    const legacy = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...current };
    if (!current.voiceFolder.trim() && typeof legacy.voiceFolder === "string") {
      next.voiceFolder = legacy.voiceFolder;
    }
    if (!current.codexPath.trim() && typeof legacy.codexPath === "string") {
      next.codexPath = legacy.codexPath;
    }
    if (
      !current.claudeCodePath.trim() &&
      typeof legacy.claudeCodePath === "string"
    ) {
      next.claudeCodePath = legacy.claudeCodePath;
    }
    if (
      !current.codexExtraArgs &&
      typeof legacy.codexExtraArgs === "string"
    ) {
      next.codexExtraArgs = legacy.codexExtraArgs;
    }
    if (
      typeof legacy.excludedFolders === "string" &&
      current.excludedFolders === DEFAULT_APP_SETTINGS.excludedFolders
    ) {
      next.excludedFolders = legacy.excludedFolders;
    }
    return next;
  } catch {
    return current;
  }
}

export type { AIProvider, AppSettings };
export const DEFAULT_SETTINGS: AppSettings = DEFAULT_APP_SETTINGS;

export interface SettingsStoreState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => void;
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function getStore(): ObsidianAppSettingsStore {
  return new ObsidianAppSettingsStore(getStudioPlugin());
}

async function persist(s: AppSettings): Promise<void> {
  try {
    await getStore().save(s);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[settingsStore] save failed", e);
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    try {
      const remote = await getStore().load();
      let merged: AppSettings = { ...DEFAULT_SETTINGS, ...remote };

      // 옛 Tauri 데스크톱 앱의 settings.json 에서 사용자 데이터 1회 흡수
      // (voice 폴더, CLI 경로 등). 이미 plugin data.json 에 값이 있으면 보존.
      const migrated = await migrateFromLegacyDesktopSettings(merged);
      const didMigrate =
        migrated.voiceFolder !== merged.voiceFolder ||
        migrated.codexPath !== merged.codexPath ||
        migrated.claudeCodePath !== merged.claudeCodePath ||
        migrated.codexExtraArgs !== merged.codexExtraArgs ||
        migrated.excludedFolders !== merged.excludedFolders;
      merged = migrated;

      // 처음 시작 시 path 가 비어 있으면 PATH 에서 자동 탐지.
      let autoFilled = didMigrate;
      if (!merged.codexPath.trim()) {
        try {
          const found = await findBinary("codex");
          if (found.trim()) {
            merged.codexPath = found.trim();
            autoFilled = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (!merged.claudeCodePath.trim()) {
        try {
          const found = await findBinary("claude");
          if (found.trim()) {
            merged.claudeCodePath = found.trim();
            autoFilled = true;
          }
        } catch {
          /* ignore */
        }
      }

      set({ settings: merged, loaded: true });

      if (autoFilled) {
        void persist(merged);
      }
    } catch {
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  async update(patch) {
    const next: AppSettings = { ...get().settings, ...patch };
    set({ settings: next });
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      void persist(next);
    }, 300);
  },

  reset() {
    set({ settings: DEFAULT_SETTINGS, loaded: false });
  },
}));

export function useSettingsBootstrap(): void {
  const loaded = useSettingsStore((s: SettingsStoreState) => s.loaded);
  const load = useSettingsStore((s: SettingsStoreState) => s.load);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
}
