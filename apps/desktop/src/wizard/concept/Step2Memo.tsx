// Step2Memo.tsx — 컨셉 마법사 2단계: 의식의 흐름 메모 + AI 분석.
//
// 동작:
//  1. 좌측 textarea — 작가가 정리되지 않은 메모를 자유 입력. store.setMemoRaw 로 자동저장.
//  2. "분석하기" — useStreamingChat 으로 MEMO 프롬프트 실행, 완료 후 JSON 파싱 → setMemoAnalysis.
//  3. 분석 결과는 5축 카드 (반복 생각 / 감정 축 / 숨은 주제 / 힘 있는 문장 / 발전 방향 3개).
//     각 항목은 ✓ 체크박스. 체크된 ID 들은 setMemoSelected 로 저장 — concept 단계 prefill 에 사용.
//  4. 메모를 건너뛰어도 다음으로 진행 가능 (선택 단계).

import { useState } from "react";
import type { MemoAnalysis } from "@ai-manuscript-studio/core";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import {
  MEMO_SYSTEM_PROMPT,
  buildMemoUserPrompt,
  parseMemoAnalysisResponse,
} from "./memoPrompts";

export interface Step2MemoProps {
  onAdvance?: () => void;
  onBack?: () => void;
}

// ─── 스타일 ────────────────────────────────────────────────────────────────

const ACCENT = "#1f7a4a";
const ACCENT_HOVER = "#165f38";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG_CARD = "#fafafa";
const RADIUS = 6;

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily:
    '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, sans-serif',
  color: TEXT,
};

const introStyle: React.CSSProperties = {
  fontSize: 13,
  color: TEXT_MUTED,
  marginBottom: 24,
  lineHeight: 1.6,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: TEXT_MUTED,
  marginBottom: 8,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 360,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "16px",
  fontSize: 14,
  lineHeight: 1.7,
  color: TEXT,
  resize: "vertical" as const,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};

const cardStyle: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "12px 14px",
  marginBottom: 10,
};

const cardHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: ACCENT,
  marginBottom: 6,
};

const checkRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "4px 0",
  fontSize: 13,
  lineHeight: 1.5,
  cursor: "pointer",
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

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: TEXT_MUTED,
  border: `1px solid ${BORDER}`,
};

const btnAnalyze: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: ACCENT,
  border: `1px solid ${ACCENT}`,
  fontSize: 13,
};

const buttonRowStyle: React.CSSProperties = {
  marginTop: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const errorBannerStyle: React.CSSProperties = {
  background: "#fff0f0",
  border: "1px solid #f5a0a0",
  borderRadius: RADIUS,
  padding: "10px 14px",
  fontSize: 13,
  color: "#b00020",
  marginBottom: 16,
};

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────

export function Step2Memo({ onAdvance, onBack }: Step2MemoProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const setMemoRaw = useConceptWizardStore((s) => s.setMemoRaw);
  const setMemoAnalysis = useConceptWizardStore((s) => s.setMemoAnalysis);
  const setMemoSelected = useConceptWizardStore((s) => s.setMemoSelected);
  const goStage = useConceptWizardStore((s) => s.goStage);

  const { run, isStreaming, error, reset } = useStreamingChat();
  const [parseError, setParseError] = useState<string | null>(null);

  const memo = session?.memo;
  const raw = memo?.raw ?? "";
  const analysis = memo?.analysis;
  const selected = new Set(memo?.selected ?? []);

  function toggleSelected(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMemoSelected(Array.from(next));
  }

  async function handleAnalyze(): Promise<void> {
    if (!session) return;
    if (!raw.trim()) return;
    setParseError(null);
    reset();

    try {
      const fullText = await run({
        messages: [
          {
            role: "user",
            content: buildMemoUserPrompt({
              seed: session.seed,
              memo: raw,
              attachedNotes: session.attachedNotes,
            }),
          },
        ],
        systemPrompt: MEMO_SYSTEM_PROMPT,
        notesContext: "",
      });

      try {
        const parsed: MemoAnalysis = parseMemoAnalysisResponse(fullText);
        setMemoAnalysis(parsed);
        // 분석 직후 기본 선택 초기화 — 사용자가 골라야 의미.
        setMemoSelected([]);
      } catch (e) {
        setParseError(
          (e instanceof Error ? e.message : String(e)) +
            " — AI 응답이 JSON 형식이 아닐 수 있습니다. 다시 시도해 주세요.",
        );
      }
    } catch {
      // useStreamingChat.error 에 반영됨.
    }
  }

  function handleNext(): void {
    // 메모가 없어도 통과 — 선택적 단계.
    goStage("concept");
    onAdvance?.();
  }

  function handleBack(): void {
    goStage("seed");
    onBack?.();
  }

  // ─── 분석 결과 카드 렌더링 헬퍼 ─────────────────────────────────────────

  function renderListCard(
    title: string,
    axis: string,
    items: string[],
  ): JSX.Element | null {
    if (items.length === 0) return null;
    return (
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{title}</div>
        {items.map((item, i) => {
          const id = `${axis}:${i}`;
          return (
            <label key={id} style={checkRowStyle}>
              <input
                type="checkbox"
                checked={selected.has(id)}
                onChange={() => toggleSelected(id)}
                style={{ marginTop: 3 }}
              />
              <span>{item}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function renderSingleLineCard(
    title: string,
    axis: string,
    value: string,
  ): JSX.Element | null {
    if (!value.trim()) return null;
    const id = `${axis}:0`;
    return (
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>{title}</div>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={selected.has(id)}
            onChange={() => toggleSelected(id)}
            style={{ marginTop: 3 }}
          />
          <span>{value}</span>
        </label>
      </div>
    );
  }

  return (
    <div style={containerStyle} data-testid="step2-memo">
      <p style={introStyle}>
        이 단계는 <strong>의식의 흐름 메모</strong>입니다. 정리하려 하지 말고,
        머릿속에 흩어진 생각·문장·인상을 그대로 풀어 놓으세요. AI 가 반복되는
        생각·감정 축·숨은 주제를 찾아드립니다. 비워두고 건너뛰어도 됩니다.
      </p>

      {error && (
        <div style={errorBannerStyle} role="alert">
          AI 호출 오류: {error}
        </div>
      )}
      {parseError && (
        <div style={errorBannerStyle} role="alert">
          {parseError}
        </div>
      )}

      <div style={gridStyle}>
        {/* 좌측 — 메모 입력 */}
        <div>
          <p style={sectionTitleStyle}>메모 (자유)</p>
          <textarea
            style={textareaStyle}
            value={raw}
            onChange={(e) => setMemoRaw(e.currentTarget.value)}
            placeholder="머릿속에 떠오르는 모든 것을 그대로... 문장이 끊겨도 OK. 모순돼도 OK."
            data-testid="memo-textarea"
            aria-label="의식의 흐름 메모"
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={isStreaming || !raw.trim() ? { ...btnAnalyze, opacity: 0.5, cursor: "not-allowed" } : btnAnalyze}
              onClick={isStreaming || !raw.trim() ? undefined : handleAnalyze}
              disabled={isStreaming || !raw.trim()}
              data-testid="memo-analyze-button"
            >
              {isStreaming ? "분석 중…" : analysis ? "다시 분석" : "분석하기"}
            </button>
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>
              {raw.length.toLocaleString()}자
            </span>
          </div>
        </div>

        {/* 우측 — 분석 결과 카드 */}
        <div>
          <p style={sectionTitleStyle}>AI 분석 (체크해서 다음 단계로)</p>
          {!analysis && !isStreaming && (
            <div style={{ ...cardStyle, color: TEXT_MUTED, fontSize: 13 }}>
              메모를 입력하고 <strong>분석하기</strong>를 누르면 AI 가 5축으로
              분석합니다.
            </div>
          )}
          {isStreaming && (
            <div style={{ ...cardStyle, color: TEXT_MUTED, fontSize: 13 }}>
              분석 중입니다…
            </div>
          )}
          {analysis && (
            <div>
              {renderSingleLineCard("감정의 축", "emotionAxis", analysis.emotionAxis)}
              {renderListCard("반복되는 생각", "recurring", analysis.recurringThoughts)}
              {renderListCard("숨은 주제", "hiddenThemes", analysis.hiddenThemes)}
              {renderListCard("힘 있는 문장", "strongSentences", analysis.strongSentences)}
              {renderListCard(
                "글로 발전 가능한 방향",
                "directions",
                analysis.developmentDirections,
              )}
            </div>
          )}
        </div>
      </div>

      <div style={buttonRowStyle}>
        <button
          style={btnSecondary}
          onClick={handleBack}
          data-testid="memo-back-button"
        >
          이전
        </button>
        <button
          style={{ ...btnPrimary, background: ACCENT_HOVER }}
          onClick={handleNext}
          data-testid="memo-next-button"
        >
          다음 (컨셉 정리하기)
        </button>
      </div>
    </div>
  );
}
