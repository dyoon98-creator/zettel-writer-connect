// main.ts — Obsidian monolith plugin entry.
//
// Surface:
//   - Sidebar indexer view (project cards).
//   - Studio view (Scrivener-style workspace) opened in the main area.
//   - Commands: open-indexer, open-studio, refresh, new-project, launch-app
//     (legacy Tauri deep link, kept until Phase 5).
//   - One ribbon icon.

import { Plugin, WorkspaceLeaf } from "obsidian";
import {
  PROJECT_INDEXER_VIEW_TYPE,
  ProjectIndexerView,
} from "./ProjectIndexerView";
import {
  MANUSCRIPT_STUDIO_VIEW_TYPE,
  ManuscriptStudioView,
  type ManuscriptStudioViewState,
} from "./studio/ManuscriptStudioView";
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

    this.registerView(
      MANUSCRIPT_STUDIO_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ManuscriptStudioView(leaf, this),
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
      id: "open-studio",
      name: "원고실 열기 (현재 노트의 프로젝트)",
      checkCallback: (checking) => {
        const folder = this.activeProjectFolder();
        if (!folder) return false;
        if (!checking) void this.openStudio(folder);
        return true;
      },
    });

    this.addCommand({
      id: "launch-app",
      name: "(레거시) Tauri 데스크톱 앱 호출 — 현재 노트의 프로젝트",
      checkCallback: (checking) => {
        const folder = this.activeProjectFolder();
        if (!folder) return false;
        if (!checking) {
          launchApp({
            vaultPath: this.vaultAdapter.getBasePath(),
            projectFolder: folder,
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

  /** 현재 활성 노트의 프로젝트 폴더 경로(vault 기준 상대). 아니면 null. */
  private activeProjectFolder(): string | null {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as
      | Record<string, unknown>
      | undefined;
    const ours =
      fm?.plugin === PLUGIN_ID &&
      (fm?.type === "writing-scene" || fm?.type === "writing-planning");
    const slug = typeof fm?.project === "string" ? fm.project : "";
    if (!ours || !slug) return null;
    const root = this.settings.writingFolder.replace(/\/+$/, "");
    return `${root}/${slug}`;
  }

  /**
   * 작업실 view 를 메인 영역에 연다. 이미 같은 프로젝트가 열려 있으면 해당
   * leaf 를 reveal, 다른 프로젝트면 새 leaf 에 열고, 비어 있으면 새 leaf 생성.
   */
  async openStudio(projectFolder: string): Promise<WorkspaceLeaf | null> {
    const { workspace } = this.app;
    const state: ManuscriptStudioViewState = { projectFolder };
    const existing = workspace
      .getLeavesOfType(MANUSCRIPT_STUDIO_VIEW_TYPE)
      .find(
        (l) =>
          (l.view as ManuscriptStudioView).getState().projectFolder ===
          projectFolder,
      );
    if (existing) {
      workspace.revealLeaf(existing);
      return existing;
    }
    const leaf = workspace.getLeaf("tab");
    await leaf.setViewState({
      type: MANUSCRIPT_STUDIO_VIEW_TYPE,
      active: true,
      state,
    });
    workspace.revealLeaf(leaf);
    return leaf;
  }
}
