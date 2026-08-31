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
    return (
      <StudioErrorBoundary>
        <App />
      </StudioErrorBoundary>
    );
  };
}

/**
 * 작업실 트리에 ErrorBoundary 가 «없어서» 생기던 일 — React 어딘가가 던지면
 * 화면이 통째로 백지가 됐다. 오류 메시지도, 폴백도 없어서 원인을 볼 방법이
 * 없었다 (2026-08-31 대표 화면 실측 — 파일·binder·CSS 는 전부 정상인데
 * 아무것도 안 그려졌고, 개발자도구를 열기 전에는 아무 단서도 없었다).
 *
 * 백지 대신 «무엇이 어디서 터졌는지»를 화면에 띄운다. 다시 시도 버튼도 둔다.
 */
class StudioErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; info: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null, info: "" };
  }

  static getDerivedStateFromError(error: Error): { error: Error; info: string } {
    return { error, info: "" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // 콘솔에도 남긴다 — 개발자도구를 여는 사람에겐 이쪽이 더 자세하다.
    // eslint-disable-next-line no-console
    console.error("[Studio] 작업실 렌더 실패", error, info.componentStack);
    this.setState({ error, info: info.componentStack ?? "" });
  }

  render(): React.ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="studio-error-screen" data-testid="studio-error-screen">
        <h2>작업실을 그리지 못했습니다</h2>
        <p>
          아래 내용을 그대로 알려 주시면 원인을 잡을 수 있습니다. 옵시디언
          개발자도구(Cmd+Opt+I)의 Console 에도 같은 내용이 있습니다.
        </p>
        <pre className="studio-error-detail">
          {error.message}
          {info ? `\n${info.split("\n").slice(0, 12).join("\n")}` : ""}
        </pre>
        <button
          type="button"
          className="app-empty-cta"
          onClick={() => this.setState({ error: null, info: "" })}
        >
          다시 그리기
        </button>
      </div>
    );
  }
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
