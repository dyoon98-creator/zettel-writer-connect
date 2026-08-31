// Step5Treatment.tsx — 컨셉 마법사 5단계: 트리트먼트 카드 보드.
//
// 동작:
//   - 첫 진입 시 session.treatment 가 비어있으면 "시놉시스로부터 채우기" 권유.
//   - 카드는 세로 리스트로 표시 (좌→우 6컬럼은 좁은 모달에 부적합). 카드별:
//       · 역할 배지 (intro/problem/case/explain/pivot/conclusion)
//       · 제목 (인라인 편집)
//       · 요약 (인라인 편집)
//       · "펼치기" 클릭 시 keySentence/readerEmotion/note 필드 추가 노출
//       · 위/아래 화살표로 순서 변경, X 로 삭제
//   - 하단 "+ 카드 추가" 버튼 (역할 셀렉트와 함께).
//   - "AI 로 채우기" — 시놉시스 + 메모 분석으로 트리트먼트 카드 6~12장 한 번에 생성.
//   - "다음" → goStage("done") — Step6Commit 으로.

import { useState } from "react";
import type { TreatmentCard, TreatmentCardRole } from "@ai-manuscript-studio/core";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import { AiStoppedNotice, AiWaitBar, isUserStopped } from "../AiWaitBar";
import {
  TREATMENT_FROM_SYNOPSIS_SYSTEM,
  TREATMENT_ROLE_LABELS,
  buildTreatmentFromSynopsisPrompt,
  parseTreatmentResponse,
} from "./treatmentPrompts";

export interface Step5TreatmentProps {
  onAdvance?: () => void;
  onBack?: () => void;
}

const ACCENT = "#1f7a4a";
const ACCENT_HOVER = "#165f38";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG_CARD = "#fafafa";
const RADIUS = 6;

const ROLE_COLORS: Record<TreatmentCardRole, string> = {
  intro: "#5b8def",
  problem: "#e07a5f",
  case: "#7a9e7e",
  explain: "#a78bfa",
  pivot: "#f59e0b",
  conclusion: "#1f7a4a",
};

const ALL_ROLES: TreatmentCardRole[] = [
  "intro",
  "problem",
  "case",
  "explain",
  "pivot",
  "conclusion",
];

// ─── 스타일 ────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "32px 24px",
  fontFamily:
    '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, sans-serif',
  color: TEXT,
};

const introStyle: React.CSSProperties = {
  fontSize: 13,
  color: TEXT_MUTED,
  marginBottom: 20,
  lineHeight: 1.6,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
};

const cardWrapperStyle: React.CSSProperties = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: "12px 14px",
  marginBottom: 10,
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const roleBadge = (role: TreatmentCardRole): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: ROLE_COLORS[role],
  color: "#fff",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderBottom: `1px dashed ${BORDER}`,
  background: "transparent",
  padding: "4px 0",
  fontSize: 14,
  fontWeight: 600,
  color: TEXT,
  outline: "none",
  fontFamily: "inherit",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.6,
  color: TEXT,
  resize: "vertical" as const,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
  minHeight: 56,
};

const smallInputStyle: React.CSSProperties = {
  ...textareaStyle,
  minHeight: 30,
  fontSize: 12,
};

const orderBtnStyle: React.CSSProperties = {
  padding: "2px 8px",
  background: "transparent",
  border: `1px solid ${BORDER}`,
  borderRadius: 4,
  cursor: "pointer",
  color: TEXT_MUTED,
  fontSize: 11,
};

const removeBtnStyle: React.CSSProperties = {
  ...orderBtnStyle,
  color: "#b00020",
  borderColor: "#f5a0a0",
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

const btnAI: React.CSSProperties = {
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

// ─── 카드 한 장 ─────────────────────────────────────────────────────────────

interface TreatmentCardEditorProps {
  card: TreatmentCard;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChange: (patch: Partial<Omit<TreatmentCard, "id">>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function TreatmentCardEditor(props: TreatmentCardEditorProps): JSX.Element {
  const { card, index, total, expanded, onToggleExpand, onChange, onMoveUp, onMoveDown, onRemove } =
    props;

  return (
    <div style={cardWrapperStyle} data-testid={`treatment-card-${card.id}`}>
      <div style={cardHeaderStyle}>
        <select
          value={card.role}
          onChange={(e) =>
            onChange({ role: e.currentTarget.value as TreatmentCardRole })
          }
          style={{
            ...roleBadge(card.role),
            border: "none",
            cursor: "pointer",
            padding: "2px 8px",
            paddingRight: 22,
          }}
          aria-label="카드 역할"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r} style={{ color: "#000" }}>
              {TREATMENT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>
          {index + 1} / {total}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            style={{ ...orderBtnStyle, opacity: index === 0 ? 0.3 : 1 }}
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="위로"
          >
            ↑
          </button>
          <button
            style={{ ...orderBtnStyle, opacity: index === total - 1 ? 0.3 : 1 }}
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="아래로"
          >
            ↓
          </button>
          <button style={removeBtnStyle} onClick={onRemove} aria-label="카드 삭제">
            ✕
          </button>
        </div>
      </div>

      <input
        style={inputStyle}
        value={card.title}
        onChange={(e) => onChange({ title: e.currentTarget.value })}
        placeholder="카드 제목"
      />

      <textarea
        style={{ ...textareaStyle, marginTop: 8 }}
        value={card.summary}
        onChange={(e) => onChange({ summary: e.currentTarget.value })}
        placeholder="이 카드에서 다룰 내용 요약 (2~3문장)"
      />

      <button
        style={{
          ...orderBtnStyle,
          marginTop: 6,
          fontSize: 11,
          background: "transparent",
          border: "none",
          color: TEXT_MUTED,
          padding: "2px 4px",
        }}
        onClick={onToggleExpand}
      >
        {expanded ? "▾ 자세히 접기" : "▸ 자세히 (핵심문장 / 독자 감정 / 메모)"}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            style={{ ...smallInputStyle, fontSize: 13 } as React.CSSProperties}
            value={card.keySentence ?? ""}
            onChange={(e) => onChange({ keySentence: e.currentTarget.value })}
            placeholder="핵심 문장 (이 카드의 한 줄)"
          />
          <input
            style={{ ...smallInputStyle, fontSize: 13 } as React.CSSProperties}
            value={card.readerEmotion ?? ""}
            onChange={(e) => onChange({ readerEmotion: e.currentTarget.value })}
            placeholder="이 카드 끝에서 독자가 느낄 감정"
          />
          <textarea
            style={{ ...textareaStyle, minHeight: 40 }}
            value={card.note ?? ""}
            onChange={(e) => onChange({ note: e.currentTarget.value })}
            placeholder="작가 메모 (필요한 자료, 위험 요소 등)"
          />
        </div>
      )}
    </div>
  );
}

// ─── 메인 ──────────────────────────────────────────────────────────────────

export function Step5Treatment({
  onAdvance,
  onBack,
}: Step5TreatmentProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const setTreatment = useConceptWizardStore((s) => s.setTreatment);
  const addTreatmentCard = useConceptWizardStore((s) => s.addTreatmentCard);
  const updateTreatmentCard = useConceptWizardStore((s) => s.updateTreatmentCard);
  const removeTreatmentCard = useConceptWizardStore((s) => s.removeTreatmentCard);
  const reorderTreatmentCards = useConceptWizardStore((s) => s.reorderTreatmentCards);
  const goStage = useConceptWizardStore((s) => s.goStage);

  const { run, isStreaming, error, cancel, reset } = useStreamingChat();
  const [parseError, setParseError] = useState<string | null>(null);
  const [refineHint, setRefineHint] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newRole, setNewRole] = useState<TreatmentCardRole>("explain");

  const cards = session?.treatment ?? [];

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function move(index: number, dir: -1 | 1): void {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= cards.length) return;
    const ids = cards.map((c) => c.id);
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderTreatmentCards(ids);
  }

  async function handleAIFill(): Promise<void> {
    if (!session) return;
    setParseError(null);
    reset();
    try {
      const fullText = await run({
        messages: [
          {
            role: "user",
            content: buildTreatmentFromSynopsisPrompt({
              conceptParagraph: session.conceptParagraph,
              synopsis: session.synopsis,
              memoAnalysis: session.memo?.analysis,
              refineHint,
            }),
          },
        ],
        systemPrompt: TREATMENT_FROM_SYNOPSIS_SYSTEM,
        notesContext: "",
      });
      try {
        const drafts = parseTreatmentResponse(fullText);
        // drafts → TreatmentCard[] (id 부여)
        const next: TreatmentCard[] = drafts.map((d, i) => ({
          id: `tc-${String(i + 1).padStart(2, "0")}`,
          title: d.title,
          role: d.role,
          summary: d.summary,
          keySentence: d.keySentence || undefined,
          readerEmotion: d.readerEmotion || undefined,
        }));
        setTreatment(next);
      } catch (e) {
        setParseError(
          (e instanceof Error ? e.message : String(e)) +
            " — AI 응답이 JSON 배열이 아닐 수 있습니다.",
        );
      }
    } catch {
      // useStreamingChat.error 반영.
    }
  }

  function handleAdd(): void {
    if (!session) return;
    addTreatmentCard(newRole);
  }

  function handleNext(): void {
    goStage("done");
    onAdvance?.();
  }

  function handleBack(): void {
    goStage("synopsis");
    onBack?.();
  }

  const nextDisabled = cards.length === 0 || isStreaming;

  return (
    <div style={containerStyle} data-testid="step5-treatment">
      <p style={introStyle}>
        시놉시스에서 한 단계 더 — <strong>트리트먼트 카드</strong>로 글의 흐름을
        설계합니다. 카드 한 장 = 글의 한 비트. AI 가 시놉시스를 6~12 카드로
        분해해 줍니다. 카드의 순서·역할·내용을 자유롭게 조정한 뒤 다음으로
        넘어가세요.
      </p>

      {/* 사용자가 스스로 그만둔 것은 «고장» 이 아니다 — 빨간 배너로 보이지 않는다. */}
      {isUserStopped(error) && <AiStoppedNotice />}
      {error && !isUserStopped(error) && (
        <div style={errorBannerStyle} role="alert">
          AI 호출 오류: {error}
        </div>
      )}
      {parseError && (
        <div style={errorBannerStyle} role="alert">
          {parseError}
        </div>
      )}

      <div style={toolbarStyle}>
        <input
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: "7px 10px",
            fontSize: 12,
            flex: 1,
            outline: "none",
            color: TEXT,
            fontFamily: "inherit",
          }}
          value={refineHint}
          onChange={(e) => setRefineHint(e.target.value)}
          placeholder="추가 지시 (선택) — 예: 사례를 더 많이, 결말은 여운 있게"
        />
        <button
          style={isStreaming ? { ...btnAI, opacity: 0.5, cursor: "not-allowed" } : btnAI}
          onClick={isStreaming ? undefined : handleAIFill}
          disabled={isStreaming}
          data-testid="treatment-ai-fill-button"
        >
          {isStreaming
            ? "생성 중…"
            : cards.length === 0
              ? "AI 로 시놉시스 → 카드 채우기"
              : "AI 로 다시 채우기"}
        </button>
      </div>

      {/* 기다리는 동안 — 무엇을 하는 중인지 + 얼마나 지났는지 + 그만두기 */}
      {isStreaming && (
        <AiWaitBar
          label="카드를 만들고 있습니다"
          onCancel={cancel}
          style={{ marginBottom: 12 }}
          testId="treatment-wait-bar"
        />
      )}

      {cards.length === 0 && !isStreaming && (
        <div
          style={{
            ...cardWrapperStyle,
            color: TEXT_MUTED,
            fontSize: 13,
            textAlign: "center" as const,
          }}
        >
          아직 카드가 없습니다. 위의 <strong>AI 로 채우기</strong> 또는 아래의{" "}
          <strong>+ 카드 추가</strong>를 사용하세요.
        </div>
      )}

      {cards.map((card, i) => (
        <TreatmentCardEditor
          key={card.id}
          card={card}
          index={i}
          total={cards.length}
          expanded={expandedIds.has(card.id)}
          onToggleExpand={() => toggleExpand(card.id)}
          onChange={(patch) => updateTreatmentCard(card.id, patch)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, +1)}
          onRemove={() => removeTreatmentCard(card.id)}
        />
      ))}

      {/* 카드 추가 */}
      <div
        style={{
          ...toolbarStyle,
          marginTop: 16,
          marginBottom: 0,
          justifyContent: "center",
        }}
      >
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.currentTarget.value as TreatmentCardRole)}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: RADIUS,
            padding: "7px 10px",
            fontSize: 13,
            background: "#fff",
            color: TEXT,
            outline: "none",
          }}
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {TREATMENT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button
          style={btnSecondary}
          onClick={handleAdd}
          data-testid="treatment-add-card-button"
        >
          + 카드 추가
        </button>
      </div>

      <div style={buttonRowStyle}>
        <button style={btnSecondary} onClick={handleBack} data-testid="treatment-back-button">
          이전
        </button>
        <button
          style={nextDisabled ? btnPrimaryDisabled : btnPrimary}
          onClick={nextDisabled ? undefined : handleNext}
          disabled={nextDisabled}
          data-testid="treatment-next-button"
          aria-disabled={nextDisabled}
        >
          원고로 가기 →
        </button>
      </div>
    </div>
  );
}
