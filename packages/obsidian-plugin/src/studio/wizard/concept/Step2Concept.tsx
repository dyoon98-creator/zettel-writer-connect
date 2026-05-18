// Step2Concept.tsx — 컨셉 마법사 2단계: AI 와 다턴 대화로 컨셉 단락 도출.
//
// 레이아웃: 좌측 70% Chat + 우측 30% Live Preview.
// - 좌측: 메시지 thread + 스트리밍 버퍼 + 입력 textarea.
// - 우측: conceptParagraph 미리보기 + 노트 chip + "정리해 보기" 버튼.
// - 하단: "다음" 버튼 (conceptParagraph 비면 disabled).

import { useCallback, useEffect, useRef, useState } from "react";

import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import { fetchNotesForContext } from "../../vaultAdapter";
import {
  buildConceptSystemPrompt,
  CONCEPT_STAGE_SYSTEM_PROMPT,
  CONCEPT_PARAGRAPH_DISTILL_PROMPT,
  READY_TO_DISTILL_PATTERNS,
} from "./conceptPrompts";
import type { ChatMessage } from "../../ai/streamingChat";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";
import { useVaultNoteSuggestions } from "./useVaultNoteSuggestions";

// ---- 타입 ------------------------------------------------------------------

interface Step2ConceptProps {
  onAdvance?: () => void;
  onBack?: () => void;
}

/**
 * Step2 의 첫 user 메시지를 만든다.
 * - 메모 단계가 비어 있으면 시드만 반환 (옛 동작).
 * - 메모 분석이 있고 사용자가 ✓ 체크한 항목이 있으면 그 항목들을 시드 뒤에 붙여
 *   AI 가 작가의 무의식 단서를 알고 첫 응답을 만들게 한다.
 */
function buildFirstUserMessage(session: ConceptDraftSession): string {
  const seed = session.seed.trim();
  const memo = session.memo;
  if (!memo?.analysis) return seed;

  const selected = new Set(memo.selected ?? []);
  const a = memo.analysis;
  const chosen: string[] = [];

  // ✓ 체크된 항목만 첫 메시지에 묻어 보낸다.
  if (selected.has("emotionAxis:0") && a.emotionAxis.trim()) {
    chosen.push(`- 감정의 축: ${a.emotionAxis.trim()}`);
  }
  a.recurringThoughts.forEach((t, i) => {
    if (selected.has(`recurring:${i}`)) chosen.push(`- 반복되는 생각: ${t}`);
  });
  a.hiddenThemes.forEach((t, i) => {
    if (selected.has(`hiddenThemes:${i}`)) chosen.push(`- 숨은 주제: ${t}`);
  });
  a.strongSentences.forEach((t, i) => {
    if (selected.has(`strongSentences:${i}`)) chosen.push(`- 힘 있는 문장: "${t}"`);
  });
  a.developmentDirections.forEach((t, i) => {
    if (selected.has(`directions:${i}`)) chosen.push(`- 발전 방향: ${t}`);
  });

  if (chosen.length === 0) return seed;

  return [
    seed,
    "",
    "(아래는 내 메모를 미리 정리해 둔 단서들이다 — 이 단서를 우선 반영해 컨셉을 정리해 줘.)",
    ...chosen,
  ].join("\n");
}

// ---- 서브 컴포넌트 ----------------------------------------------------------

interface MessageRowProps {
  role: "user" | "assistant";
  content: string;
}

function MessageRow({ role, content }: MessageRowProps): JSX.Element {
  const isUser = role === "user";
  return (
    <div
      className={"wizard-msg " + (isUser ? "wizard-msg--user" : "wizard-msg--ai")}
      data-testid={`concept-msg-${role}`}
    >
      <div className="wizard-msg-meta">
        <span className="wizard-msg-role">{isUser ? "작가" : "AI 코치"}</span>
      </div>
      <div className="wizard-msg-body" style={{ whiteSpace: "pre-wrap" }}>
        {content}
      </div>
    </div>
  );
}

function NoteChip({
  link,
  onRemove,
}: {
  link: string;
  onRemove: () => void;
}): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        background: "var(--color-status-bg, #efeae0)",
        fontSize: 12,
        color: "var(--color-text, #2b2620)",
        border: "1px solid var(--color-border, #e0dcd4)",
      }}
      data-testid="concept-note-chip"
    >
      {link}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${link} 노트 제거`}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          fontSize: 12,
          padding: "0 2px",
          lineHeight: 1,
        }}
        data-testid="concept-note-chip-remove"
      >
        ×
      </button>
    </span>
  );
}

// ---- 메인 컴포넌트 ----------------------------------------------------------

export function Step2Concept({ onAdvance, onBack }: Step2ConceptProps): JSX.Element {
  const session = useConceptWizardStore((s) => s.session);
  const appendMessage = useConceptWizardStore((s) => s.appendMessage);
  const setConceptParagraph = useConceptWizardStore((s) => s.setConceptParagraph);
  const goStage = useConceptWizardStore((s) => s.goStage);
  const attachNote = useConceptWizardStore((s) => s.attachNote);
  const detachNote = useConceptWizardStore((s) => s.detachNote);

  const mainChat = useStreamingChat();
  const distillChat = useStreamingChat();

  // 옵시디언 vault 노트 자동완성 데이터 (datalist).
  const { notes: vaultNotes } = useVaultNoteSuggestions();

  const [draft, setDraft] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [readyHint, setReadyHint] = useState(false);

  // 노트 컨텍스트 캐시 — attachedNotes 변경 시만 재fetch.
  const notesCacheRef = useRef<{ links: string[]; context: string }>({
    links: [],
    context: "",
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const firstCallRef = useRef(false);

  const conversation = session?.conversation ?? [];
  const attachedNotes = session?.attachedNotes ?? [];
  const conceptParagraph = session?.conceptParagraph ?? "";

  // 노트 컨텍스트 fetch (캐시 적중 시 skip).
  const getNotesContext = useCallback(async (): Promise<string> => {
    const cache = notesCacheRef.current;
    const sameLinks =
      cache.links.length === attachedNotes.length &&
      attachedNotes.every((l, i) => cache.links[i] === l);
    if (sameLinks) return cache.context;

    try {
      const { context } = await fetchNotesForContext(attachedNotes);
      notesCacheRef.current = { links: attachedNotes.slice(), context };
      return context;
    } catch {
      return "";
    }
  }, [attachedNotes]);

  // conversation → ChatMessage[] 변환.
  const toChatMessages = useCallback((): ChatMessage[] => {
    return conversation.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [conversation]);

  // AI 호출 공통 로직.
  const callAI = useCallback(
    async (
      messages: ChatMessage[],
      chat: ReturnType<typeof useStreamingChat>,
    ): Promise<string> => {
      const notesContext = await getNotesContext();
      return await chat.run({
        messages,
        systemPrompt: session ? buildConceptSystemPrompt(session) : CONCEPT_STAGE_SYSTEM_PROMPT,
        notesContext,
      });
    },
    [getNotesContext, session],
  );

  // 첫 진입 시 시드를 user message로 push 후 AI 첫 응답 호출.
  useEffect(() => {
    if (firstCallRef.current) return;
    if (!session) return;
    if (conversation.length > 0) return; // 이미 대화 있으면 skip (resume).

    firstCallRef.current = true;

    // 첫 user 메시지 — 시드 + (있다면) 메모 분석에서 선택된 단서들을 함께 전달.
    const seedPlusMemo = buildFirstUserMessage(session);
    appendMessage("user", seedPlusMemo);

    const firstMessages: ChatMessage[] = [{ role: "user", content: seedPlusMemo }];

    void (async () => {
      try {
        const fullText = await callAI(firstMessages, mainChat);
        appendMessage("assistant", fullText);
        // 신호 감지.
        if (READY_TO_DISTILL_PATTERNS.some((p) => fullText.includes(p))) {
          setReadyHint(true);
        }
      } catch {
        // error 는 mainChat.error 에 노출됨.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // 메시지 변경 시 하단 자동 스크롤.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.length, mainChat.buffer, mainChat.isStreaming]);

  // 작가 메시지 전송.
  const handleSend = async (): Promise<void> => {
    const text = draft.trim();
    if (!text || mainChat.isStreaming) return;
    setDraft("");

    appendMessage("user", text);

    // store 갱신이 비동기이므로 현재 conversation + 새 메시지 직접 구성.
    const messages: ChatMessage[] = [
      ...toChatMessages(),
      { role: "user", content: text },
    ];

    try {
      const fullText = await callAI(messages, mainChat);
      appendMessage("assistant", fullText);
      if (READY_TO_DISTILL_PATTERNS.some((p) => fullText.includes(p))) {
        setReadyHint(true);
      }
    } catch {
      // mainChat.error 에 노출됨.
    }
  };

  // "정리해 보기" 버튼 — distill 호출.
  const handleDistill = async (): Promise<void> => {
    if (distillChat.isStreaming) return;
    setReadyHint(false);

    const messages: ChatMessage[] = [
      ...toChatMessages(),
      { role: "user", content: CONCEPT_PARAGRAPH_DISTILL_PROMPT },
    ];

    try {
      const notesContext = await getNotesContext();
      const fullText = await distillChat.run({
        messages,
        systemPrompt: session ? buildConceptSystemPrompt(session) : CONCEPT_STAGE_SYSTEM_PROMPT,
        notesContext,
      });
      setConceptParagraph(fullText.trim());
    } catch {
      // distillChat.error 에 노출됨.
    }
  };

  // 노트 추가.
  const handleNoteAdd = (): void => {
    const raw = noteInput.trim();
    if (!raw) return;
    attachNote(raw);
    setNoteInput("");
    // 캐시 무효화.
    notesCacheRef.current = { links: [], context: "" };
  };

  // "다음" 버튼.
  const handleAdvance = (): void => {
    goStage("synopsis");
    onAdvance?.();
  };

  // 키보드 핸들러.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    } else if (e.key === "Escape" && mainChat.isStreaming) {
      e.preventDefault();
      mainChat.cancel();
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNoteAdd();
    }
  };

  const isStreaming = mainChat.isStreaming;
  const hasError = mainChat.error || distillChat.error;

  // ---- 렌더 ----------------------------------------------------------------

  return (
    <div
      data-testid="step2-concept"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* 에러 배너 */}
      {hasError && (
        <div
          data-testid="concept-error-banner"
          role="alert"
          style={{
            padding: "8px 16px",
            background: "#5c1a1a",
            color: "#ffaaaa",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{mainChat.error ?? distillChat.error}</span>
          <button
            type="button"
            onClick={() => {
              mainChat.reset();
              distillChat.reset();
            }}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "1px solid #ff8888",
              color: "#ffaaaa",
              borderRadius: 4,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 12,
            }}
            data-testid="concept-error-retry"
          >
            재시도
          </button>
        </div>
      )}

      {/* 메인 바디 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 좌측 70% — Chat */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "70%",
            borderRight: "1px solid var(--color-border, #e0dcd4)",
            overflow: "hidden",
          }}
        >
          {/* 메시지 thread */}
          <div
            ref={scrollRef}
            className="wizard-thread"
            role="log"
            aria-live="polite"
            style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}
          >
            {conversation.map((m, i) => (
              <MessageRow key={i} role={m.role as "user" | "assistant"} content={m.content} />
            ))}

            {/* 스트리밍 중인 assistant 응답 */}
            {isStreaming && (
              <div
                className="wizard-msg wizard-msg--ai wizard-msg--streaming"
                data-testid="concept-msg-streaming"
              >
                <div className="wizard-msg-meta">
                  <span className="wizard-msg-role">AI 코치</span>
                </div>
                <div className="wizard-msg-body" style={{ whiteSpace: "pre-wrap" }}>
                  {mainChat.buffer}
                  <span className="wizard-msg-caret" aria-hidden>
                    ▍
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 입력 영역 */}
          <div
            style={{
              borderTop: "1px solid var(--color-border, #e0dcd4)",
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <textarea
              data-testid="concept-input"
              placeholder="답변을 입력하세요. (Cmd/Ctrl+Enter 전송, Esc 중단)"
              value={draft}
              rows={3}
              disabled={isStreaming}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "8px",
                fontSize: 14,
                boxSizing: "border-box",
                background: "var(--color-bg-pane, #ffffff)",
                color: "var(--color-text, #2b2620)",
                border: "1px solid var(--color-border, #e0dcd4)",
                borderRadius: 4,
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <span
                style={{ fontSize: 12, color: "var(--color-text-muted, #786f63)", alignSelf: "center" }}
              >
                {isStreaming ? "AI가 답변 중… (Esc 로 중단)" : "Cmd/Ctrl + Enter 로 전송"}
              </span>
              <button
                type="button"
                data-testid="concept-send"
                disabled={isStreaming || !draft.trim()}
                onClick={() => void handleSend()}
                style={{
                  padding: "6px 16px",
                  borderRadius: 4,
                  border: "none",
                  cursor: isStreaming || !draft.trim() ? "not-allowed" : "pointer",
                  fontSize: 13,
                  background: "#1f7a4a",
                  color: "#fff",
                  opacity: isStreaming || !draft.trim() ? 0.5 : 1,
                }}
              >
                보내기
              </button>
            </div>
          </div>
        </div>

        {/* 우측 30% — Live Preview */}
        <div
          style={{
            width: "30%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 컨셉 단락 미리보기 */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              borderBottom: "1px solid var(--color-border, #e0dcd4)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted, #786f63)",
                marginBottom: 8,
              }}
            >
              AI 가 정리한 컨셉 단락
            </div>
            <div
              data-testid="concept-paragraph-preview"
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: conceptParagraph
                  ? "var(--color-text, #2b2620)"
                  : "var(--color-text-muted, #786f63)",
                whiteSpace: "pre-wrap",
                minHeight: 60,
              }}
            >
              {conceptParagraph || '아직 정리된 컨셉이 없습니다. “정리해 보기”를 눌러주세요.'}
            </div>

            {/* distill 스트리밍 중 */}
            {distillChat.isStreaming && (
              <div
                data-testid="concept-distill-streaming"
                style={{
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: "var(--color-text, #2b2620)",
                  whiteSpace: "pre-wrap",
                  marginTop: 4,
                }}
              >
                {distillChat.buffer}
                <span aria-hidden>▍</span>
              </div>
            )}
          </div>

          {/* "정리해 보기" 버튼 */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border, #e0dcd4)" }}>
            <button
              type="button"
              data-testid="concept-distill-btn"
              disabled={distillChat.isStreaming || conversation.length === 0}
              onClick={() => void handleDistill()}
              style={{
                width: "100%",
                padding: "7px",
                borderRadius: 4,
                border: readyHint
                  ? "1px solid #c8a800"
                  : "1px solid var(--color-border, #e0dcd4)",
                background: readyHint
                  ? "rgba(200, 168, 0, 0.12)"
                  : "var(--color-bg-pane-alt, #f4f1ec)",
                color: readyHint ? "#c8a800" : "var(--color-text, #2b2620)",
                cursor:
                  distillChat.isStreaming || conversation.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontSize: 13,
                opacity: distillChat.isStreaming || conversation.length === 0 ? 0.5 : 1,
                transition: "border-color 0.2s, color 0.2s",
              }}
            >
              {readyHint ? "AI 신호 — 정리해 보기" : "정리해 보기"}
            </button>
          </div>

          {/* 노트 chip 목록 */}
          <div style={{ padding: "8px 14px", overflowY: "auto" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-muted, #786f63)",
                marginBottom: 6,
              }}
            >
              연결된 노트
            </div>

            {attachedNotes.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--color-text-muted, #786f63)", marginBottom: 6 }}>
                연결된 노트 없음
              </div>
            )}

            <div
              data-testid="concept-note-chips"
              style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}
            >
              {attachedNotes.map((link) => (
                <NoteChip
                  key={link}
                  link={link}
                  onRemove={() => {
                    detachNote(link);
                    notesCacheRef.current = { links: [], context: "" };
                  }}
                />
              ))}
            </div>

            {/* 노트 추가 입력 */}
            <div style={{ display: "flex", gap: 4 }}>
              <input
                type="text"
                data-testid="concept-note-input"
                placeholder="[[노트 제목]] 입력 — 영구노트 자동완성"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                list="vault-note-suggestions-step2"
                autoComplete="off"
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: 12,
                  borderRadius: 4,
                  border: "1px solid var(--color-border, #e0dcd4)",
                  background: "var(--color-bg-pane, #ffffff)",
                  color: "var(--color-text, #2b2620)",
                }}
              />
              <datalist id="vault-note-suggestions-step2">
                {vaultNotes.map((title) => (
                  <option key={title} value={`[[${title}]]`} />
                ))}
              </datalist>
              <button
                type="button"
                data-testid="concept-note-add"
                onClick={handleNoteAdd}
                disabled={!noteInput.trim()}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 4,
                  border: "1px solid var(--color-border, #e0dcd4)",
                  background: "var(--color-bg-pane-alt, #f4f1ec)",
                  color: "var(--color-text, #2b2620)",
                  cursor: noteInput.trim() ? "pointer" : "not-allowed",
                  opacity: noteInput.trim() ? 1 : 0.5,
                }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 액션 */}
      <div
        style={{
          borderTop: "1px solid var(--color-border, #e0dcd4)",
          padding: "10px 16px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        {onBack && (
          <button
            type="button"
            data-testid="concept-back"
            onClick={onBack}
            style={{
              padding: "7px 20px",
              borderRadius: 4,
              border: "1px solid var(--color-border, #e0dcd4)",
              background: "transparent",
              color: "var(--color-text, #2b2620)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            이전
          </button>
        )}
        <button
          type="button"
          data-testid="concept-next"
          disabled={!conceptParagraph.trim()}
          onClick={handleAdvance}
          style={{
            padding: "7px 20px",
            borderRadius: 4,
            border: "none",
            background: conceptParagraph.trim()
              ? "#1f7a4a"
              : "var(--color-border, #e0dcd4)",
            color: conceptParagraph.trim() ? "#fff" : "var(--color-text-muted, #786f63)",
            cursor: conceptParagraph.trim() ? "pointer" : "not-allowed",
            fontSize: 13,
          }}
        >
          다음
        </button>
      </div>
    </div>
  );
}
