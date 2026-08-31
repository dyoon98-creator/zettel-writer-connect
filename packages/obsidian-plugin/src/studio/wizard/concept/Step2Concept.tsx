// Step2Concept.tsx — 컨셉 마법사 2단계: AI 와 다턴 대화로 컨셉 단락 도출.
//
// 레이아웃: 좌측 70% Chat + 우측 30% Live Preview.
// - 좌측: 메시지 thread + 스트리밍 버퍼 + 입력 textarea.
// - 우측: conceptParagraph 미리보기 + 노트 chip + "정리해 보기" 버튼.
// - 하단: "다음" 버튼 (conceptParagraph 비면 disabled).
//
// ── 판정 박제 (aiwait-mouse-7f4c1a08 · 2026-08-31) ──────────────────────────
//
// 물음 1. 이 화면은 «대화» 화면이라 마법사 단계와 생김새가 다르다. 공용 대기
//         표시 AiWaitBar 를 그대로 쓰는가, 이 화면만 다르게 가는가.
// 답    . 그대로 쓴다. 화면에 맞춰 바꾸는 것은 «자리» 뿐이다.
//   - 그대로 두는 것 — 생김새·문면·버튼 이름(「그만두기」). 사용자는 마법사 네
//     화면에서 이미 이 막대를 봤다. 같은 기다림에 다른 그림을 내밀면 그만두는
//     법을 화면마다 새로 배워야 한다.
//   - 자리만 다른 이유 — 이 화면에서는 왼쪽 대화(mainChat)와 오른쪽 정리
//     (distillChat)가 «따로» 돈다. 그래서 막대도 둘이고, 각 막대는 제 옆에서
//     도는 호출만 멈춘다. 하나로 합치면 「그만두기」가 무엇을 멈추는지 알 수
//     없다.
//
// 왜 여기에 마우스 취소가 «아예 없던» 것과 같았나 (실측):
//   Esc 처리기가 textarea 의 onKeyDown 에만 붙어 있는데, 그 textarea 는
//   `disabled={isStreaming}` 이다. 브라우저는 disabled 요소에 포커스를 주지
//   않으므로, 답을 만드는 «동안» 에는 Esc 가 그 처리기에 닿을 수 없다.
//   → 마우스 사용자에게는 물론 키보드 사용자에게도 취소가 없었다.
//   그래서 textarea 처리기는 그대로 두고(빼지 않는다) 창 전체 Esc 를 «더했다».
//   창 전체 keydown 방식은 SelectionPopover.tsx 가 이미 쓴다 — 새 체계가 아니다.
//
// 물음 4. 타자기 커서 「▍」 를 어떻게 하는가.
// 답    . 없앤다. codex 는 글자를 한 자씩 주지 않는다(본문은 턴이 끝난 뒤
//         통째로 온다). 한 글자도 오지 않는 자리에서 커서만 깜빡이는 것은
//         «지금 타자 치는 중» 이라는 거짓말이다. 그 자리에 남는 것은 대기 막대
//         — 무슨 일 · 몇 초째 · 언제 저절로 멈추는지 · 그만두기. 말풍선 자체는
//         진행 알림이 실제로 왔을 때만 띄운다. 빈 말풍선은 「AI 코치가 아무
//         말도 하지 않았다」로 읽힌다.

import { useCallback, useEffect, useRef, useState } from "react";

import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { useStreamingChat } from "../../ai/useStreamingChat";
import { fetchNotesForContext } from "../../vaultAdapter";
import { AiStoppedNotice, AiWaitBar, isUserStopped } from "../AiWaitBar";
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

// ---- 키 판별 ----------------------------------------------------------------

/**
 * 이 keydown 이 «Enter 물리 키» 인가.
 *
 * ── 원인 판정 (2026-08-31 · 대표 실사용 결함) ──────────────────────────────
 * 증상: 한글로 답을 쓰고 `Cmd+Enter` 를 눌러도 전송이 안 된다. [보내기] 버튼은
 *       된다. 화면에는 「Cmd/Ctrl+Enter 로 전송」이라 적혀 있다.
 *
 * 원인: **한글 IME 조합 중에는 `e.key` 가 "Enter" 로 오지 않는다.** macOS
 *       Chromium(옵시디언은 Electron=Chromium)은 조합 중 keydown 을
 *       `key: "Process"` · `keyCode: 229` · `isComposing: true` 로 보낸다.
 *       그래서 `e.key === "Enter"` 비교가 통째로 빗나가고 처리기가 «아예 실행되지
 *       않는다». 한글을 쓰는 사람에게만, 마지막 음절이 조합 중일 때만 터진다 —
 *       영문만 쓰면 평생 안 보인다.
 *
 * 고침: 판별 축을 `key`(IME 가 바꿔치는 «논리» 값)에서 `code`(IME 와 무관한
 *       «물리» 키)로 옮긴다. `code` 는 조합 중에도 그대로 "Enter" 다.
 *       `key` 비교도 남겨 둔다 — 더하되 빼지 않는다.
 *
 * 왜 «조합 중이면 무시» 가 아니라 «조합 중에도 보낸다» 인가:
 *   흔한 IME 방어는 「조합 중 Enter 는 무시」다. 그것은 **맨 Enter 로 전송하는**
 *   화면의 규칙이다 — 거기서 Enter 는 「음절 확정」과 「전송」 둘 다를 뜻해 모호하다.
 *   여기는 `Cmd/Ctrl+Enter` 라 모호하지 않다. **한글 IME 는 Cmd+Enter 를 음절
 *   확정에 쓰지 않는다.** 이 조합을 누른 사람의 뜻은 하나뿐이므로 그대로 보낸다.
 *
 * 같은 결함이 `../WizardChat.tsx` 에도 글자 그대로 있었고 함께 고쳤다. 두 곳에
 * 같은 함수를 두는 이유는 이 발주가 새 공용 파일을 만들 수 없어서다. 둘이 갈라지지
 * 못하도록 `tests/studio/wizard/imeSend.test.ts` 가 양쪽을 함께 못박는다.
 */
function isEnterKey(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter";
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

  // 창 전체 Esc — 답을 만드는 «동안» 실제로 닿는 유일한 키보드 경로.
  // (아래 handleKeyDown 의 Esc 는 disabled 된 textarea 에 붙어 있어 정작 그
  //  순간에는 닿지 않는다. 그 줄은 빼지 않고 이 경로를 더한다.)
  useEffect(() => {
    if (!mainChat.isStreaming && !distillChat.isStreaming) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (mainChat.isStreaming) mainChat.cancel();
      if (distillChat.isStreaming) distillChat.cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    mainChat.isStreaming,
    distillChat.isStreaming,
    mainChat.cancel,
    distillChat.cancel,
  ]);

  // 작가 메시지 전송.
  //
  // liveText — 키보드로 보낼 때 «입력칸에 지금 실제로 있는 글자» 를 그대로 받는다.
  // 한글 조합 중에는 React 상태(draft)가 마지막 음절만큼 뒤처질 수 있다. 사용자가
  // 보내려는 것은 «지금 눈에 보이는 문장» 이지 한 글자 모자란 문장이 아니다.
  const handleSend = async (liveText?: string): Promise<void> => {
    const text = (liveText ?? draft).trim();
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
    if ((e.metaKey || e.ctrlKey) && isEnterKey(e)) {
      e.preventDefault();
      void handleSend(e.currentTarget.value);
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

  // 사용자가 스스로 그만둔 것은 «고장» 이 아니다 — 빨간 배너로 보이지 않는다.
  const stoppedByUser =
    isUserStopped(mainChat.error) || isUserStopped(distillChat.error);
  const failure =
    (mainChat.error && !isUserStopped(mainChat.error) ? mainChat.error : null) ??
    (distillChat.error && !isUserStopped(distillChat.error)
      ? distillChat.error
      : null);

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
      {/* 그만둔 뒤 — 쓰던 내용이 그대로임을 말한다 (고장 아님) */}
      {stoppedByUser && !failure && (
        <AiStoppedNotice
          style={{
            marginTop: 8,
            marginLeft: 16,
            marginRight: 16,
            marginBottom: 8,
          }}
        />
      )}

      {/* 에러 배너 */}
      {failure && (
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
          <span>{failure}</span>
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

            {/* AI 가 보내 온 것이 실제로 있을 때만 말풍선을 띄운다.
                아무것도 오지 않는 동안 «살아 있음» 을 말하는 것은 아래 대기
                막대의 몫이다 — 빈 말풍선 + 깜빡이는 커서는 거짓말이다. */}
            {isStreaming && mainChat.buffer.length > 0 && (
              <div
                className="wizard-msg wizard-msg--ai wizard-msg--streaming"
                data-testid="concept-msg-streaming"
              >
                <div className="wizard-msg-meta">
                  <span className="wizard-msg-role">AI 코치</span>
                </div>
                <div className="wizard-msg-body" style={{ whiteSpace: "pre-wrap" }}>
                  {mainChat.buffer}
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
            {/* 기다리는 동안 — 무엇을 하는 중인지 + 몇 초째인지 + 그만두기.
                손이 이미 여기 있으므로 버튼도 여기 둔다. */}
            {isStreaming && (
              <AiWaitBar
                label="AI 코치가 답을 쓰고 있습니다"
                onCancel={mainChat.cancel}
                testId="concept-wait-bar"
              />
            )}

            <textarea
              data-testid="concept-input"
              placeholder="답변을 입력하세요. (Cmd/Ctrl+Enter 로 전송)"
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
                {isStreaming
                  ? "Esc 를 눌러도 그만둘 수 있습니다"
                  : "Cmd/Ctrl + Enter 로 전송"}
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

            {/* 정리는 대화와 «따로» 돈다 — 그래서 그만두기도 따로 있다. */}
            {distillChat.isStreaming && (
              <AiWaitBar
                label="컨셉 단락을 정리하고 있습니다"
                onCancel={distillChat.cancel}
                style={{ marginBottom: 10, padding: "8px 10px" }}
                testId="concept-distill-wait-bar"
              />
            )}

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
              {/* 정리하는 «중» 에 「정리해 보기를 눌러주세요」라고 하면
                  지금 무슨 일이 나는지 사용자가 다시 헷갈린다. */}
              {conceptParagraph ||
                (distillChat.isStreaming
                  ? ""
                  : "아직 정리된 컨셉이 없습니다. “정리해 보기”를 눌러주세요.")}
            </div>

            {/* 정리 중 도착한 것이 있을 때만 보인다 (커서만 깜빡이지 않는다) */}
            {distillChat.isStreaming && distillChat.buffer.length > 0 && (
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
