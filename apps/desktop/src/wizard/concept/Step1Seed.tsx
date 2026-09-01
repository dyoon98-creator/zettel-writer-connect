// @TASK P2-T4 — Step1Seed: 컨셉 마법사 1단계 (시드 입력)
// 시드 텍스트 + 노트 첨부 + 톤/장르 선택 → store.start() → onAdvance()

import { useRef, useState } from "react";
import {
  type ConceptTone,
  type Genre,
  GENRE_LABEL_KO,
  DEFAULT_DRAFT_GENRE,
  suggestGenreForTone,
} from "@ai-manuscript-studio/core";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useVaultNoteSuggestions } from "./useVaultNoteSuggestions";

// ─── 타입 / 상수 ─────────────────────────────────────────────────────────────

interface ToneOption {
  id: ConceptTone;
  label: string;
}
interface GenreOption {
  id: Genre;
  label: string;
}

const TONE_OPTIONS: ToneOption[] = [
  { id: "decision-memo",           label: "간결한 의사결정체" },
  { id: "analytical-report",       label: "분석적 보고체" },
  { id: "customer-report",          label: "고객 보고체" },
  { id: "legal-accounting-review", label: "법률·회계 검토체" },
  { id: "column-narrative",        label: "칼럼형 서술체" },
  { id: "long-form-reasoning",     label: "장문 원고형 사유체" },
  { id: "lecture-presentation",    label: "강의·발표체" },
  { id: "explanatory",             label: "친절한 설명체" },
];

const GENRE_OPTIONS: GenreOption[] = (
  Object.entries(GENRE_LABEL_KO) as [Genre, string][]
).map(([id, label]) => ({ id, label }));

// ─── Props ───────────────────────────────────────────────────────────────────

export interface Step1SeedProps {
  /** 부모 모달이 다음 단계로 진입할 때 호출. store.start() 는 이 컴포넌트가 먼저 수행. */
  onAdvance?: () => void;
}

// ─── 스타일 상수 (inline style) ───────────────────────────────────────────────

const ACCENT = "#1f7a4a";
const ACCENT_LIGHT = "rgba(31, 122, 74, 0.12)";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG = "#ffffff";
const RADIUS = 6;

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "32px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  color: TEXT,
  background: BG,
  fontFamily:
    '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", -apple-system, sans-serif',
  fontSize: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 8,
  color: TEXT,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: RADIUS,
  border: `1px solid ${BORDER}`,
  fontSize: 14,
  lineHeight: 1.6,
  color: TEXT,
  background: BG,
  resize: "vertical",
  outline: "none",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 10px",
  borderRadius: 999,
  background: ACCENT_LIGHT,
  color: ACCENT,
  fontSize: 13,
  fontWeight: 500,
  border: `1px solid rgba(31, 122, 74, 0.25)`,
};

const chipXStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: ACCENT,
  fontSize: 14,
  lineHeight: 1,
  padding: "0 2px",
};

const noteInputRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 10,
};

const noteInputStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 10px",
  borderRadius: RADIUS,
  border: `1px solid ${BORDER}`,
  fontSize: 13,
  color: TEXT,
  background: BG,
  outline: "none",
};

const addBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: RADIUS,
  border: `1px solid ${BORDER}`,
  background: BG,
  color: TEXT,
  fontSize: 13,
  cursor: "pointer",
};

function radioGroupStyle(): React.CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  };
}

function radioLabelStyle(selected: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: RADIUS,
    border: `1px solid ${selected ? ACCENT : BORDER}`,
    background: selected ? ACCENT_LIGHT : BG,
    color: selected ? ACCENT : TEXT,
    fontWeight: selected ? 600 : 400,
    cursor: "pointer",
    fontSize: 13,
    userSelect: "none",
  };
}

const nextBtnStyle = (disabled: boolean): React.CSSProperties => ({
  alignSelf: "flex-end",
  padding: "10px 28px",
  borderRadius: RADIUS,
  border: "none",
  background: disabled ? "#d5d0c9" : ACCENT,
  color: disabled ? TEXT_MUTED : "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "background 0.15s",
});

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function Step1Seed({ onAdvance }: Step1SeedProps): JSX.Element {
  // ── local state ──
  const [seed, setSeed] = useState("");
  // 옵시디언 쪽과 같은 설계 — 아무것도 미리 고르지 않고, 톤을 고르면 장르가 따라온다.
  const [tone, setTone] = useState<ConceptTone | null>(null);
  const [genre, setGenre] = useState<Genre | null>(null);
  // 사용자가 장르를 «직접» 만졌나. 만진 뒤에는 톤을 바꿔도 추천이 덮지 않는다.
  const [genreChosenByUser, setGenreChosenByUser] = useState(false);
  const [attachedNotes, setAttachedNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState("");

  const noteInputRef = useRef<HTMLInputElement>(null);

  // 옵시디언 vault 의 노트 제목 자동완성.
  const { notes: vaultNotes } = useVaultNoteSuggestions();

  // ── 톤 변경 ──
  // ── 톤 변경 → 장르 «추천» (원본에 있던 편의를 되살림) ──
  function handleToneChange(t: ConceptTone): void {
    setTone(t);
    if (!genreChosenByUser) setGenre(suggestGenreForTone(t));
  }

  // ── 장르 직접 선택 ──
  function handleGenreChange(g: Genre): void {
    setGenre(g);
    setGenreChosenByUser(true);
  }

  // ── 노트 첨부 ──
  function addNote(): void {
    const raw = noteInput.trim();
    if (!raw) return;
    setAttachedNotes((prev) =>
      prev.includes(raw) ? prev : [...prev, raw],
    );
    setNoteInput("");
    noteInputRef.current?.focus();
  }

  function removeNote(link: string): void {
    setAttachedNotes((prev) => prev.filter((n) => n !== link));
  }

  function handleNoteKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      addNote();
    }
  }

  // ── 다음 ──
  // 셋이 다 있어야 넘어간다 — 씨앗 문장, 문체, 문서 종류.
  const isDisabled = seed.trim().length === 0 || tone === null || genre === null;

  function handleAdvance(): void {
    if (isDisabled || tone === null || genre === null) return;
    useConceptWizardStore.getState().start({
      seed: seed.trim(),
      tone,
      genre,
      attachedNotes,
    });
    onAdvance?.();
  }

  // ── 렌더 ──
  return (
    <div style={containerStyle}>
      {/* 시드 입력 */}
      <section>
        <label htmlFor="step1-seed" style={labelStyle}>
          어떤 글/문서를 만들까요?
        </label>
        <textarea
          id="step1-seed"
          data-testid="step1-seed-textarea"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          rows={3}
          maxLength={500}
          placeholder="목적, 독자, 핵심 메시지를 한두 문장으로 알려주세요."
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          style={textareaStyle}
          aria-label="시드 입력"
        />
      </section>

      {/* 노트 첨부 */}
      <section>
        <label style={labelStyle} id="step1-notes-label">
          관련 노트 첨부 (선택)
        </label>
        {/* chip 목록 */}
        {attachedNotes.length > 0 && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}
            aria-label="첨부된 노트 목록"
          >
            {attachedNotes.map((note) => (
              <span key={note} style={chipStyle}>
                {note}
                <button
                  type="button"
                  style={chipXStyle}
                  aria-label={`${note} 제거`}
                  data-testid={`note-chip-remove-${note}`}
                  onClick={() => removeNote(note)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {/* input + 추가 버튼 */}
        <div style={noteInputRowStyle}>
          <input
            ref={noteInputRef}
            id="step1-note-input"
            type="text"
            data-testid="step1-note-input"
            placeholder="[[노트 제목]] 또는 제목 직접 입력 — 영구노트 자동완성"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            style={noteInputStyle}
            aria-labelledby="step1-notes-label"
            aria-label="노트 링크 입력"
            list="vault-note-suggestions"
            autoComplete="off"
          />
          <datalist id="vault-note-suggestions">
            {vaultNotes.map((title) => (
              <option key={title} value={`[[${title}]]`} />
            ))}
          </datalist>
          <button
            type="button"
            data-testid="step1-note-add-btn"
            style={addBtnStyle}
            onClick={addNote}
          >
            추가
          </button>
        </div>
      </section>

      {/* 톤 선택 */}
      <section>
        <div role="radiogroup" aria-label="문체·논조 선택">
          <span style={labelStyle} id="step1-tone-label">
            문체·논조
          </span>
          <div style={radioGroupStyle()}>
            {TONE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                style={radioLabelStyle(tone === opt.id)}
                data-testid={`step1-tone-${opt.id}`}
              >
                <input
                  type="radio"
                  name="step1-tone"
                  value={opt.id}
                  checked={tone === opt.id}
                  onChange={() => handleToneChange(opt.id)}
                  style={{ display: "none" }}
                  aria-label={opt.label}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* 장르 선택 */}
      <section>
        <div role="radiogroup" aria-label="장르 선택">
          <span style={labelStyle} id="step1-genre-label">
            장르
          </span>
          <div style={radioGroupStyle()}>
            {GENRE_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                style={radioLabelStyle(genre === opt.id)}
                data-testid={`step1-genre-${opt.id}`}
              >
                <input
                  type="radio"
                  name="step1-genre"
                  value={opt.id}
                  checked={genre === opt.id}
                  onChange={() => handleGenreChange(opt.id)}
                  style={{ display: "none" }}
                  aria-label={opt.label}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* 다음 버튼 */}
      <button
        type="button"
        data-testid="step1-next-btn"
        disabled={isDisabled}
        style={nextBtnStyle(isDisabled)}
        onClick={handleAdvance}
        aria-disabled={isDisabled}
      >
        다음
      </button>
    </div>
  );
}
