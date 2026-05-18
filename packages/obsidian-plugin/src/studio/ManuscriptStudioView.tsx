// ManuscriptStudioView.tsx — 옵시디언 WorkspaceLeaf 안에서 작업실 React tree
// (apps/desktop 출신 App.tsx) 를 마운트한다.
//
// mount 시:
//   1. initStudioContext(plugin) — adapters/* 가 plugin 인스턴스를 찾을 수 있게
//   2. App tree 마운트 — 내부에서 useSettingsBootstrap, deep-link 등을 setup
//   3. projectStore.loadProject(vaultPath, projectFolder) — view state 로 받은
//      프로젝트를 자동 로드
//
// unmount 시: React unmount + release (context ref-count 감소).

import { ItemView, type WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import type AIManuscriptStudioPlugin from "../main";
import { initStudioContext } from "./context";

// App tree 자체는 lazy require 로 mount 시점에 평가. test/non-Electron 환경에서
// React tree 의 무거운 transitive deps 가 즉시 로드되지 않게 한다.
function lazyLoadStudioRoot(): React.ComponentType<{ projectFolder?: string }> {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { App } = require("./App") as typeof import("./App");
  const { useProjectStore } = require("./state/projectStore") as typeof import("./state/projectStore");
  /* eslint-enable @typescript-eslint/no-require-imports */

  return function StudioRoot({ projectFolder }: { projectFolder?: string }) {
    const loadProject = useProjectStore((s) => s.loadProject);
    React.useEffect(() => {
      if (!projectFolder) return;
      // projectFolder 는 vault-relative ("3 Writing/<slug>"). loadProject 는
      // (vaultPath, projectSlug) 시그니처지만 slug 자리에 그대로 넣어도 hash 만
      // 만들어지므로 정상 동작.
      void loadProject("", projectFolder);
    }, [projectFolder, loadProject]);
    return <App />;
  };
}

export const MANUSCRIPT_STUDIO_VIEW_TYPE = "manuscript-studio-view";

export interface ManuscriptStudioViewState extends Record<string, unknown> {
  projectFolder?: string;
}

export class ManuscriptStudioView extends ItemView {
  private root: Root | null = null;
  private state: ManuscriptStudioViewState = {};
  private releaseContext: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: AIManuscriptStudioPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return MANUSCRIPT_STUDIO_VIEW_TYPE;
  }

  getDisplayText(): string {
    const slug = this.state.projectFolder?.split("/").pop();
    return slug ? `원고: ${slug}` : "AI 원고실";
  }

  getIcon(): string {
    return "pencil";
  }

  async setState(
    state: ManuscriptStudioViewState,
    result: { history: boolean },
  ): Promise<void> {
    this.state = { ...state };
    this.render();
    await super.setState(state, result);
  }

  getState(): ManuscriptStudioViewState {
    return { ...this.state };
  }

  async onOpen(): Promise<void> {
    this.releaseContext = initStudioContext(this.plugin);
    // 옵시디언 view leaf 의 content area 자체에 absolute fill 을 적용해
    // .app-shell 의 100vh/100vw 가 view 영역 안으로 가둬지도록 한다.
    const contentEl = this.containerEl.children[1] as HTMLElement;
    contentEl.empty();
    contentEl.style.padding = "0";
    contentEl.style.overflow = "hidden";
    contentEl.style.position = "relative";
    const host = contentEl.createDiv({ cls: "manuscript-studio-root" });
    this.root = createRoot(host);
    this.render();

    // 작업실에 집중할 수 있도록 옵시디언 우측 사이드바 (인덱서 카드 목록)
    // 자동 접기. 사용자가 다시 펼치고 싶으면 옵시디언 단축키 (Cmd+Opt+→)
    // 또는 사이드바 토글 버튼으로 가능.
    try {
      const split = (
        this.app.workspace as unknown as {
          rightSplit?: { collapse?: () => void };
        }
      ).rightSplit;
      if (split && typeof split.collapse === "function") split.collapse();
    } catch {
      /* 옛 옵시디언 또는 mock 환경에서 fail-safe */
    }
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
    this.releaseContext?.();
    this.releaseContext = null;
  }

  private render(): void {
    if (!this.root) return;
    const StudioRoot = lazyLoadStudioRoot();
    this.root.render(<StudioRoot projectFolder={this.state.projectFolder} />);
  }
}
