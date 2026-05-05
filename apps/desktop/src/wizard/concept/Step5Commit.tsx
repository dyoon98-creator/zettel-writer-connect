// Step5Commit.tsx — Concept Wizard 5단계: 결과 요약 + 옵시디언 binder 주입.
//
// 사용자가 컨셉/시놉시스/목차를 확인하고 제목을 편집한 뒤
// "프로젝트 생성" 버튼을 눌러 볼트에 새 프로젝트를 저장한다.

import { useState, useMemo } from "react";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useProjectStore } from "../../state/projectStore";
import { tauriVaultAdapter, getVaultBasePath } from "../../vaultAdapter";
import { tauriNoticeAdapter } from "../../noticeAdapter";
import { createFrontmatterAdapter } from "../../frontmatterAdapter";
import { seedFromConceptDraft } from "./conceptSeed";
import { slugify, todayDateStamp } from "@ai-manuscript-studio/core";

interface Step5CommitProps {
  onBack?: () => void;
  onComplete?: () => void;
}

function deriveInitialTitle(session: NonNullable<ReturnType<typeof useConceptWizardStore.getState>["session"]>): string {
  // synopsis 첫 줄 또는 seed 첫 12자
  if (session.synopsis) {
    const firstLine = session.synopsis.split(/\n/)[0].trim();
    if (firstLine) return firstLine.slice(0, 60);
  }
  if (session.seed) {
    return session.seed.split(/\n/)[0].trim().slice(0, 60);
  }
  return "";
}

function deriveSlugPreview(title: string): string {
  const base = slugify(title) || "untitled";
  return `${base}-${todayDateStamp()}`;
}

export function Step5Commit({ onBack, onComplete }: Step5CommitProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const closeWizard = useConceptWizardStore((s) => s.close);
  const loadProject = useProjectStore((s) => s.loadProject);

  const initialTitle = session ? deriveInitialTitle(session) : "";

  const [title, setTitle] = useState(initialTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const slugPreview = useMemo(() => deriveSlugPreview(title.trim()), [title]);
  const vaultPath = getVaultBasePath();

  const canSubmit = title.trim().length > 0 && !isLoading && session !== null;

  function toggleChapter(id: string): void {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate(): Promise<void> {
    if (!session || !vaultPath) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await seedFromConceptDraft(session, {
        vault: tauriVaultAdapter,
        notice: tauriNoticeAdapter,
        frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
        vaultPath,
        title: title.trim(),
      });
      await loadProject(result.vaultPath, result.projectSlug);
      closeWizard();
      tauriNoticeAdapter.info("프로젝트가 생성됐습니다.");
      onComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
    }
  }

  if (!session) {
    return (
      <div data-testid="step5-no-session" className="flex items-center justify-center h-full text-sm text-gray-500">
        세션 정보가 없습니다.
      </div>
    );
  }

  return (
    <div data-testid="step5-commit" className="flex flex-col h-full overflow-hidden">
      {/* 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* 제목 입력 */}
        <section>
          <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
            프로젝트 제목
          </label>
          <input
            data-testid="step5-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* 컨셉 단락 */}
        {session.conceptParagraph && (
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">컨셉</p>
            <div
              data-testid="step5-concept"
              className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-300 whitespace-pre-wrap"
            >
              {session.conceptParagraph}
            </div>
          </section>
        )}

        {/* 시놉시스 */}
        {session.synopsis && (
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">시놉시스</p>
            <div
              data-testid="step5-synopsis"
              className="rounded-md bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-300 whitespace-pre-wrap"
            >
              {session.synopsis}
            </div>
          </section>
        )}

        {/* 목차 미리보기 */}
        {session.outline.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
              목차 ({session.outline.length}장)
            </p>
            <ol data-testid="step5-outline" className="space-y-1">
              {session.outline.map((chap, i) => (
                <li key={chap.id} className="rounded-md border border-gray-700 bg-gray-800">
                  <button
                    type="button"
                    data-testid={`step5-chapter-toggle-${chap.id}`}
                    onClick={() => toggleChapter(chap.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 rounded-md"
                  >
                    <span>
                      <span className="text-gray-500 mr-2">{i + 1}.</span>
                      {chap.title}
                    </span>
                    <span className="text-gray-500 text-xs">{expandedChapters.has(chap.id) ? "▲" : "▼"}</span>
                  </button>
                  {expandedChapters.has(chap.id) && (
                    <div className="px-3 pb-2 text-xs text-gray-400 whitespace-pre-wrap">
                      {chap.summary}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 첨부 노트 */}
        {session.attachedNotes.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">참고 노트</p>
            <div className="flex flex-wrap gap-2" data-testid="step5-attached-notes">
              {session.attachedNotes.map((note) => (
                <span
                  key={note}
                  className="inline-flex items-center rounded-full bg-blue-900 border border-blue-700 px-2 py-0.5 text-xs text-blue-300"
                >
                  {note}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 저장 위치 미리보기 */}
        {vaultPath && (
          <section>
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">저장 위치</p>
            <div
              data-testid="step5-path-preview"
              className="rounded-md bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-400 font-mono break-all"
            >
              {vaultPath}/3 Writing/<span className="text-blue-400">{slugPreview}</span>/
            </div>
          </section>
        )}

        {/* 에러 배너 */}
        {error && (
          <div
            data-testid="step5-error"
            className="rounded-md bg-red-900 border border-red-700 px-3 py-2 text-sm text-red-300"
          >
            <p className="font-semibold mb-1">생성 실패</p>
            <p className="text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="shrink-0 flex justify-between items-center px-6 py-4 border-t border-gray-700">
        <button
          type="button"
          data-testid="step5-back"
          onClick={() => onBack?.()}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          이전
        </button>

        <div className="flex gap-2">
          {error && (
            <button
              type="button"
              data-testid="step5-retry"
              onClick={() => { setError(null); void handleCreate(); }}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-md bg-gray-700 text-sm text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              재시도
            </button>
          )}
          <button
            type="button"
            data-testid="step5-submit"
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "생성 중…" : "프로젝트 생성"}
          </button>
        </div>
      </div>
    </div>
  );
}
