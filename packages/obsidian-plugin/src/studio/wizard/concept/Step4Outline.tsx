// Step4Outline.tsx — 컨셉 마법사 4단계: 12-30장 목차 AI 생성 + master-detail 편집.
// @TASK P2-T7

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import { fetchNotesForContext } from "../../vaultAdapter";
import type { OutlineChapter } from "@ai-manuscript-studio/core";
import {
  OUTLINE_SYSTEM_PROMPT,
  SINGLE_CHAPTER_REFINE_SYSTEM,
  buildOutlineUserPrompt,
  parseOutlineResponse,
} from "./outlinePrompts";

// ---- Props ------------------------------------------------------------------

export interface Step4OutlineProps {
  onAdvance?: () => void;
  onBack?: () => void;
}

// ---- 스타일 상수 ------------------------------------------------------------

const ACCENT = "#1f7a4a";
const ACCENT_LIGHT = "rgba(31,122,74,0.10)";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const BG = "#ffffff";
const BG_SIDE = "#f9f7f4";
const RADIUS = 6;
const FONT =
  '"Apple SD Gothic Neo","Pretendard","Noto Sans KR",-apple-system,sans-serif';

// ---- SortableChapterItem ----------------------------------------------------

interface SortableItemProps {
  chapter: OutlineChapter;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onMerge: () => void;
  onSplit: () => void;
  onRemove: () => void;
  canMerge: boolean;
}

function SortableChapterItem({
  chapter,
  index,
  isSelected,
  onSelect,
  onMerge,
  onSplit,
  onRemove,
  canMerge,
}: SortableItemProps): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: chapter.id });

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderBottom: `1px solid ${BORDER}`,
    background: isSelected ? ACCENT_LIGHT : BG_SIDE,
    cursor: "pointer",
    userSelect: "none",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`outline-chapter-item-${chapter.id}`}
      onClick={onSelect}
    >
      {/* 드래그 핸들 */}
      <span
        {...attributes}
        {...listeners}
        data-testid={`outline-drag-handle-${chapter.id}`}
        style={{
          cursor: "grab",
          color: TEXT_MUTED,
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          touchAction: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="드래그하여 순서 변경"
      >
        ⠿
      </span>

      {/* 번호 */}
      <span
        style={{
          fontSize: 12,
          color: TEXT_MUTED,
          flexShrink: 0,
          minWidth: 24,
          textAlign: "right",
        }}
      >
        {index + 1}
      </span>

      {/* 제목 */}
      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? ACCENT : TEXT,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {chapter.title}
      </span>

      {/* 더보기 버튼 + 메뉴 */}
      <div
        ref={menuRef}
        style={{ position: "relative", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid={`outline-menu-btn-${chapter.id}`}
          aria-label="장 메뉴"
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: TEXT_MUTED,
            fontSize: 16,
            padding: "2px 4px",
            lineHeight: 1,
            borderRadius: 4,
          }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              zIndex: 100,
              background: BG,
              border: `1px solid ${BORDER}`,
              borderRadius: RADIUS,
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              minWidth: 120,
            }}
          >
            {canMerge && (
              <button
                type="button"
                data-testid={`outline-merge-btn-${chapter.id}`}
                style={menuItemStyle}
                onClick={() => {
                  setMenuOpen(false);
                  onMerge();
                }}
              >
                다음 장과 병합
              </button>
            )}
            <button
              type="button"
              data-testid={`outline-split-btn-${chapter.id}`}
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                onSplit();
              }}
            >
              장 분리
            </button>
            <button
              type="button"
              data-testid={`outline-remove-btn-${chapter.id}`}
              style={{ ...menuItemStyle, color: "#c0392b" }}
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "8px 14px",
  background: "none",
  border: "none",
  textAlign: "left",
  fontSize: 13,
  color: TEXT,
  cursor: "pointer",
};

// ---- Step4Outline -----------------------------------------------------------

export function Step4Outline({
  onAdvance,
  onBack,
}: Step4OutlineProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const setOutline = useConceptWizardStore((s) => s.setOutline);
  const updateChapter = useConceptWizardStore((s) => s.updateChapter);
  const reorderChapters = useConceptWizardStore((s) => s.reorderChapters);
  const mergeChapters = useConceptWizardStore((s) => s.mergeChapters);
  const splitChapter = useConceptWizardStore((s) => s.splitChapter);
  const removeChapter = useConceptWizardStore((s) => s.removeChapter);
  const goStage = useConceptWizardStore((s) => s.goStage);

  const outline: OutlineChapter[] = session?.outline ?? [];
  const conceptParagraph = session?.conceptParagraph ?? "";
  const synopsis = session?.synopsis ?? "";
  const attachedNotes = session?.attachedNotes ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rawFallback, setRawFallback] = useState<string | null>(null);
  const [refineHint, setRefineHint] = useState("");
  const [refineHintInput, setRefineHintInput] = useState("");

  // 단장 재제안
  const [singleRefineLoading, setSingleRefineLoading] = useState(false);
  const [singleRefineError, setSingleRefineError] = useState<string | null>(
    null,
  );

  const streaming = useStreamingChat();
  const singleStreaming = useStreamingChat();

  // 자동 streaming — 첫 진입 시만
  const didAutoRun = useRef(false);

  const runGenerate = useCallback(
    async (hint?: string) => {
      setParseError(null);
      setRawFallback(null);
      try {
        const { context } = await fetchNotesForContext(attachedNotes);
        const fullText = await streaming.run({
          messages: [
            {
              role: "user",
              content: buildOutlineUserPrompt({
                conceptParagraph,
                synopsis,
                refineHint: hint,
              }),
            },
          ],
          systemPrompt: OUTLINE_SYSTEM_PROMPT,
          notesContext: context,
        });
        const parsed = parseOutlineResponse(fullText);
        const chapters: OutlineChapter[] = parsed.map((c, i) => ({
          id: `ch-${String(i + 1).padStart(2, "0")}`,
          title: c.title,
          summary: c.summary,
        }));
        setOutline(chapters);
        setSelectedId(chapters[0]?.id ?? null);
      } catch (e) {
        const raw = streaming.buffer;
        if (raw.trim()) {
          setRawFallback(raw);
          setParseError(
            e instanceof Error ? e.message : "파싱 실패",
          );
        } else {
          setParseError(e instanceof Error ? e.message : String(e));
        }
      }
    },
    [
      attachedNotes,
      conceptParagraph,
      synopsis,
      streaming,
      setOutline,
    ],
  );

  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    if (outline.length === 0) {
      void runGenerate();
    } else {
      setSelectedId(outline[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = outline.findIndex((c) => c.id === active.id);
    const newIndex = outline.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(outline, oldIndex, newIndex);
    reorderChapters(reordered.map((c) => c.id));
  }

  // 단장 재제안
  async function handleSingleRefine(): Promise<void> {
    const ch = outline.find((c) => c.id === selectedId);
    if (!ch) return;
    setSingleRefineError(null);
    setSingleRefineLoading(true);
    try {
      const { context } = await fetchNotesForContext(attachedNotes);
      const fullText = await singleStreaming.run({
        messages: [
          {
            role: "user",
            content: `현재 제목: ${ch.title}\n현재 일세:\n${ch.summary}\n\n더 매력적으로 다듬어 JSON 으로 출력.`,
          },
        ],
        systemPrompt: SINGLE_CHAPTER_REFINE_SYSTEM,
        notesContext: context,
      });
      const parsed = parseOutlineResponse(fullText);
      const first = parsed[0];
      if (first) {
        updateChapter(ch.id, {
          title: first.title,
          summary: first.summary,
        });
      }
    } catch (e) {
      setSingleRefineError(e instanceof Error ? e.message : String(e));
    } finally {
      setSingleRefineLoading(false);
    }
  }

  // 장 분리 — summary 를 \n\n 으로 균등 분할
  function handleSplit(id: string): void {
    const ch = outline.find((c) => c.id === id);
    if (!ch) return;
    const paragraphs = ch.summary
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length < 2) {
      // 단락이 1개뿐이면 반씩 나누기
      const half = Math.ceil(ch.summary.length / 2);
      splitChapter(id, [
        { title: `${ch.title} (1부)`, summary: ch.summary.slice(0, half).trim() },
        { title: `${ch.title} (2부)`, summary: ch.summary.slice(half).trim() },
      ]);
    } else {
      const mid = Math.ceil(paragraphs.length / 2);
      splitChapter(id, [
        {
          title: `${ch.title} (1부)`,
          summary: paragraphs.slice(0, mid).join("\n\n"),
        },
        {
          title: `${ch.title} (2부)`,
          summary: paragraphs.slice(mid).join("\n\n"),
        },
      ]);
    }
    // 분리 후 첫 장 선택
    setSelectedId(outline[0]?.id ?? null);
  }

  // 전체 재제안
  function handleFullRefine(): void {
    const hint = refineHintInput.trim();
    setRefineHint(hint);
    setRefineHintInput("");
    void runGenerate(hint || undefined);
  }

  const selectedChapter = outline.find((c) => c.id === selectedId) ?? null;
  const canAdvance = outline.length >= 12;
  const isGenerating = streaming.isStreaming;

  return (
    <div
      data-testid="step4-outline-root"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: FONT,
        fontSize: 14,
        color: TEXT,
        background: BG,
      }}
    >
      {/* 에러 배너 */}
      {(streaming.error || parseError) && (
        <div
          data-testid="step4-error-banner"
          style={{
            background: "#fdecea",
            color: "#c0392b",
            padding: "10px 16px",
            fontSize: 13,
            borderBottom: `1px solid #f5c6c6`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{streaming.error ?? parseError}</span>
          {rawFallback && (
            <span style={{ color: TEXT_MUTED, fontSize: 12 }}>
              (원본 응답 확인 후 수동 입력 가능)
            </span>
          )}
          <button
            type="button"
            data-testid="step4-retry-btn"
            style={{
              marginLeft: "auto",
              padding: "4px 12px",
              borderRadius: RADIUS,
              border: `1px solid #c0392b`,
              background: "none",
              color: "#c0392b",
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={() => void runGenerate(refineHint || undefined)}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 본문 — 좌 40% + 우 60% */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 좌측: 장 목록 */}
        <div
          style={{
            width: "40%",
            borderRight: `1px solid ${BORDER}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${BORDER}`,
              background: BG_SIDE,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              목차 ({outline.length}장)
            </span>
            {isGenerating && (
              <span
                data-testid="step4-generating-indicator"
                style={{ marginLeft: 10, color: ACCENT, fontSize: 12 }}
              >
                AI 생성 중…
              </span>
            )}
          </div>

          {/* streaming buffer (생성 중 미리 보기) */}
          {isGenerating && streaming.buffer && (
            <div
              style={{
                padding: "8px 14px",
                fontSize: 12,
                color: TEXT_MUTED,
                borderBottom: `1px solid ${BORDER}`,
                maxHeight: 80,
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                background: BG_SIDE,
              }}
            >
              {streaming.buffer.slice(-200)}
            </div>
          )}

          {/* dnd 목록 */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {outline.length === 0 && !isGenerating ? (
              <div
                style={{
                  padding: 24,
                  color: TEXT_MUTED,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                목차가 없습니다. AI 생성 버튼을 눌러주세요.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={outline.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {outline.map((ch, i) => (
                    <SortableChapterItem
                      key={ch.id}
                      chapter={ch}
                      index={i}
                      isSelected={ch.id === selectedId}
                      canMerge={i < outline.length - 1}
                      onSelect={() => setSelectedId(ch.id)}
                      onMerge={() => {
                        const next = outline[i + 1];
                        if (next) mergeChapters(ch.id, next.id);
                      }}
                      onSplit={() => handleSplit(ch.id)}
                      onRemove={() => {
                        removeChapter(ch.id);
                        if (selectedId === ch.id) {
                          setSelectedId(
                            outline[i + 1]?.id ?? outline[i - 1]?.id ?? null,
                          );
                        }
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* 전체 재제안 영역 */}
          <div
            style={{
              borderTop: `1px solid ${BORDER}`,
              padding: "10px 12px",
              background: BG_SIDE,
            }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                type="text"
                data-testid="step4-refine-hint-input"
                placeholder="재제안 지시 (선택)"
                value={refineHintInput}
                onChange={(e) => setRefineHintInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFullRefine();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: RADIUS,
                  border: `1px solid ${BORDER}`,
                  fontSize: 12,
                  color: TEXT,
                  background: BG,
                  outline: "none",
                }}
              />
              <button
                type="button"
                data-testid="step4-full-refine-btn"
                disabled={isGenerating}
                onClick={handleFullRefine}
                style={{
                  padding: "6px 12px",
                  borderRadius: RADIUS,
                  border: `1px solid ${BORDER}`,
                  background: BG,
                  color: isGenerating ? TEXT_MUTED : TEXT,
                  fontSize: 12,
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                전체 재제안
              </button>
            </div>
          </div>
        </div>

        {/* 우측: 선택된 장 상세 */}
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {selectedChapter ? (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* 제목 */}
              <div>
                <label
                  htmlFor="step4-chapter-title"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 12,
                    color: TEXT_MUTED,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  장 제목
                </label>
                <input
                  id="step4-chapter-title"
                  type="text"
                  data-testid="step4-chapter-title-input"
                  value={selectedChapter.title}
                  onChange={(e) =>
                    updateChapter(selectedChapter.id, { title: e.target.value })
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: RADIUS,
                    border: `1px solid ${BORDER}`,
                    fontSize: 15,
                    fontWeight: 600,
                    color: TEXT,
                    background: BG,
                    outline: "none",
                  }}
                />
              </div>

              {/* 일세 */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <label
                  htmlFor="step4-chapter-summary"
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 12,
                    color: TEXT_MUTED,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  일세 (장 요약)
                </label>
                <textarea
                  id="step4-chapter-summary"
                  data-testid="step4-chapter-summary-textarea"
                  rows={8}
                  value={selectedChapter.summary}
                  onChange={(e) =>
                    updateChapter(selectedChapter.id, {
                      summary: e.target.value,
                    })
                  }
                  style={{
                    flex: 1,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: RADIUS,
                    border: `1px solid ${BORDER}`,
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: TEXT,
                    background: BG,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </div>

              {/* 단장 재제안 */}
              <div>
                {singleRefineError && (
                  <div
                    style={{ color: "#c0392b", fontSize: 12, marginBottom: 6 }}
                  >
                    {singleRefineError}
                  </div>
                )}
                {singleStreaming.isStreaming && (
                  <div
                    data-testid="step4-single-refine-streaming"
                    style={{
                      fontSize: 12,
                      color: ACCENT,
                      marginBottom: 6,
                    }}
                  >
                    재제안 생성 중…
                  </div>
                )}
                <button
                  type="button"
                  data-testid="step4-single-refine-btn"
                  disabled={singleRefineLoading || singleStreaming.isStreaming}
                  onClick={() => void handleSingleRefine()}
                  style={{
                    padding: "8px 18px",
                    borderRadius: RADIUS,
                    border: `1px solid ${ACCENT}`,
                    background: BG,
                    color: ACCENT,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor:
                      singleRefineLoading || singleStreaming.isStreaming
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  이 장만 재제안
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: TEXT_MUTED,
                fontSize: 14,
              }}
            >
              {isGenerating
                ? "AI가 목차를 생성하고 있습니다…"
                : "좌측에서 장을 선택하세요."}
            </div>
          )}
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderTop: `1px solid ${BORDER}`,
          background: BG_SIDE,
        }}
      >
        <button
          type="button"
          data-testid="step4-back-btn"
          onClick={() => {
            goStage("synopsis");
            onBack?.();
          }}
          style={{
            padding: "9px 22px",
            borderRadius: RADIUS,
            border: `1px solid ${BORDER}`,
            background: BG,
            color: TEXT,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          이전
        </button>

        <span style={{ fontSize: 12, color: TEXT_MUTED }}>
          {outline.length}장
          {outline.length < 12 && ` (최소 12장 필요)`}
        </span>

        <button
          type="button"
          data-testid="step4-next-btn"
          disabled={!canAdvance || isGenerating}
          onClick={() => {
            if (!canAdvance || isGenerating) return;
            goStage("done");
            onAdvance?.();
          }}
          style={{
            padding: "9px 28px",
            borderRadius: RADIUS,
            border: "none",
            background: canAdvance && !isGenerating ? ACCENT : "#d5d0c9",
            color: canAdvance && !isGenerating ? "#fff" : TEXT_MUTED,
            fontWeight: 600,
            fontSize: 14,
            cursor:
              canAdvance && !isGenerating ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          다음
        </button>
      </div>
    </div>
  );
}
