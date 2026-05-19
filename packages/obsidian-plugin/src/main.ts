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
import { QuickComposeModal } from "./QuickComposeModal";
import { parseStructureNote } from "./structureBridge/parseStructureNote";
import { createWritingProjectFromHandoff } from "./structureBridge/createWritingProjectFromHandoff";

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
      checkCallback: (checking: boolean) => {
        const folder = this.activeProjectFolder();
        if (!folder) return false;
        if (!checking) void this.openStudio(folder);
        return true;
      },
    });

    this.addCommand({
      id: "launch-app",
      name: "(레거시) Tauri 데스크톱 앱 호출 — 현재 노트의 프로젝트",
      checkCallback: (checking: boolean) => {
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

    this.addCommand({
      id: "quick-compose-communication",
      name: "즉석 커뮤니케이션 작성",
      callback: () => {
        new QuickComposeModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "import-active-structure-note",
      name: "현재 구조노트를 원고 프로젝트로 가져오기",
      callback: () => void this.importActiveStructureNote(),
    });

    this.addSettingTab(new AIManuscriptStudioSettingTab(this.app, this));

    // Surface the indexer panel as soon as the workspace layout is ready.
    // Mirrors the Zettel Connect pattern so enabling/reloading the plugin
    // makes the right-sidebar panel visible without requiring the ribbon/command.
    this.app.workspace.onLayoutReady(() => {
      void this.openIndexerOnLayoutReady();
    });
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

  private async openIndexerOnLayoutReady(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(PROJECT_INDEXER_VIEW_TYPE).length > 0) {
      return;
    }
    await this.openIndexer();
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

  /** W1: 현재 활성 3.Structure 노트를 원고 프로젝트로 가져온다. */
  private async importActiveStructureNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      this.noticeAdapter.warn("열린 파일이 없습니다. 3.Structure 노트를 먼저 열어 주세요.");
      return;
    }
    if (!file.path.startsWith("3.Structure/")) {
      this.noticeAdapter.warn(
        `'${file.path}'는 3.Structure 폴더 안의 파일이 아닙니다. 구조노트만 가져올 수 있습니다.`,
      );
      return;
    }
    let markdown: string;
    try {
      markdown = await this.vaultAdapter.readFile(file.path);
    } catch {
      this.noticeAdapter.error(`파일을 읽는 중 오류가 발생했습니다: ${file.path}`);
      return;
    }
    let handoff;
    try {
      handoff = parseStructureNote(file.path, markdown);
    } catch (err) {
      this.noticeAdapter.error(`구조노트 파싱 실패: ${(err as Error).message}`);
      return;
    }
    const writingFolder = this.settings.writingFolder ?? "4.Writing";
    let result;
    try {
      result = await createWritingProjectFromHandoff({
        vault: this.vaultAdapter,
        notice: this.noticeAdapter,
        writingFolder,
        handoff,
      });
    } catch (err) {
      this.noticeAdapter.error(`프로젝트 생성 실패: ${(err as Error).message}`);
      return;
    }
    await this.refreshIndexer();
    await this.openStudio(result.folderPath);
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
