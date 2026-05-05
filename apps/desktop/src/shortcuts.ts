// shortcuts.ts — 글로벌 단축키 등록.
//
// React 컴포넌트에서 useGlobalShortcuts()를 한 번만 호출하면
// window-level 키 리스너가 부착된다. 핵심 단축키:
//   - Cmd/Ctrl+1/2/3 — 패널 포커스 (binder/editor/inspector)
//   - Cmd/Ctrl+K     — 코크보드 ↔ 에디터 토글
//   - Cmd/Ctrl+S     — 저장 (CodeMirror가 같은 키를 잡아도 동작)
//   - Cmd/Ctrl+N     — 선택된 부모에 새 장면
//   - Cmd/Ctrl+Alt+N — 새 폴더 (Phase E 부터; Cmd+Shift+N 은 wizard 로 이동)
//   - Cmd/Ctrl+Shift+N — 새 원고 마법사 열기
//   - Cmd/Ctrl+,     — 설정 (placeholder)
//
// CodeMirror가 입력 중일 때(Mod+S)는 CM의 키맵이 먼저 잡고 우리 win-handler까지
// 도달하지 않는다. 이 win-handler는 binder/inspector 등 외부 요소에 포커스가
// 있을 때 동작.

import { useEffect } from "react";
import { useProjectStore } from "./state/projectStore";
import { addFolderNearSelection, addSceneNearSelection } from "./binder/binderActions";
import { tauriNoticeAdapter } from "./noticeAdapter";
import { useWizardStore } from "./wizard/wizardStore";

const PANE_SELECTORS = {
  binder: ".pane:nth-of-type(1) .binder-body",
  editor: ".pane:nth-of-type(3) .editor-pane-body",
  inspector: ".pane:nth-of-type(5) .inspector-body",
};

function focusPane(which: "binder" | "editor" | "inspector"): void {
  // panes는 pane-resize-handle 사이에 끼므로 nth-of-type 인덱스가 1, 3, 5.
  const sel = PANE_SELECTORS[which];
  const el = document.querySelector(sel) as HTMLElement | null;
  if (el) {
    el.focus();
    if (typeof (el as HTMLElement).scrollIntoView === "function") {
      (el as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }
}

export function useGlobalShortcuts(): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // CodeMirror가 자체 처리하는 키는 무시할 수 있도록 default-prevented 검사.
      if (e.defaultPrevented) return;

      const key = e.key.toLowerCase();

      if (key === "1") {
        e.preventDefault();
        focusPane("binder");
      } else if (key === "2") {
        e.preventDefault();
        focusPane("editor");
      } else if (key === "3") {
        e.preventDefault();
        focusPane("inspector");
      } else if (key === "k") {
        e.preventDefault();
        const state = useProjectStore.getState();
        const sel = state.selectedNodeIds;
        if (sel.length === 1) {
          state.setViewMode(state.viewMode === "corkboard" ? "editor" : "corkboard");
        }
      } else if (key === "n" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void addSceneNearSelection();
      } else if (key === "n" && e.altKey) {
        // Cmd/Ctrl+Alt+N — 새 폴더 (Phase D 의 Cmd+Shift+N 자리에서 이동).
        e.preventDefault();
        void addFolderNearSelection();
      } else if (key === "n" && e.shiftKey) {
        // Cmd/Ctrl+Shift+N — 새 원고 마법사.
        e.preventDefault();
        useWizardStore.getState().start();
      } else if (key === ",") {
        e.preventDefault();
        tauriNoticeAdapter.info("설정 화면은 Phase F에서 추가됩니다");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
