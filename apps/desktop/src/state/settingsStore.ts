// settingsStore.ts — Tauri 백엔드의 settings.json 와 동기화되는 Zustand 스토어.
//
// 흐름:
//   1) App 시작 시 useSettingsBootstrap 가 settings_load 호출 → store 초기화.
//   2) 사용자가 setField 류 액션 호출 → debounce 후 settings_save.
//   3) 다른 모듈 (tauriAIBridge, CLIWizardBridge, SkillPackLoader 등) 은
//      useSettingsStore.getState() 로 readonly 접근.

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

export type AIProvider = "codex" | "claude-code" | "mock";

export interface AppSettings {
  aiProvider: AIProvider;
  codexPath: string;
  codexExtraArgs: string;
  claudeCodePath: string;
  confirmBeforeRun: boolean;
  enableExecLog: boolean;
  excludedFolders: string;
  licenseKey: string;
  skillpackFolder: string;
  useMockBridge: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
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

export interface SettingsStoreState {
  settings: AppSettings;
  loaded: boolean;
  /** 백엔드에서 settings.json을 한 번 읽어 store 채움. */
  load: () => Promise<void>;
  /** Partial update — debounce 없이 즉시 저장. */
  update: (patch: Partial<AppSettings>) => Promise<void>;
  /** 명시적 reset (test only). */
  reset: () => void;
}

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function persist(s: AppSettings): Promise<void> {
  try {
    await invoke("settings_save", { settings: s });
  } catch (e) {
    // settings 저장 실패는 치명적이지 않음 — 다음 update 때 재시도.
    // eslint-disable-next-line no-console
    console.warn("[settingsStore] save failed", e);
  }
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    try {
      const remote = await invoke<AppSettings>("settings_load");
      // 백엔드는 default를 채워주지만, 누락된 키가 있어도 default와 머지.
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...remote };

      // 처음 시작이거나 path 가 비어 있으면 PATH 에서 자동 탐지.
      // GUI 앱은 launchd 의 짧은 PATH 만 가져 nvm/homebrew 가 안 보이므로
      // ai_find_binary 가 zsh login shell 또는 알려진 후보 위치를 시도한다.
      let autoFilled = false;
      if (!merged.codexPath.trim()) {
        try {
          const found = await invoke<string>("ai_find_binary", { name: "codex" });
          if (found && found.trim()) {
            merged.codexPath = found.trim();
            autoFilled = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (!merged.claudeCodePath.trim()) {
        try {
          const found = await invoke<string>("ai_find_binary", { name: "claude" });
          if (found && found.trim()) {
            merged.claudeCodePath = found.trim();
            autoFilled = true;
          }
        } catch {
          /* ignore */
        }
      }

      set({ settings: merged, loaded: true });

      // 자동 탐지된 값을 settings.json 으로 즉시 저장 — 다음 실행에서 다시 탐색 안 함.
      if (autoFilled) {
        void persist(merged);
      }
    } catch {
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },

  async update(patch) {
    const next = { ...get().settings, ...patch };
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

/** App.tsx mount 직후 호출 — store가 비어 있으면 1회 load. */
export function useSettingsBootstrap(): void {
  const loaded = useSettingsStore((s) => s.loaded);
  const load = useSettingsStore((s) => s.load);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
}
