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
import { getStudioPlugin } from "../context";

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
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...remote };

      // 처음 시작 시 path 가 비어 있으면 PATH 에서 자동 탐지.
      let autoFilled = false;
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
