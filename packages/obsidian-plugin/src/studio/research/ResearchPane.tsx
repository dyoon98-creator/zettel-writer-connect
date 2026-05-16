// ResearchPane.tsx — 인스펙터 패널의 "리서치" 탭 콘텐츠.
//
// 구성:
//   1. 입력 영역 — prompt + 자료 유형 + 미리 첨부 링크 + "리서치 시작"
//      (실행 중이면 진행 시간 표시 + 입력 disabled)
//   2. 목록 — 최신순 ResearchItem (제목 / 일시 / 삭제 hover)
//   3. 선택 시 ResearchItemView 로 본문 + 리라이트 버튼
//
// 외곽 헤더는 InspectorPane 의 탭 스트립이 대신한다.

import { useEffect, useState } from "react";

import {
  RESEARCH_SOURCE_LABEL,
  type ResearchSourceKind,
} from "./researchRunner";
import { useResearchStore } from "../state/researchStore";
import { useProjectStore } from "../state/projectStore";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { ResearchItemView } from "./ResearchItemView";

export function ResearchPane(): JSX.Element {
  const projectFolder = useProjectStore((s) => s.projectFolder);

  const items = useResearchStore((s) => s.items);
  const selectedId = useResearchStore((s) => s.selectedId);
  const isRunning = useResearchStore((s) => s.isRunning);
  const runStartedAt = useResearchStore((s) => s.runStartedAt);
  const runError = useResearchStore((s) => s.runError);
  const runResearch = useResearchStore((s) => s.runResearch);
  const selectResearch = useResearchStore((s) => s.selectResearch);
  const deleteResearch = useResearchStore((s) => s.deleteResearch);

  const [prompt, setPrompt] = useState("");
  const [sourceKind, setSourceKind] = useState<ResearchSourceKind>("general");
  const [linkDraft, setLinkDraft] = useState("");
  const [attachedLinks, setAttachedLinks] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [inputCollapsed, setInputCollapsed] = useState(false);

  // 진행 시간 ticker.
  useEffect(() => {
    if (!isRunning || runStartedAt == null) {
      setElapsed(0);
      return;
    }
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - runStartedAt) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [isRunning, runStartedAt]);

  const selected = selectedId ? items.find((x) => x.id === selectedId) : null;

  const addLink = (): void => {
    const u = linkDraft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      tauriNoticeAdapter.warn("URL 은 http:// 또는 https:// 로 시작해야 합니다.");
      return;
    }
    if (attachedLinks.includes(u)) {
      setLinkDraft("");
      return;
    }
    setAttachedLinks([...attachedLinks, u]);
    setLinkDraft("");
  };
  const removeLink = (u: string): void => {
    setAttachedLinks(attachedLinks.filter((x) => x !== u));
  };

  const handleRun = async (): Promise<void> => {
    if (!projectFolder) {
      tauriNoticeAdapter.error("프로젝트가 열려 있지 않습니다.");
      return;
    }
    await runResearch({ prompt, sourceKind, attachedLinks });
    // 성공 시 입력 비우고 자동 접기.
    setPrompt("");
    setAttachedLinks([]);
    setInputCollapsed(true);
  };

  const handleDelete = async (id: string, title: string): Promise<void> => {
    if (!window.confirm(`"${title}" 리서치를 삭제할까요?`)) return;
    await deleteResearch(id);
  };

  return (
    <div className="research-pane">
      <div className="research-pane-toolbar">
        <button
          type="button"
          className="research-pane-collapse-btn"
          onClick={() => setInputCollapsed((v) => !v)}
          title={inputCollapsed ? "리서치 입력 펼치기" : "리서치 입력 접기"}
        >
          {inputCollapsed ? "+ 새 리서치" : "− 입력 접기"}
        </button>
      </div>

      {!inputCollapsed && (
        <div className="research-pane-input">
          <textarea
            rows={3}
            value={prompt}
            disabled={isRunning}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="리서치 prompt — 예: AI 시대 신입의 생존 전략에 관한 최근 인터뷰·논문·통계."
            className="research-pane-prompt"
          />
          <div className="research-pane-input-row">
            <select
              value={sourceKind}
              disabled={isRunning}
              onChange={(e) => setSourceKind(e.target.value as ResearchSourceKind)}
              className="research-pane-source"
            >
              {Object.entries(RESEARCH_SOURCE_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="research-pane-run"
              disabled={isRunning || !prompt.trim() || !projectFolder}
              onClick={() => void handleRun()}
            >
              {isRunning ? `리서치 중… ${elapsed}초` : "리서치 시작"}
            </button>
          </div>

          <div className="research-pane-link-row">
            <input
              type="url"
              value={linkDraft}
              disabled={isRunning}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              placeholder="참고 링크 (선택, https://…)"
              className="research-pane-link-input"
            />
            <button
              type="button"
              disabled={isRunning || !linkDraft.trim()}
              onClick={addLink}
              className="research-pane-link-add"
            >
              +
            </button>
          </div>
          {attachedLinks.length > 0 && (
            <ul className="research-pane-link-list">
              {attachedLinks.map((u) => (
                <li key={u}>
                  <span title={u}>
                    {u.length > 50 ? `${u.slice(0, 50)}…` : u}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLink(u)}
                    title="제거"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {runError && (
            <div className="research-pane-error">{runError}</div>
          )}
        </div>
      )}

      <div className="research-pane-list">
        {items.length === 0 ? (
          <div className="research-pane-empty">
            아직 리서치가 없습니다. 위에서 prompt 를 입력해 시작하세요.
          </div>
        ) : (
          items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={
                "research-pane-list-item" +
                (it.id === selectedId
                  ? " research-pane-list-item--active"
                  : "")
              }
              onClick={() => void selectResearch(it.id)}
            >
              <div className="research-pane-list-item-title">{it.title}</div>
              <div className="research-pane-list-item-meta">
                <span>
                  {it.createdAt
                    ? new Date(it.createdAt).toLocaleDateString("ko-KR")
                    : ""}
                </span>
                {it.links.length > 0 && (
                  <span> · 🔗{it.links.length}</span>
                )}
                <button
                  type="button"
                  className="research-pane-list-item-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(it.id, it.title);
                  }}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="research-pane-detail">
          <ResearchItemView item={selected} />
        </div>
      )}
    </div>
  );
}
