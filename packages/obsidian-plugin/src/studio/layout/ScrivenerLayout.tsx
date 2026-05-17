// ScrivenerLayout.tsx — 3열 리사이저블 레이아웃 + 헤더 바.
//
// 헤더:
//   - 프로젝트 제목 (더블클릭 → input → Enter 저장)
//   - 프로젝트 status 배지 (클릭 → dropdown)
//   - "총 N자 / 목표 M자" + 진행 막대
//   - viewMode 토글 (단일 폴더 선택 시에만 표시)
//   - 설정 팝오버

import { useEffect, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ProjectStatus, STATUS_LABEL_KO } from "@ai-manuscript-studio/core";
import type { BinderNode } from "@ai-manuscript-studio/core";

import { useProjectStore } from "../state/projectStore";
import { findBinderNode } from "../state/binderQueries";
import { BinderPane } from "../binder/BinderPane";
import { EditorPane } from "../editor/EditorPane";
import { InspectorPane } from "../inspector/InspectorPane";
import { SettingsPopover } from "../theme/SettingsPopover";
import { useWizardStore } from "../wizard/wizardStore";
import { PlanningResultModal } from "../wizard/PlanningResultModal";

const ALL_STATUSES: ProjectStatus[] = [
  "idea",
  "planning",
  "outline",
  "researching",
  "drafting",
  "feedback",
  "revising",
  "final",
  "published",
];

export function ScrivenerLayout(): JSX.Element {
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const selectedIds = useProjectStore((s) => s.selectedNodeIds);
  const viewMode = useProjectStore((s) => s.viewMode);
  const setViewMode = useProjectStore((s) => s.setViewMode);
  const setProjectTitle = useProjectStore((s) => s.setProjectTitle);
  const setProjectStatus = useProjectStore((s) => s.setProjectStatus);
  const startWizard = useWizardStore((s) => s.start);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta?.title ?? "");
  const [planningOpen, setPlanningOpen] = useState(false);
  useEffect(() => {
    if (meta && !editingTitle) setTitleDraft(meta.title);
  }, [meta, editingTitle]);

  const [statusOpen, setStatusOpen] = useState(false);

  let selectedFolder: BinderNode | null = null;
  if (binder && selectedIds.length === 1) {
    const n = findBinderNode(binder, selectedIds[0]);
    if (n && n.type === "folder") selectedFolder = n;
  }

  const handleTitleSave = async (): Promise<void> => {
    if (titleDraft.trim() && titleDraft.trim() !== meta?.title) {
      await setProjectTitle(titleDraft.trim());
    } else {
      setTitleDraft(meta?.title ?? "");
    }
    setEditingTitle(false);
  };

  const progress = meta && meta.wordGoal > 0
    ? Math.min(100, Math.round((meta.currentWords / meta.wordGoal) * 100))
    : 0;

  return (
    <>
      <header className="header-bar">
        {editingTitle ? (
          <input
            className="header-title-input"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => void handleTitleSave()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleTitleSave();
              if (e.key === "Escape") {
                setTitleDraft(meta?.title ?? "");
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <span
            className="header-title"
            onDoubleClick={() => setEditingTitle(true)}
            title="더블클릭으로 이름 변경"
          >
            {meta?.title ?? "(제목 없음)"}
          </span>
        )}

        <div className="header-status-anchor">
          <button
            className="header-status header-status-btn"
            onClick={() => setStatusOpen((v) => !v)}
          >
            {meta ? STATUS_LABEL_KO[meta.status] : "—"}
          </button>
          {statusOpen && (
            <div
              className="header-status-menu"
              onMouseLeave={() => setStatusOpen(false)}
            >
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  className={
                    s === meta?.status ? "header-status-menu-item--active" : ""
                  }
                  onClick={async () => {
                    setStatusOpen(false);
                    await setProjectStatus(s);
                  }}
                >
                  {STATUS_LABEL_KO[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="header-progress">
          <div className="header-progress-bar">
            <div
              className="header-progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="header-words">
            {meta
              ? `${meta.currentWords.toLocaleString()} / ${meta.wordGoal.toLocaleString()}자`
              : ""}
          </span>
        </div>

        {selectedFolder && (
          <div className="header-viewmode">
            <button
              className={
                viewMode === "editor" ? "header-viewmode-btn--active" : ""
              }
              onClick={() => setViewMode("editor")}
              title="이 폴더의 모든 장면을 한 통합 에디터에 순서대로 펼쳐 봅니다"
            >
              Scrivenings
            </button>
            <button
              className={
                viewMode === "corkboard" ? "header-viewmode-btn--active" : ""
              }
              onClick={() => setViewMode("corkboard")}
              title="장면을 카드 보드처럼 보고 재배치"
            >
              코크보드
            </button>
          </div>
        )}

        <div className="header-spacer" />

        <button
          type="button"
          className="header-interview-btn"
          data-testid="header-interview"
          onClick={() => {
            if (!meta) return;
            startWizard({
              draftTitle: meta.title,
              draftGenre: meta.genre,
              targetProjectFolder: useProjectStore.getState().projectFolder ?? undefined,
            });
          }}
          title="이 원고로 기획 인터뷰 시작 — 인터뷰어가 질문 세례를 던집니다"
          disabled={!meta}
          style={{ marginRight: 8 }}
        >
          기획 인터뷰
        </button>

        <button
          type="button"
          className="header-interview-btn"
          data-testid="header-planning-result"
          onClick={() => {
            if (!meta) return;
            setPlanningOpen(true);
          }}
          title="기존 planning.md 결과를 보고 binder 에 적용합니다"
          disabled={!meta}
          style={{ marginRight: 8 }}
        >
          기획 결과 보기
        </button>

        <button
          type="button"
          className="header-new-manuscript-btn"
          data-testid="header-new-manuscript"
          onClick={() => startWizard()}
          title="새 원고 만들기 (Cmd/Ctrl+Shift+N)"
        >
          + 새 원고
        </button>

        <SettingsPopover />
      </header>

      <ManuscriptPanes />

      {planningOpen && (
        <PlanningResultModal onClose={() => setPlanningOpen(false)} />
      )}
    </>
  );
}

/**
 * Binder | Editor | Inspector — 3-pane Scrivener-style 레이아웃.
 * 리서치는 인스펙터 패널의 "리서치" 탭으로 통합돼 별도 컬럼이 없다.
 */
function ManuscriptPanes(): JSX.Element {
  return (
    <PanelGroup
      direction="horizontal"
      className="panes"
      autoSaveId="ams-panes-3col"
    >
      <Panel defaultSize={20} minSize={12} className="pane">
        <BinderPane />
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={56} minSize={30} className="pane">
        <EditorPane />
      </Panel>
      <PanelResizeHandle className="resize-handle" />
      <Panel defaultSize={24} minSize={16} className="pane">
        <InspectorPane />
      </Panel>
    </PanelGroup>
  );
}
