// appSettings — load/save round trip 검증.

import { DEFAULT_APP_SETTINGS, ObsidianAppSettingsStore } from "../../src/adapters/appSettings";
import type AIManuscriptStudioPlugin from "../../src/main";

class FakePlugin {
  private data: Record<string, unknown> | null = null;

  async loadData(): Promise<Record<string, unknown> | null> {
    return this.data;
  }
  async saveData(data: Record<string, unknown>): Promise<void> {
    this.data = data;
  }
}

function asPlugin(p: FakePlugin): AIManuscriptStudioPlugin {
  return p as unknown as AIManuscriptStudioPlugin;
}

describe("ObsidianAppSettingsStore", () => {
  test("아무 것도 저장된 적 없으면 DEFAULT 반환", async () => {
    const store = new ObsidianAppSettingsStore(asPlugin(new FakePlugin()));
    const s = await store.load();
    expect(s).toEqual(DEFAULT_APP_SETTINGS);
  });

  test("save 후 load 가 같은 값을 반환", async () => {
    const plugin = new FakePlugin();
    const store = new ObsidianAppSettingsStore(asPlugin(plugin));
    await store.save({
      ...DEFAULT_APP_SETTINGS,
      codexPath: "/opt/homebrew/bin/codex",
      aiProvider: "codex",
    });
    const loaded = await store.load();
    expect(loaded.codexPath).toBe("/opt/homebrew/bin/codex");
    expect(loaded.aiProvider).toBe("codex");
  });

  test("기존 writingFolder 같은 다른 영역은 보존된다", async () => {
    const plugin = new FakePlugin();
    // 인덱서가 먼저 writingFolder 를 저장한 상태를 가정
    await plugin.saveData({ writingFolder: "MyDrafts" });
    const store = new ObsidianAppSettingsStore(asPlugin(plugin));
    await store.save({
      ...DEFAULT_APP_SETTINGS,
      licenseKey: "abc-123",
    });
    const raw = await plugin.loadData();
    expect((raw as Record<string, unknown>).writingFolder).toBe("MyDrafts");
    expect(
      ((raw as { app: { licenseKey: string } }).app).licenseKey,
    ).toBe("abc-123");
  });

  test("저장된 일부 필드만 있어도 기본값과 머지", async () => {
    const plugin = new FakePlugin();
    await plugin.saveData({ app: { codexPath: "/x/codex" } });
    const store = new ObsidianAppSettingsStore(asPlugin(plugin));
    const loaded = await store.load();
    expect(loaded.codexPath).toBe("/x/codex");
    expect(loaded.aiProvider).toBe(DEFAULT_APP_SETTINGS.aiProvider);
    expect(loaded.confirmBeforeRun).toBe(DEFAULT_APP_SETTINGS.confirmBeforeRun);
  });
});
