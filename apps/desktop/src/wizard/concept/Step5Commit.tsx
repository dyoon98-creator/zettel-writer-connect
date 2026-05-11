// Step5Commit.tsx — Concept Wizard 6단계: 결과 요약 + 옵시디언 binder 주입.
//
// 사용자가 컨셉/메모/시놉시스/트리트먼트를 확인하고 제목을 편집한 뒤
// "프로젝트 생성"을 누르면 vault 에 시드하고 즉시 기획 인터뷰로 진입한다.

import { useState, useMemo } from "react";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useProjectStore } from "../../state/projectStore";
import { useWizardStore } from "../wizardStore";
import { tauriVaultAdapter, getVaultBasePath } from "../../vaultAdapter";
import { tauriNoticeAdapter } from "../../noticeAdapter";
import { createFrontmatterAdapter } from "../../frontmatterAdapter";
import { seedFromConceptDraft } from "./conceptSeed";
import { slugify, todayDateStamp } from "@ai-manuscript-studio/core";
import { TREATMENT_ROLE_LABELS } from "./treatmentPrompts";

interface Step5CommitProps {
  onBack?: () => void;
  onComplete?: () => void;
}

// ─── 스타일 토큰 (다른 Step 들과 동일) ──────────────────────────────────────

const ACCENT = "#1f7a4a";
const ACCENT_HOVER = "#165f38";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG_CARD = "#fafafa";
const RADIUS = 6;

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: TEXT_MUTED,
  marginBottom: 6,
};

const cardStyle: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "10px 12px",
  fontSize: 13,
  color: TEXT,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap" as const,
};

const titleInputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "9px 12px",
  fontSize: 14,
  color: TEXT,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box" as const,
  background: "#ffffff",
};

const btnBase: React.CSSProperties = {
  padding: "9px 20px",
  borderRadius: RADIUS,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  border: "none",
  transition: "background 0.15s",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: ACCENT_HOVER,
  color: "#fff",
};

const btnPrimaryDisabled: React.CSSProperties = {
  ...btnPrimary,
  background: "#b0c8bb",
  cursor: "not-allowed",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: TEXT_MUTED,
  border: `1px solid ${BORDER}`,
};

const errorBannerStyle: React.CSSProperties = {
  background: "#fff0f0",
  border: "1px solid #f5a0a0",
  borderRadius: RADIUS,
  padding: "10px 12px",
  fontSize: 13,
  color: "#b00020",
};

function deriveInitialTitle(
  session: NonNullable<ReturnType<typeof useConceptWizardStore.getState>["session"]>,
): string {
  if (session.synopsis) {
    const firstLine = session.synopsis.split(/\n/)[0].trim();
    if (firstLine) return firstLine.slice(0, 60);
  }
  if (session.seed) return session.seed.split(/\n/)[0].trim().slice(0, 60);
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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const slugPreview = useMemo(() => deriveSlugPreview(title.trim()), [title]);
  const vaultPath = getVaultBasePath();

  const canSubmit = title.trim().length > 0 && !isLoading && session !== null;

  function toggleItem(id: string): void {
    setExpandedItems((prev) => {
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
      tauriNoticeAdapter.info(
        "프로젝트가 생성됐습니다. 기획 인터뷰를 이어 시작합니다.",
      );

      // v2 — 컨셉 마법사 종료 직후 기획 인터뷰로 자연스럽게 이어진다.
      const projectFolder = useProjectStore.getState().projectFolder;
      const meta = useProjectStore.getState().meta;
      if (meta && projectFolder) {
        useWizardStore.getState().start({
          draftTitle: meta.title,
          draftGenre: meta.genre,
          targetProjectFolder: projectFolder,
        });
      }

      onComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
    }
  }

  if (!session) {
    return (
      <div
        data-testid="step5-no-session"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          fontSize: 13,
          color: TEXT_MUTED,
          padding: 32,
        }}
      >
        세션 정보가 없습니다.
      </div>
    );
  }

  return (
    <div
      data-testid="step5-commit"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#ffffff",
        color: TEXT,
        fontFamily:
          '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, sans-serif',
      }}
    >
      {/* 스크롤 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* 제목 입력 */}
        <section>
          <p style={sectionTitleStyle}>프로젝트 제목</p>
          <input
            data-testid="step5-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            style={titleInputStyle}
          />
        </section>

        {session.conceptParagraph && (
          <section>
            <p style={sectionTitleStyle}>컨셉</p>
            <div style={cardStyle} data-testid="step5-concept">
              {session.conceptParagraph}
            </div>
          </section>
        )}

        {session.synopsis && (
          <section>
            <p style={sectionTitleStyle}>시놉시스</p>
            <div style={cardStyle} data-testid="step5-synopsis">
              {session.synopsis}
            </div>
          </section>
        )}

        {/* 트리트먼트 (v2 우선) 또는 legacy outline */}
        {session.treatment && session.treatment.length > 0 ? (
          <section>
            <p style={sectionTitleStyle}>
              트리트먼트 ({session.treatment.length}장)
            </p>
            <ol
              data-testid="step5-treatment"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {session.treatment.map((card, i) => {
                const open = expandedItems.has(card.id);
                return (
                  <li
                    key={card.id}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: RADIUS,
                      background: BG_CARD,
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`step5-card-toggle-${card.id}`}
                      onClick={() => toggleItem(card.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: TEXT,
                        textAlign: "left" as const,
                        fontFamily: "inherit",
                      }}
                    >
                      <span>
                        <span style={{ color: TEXT_MUTED, marginRight: 8 }}>
                          {i + 1}.
                        </span>
                        <span
                          style={{
                            color: ACCENT,
                            fontSize: 11,
                            fontWeight: 600,
                            marginRight: 8,
                          }}
                        >
                          [{TREATMENT_ROLE_LABELS[card.role]}]
                        </span>
                        {card.title}
                      </span>
                      <span style={{ color: TEXT_MUTED, fontSize: 11 }}>
                        {open ? "▲" : "▼"}
                      </span>
                    </button>
                    {open && (
                      <div
                        style={{
                          padding: "0 12px 10px",
                          fontSize: 12,
                          color: TEXT_MUTED,
                          whiteSpace: "pre-wrap" as const,
                          lineHeight: 1.6,
                        }}
                      >
                        {card.summary}
                        {card.keySentence && (
                          <div style={{ marginTop: 6, color: ACCENT }}>
                            ▸ {card.keySentence}
                          </div>
                        )}
                        {card.readerEmotion && (
                          <div style={{ marginTop: 4, color: "#a86d1f" }}>
                            감정: {card.readerEmotion}
                          </div>
                        )}
                        {card.note && (
                          <div style={{ marginTop: 4 }}>
                            메모: {card.note}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : session.outline.length > 0 ? (
          <section>
            <p style={sectionTitleStyle}>
              목차 ({session.outline.length}장)
            </p>
            <ol
              data-testid="step5-outline"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {session.outline.map((chap, i) => {
                const open = expandedItems.has(chap.id);
                return (
                  <li
                    key={chap.id}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: RADIUS,
                      background: BG_CARD,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(chap.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        color: TEXT,
                        textAlign: "left" as const,
                        fontFamily: "inherit",
                      }}
                    >
                      <span>
                        <span style={{ color: TEXT_MUTED, marginRight: 8 }}>
                          {i + 1}.
                        </span>
                        {chap.title}
                      </span>
                      <span style={{ color: TEXT_MUTED, fontSize: 11 }}>
                        {open ? "▲" : "▼"}
                      </span>
                    </button>
                    {open && (
                      <div
                        style={{
                          padding: "0 12px 10px",
                          fontSize: 12,
                          color: TEXT_MUTED,
                          whiteSpace: "pre-wrap" as const,
                        }}
                      >
                        {chap.summary}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {session.attachedNotes.length > 0 && (
          <section>
            <p style={sectionTitleStyle}>참고 노트</p>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
              data-testid="step5-attached-notes"
            >
              {session.attachedNotes.map((note) => (
                <span
                  key={note}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--color-status-bg, #efeae0)",
                    border: `1px solid ${BORDER}`,
                    fontSize: 12,
                    color: TEXT_MUTED,
                  }}
                >
                  {note}
                </span>
              ))}
            </div>
          </section>
        )}

        {vaultPath && (
          <section>
            <p style={sectionTitleStyle}>저장 위치</p>
            <div
              data-testid="step5-path-preview"
              style={{
                background: "#f7f5f2",
                border: `1px solid ${BORDER}`,
                borderRadius: RADIUS,
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: TEXT_MUTED,
                wordBreak: "break-all" as const,
              }}
            >
              {vaultPath}/3 Writing/<span style={{ color: ACCENT }}>{slugPreview}</span>/
            </div>
          </section>
        )}

        {error && (
          <div style={errorBannerStyle} data-testid="step5-error" role="alert">
            <p style={{ fontWeight: 600, margin: 0, marginBottom: 4 }}>생성 실패</p>
            <p style={{ margin: 0, fontSize: 12 }}>{error}</p>
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 28px",
          borderTop: `1px solid ${BORDER}`,
          background: "#faf9f7",
        }}
      >
        <button
          type="button"
          data-testid="step5-back"
          onClick={() => onBack?.()}
          style={btnSecondary}
        >
          이전
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {error && (
            <button
              type="button"
              data-testid="step5-retry"
              onClick={() => {
                setError(null);
                void handleCreate();
              }}
              disabled={!canSubmit}
              style={canSubmit ? btnSecondary : { ...btnSecondary, opacity: 0.5, cursor: "not-allowed" }}
            >
              재시도
            </button>
          )}
          <button
            type="button"
            data-testid="step5-submit"
            onClick={() => void handleCreate()}
            disabled={!canSubmit}
            style={canSubmit ? btnPrimary : btnPrimaryDisabled}
            aria-disabled={!canSubmit}
          >
            {isLoading ? "생성 중…" : "프로젝트 생성 + 기획 인터뷰 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}
