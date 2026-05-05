// main.ts — slim Phase G plugin entry. Stays under 100 lines.
//
// Surface:
//   - One ItemView (right sidebar) listing projects under `<writingFolder>/`.
//   - Three commands: open-indexer, launch-app, refresh.
//   - One ribbon icon.
//   - Mobile-only banner inside the view.

import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  PROJECT_INDEXER_VIEW_TYPE,
  ProjectIndexerView,
} from "./ProjectIndexerView";
import { launchApp } from "./launchApp";
import {
  AIManuscriptStudioSettings,
  AIManuscriptStudioSettingTab,
  OBSIDIAN_SETTINGS_DEFAULTS,
} from "./settings";
import { ObsidianVaultAdapter } from "./vaultAdapter";
import { ObsidianNoticeAdapter } from "./noticeAdapter";
import { ObsidianFrontmatterAdapter } from "./frontmatterAdapter";
import { PLUGIN_ID } from "@ai-manuscript-studio/core/browser";

export default class AIManuscriptStudioPlugin extends Plugin {
  settings!: AIManuscriptStudioSettings;
  vaultAdapter!: ObsidianVaultAdapter;
  noticeAdapter!: ObsidianNoticeAdapter;
  frontmatterAdapter!: ObsidianFrontmatterAdapter;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.vaultAdapter = new ObsidianVaultAdapter(this.app);
    this.noticeAdapter = new ObsidianNoticeAdapter();
    this.frontmatterAdapter = new ObsidianFrontmatterAdapter(this.app);

    this.registerView(
      PROJECT_INDEXER_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ProjectIndexerView(leaf, this),
    );

    this.addRibbonIcon("pencil", "AI 원고실 인덱서 열기", () =>
      void this.openIndexer(),
    );

    this.addCommand({
      id: "open-indexer",
      name: "원고 인덱서 열기",
      callback: () => void this.openIndexer(),
    });

    this.addCommand({
      id: "launch-app",
      name: "원고실 앱에서 열기 (현재 노트의 프로젝트)",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as
          | Record<string, unknown>
          | undefined;
        const ours =
          fm?.plugin === PLUGIN_ID &&
          (fm?.type === "writing-scene" || fm?.type === "writing-planning");
        const slug = typeof fm?.project === "string" ? fm.project : "";
        if (!ours || !slug) return false;
        if (!checking) {
          const root = this.settings.writingFolder.replace(/\/+$/, "");
          launchApp({
            vaultPath: this.vaultAdapter.getBasePath(),
            projectFolder: `${root}/${slug}`,
            notice: this.noticeAdapter,
          });
        }
        return true;
      },
    });

    this.addCommand({
      id: "refresh-indexer",
      name: "원고 목록 새로 고침",
      callback: () => void this.refreshIndexer(),
    });

    this.addCommand({
      id: "new-project",
      name: "새 원고 만들기",
      callback: () => void this.openNewProjectFlow(),
    });

    this.addSettingTab(new AIManuscriptStudioSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    // Detaching leaves is left to Obsidian's cleanup; explicit detach can
    // race with workspace serialization, which is harmless but noisy.
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      OBSIDIAN_SETTINGS_DEFAULTS,
      await this.loadData(),
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    void this.refreshIndexer();
  }

  async openIndexer(): Promise<WorkspaceLeaf | null> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(PROJECT_INDEXER_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return existing[0];
    }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return null;
    await leaf.setViewState({
      type: PROJECT_INDEXER_VIEW_TYPE,
      active: true,
    });
    workspace.revealLeaf(leaf);
    return leaf;
  }

  private async refreshIndexer(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(
      PROJECT_INDEXER_VIEW_TYPE,
    )) {
      const view = leaf.view;
      if (view instanceof ProjectIndexerView) {
        await view.refresh();
      }
    }
  }

  private async openNewProjectFlow(): Promise<void> {
    const leaf = await this.openIndexer();
    if (!leaf) return;
    const view = leaf.view;
    if (view instanceof ProjectIndexerView) {
      view.openNewProjectModal();
    }
  }
}
