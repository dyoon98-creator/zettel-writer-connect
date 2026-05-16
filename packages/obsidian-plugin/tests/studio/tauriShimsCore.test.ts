// tauriShims/core.ts — invoke dispatcher 의 옵시디언 매핑 검증.
//
// vault_*/settings_*/voice_* 명령이 옵시디언 Vault adapter 와
// ObsidianAppSettingsStore 로 정확히 라우팅되는지 확인.

import { App, FileSystemAdapter } from "../__mocks__/obsidian";
import { ObsidianVaultAdapter } from "../../src/vaultAdapter";
import { initStudioContext } from "../../src/studio/context";
import { invoke } from "../../src/studio/tauriShims/core";
import type AIManuscriptStudioPlugin from "../../src/main";

function makePlugin(): {
  app: App;
  adapter: FileSystemAdapter;
  plugin: AIManuscriptStudioPlugin;
} {
  const adapter = new FileSystemAdapter("/vault");
  const app = new App();
  // mock app.vault.adapter 를 우리가 만든 adapter 로 교체
  (app.vault as unknown as { adapter: FileSystemAdapter }).adapter = adapter;
  const vaultAdapter = new ObsidianVaultAdapter(app as unknown as App);

  let stored: Record<string, unknown> | null = null;
  const plugin = {
    app,
    vaultAdapter,
    async loadData(): Promise<unknown> {
      return stored;
    },
    async saveData(data: Record<string, unknown>): Promise<void> {
      stored = data;
    },
  } as unknown as AIManuscriptStudioPlugin;

  initStudioContext(plugin);
  return { app, adapter, plugin };
}

describe("tauriShims/core invoke()", () => {
  describe("vault 명령", () => {
    test("vault_read_file 은 vault.adapter.read 로 라우팅 (abs → rel 변환)", async () => {
      const { adapter } = makePlugin();
      adapter.__setFile("3 Writing/my-novel/project.json", '{"hello":"world"}');
      // desktop 측은 abs 경로를 넘긴다 — base /vault prefix 가 떨어져야 함.
      const out = await invoke<string>("vault_read_file", {
        path: "/vault/3 Writing/my-novel/project.json",
      });
      expect(out).toBe('{"hello":"world"}');
    });

    test("vault_write_file 은 vault.adapter.write 로 라우팅", async () => {
      const { adapter } = makePlugin();
      adapter.__setDir("3 Writing/my-novel");
      await invoke("vault_write_file", {
        path: "/vault/3 Writing/my-novel/note.md",
        content: "hello",
      });
      const stored = await adapter.read("3 Writing/my-novel/note.md");
      expect(stored).toBe("hello");
    });

    test("vault_exists 는 vault.adapter.exists 로 라우팅", async () => {
      const { adapter } = makePlugin();
      adapter.__setFile("3 Writing/x/y.md", "");
      expect(
        await invoke<boolean>("vault_exists", { path: "/vault/3 Writing/x/y.md" }),
      ).toBe(true);
      expect(
        await invoke<boolean>("vault_exists", { path: "/vault/nope.md" }),
      ).toBe(false);
    });

    test("vault_list_dir 는 entries 의 is_directory 필드를 sneak case 로 반환", async () => {
      const { adapter } = makePlugin();
      adapter.__setDir("3 Writing/my-novel/01");
      adapter.__setFile("3 Writing/my-novel/binder.json", "{}");
      const out = await invoke<{ name: string; is_directory: boolean }[]>(
        "vault_list_dir",
        { path: "/vault/3 Writing/my-novel" },
      );
      const names = out.map((e) => e.name).sort();
      expect(names).toEqual(["01", "binder.json"]);
      const dir = out.find((e) => e.name === "01");
      expect(dir?.is_directory).toBe(true);
    });

    test("vault_delete_file 은 vault.adapter.remove 로 라우팅", async () => {
      const { adapter } = makePlugin();
      adapter.__setFile("3 Writing/old.md", "x");
      await invoke("vault_delete_file", { path: "/vault/3 Writing/old.md" });
      expect(await adapter.exists("3 Writing/old.md")).toBe(false);
    });

    test("vault_watch_start / stop 은 안전한 no-op (이미 ObsidianVaultAdapter.watch 가 처리)", async () => {
      makePlugin();
      await expect(invoke("vault_watch_start", { path: "/vault" })).resolves.toBe(0);
      await expect(invoke("vault_watch_stop", { watcherId: 0 })).resolves.toBe(0);
    });
  });

  describe("settings 명령", () => {
    test("settings_save → settings_load round trip", async () => {
      makePlugin();
      const next = {
        aiProvider: "codex" as const,
        codexPath: "/x/codex",
        codexExtraArgs: "",
        claudeCodePath: "",
        confirmBeforeRun: true,
        enableExecLog: false,
        excludedFolders: "0 raw",
        licenseKey: "",
        skillpackFolder: "_skillpacks",
        useMockBridge: false,
      };
      await invoke("settings_save", { settings: next });
      const loaded = await invoke<typeof next>("settings_load");
      expect(loaded.codexPath).toBe("/x/codex");
      expect(loaded.excludedFolders).toBe("0 raw");
    });
  });

  describe("voice 명령", () => {
    test("voice_path 는 base + default voice folder 절대 경로", async () => {
      makePlugin();
      const p = await invoke<string>("voice_path");
      expect(p).toBe("/vault/_attachments/voice");
    });

    test("voice_folder_info 는 path + is_default 반환 + 폴더 생성 효과", async () => {
      const { adapter } = makePlugin();
      const info = await invoke<{ path: string; is_default: boolean }>(
        "voice_folder_info",
      );
      expect(info.path).toBe("/vault/_attachments/voice");
      expect(info.is_default).toBe(true);
      expect(await adapter.exists("_attachments/voice")).toBe(true);
    });

    test("voice_write_file 후 voice_list_files 가 해당 파일을 보여준다", async () => {
      makePlugin();
      await invoke("voice_write_file", {
        name: "sample.txt",
        content: "내 문체 학습 자료",
      });
      const list = await invoke<{ name: string; abs_path: string }[]>(
        "voice_list_files",
      );
      const f = list.find((e) => e.name === "sample.txt");
      expect(f).toBeTruthy();
      expect(f!.abs_path).toBe("/vault/_attachments/voice/sample.txt");
    });
  });

  describe("에러 처리", () => {
    test("알려지지 않은 명령은 throw", async () => {
      makePlugin();
      await expect(invoke("definitely_not_a_real_command")).rejects.toThrow(
        /알려지지 않은 invoke 명령/,
      );
    });
  });
});
