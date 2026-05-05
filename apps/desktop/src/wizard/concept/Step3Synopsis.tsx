// Step3Synopsis.tsx — 컨셉 마법사 3단계: 시놉시스 streaming + 인라인 편집.
// @TASK P2-T6
//
// 동작 흐름:
//  1. 첫 진입 시 session.synopsis 가 비어있으면 자동 streaming 호출.
//  2. streaming 중: read-only div 에 buffer + caret(▍) 표시.
//  3. 완료 시: setSynopsis(fullText) → textarea 로 전환 (인라인 편집).
//  4. synopsis 가 이미 있으면 자동 호출 없이 바로 textarea 모드.
//  5. "다시 다듬기": refineHint 입력 후 재제안.
//  6. "다음": synopsis 비어있으면 disabled. 클릭 시 goStage("outline").
//  7. "이전": goStage("concept").

import { useEffect, useRef, useState } from "react";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import { fetchNotesForContext } from "../../vaultAdapter";
import {
  SYNOPSIS_SYSTEM_PROMPT,
  buildSynopsisUserPrompt,
} from "./synopsisPrompts";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface Step3SynopsisProps {
  onAdvance?: () => void;
  onBack?: () => void;
}

// ─── 스타일 상수 ──────────────────────────────────────────────────────────────

const ACCENT = "#1f7a4a";
const ACCENT_HOVER = "#165f38";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG_CONCEPT = "#f7f5f2";
const BG_STREAMING = "#fafafa";
const RADIUS = 6;

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily: "Pretendard, system-ui, sans-serif",
  color: TEXT,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: TEXT_MUTED,
  marginBottom: 8,
};

const conceptBoxStyle: React.CSSProperties = {
  background: BG_CONCEPT,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "12px 16px",
  fontSize: 13,
  lineHeight: 1.6,
  color: TEXT_MUTED,
  marginBottom: 24,
  whiteSpace: "pre-wrap" as const,
};

const streamingBoxStyle: React.CSSProperties = {
  background: BG_STREAMING,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "16px",
  fontSize: 15,
  lineHeight: 1.75,
  color: TEXT,
  minHeight: 160,
  whiteSpace: "pre-wrap" as const,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "16px",
  fontSize: 15,
  lineHeight: 1.75,
  color: TEXT,
  resize: "vertical" as const,
  minHeight: 160,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};

const errorBannerStyle: React.CSSProperties = {
  background: "#fff0f0",
  border: "1px solid #f5a0a0",
  borderRadius: RADIUS,
  padding: "10px 14px",
  fontSize: 13,
  color: "#b00020",
  marginBottom: 16,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const refineSectionStyle: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const refineInputStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "8px 12px",
  fontSize: 13,
  color: TEXT,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

const buttonRowStyle: React.CSSProperties = {
  marginTop: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
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
  background: ACCENT,
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

const btnRefine: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  fontSize: 13,
};

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export function Step3Synopsis({
  onAdvance,
  onBack,
}: Step3SynopsisProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const setSynopsis = useConceptWizardStore((s) => s.setSynopsis);
  const goStage = useConceptWizardStore((s) => s.goStage);

  const { run, buffer, isStreaming, error, reset } = useStreamingChat();

  const [refineHint, setRefineHint] = useState("");
  const [hasRun, setHasRun] = useState(false);

  const runRef = useRef(run);
  runRef.current = run;

  // 첫 진입 시 자동 streaming — session.synopsis 가 비어있을 때만.
  useEffect(() => {
    if (!session) return;
    if (session.synopsis.trim()) {
      // 이미 synopsis 있음 → 자동 호출 X.
      setHasRun(true);
      return;
    }

    let cancelled = false;

    async function autoRun(): Promise<void> {
      if (!session) return;
      try {
        let notesContext = "";
        if (session.attachedNotes.length > 0) {
          const result = await fetchNotesForContext(session.attachedNotes);
          notesContext = result.context;
        }

        const fullText = await runRef.current({
          messages: [
            {
              role: "user",
              content: buildSynopsisUserPrompt({
                conceptParagraph: session.conceptParagraph,
              }),
            },
          ],
          systemPrompt: SYNOPSIS_SYSTEM_PROMPT,
          notesContext,
        });

        if (!cancelled) {
          setSynopsis(fullText);
          setHasRun(true);
        }
      } catch {
        // error 는 useStreamingChat.error 에 반영됨.
        if (!cancelled) {
          setHasRun(true);
        }
      }
    }

    autoRun();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refine 재제안.
  async function handleRefine(): Promise<void> {
    if (!session) return;
    reset();

    try {
      let notesContext = "";
      if (session.attachedNotes.length > 0) {
        const result = await fetchNotesForContext(session.attachedNotes);
        notesContext = result.context;
      }

      const fullText = await run({
        messages: [
          {
            role: "user",
            content: buildSynopsisUserPrompt({
              conceptParagraph: session.conceptParagraph,
              refineHint: refineHint,
            }),
          },
        ],
        systemPrompt: SYNOPSIS_SYSTEM_PROMPT,
        notesContext,
      });

      setSynopsis(fullText);
    } catch {
      // error 는 useStreamingChat.error 에 반영됨.
    }
  }

  function handleNext(): void {
    goStage("outline");
    onAdvance?.();
  }

  function handleBack(): void {
    goStage("concept");
    onBack?.();
  }

  const synopsis = session?.synopsis ?? "";
  const conceptParagraph = session?.conceptParagraph ?? "";
  const nextDisabled = synopsis.trim().length === 0 || isStreaming;

  // streaming 중이면 buffer 를 보여줌. 완료 후엔 textarea.
  const showStreaming = isStreaming || (buffer && !hasRun);

  return (
    <div style={containerStyle} data-testid="step3-synopsis">
      {/* 컨셉 단락 참조 박스 */}
      {conceptParagraph && (
        <div>
          <p style={sectionTitleStyle}>컨셉 단락 (참조)</p>
          <div style={conceptBoxStyle} data-testid="concept-paragraph-ref">
            {conceptParagraph}
          </div>
        </div>
      )}

      {/* 시놉시스 영역 */}
      <div>
        <p style={sectionTitleStyle}>시놉시스</p>

        {/* 에러 배너 */}
        {error && (
          <div style={errorBannerStyle} data-testid="error-banner" role="alert">
            <span>오류: {error}</span>
            <button
              style={{ ...btnBase, padding: "4px 10px", fontSize: 12, marginLeft: "auto", background: "#b00020", color: "#fff" }}
              onClick={() => {
                reset();
                handleRefine();
              }}
            >
              재시도
            </button>
          </div>
        )}

        {/* streaming 중 — read-only div + caret */}
        {showStreaming && (
          <div style={streamingBoxStyle} data-testid="streaming-display" aria-live="polite">
            {buffer}
            <span aria-hidden="true">▍</span>
          </div>
        )}

        {/* 완료 후 — textarea 편집 */}
        {!showStreaming && (
          <textarea
            style={textareaStyle}
            data-testid="synopsis-textarea"
            value={synopsis}
            onChange={(e) => setSynopsis(e.currentTarget.value)}
            placeholder="시놉시스가 여기에 표시됩니다..."
            aria-label="시놉시스"
          />
        )}
      </div>

      {/* 다시 다듬기 */}
      {!isStreaming && (
        <div style={refineSectionStyle}>
          <label style={{ fontSize: 12, color: TEXT_MUTED }} htmlFor="refine-hint">
            추가 지시 (선택)
          </label>
          <input
            id="refine-hint"
            style={refineInputStyle}
            type="text"
            value={refineHint}
            onChange={(e) => setRefineHint(e.target.value)}
            placeholder="예: 더 짧게, 비유를 강화해줘..."
            data-testid="refine-hint-input"
          />
          <button
            style={btnRefine}
            onClick={handleRefine}
            data-testid="refine-button"
          >
            다시 다듬기 (재제안)
          </button>
        </div>
      )}

      {/* 액션 버튼 */}
      <div style={buttonRowStyle}>
        <button
          style={btnSecondary}
          onClick={handleBack}
          data-testid="back-button"
        >
          이전
        </button>
        <button
          style={nextDisabled ? btnPrimaryDisabled : { ...btnPrimary, background: ACCENT_HOVER }}
          onClick={nextDisabled ? undefined : handleNext}
          disabled={nextDisabled}
          data-testid="next-button"
          aria-disabled={nextDisabled}
        >
          다음
        </button>
      </div>
    </div>
  );
}
