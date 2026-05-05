// ScrivenerEditor.tsx — Scrivenings 모드 (다중 장면 통합 보기).
//
// 두 모드:
//   - "보기": 본문을 마크다운으로 렌더 (옵시디언 read mode 와 동일한 스타일)
//   - "편집": 각 장면이 자기 SimpleMarkdownEditor (textarea) 를 가짐
//
// 점선 § 가 장면 사이를 표시 — 합본처럼 흐르되 경계는 보임.

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import type { BinderDocument } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../state/projectStore";
import { RichEditor } from "./RichEditor";
import { useThemePreference } from "../theme/themeStore";

export interface ScrivenerEditorProps {
  documents: BinderDocument[];
}

// marked 호출은 단순화 — inline HTML 통과 default, GFM default.
// async 옵션을 빼서 결과 타입을 항상 string 으로 고정.
function renderMarkdown(src: string): string {
  try {
    return marked.parse(src) as string;
  } catch {
    return escapeHtml(src);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
}

export function ScrivenerEditor(props: ScrivenerEditorProps): JSX.Element {
  const { documents } = props;
  const ensureSceneLoaded = useProjectStore((s) => s.ensureSceneLoaded);
  const sceneCache = useProjectStore((s) => s.sceneCache);
  const setSceneDraft = useProjectStore((s) => s.setSceneDraft);
  const saveScene = useProjectStore((s) => s.saveScene);
  const toggleSelection = useProjectStore((s) => s.toggleSelection);

  const { theme, bodyFont } = useThemePreference();
  const dark = theme === "dark";

  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    for (const d of documents) {
      void ensureSceneLoaded(d.id);
    }
  }, [documents, ensureSceneLoaded]);

  // 합본 통합 글자 수.
  const totalChars = useMemo(() => {
    let sum = 0;
    for (const d of documents) {
      const c = sceneCache[d.id];
      if (!c) continue;
      const live = c.draft ?? c.body;
      sum += live.length;
    }
    return sum;
  }, [documents, sceneCache]);

  return (
    <div className="scrivener-editor">
      <div className="scrivener-toolbar">
        <span className="scrivener-toolbar-label">
          Scrivenings · {documents.length}개 장면 · 합 {totalChars.toLocaleString()}자
        </span>
        <div className="scrivener-mode-toggle">
          <button
            className={mode === "view" ? "scrivener-mode-btn--active" : ""}
            onClick={() => setMode("view")}
          >
            보기
          </button>
          <button
            className={mode === "edit" ? "scrivener-mode-btn--active" : ""}
            onClick={() => setMode("edit")}
          >
            편집
          </button>
        </div>
      </div>

      <div className="scrivener-stack" data-mode={mode}>
        {documents.map((d, idx) => {
          const cache = sceneCache[d.id];
          const isFirst = idx === 0;
          return (
            <div key={d.id} className="scrivener-section">
              {!isFirst && (
                <div className="scrivener-separator" aria-hidden>
                  <span className="scrivener-separator-line" />
                  <span className="scrivener-separator-mark">§</span>
                  <span className="scrivener-separator-line" />
                </div>
              )}
              <div
                className="scrivener-section-title"
                onClick={() => toggleSelection(d.id, "single")}
                title="이 장면만 단독 편집"
                role="button"
                tabIndex={0}
              >
                <span className="scrivener-section-title-text">{d.title}</span>
                <span className="scrivener-section-title-jump">↗</span>
              </div>
              {!cache ? (
                <p className="pane-hint">불러오는 중…</p>
              ) : mode === "view" ? (
                <div
                  className="scrivener-readonly scrivener-readonly--md"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(cache.draft ?? cache.body),
                  }}
                />
              ) : (
                <RichEditor
                  docId={d.id}
                  body={cache.body}
                  draft={cache.draft}
                  onChange={(next) => setSceneDraft(d.id, next)}
                  onSave={() => void saveScene(d.id)}
                  dark={dark}
                  bodyFont={bodyFont}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
