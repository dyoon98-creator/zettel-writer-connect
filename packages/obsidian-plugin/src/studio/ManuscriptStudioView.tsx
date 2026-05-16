// ManuscriptStudioView.tsx — Scrivener-style 작업실 view 의 옵시디언 호스트.
//
// 옵시디언 WorkspaceLeaf 안에 React tree 를 마운트한다. 실제 UI 컴포넌트
// (BinderPane / InspectorPane / 에디터 등) 는 Phase 3 에서 이식되며, 지금은
// "어떤 프로젝트가 열렸는지" 를 표시하는 골격만 둔다.

import { ItemView, type WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import type AIManuscriptStudioPlugin from "../main";

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
  }

  private render(): void {
    if (!this.root) return;
    this.root.render(
      <StudioShell
        projectFolder={this.state.projectFolder}
        pluginVersion={this.plugin.manifest.version}
      />,
    );
  }
}

interface StudioShellProps {
  projectFolder?: string;
  pluginVersion: string;
}

function StudioShell({
  projectFolder,
  pluginVersion,
}: StudioShellProps): React.ReactElement {
  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        fontFamily: "var(--font-interface)",
      }}
    >
      <h2 style={{ margin: 0 }}>AI 원고실</h2>
      <p style={{ margin: 0, color: "var(--text-muted)" }}>
        통합 모드 v{pluginVersion} — 작업실 view 골격이 마운트되었습니다.
      </p>
      <div
        style={{
          padding: "12px 16px",
          background: "var(--background-secondary)",
          border: "1px solid var(--background-modifier-border)",
          borderRadius: "6px",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>현재 프로젝트</div>
        <div style={{ fontFamily: "var(--font-monospace)", fontSize: "0.9em" }}>
          {projectFolder ?? "(미지정 — 인덱서에서 카드를 클릭하세요)"}
        </div>
      </div>
      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85em" }}>
        Phase 1 골격. 실제 binder / 에디터 / inspector / 마법사 UI 는 Phase 3 에서
        이식 예정입니다.
      </p>
    </div>
  );
}
