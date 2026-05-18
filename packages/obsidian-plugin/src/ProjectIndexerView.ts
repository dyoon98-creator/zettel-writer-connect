// ProjectIndexerView.ts — right-sidebar ItemView. The whole UI surface of
// the slim v2 plugin lives here.
//
// Responsibilities:
//   - Scan the writing folder for subfolders containing `project.json`.
//   - Render one card per project (title, status badge, progress bar,
//     "원고실 열기" button that opens the in-vault AI 원고실 작업실 view).
//   - Re-render on project.json/binder.json changes (debounced 200ms).
//   - Show a mobile-unsupported banner on mobile.

import { ItemView, Platform, TFile, WorkspaceLeaf } from "obsidian";
import {
  ProjectMetaIO,
  BinderIO,
  type ProjectMeta,
  type BinderTree,
  type BinderNode,
  type BinderDocument,
} from "@ai-manuscript-studio/core/browser";
import type {
  VaultAdapter,
  NoticeAdapter,
  VaultEvent,
} from "@ai-manuscript-studio/core/adapters";
import type AIManuscriptStudioPlugin from "./main";
import { NewProjectModal, type NewProjectInput } from "./NewProjectModal";
import { createProjectFromInput } from "./createProject";

export const PROJECT_INDEXER_VIEW_TYPE = "ams-project-indexer";

interface ProjectCard {
  /** Vault-relative path to the project folder, e.g. "3 Writing/my-essay". */
  folderPath: string;
  meta: ProjectMeta;
  binder: BinderTree | null;
}

export class ProjectIndexerView extends ItemView {
  private plugin: AIManuscriptStudioPlugin;
  private vault: VaultAdapter;
  private notice: NoticeAdapter;
  private cards: ProjectCard[] = [];
  private expanded = new Set<string>();
  private debounceTimer: number | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: AIManuscriptStudioPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.vault = plugin.vaultAdapter;
    this.notice = plugin.noticeAdapter;
  }

  getViewType(): string {
    return PROJECT_INDEXER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "AI 원고실 — 원고 인덱서";
  }

  getIcon(): string {
    return "pencil";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
    const folder = this.plugin.settings.writingFolder;
    this.unsubscribe = this.vault.watch(folder, (event: VaultEvent) => {
      const path = "path" in event ? event.path : event.to;
      // Only react to project.json / binder.json or scene files under
      // the writing folder. Cheap path filter.
      if (
        path.endsWith("/project.json") ||
        path.endsWith("/binder.json") ||
        path.endsWith(".md")
      ) {
        this.scheduleRefresh();
      }
    });
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private scheduleRefresh(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.refresh();
    }, 200);
  }

  /** Public: fully reload card data and re-render. */
  async refresh(): Promise<void> {
    try {
      this.cards = await this.scanProjects(this.plugin.settings.writingFolder);
      this.render();
    } catch (err) {
      const msg = (err as Error).message;
      this.renderError(msg);
    }
  }

  /** Public for tests: scan a writing folder and return project cards. */
  async scanProjects(writingFolder: string): Promise<ProjectCard[]> {
    const cards: ProjectCard[] = [];
    const folder = writingFolder.replace(/\/+$/, "");
    const entries = await this.vault.listDir(folder);
    for (const entry of entries) {
      if (!entry.isDirectory) continue;
      const projectPath = `${folder}/${entry.name}`;
      try {
        const exists = await ProjectMetaIO.exists(this.vault, projectPath);
        if (!exists) continue;
        const meta = await ProjectMetaIO.read(this.vault, projectPath);
        let binder: BinderTree | null = null;
        try {
          binder = await BinderIO.read(this.vault, projectPath);
        } catch {
          binder = null;
        }
        cards.push({ folderPath: projectPath, meta, binder });
      } catch {
        // Skip folders with malformed project.json.
        continue;
      }
    }
    cards.sort((a, b) => {
      const ua = a.meta.updatedAt ?? "";
      const ub = b.meta.updatedAt ?? "";
      return ub.localeCompare(ua);
    });
    return cards;
  }

  private render(): void {
    const container = this.containerEl.children[1] ?? this.containerEl;
    container.empty();
    container.addClass("ams-indexer");

    if (Platform.isMobile) {
      const banner = container.createDiv({ cls: "ams-mobile-banner" });
      banner.setText("이 플러그인은 데스크톱 전용입니다.");
      return;
    }

    const header = container.createDiv({ cls: "ams-indexer-header" });
    const titleRow = header.createDiv({ cls: "ams-indexer-title-row" });
    titleRow.createEl("h3", {
      cls: "ams-indexer-title",
      text: "원고 프로젝트",
    });
    const newBtn = titleRow.createEl("button", {
      cls: "ams-new-project-btn mod-cta",
      text: "+ 새 원고",
    });
    newBtn.addEventListener("click", () => this.openNewProjectModal());
    header.createEl("p", {
      cls: "ams-indexer-sub",
      text: "원고를 선택하면 Obsidian AI 원고실 작업실에서 바로 작업할 수 있습니다.",
    });

    if (this.cards.length === 0) {
      const empty = container.createDiv({ cls: "ams-empty" });
      empty.createEl("p", {
        text: `'${this.plugin.settings.writingFolder}' 폴더에 원고 프로젝트가 없습니다.`,
      });
      const cta = empty.createEl("button", {
        cls: "ams-empty-cta mod-cta",
        text: "+ 첫 원고 만들기",
      });
      cta.addEventListener("click", () => this.openNewProjectModal());
      return;
    }

    const list = container.createDiv({ cls: "ams-card-list" });
    for (const card of this.cards) {
      this.renderCard(list, card);
    }
  }

  private renderError(message: string): void {
    const container = this.containerEl.children[1] ?? this.containerEl;
    container.empty();
    container.addClass("ams-indexer");
    const err = container.createDiv({ cls: "ams-error" });
    err.setText(`인덱싱 오류: ${message}`);
  }

  private renderCard(parent: HTMLElement, card: ProjectCard): void {
    const cardEl = parent.createDiv({ cls: "ams-card" });

    const titleRow = cardEl.createDiv({ cls: "ams-card-title-row" });
    titleRow.createEl("h4", {
      cls: "ams-card-title",
      text: card.meta.title,
    });

    const statusDef = card.meta.customStatuses?.find(
      (s: { id: string }) => s.id === card.meta.status,
    );
    const badge = titleRow.createSpan({ cls: "ams-status-badge" });
    badge.setText(statusDef?.name ?? card.meta.status);
    if (statusDef?.color) {
      badge.style.background = statusDef.color;
    }

    // Progress
    const goal = card.meta.wordGoal || 0;
    const cur = card.meta.currentWords || 0;
    const pct = goal > 0 ? Math.min(100, Math.round((cur / goal) * 100)) : 0;
    const progressText = cardEl.createDiv({ cls: "ams-progress-text" });
    progressText.setText(
      goal > 0
        ? `${cur.toLocaleString()} / ${goal.toLocaleString()} (${pct}%)`
        : `${cur.toLocaleString()} 자`,
    );
    if (goal > 0) {
      const bar = cardEl.createDiv({ cls: "ams-progress-bar" });
      const fill = bar.createDiv({ cls: "ams-progress-fill" });
      fill.style.width = `${pct}%`;
    }

    const meta = cardEl.createDiv({ cls: "ams-card-meta" });
    meta.createSpan({ text: `최종 수정: ${card.meta.updatedAt ?? "-"}` });
    if (card.meta.genre) {
      meta.createSpan({ text: `· ${card.meta.genre}` });
    }

    // Scene expand toggle
    const docs = card.binder ? collectDocuments(card.binder.root) : [];
    if (docs.length > 0) {
      const isOpen = this.expanded.has(card.folderPath);
      const toggle = cardEl.createDiv({ cls: "ams-scenes-toggle" });
      toggle.setText(
        `${isOpen ? "▾" : "▸"} 이 프로젝트의 장면 (${docs.length})`,
      );
      toggle.addEventListener("click", () => {
        if (this.expanded.has(card.folderPath)) {
          this.expanded.delete(card.folderPath);
        } else {
          this.expanded.add(card.folderPath);
        }
        this.render();
      });

      if (isOpen) {
        const list = cardEl.createDiv({ cls: "ams-scenes-list" });
        for (const doc of docs) {
          const link = list.createEl("a", {
            cls: "ams-scene-link",
            text: doc.title || doc.file,
          });
          const target = `${card.folderPath}/${doc.file}`;
          link.addEventListener("click", (e) => {
            e.preventDefault();
            void this.openScene(target);
          });
        }
      }
    }

    // Launch button — 옵시디언 내 작업실 view 로 직접 연다.
    const btn = cardEl.createEl("button", {
      cls: "ams-launch-btn mod-cta",
      text: "원고실 열기",
    });
    btn.addEventListener("click", () => {
      void this.plugin.openStudio(card.folderPath);
    });
  }

  /** Public — '+ 새 원고' / '+ 첫 원고 만들기' / 명령에서 호출. */
  openNewProjectModal(): void {
    if (Platform.isMobile) {
      this.notice.warn("이 기능은 데스크톱 전용입니다.");
      return;
    }
    new NewProjectModal(this.app, async (input: NewProjectInput) => {
      try {
        const result = await createProjectFromInput({
          vault: this.vault,
          notice: this.notice,
          writingFolder: this.plugin.settings.writingFolder,
          input,
        });
        this.notice.info(`새 원고를 만들었습니다: ${result.title}`);
        await this.refresh();
        if (input.openInApp) {
          void this.plugin.openStudio(result.folderPath);
        }
      } catch (err) {
        this.notice.error(`원고 만들기 실패: ${(err as Error).message}`);
      }
    }).open();
  }

  private async openScene(path: string): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(f);
    } else {
      this.notice.error(`장면 파일을 찾을 수 없습니다: ${path}`);
    }
  }
}

/** Walk a binder tree and return all `document`-typed leaves. */
export function collectDocuments(nodes: BinderNode[]): BinderDocument[] {
  const out: BinderDocument[] = [];
  const walk = (ns: BinderNode[]): void => {
    for (const n of ns) {
      if (n.type === "document") out.push(n);
      else if (n.type === "folder") walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
