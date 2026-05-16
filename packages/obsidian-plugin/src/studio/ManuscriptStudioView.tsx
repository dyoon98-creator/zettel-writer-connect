// ManuscriptStudioView.tsx — 옵시디언 WorkspaceLeaf 안에서 작업실 React tree
// (apps/desktop 출신 App.tsx) 를 마운트한다.
//
// mount 시:
//   1. initStudioContext(plugin) — adapters/* 가 plugin 인스턴스를 찾을 수 있게
//   2. App tree 마운트 — 내부에서 useSettingsBootstrap, deep-link 등을 setup
//   3. projectStore.loadProject(vaultPath, projectFolder) — view state 로 받은
//      프로젝트를 자동 로드
//
// unmount 시: React unmount + disposeStudioContext.

import { ItemView, type WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import type AIManuscriptStudioPlugin from "../main";
import { initStudioContext, disposeStudioContext } from "./context";

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
    initStudioContext(this.plugin);
    this.containerEl.children[1].empty();
    const host = this.containerEl.children[1].createDiv({
      cls: "manuscript-studio-root",
    });
    this.root = createRoot(host);
    this.render();
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
    disposeStudioContext();
  }

  private render(): void {
    if (!this.root) return;
    const StudioRoot = lazyLoadStudioRoot();
    this.root.render(<StudioRoot projectFolder={this.state.projectFolder} />);
  }
}
