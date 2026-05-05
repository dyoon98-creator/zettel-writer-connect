// @TASK P2-T4 — Step1Seed: 컨셉 마법사 1단계 (시드 입력)
// 시드 텍스트 + 노트 첨부 + 톤/장르 선택 → store.start() → onAdvance()

import { useRef, useState } from "react";
import type { ConceptTone, Genre } from "@ai-manuscript-studio/core";
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
  { id: "novel", label: "소설" },
  { id: "essay", label: "에세이" },
  { id: "nonfiction", label: "논픽션" },
  { id: "screenplay", label: "시나리오" },
];

const GENRE_OPTIONS: GenreOption[] = [
  { id: "essay", label: "에세이" },
  { id: "practical", label: "실용서" },
  { id: "youtube", label: "유튜브 대본" },
  { id: "lecture", label: "강의안" },
  { id: "world", label: "세계관/웹소설" },
];

/** 톤 → 기본 장르 자동 추천. 사용자가 변경 가능. */
const DEFAULT_GENRE_FOR_TONE: Record<ConceptTone, Genre> = {
  novel: "world",
  essay: "essay",
  nonfiction: "practical",
  screenplay: "youtube",
};

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
  const [tone, setTone] = useState<ConceptTone>("novel");
  const [genre, setGenre] = useState<Genre>(DEFAULT_GENRE_FOR_TONE["novel"]);
  // userChangedGenre: 사용자가 직접 장르를 선택했으면 톤 변경 시 자동 매칭 적용 안 함.
  const [userChangedGenre, setUserChangedGenre] = useState(false);
  const [attachedNotes, setAttachedNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState("");

  const noteInputRef = useRef<HTMLInputElement>(null);

  // 옵시디언 vault 의 노트 제목 자동완성.
  const { notes: vaultNotes } = useVaultNoteSuggestions();

  // ── 톤 변경 → 장르 자동 추천 ──
  function handleToneChange(t: ConceptTone): void {
    setTone(t);
    if (!userChangedGenre) {
      setGenre(DEFAULT_GENRE_FOR_TONE[t]);
    }
  }

  // ── 장르 변경 ──
  function handleGenreChange(g: Genre): void {
    setGenre(g);
    setUserChangedGenre(true);
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
  const isDisabled = seed.trim().length === 0;

  function handleAdvance(): void {
    if (isDisabled) return;
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
          어떤 책을 쓰고 싶나요?
        </label>
        <textarea
          id="step1-seed"
          data-testid="step1-seed-textarea"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          rows={3}
          maxLength={500}
          placeholder="어떤 책을 쓰고 싶나요? 한두 문장으로 알려주세요."
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
        <div role="radiogroup" aria-label="작품 톤 선택">
          <span style={labelStyle} id="step1-tone-label">
            톤
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
