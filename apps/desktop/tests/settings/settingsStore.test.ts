// settingsStore.test.ts — load 가 default 를 채우고 save 가 round-trip 한다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredSettings,
  installTauriMocks,
  setStoredSettings,
} from "../__mocks__/tauri";

installTauriMocks();

import {
  DEFAULT_SETTINGS,
  useSettingsStore,
} from "../../src/state/settingsStore";

beforeEach(() => {
  clearStoredSettings();
  useSettingsStore.getState().reset();
});
afterEach(() => clearStoredSettings());

describe("settingsStore", () => {
  it("load() — 저장된 settings.json 이 없으면 default 적용", async () => {
    await useSettingsStore.getState().load();
    const s = useSettingsStore.getState().settings;
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().loaded).toBe(true);
  });

  it("load() — 부분만 저장되어 있어도 누락 키는 default 와 머지", async () => {
    setStoredSettings({ codexPath: "/usr/bin/codex" });
    await useSettingsStore.getState().load();
    const s = useSettingsStore.getState().settings;
    expect(s.codexPath).toBe("/usr/bin/codex");
    expect(s.aiProvider).toBe(DEFAULT_SETTINGS.aiProvider);
  });

  it("update() — debounce 후 settings_save 호출 (간접 검증)", async () => {
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().update({ codexPath: "/p" });
    expect(useSettingsStore.getState().settings.codexPath).toBe("/p");
    // 300ms debounce 후 save 가 호출된다 — 시간을 기다린다.
    await new Promise((r) => setTimeout(r, 350));
    // 다시 load 하면 동일 값이 돌아오는지 확인 (round-trip).
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings.codexPath).toBe("/p");
  });
});
