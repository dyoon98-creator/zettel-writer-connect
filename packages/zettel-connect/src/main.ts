import { Notice, Plugin, TFile, WorkspaceLeaf, requestUrl } from "obsidian";
import {
  CONNECTION_VIEW_TYPE,
  ConnectionPanel,
} from "./view/ConnectionPanel";
import { EmbeddingEngine } from "./engine/embeddings";
import {
  DEFAULT_SETTINGS,
  ZettelConnectSettings,
  ZettelConnectSettingTab,
} from "./settings";

const OLLAMA_CANDIDATE_PATHS = [
  "/opt/homebrew/bin/ollama",
  "/usr/local/bin/ollama",
  "/usr/bin/ollama",
];

export default class ZettelConnectPlugin extends Plugin {
  settings!: ZettelConnectSettings;
  embedder!: EmbeddingEngine;
  private debounceTimer: number | null = null;
  private spawnedOllamaPid: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.embedder = new EmbeddingEngine(this.app, {
      provider: this.settings.embeddingProvider,
      ollamaEndpoint: this.settings.ollamaEndpoint,
      ollamaModel: this.settings.ollamaModel,
    });

    this.registerView(
      CONNECTION_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ConnectionPanel(leaf, this),
    );

    this.addRibbonIcon("link", "Zettel Connect: 패널 열기", () =>
      void this.activateView(),
    );

    this.addCommand({
      id: "open-connection-panel",
      name: "패널 열기",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "recommend-for-active-note",
      name: "현재 노트에 대한 추천 받기",
      callback: async () => {
        const leaf = await this.activateView();
        const view = leaf?.view;
        if (view instanceof ConnectionPanel) {
          await view.recommendForActive();
        }
      },
    });

    this.addCommand({
      id: "clear-embedding-cache",
      name: "임베딩 캐시 초기화",
      callback: async () => {
        await this.clearEmbeddingCache();
      },
    });

    this.addSettingTab(new ZettelConnectSettingTab(this.app, this));

    // M3 — Auto trigger on file-open for configured folder
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.handleFileOpen(file);
      }),
    );

    // Autostart Ollama (fire-and-forget, don't block plugin load)
    void this.ensureOllamaRunning();
  }

  async onunload(): Promise<void> {
    await this.embedder?.flushCache();
    this.app.workspace.detachLeavesOfType(CONNECTION_VIEW_TYPE);
    this.stopSpawnedOllama();
  }

  // ─── Ollama autostart ──────────────────────────────────

  private async pingOllama(): Promise<boolean> {
    try {
      const res = await requestUrl({
        url: `${this.settings.ollamaEndpoint.replace(/\/+$/, "")}/api/tags`,
        method: "GET",
        throw: false,
      });
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  private resolveOllamaBinary(): string | null {
    const fs = require("fs") as typeof import("fs");
    const custom = this.settings.ollamaBinary.trim();
    if (custom) {
      return fs.existsSync(custom) ? custom : null;
    }
    for (const p of OLLAMA_CANDIDATE_PATHS) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  async ensureOllamaRunning(): Promise<void> {
    if (!this.settings.autostartOllama) return;
    if (this.settings.embeddingProvider !== "ollama") return;
    // Only localhost endpoints make sense to autostart.
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(this.settings.ollamaEndpoint)) {
      return;
    }
    if (await this.pingOllama()) return; // already up

    const bin = this.resolveOllamaBinary();
    if (!bin) {
      new Notice(
        "⚠ Ollama 바이너리를 찾지 못했습니다.\n→ 설정 → Zettel Connect → 'Ollama 바이너리 경로'에 전체 경로 입력.",
        10000,
      );
      return;
    }

    try {
      const cp = require("child_process") as typeof import("child_process");
      const child = cp.spawn(bin, ["serve"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      this.spawnedOllamaPid = child.pid ?? null;

      // Wait up to ~5s for server to come up
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.pingOllama()) {
          new Notice("🟢 Ollama 자동 기동 완료", 3000);
          return;
        }
      }
      new Notice(
        "⚠ Ollama를 띄웠지만 응답이 없습니다.\n→ 터미널에서 `ollama serve` 수동 실행 후 확인.",
        10000,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`⚠ Ollama 기동 실패: ${msg}`, 10000);
      this.spawnedOllamaPid = null;
    }
  }

  private stopSpawnedOllama(): void {
    if (this.spawnedOllamaPid === null) return;
    try {
      process.kill(this.spawnedOllamaPid, "SIGTERM");
    } catch {
      // already gone
    }
    this.spawnedOllamaPid = null;
  }

  // ─── Settings I/O ──────────────────────────────────────

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Propagate provider config changes to engine
    this.embedder?.updateConfig({
      provider: this.settings.embeddingProvider,
      ollamaEndpoint: this.settings.ollamaEndpoint,
      ollamaModel: this.settings.ollamaModel,
    });
  }

  // ─── View management ───────────────────────────────────

  async activateView(): Promise<WorkspaceLeaf | null> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(CONNECTION_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return existing[0];
    }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return null;
    await leaf.setViewState({ type: CONNECTION_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
    return leaf;
  }

  // ─── Auto-trigger ──────────────────────────────────────

  private handleFileOpen(file: TFile | null): void {
    if (!this.settings.autoTrigger) return;
    if (!file) return;
    const folder = this.settings.autoTriggerFolder;
    if (folder && !file.path.startsWith(folder)) return;
    if (file.extension !== "md") return;

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.runAutoRecommend();
    }, this.settings.autoTriggerDebounceMs);
  }

  private async runAutoRecommend(): Promise<void> {
    // Only run if the view is already open — don't force-open on every nav.
    const leaves = this.app.workspace.getLeavesOfType(CONNECTION_VIEW_TYPE);
    if (leaves.length === 0) return;
    const view = leaves[0].view;
    if (view instanceof ConnectionPanel) {
      await view.recommendForActive();
    }
  }

  // ─── Commands exposed to settings tab ──────────────────

  async clearEmbeddingCache(): Promise<void> {
    await this.embedder?.clearCache();
    new Notice("임베딩 캐시 초기화됨");
  }

  async testOllama(): Promise<void> {
    if (this.settings.embeddingProvider !== "ollama") {
      new Notice("임베딩 제공자가 Ollama가 아닙니다.");
      return;
    }
    try {
      const dim = await this.embedder.testConnection();
      new Notice(
        `✅ Ollama 연결 성공 (${this.settings.ollamaModel}, ${dim}-dim)`,
      );
    } catch (err) {
      new Notice(
        `❌ Ollama 연결 실패: ${err instanceof Error ? err.message : String(err)}`,
        10000,
      );
    }
  }
}
