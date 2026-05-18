// ProjectSwitcher.tsx — topbar 의 "다른 원고 열기" dropdown.
//
// 현재 열린 vault 의 설정된 writingFolder 아래에서 모든 project.json 을 스캔해 목록 표시.
// 클릭 시 useProjectStore.loadProject(vaultPath, projectFolder) 호출 → 데스크톱 앱이
// 그 원고로 즉시 전환.

import { useEffect, useRef, useState } from "react";

import { ProjectV2Manager, type ProjectMeta } from "@ai-manuscript-studio/core";

import { tauriNoticeAdapter } from "../noticeAdapter";
import { createFrontmatterAdapter } from "../frontmatterAdapter";
import { useProjectStore } from "../state/projectStore";
import { getStudioPlugin } from "../context";
import { tauriVaultAdapter } from "../vaultAdapter";

function getWritingRoot(): string {
  try {
    return getStudioPlugin().settings.writingFolder.replace(/\/+$/, "") || "4.Writing";
  } catch {
    return "4.Writing";
  }
}

export function ProjectSwitcher(): JSX.Element | null {
  const vaultPath = useProjectStore((s) => s.vaultPath);
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const currentTitle = useProjectStore((s) => s.meta?.title ?? "");
  const loadProject = useProjectStore((s) => s.loadProject);
  const writingRoot = getWritingRoot();

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // dropdown open 시 목록 새로 fetch.
  useEffect(() => {
    if (!open) return;
    if (!vaultPath) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const manager = new ProjectV2Manager({
          vault: tauriVaultAdapter,
          notice: tauriNoticeAdapter,
          frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
        });
        const list = await manager.list(writingRoot);
        if (cancelled) return;
        setProjects(list);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, vaultPath, writingRoot]);

  // 바깥 클릭으로 dropdown 닫기.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!vaultPath) return null;

  function handlePick(meta: ProjectMeta): void {
    if (!vaultPath) return;
    const targetFolder = `${writingRoot}/${meta.id}`;
    if (targetFolder === projectFolder) {
      setOpen(false);
      return;
    }
    setOpen(false);
    void loadProject(vaultPath, meta.id).catch((e) => {
      tauriNoticeAdapter.error(
        `원고 전환 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  }

  const display = currentTitle ? `📄 ${currentTitle}` : "원고 선택";

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="app-topbar-btn"
        data-testid="topbar-project-switcher"
        onClick={() => setOpen((v) => !v)}
        title="현재 vault 안의 다른 원고로 전환"
        style={{ minWidth: 160, textAlign: "left" }}
      >
        {display}
        <span style={{ marginLeft: 8, opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          data-testid="topbar-project-switcher-list"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            minWidth: 280,
            maxHeight: 360,
            overflow: "auto",
            background: "var(--color-surface, #fff)",
            border: "1px solid var(--color-border, #ccc)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
        >
          {isLoading && (
            <div style={{ padding: "10px 12px", fontSize: 13, opacity: 0.7 }}>
              불러오는 중…
            </div>
          )}
          {error && (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "#a33" }}>
              {error}
            </div>
          )}
          {!isLoading && !error && projects.length === 0 && (
            <div style={{ padding: "10px 12px", fontSize: 13, opacity: 0.7 }}>
              {writingRoot} 아래에 원고가 없습니다.
            </div>
          )}
          {projects.map((p) => {
            const folder = `${writingRoot}/${p.id}`;
            const isCurrent = folder === projectFolder;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isCurrent}
                data-testid={`topbar-project-switcher-item-${p.id}`}
                onClick={() => handlePick(p)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  background: isCurrent
                    ? "rgba(40, 140, 80, 0.12)"
                    : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--color-border-subtle, #eee)",
                  cursor: isCurrent ? "default" : "pointer",
                  fontSize: 13,
                  color: "var(--color-text, #222)",
                }}
              >
                <div style={{ fontWeight: isCurrent ? 600 : 500 }}>
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    opacity: 0.6,
                    marginTop: 2,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <span>{p.genre}</span>
                  <span>•</span>
                  <span>
                    {p.currentWords?.toLocaleString() ?? 0} /{" "}
                    {p.wordGoal?.toLocaleString() ?? 0}자
                  </span>
                  {isCurrent && (
                    <>
                      <span>•</span>
                      <span style={{ color: "#1f7a4a" }}>현재</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
