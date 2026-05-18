// WizardChat.tsx — 메시지 스레드 + textarea 입력 + 토큰 스트리밍 표시.
//
// - 모든 메시지를 시간순으로 렌더 (system 메시지는 옅게 표시)
// - 스트리밍 중인 마지막 assistant 응답은 별도 노드로 보여주고 끝에 caret(▍) 추가
// - Cmd/Ctrl+Enter 로 전송, Esc 로 cancelStream
// - 마지막 assistant 메시지에 "재생성" 버튼

import { useEffect, useRef, useState } from "react";
import {
  STAGE_LABEL_KO,
  type WizardMessage,
} from "@ai-manuscript-studio/core";

import { useWizardStore } from "./wizardStore";

interface MessageRowProps {
  msg: WizardMessage;
  showRegenerate: boolean;
  onRegenerate: () => void;
}

function LoadingDots({ label }: { label: string }): JSX.Element {
  // 점 3개가 순차로 펄스. CSS keyframes 는 global.css 에 정의.
  return (
    <span className="wizard-loading" role="status" aria-live="polite">
      <span className="wizard-loading-label">{label}</span>
      <span className="wizard-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
    </span>
  );
}

function MessageRow({ msg, showRegenerate, onRegenerate }: MessageRowProps): JSX.Element {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  return (
    <div
      className={
        "wizard-msg " +
        (isUser
          ? "wizard-msg--user"
          : isSystem
            ? "wizard-msg--system"
            : "wizard-msg--ai")
      }
      data-testid={`wizard-msg-${msg.role}`}
    >
      <div className="wizard-msg-meta">
        <span className="wizard-msg-role">
          {isUser ? "작가" : isSystem ? "시스템" : "AI 비서"}
        </span>
        <span className="wizard-msg-stage">{STAGE_LABEL_KO[msg.stage]}</span>
      </div>
      <div className="wizard-msg-body">{msg.content}</div>
      {showRegenerate && (
        <div className="wizard-msg-actions">
          <button
            type="button"
            className="wizard-msg-action-btn"
            onClick={onRegenerate}
          >
            재생성
          </button>
        </div>
      )}
    </div>
  );
}

export function WizardChat(): JSX.Element {
  const engine = useWizardStore((s) => s.engineRef);
  const isStreaming = useWizardStore((s) => s.isStreaming);
  const streamingBuffer = useWizardStore((s) => s.streamingBuffer);
  const phase = useWizardStore((s) => s.phase);
  const sendUserMessage = useWizardStore((s) => s.sendUserMessage);
  const regenerateLast = useWizardStore((s) => s.regenerateLast);
  const cancelStream = useWizardStore((s) => s.cancelStream);
  const currentQuestion = useWizardStore((s) => s.currentQuestion);
  const isAwaitingQuestion = useWizardStore((s) => s.isAwaitingQuestion);
  // rev 변경 시 리렌더.
  useWizardStore((s) => s.rev);

  const [draft, setDraft] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [otherDraft, setOtherDraft] = useState("");

  // 새 질문이 오면 입력 상태 초기화.
  useEffect(() => {
    setSelectedChoice(null);
    setOtherDraft("");
    setDraft("");
  }, [currentQuestion]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledUpRef = useRef(false);

  const messages = engine ? engine.session.messages : [];

  // 자동 스크롤. 사용자가 위로 올렸으면 멈춘다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (userScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streamingBuffer, isStreaming]);

  const onScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distFromBottom > 80;
  };

  const handleSend = async (): Promise<void> => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    userScrolledUpRef.current = false;
    await sendUserMessage(text);
  };

  // 일반 옵션 클릭 → 즉시 전송. 마지막(직접 입력) 옵션 클릭 → textarea 노출 후 명시적 전송.
  const handleChoiceSelect = (i: number): void => {
    const opts = currentQuestion?.options ?? [];
    const isLast = i === opts.length - 1;
    setSelectedChoice(i);
    if (!isLast) {
      const chosen = opts[i] ?? "";
      if (chosen.trim()) {
        userScrolledUpRef.current = false;
        void sendUserMessage(chosen);
      }
    }
  };

  const handleChoiceSubmit = async (): Promise<void> => {
    if (!currentQuestion || currentQuestion.format !== "choice") return;
    if (selectedChoice === null) return;
    const opts = currentQuestion.options ?? [];
    const chosen = opts[selectedChoice] ?? "";
    const isLast = selectedChoice === opts.length - 1;
    // 마지막(직접 입력) 옵션은 직접 입력 텍스트가 본문이 됨.
    const content = isLast && otherDraft.trim()
      ? `${chosen}: ${otherDraft.trim()}`
      : chosen;
    if (!content.trim()) return;
    userScrolledUpRef.current = false;
    await sendUserMessage(content);
  };

  // 마지막 assistant 메시지 인덱스.
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  const canRegenerate =
    !isStreaming && phase === "interviewing" && lastAssistantIdx !== -1;

  return (
    <section className="wizard-chat" data-testid="wizard-chat">
      <div
        className="wizard-thread"
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && !isStreaming && !isAwaitingQuestion && (
          <div className="wizard-empty-prompt">
            잠시 기다려주세요. AI 비서가 첫 질문을 준비하고 있습니다…
          </div>
        )}

        {messages.map((m, i) => (
          <MessageRow
            key={m.id}
            msg={m}
            showRegenerate={i === lastAssistantIdx && canRegenerate}
            onRegenerate={() => void regenerateLast()}
          />
        ))}

        {/* 객관식 답변은 footer 가 아닌 마지막 질문 바로 아래에 인라인으로
            붙여 짧은 thread 와 footer 사이의 빈 공간을 없앤다. */}
        {!isStreaming &&
          !isAwaitingQuestion &&
          phase === "interviewing" &&
          currentQuestion?.format === "choice" &&
          currentQuestion.options && (
            <div className="wizard-msg wizard-msg--choice-inline">
              <ChoiceInput
                options={currentQuestion.options}
                selected={selectedChoice}
                onSelect={handleChoiceSelect}
                otherDraft={otherDraft}
                onOtherChange={setOtherDraft}
                disabled={false}
                onSubmit={() => void handleChoiceSubmit()}
              />
            </div>
          )}

        {/* 다음 질문을 기다리는 동안 thread 안에 로딩 인디케이터를 보여
            준다 (객관식이라 footer 가 비었을 때도 작동 중임을 확인). */}
        {isAwaitingQuestion && (
          <div
            className="wizard-msg wizard-msg--ai wizard-msg--loading"
            data-testid="wizard-msg-loading"
          >
            <div className="wizard-msg-meta">
              <span className="wizard-msg-role">AI 비서</span>
              <span className="wizard-msg-stage">
                {engine ? STAGE_LABEL_KO[engine.session.currentStage] : ""}
              </span>
            </div>
            <div className="wizard-msg-body">
              <LoadingDots label="다음 질문을 작성 중" />
            </div>
          </div>
        )}

        {isStreaming && (
          <div
            className="wizard-msg wizard-msg--ai wizard-msg--streaming"
            data-testid="wizard-msg-streaming"
          >
            <div className="wizard-msg-meta">
              <span className="wizard-msg-role">AI 비서</span>
              <span className="wizard-msg-stage">
                {engine ? STAGE_LABEL_KO[engine.session.currentStage] : ""}
              </span>
            </div>
            <div className="wizard-msg-body">
              {streamingBuffer}
              <span className="wizard-msg-caret" aria-hidden>
                ▍
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 객관식이면 답변 UI 가 thread 안에 인라인으로 들어가므로 footer 를 비운다. */}
      {currentQuestion?.format === "choice" && currentQuestion.options ? null : (
      <footer className="wizard-input">
        {isAwaitingQuestion ? (
          <div className="wizard-input-hint" style={{ padding: 12 }}>
            <LoadingDots label="AI가 다음 질문을 작성 중" />
          </div>
        ) : (
          <>
            <textarea
              className="wizard-input-textarea"
              data-testid="wizard-input"
              placeholder={
                phase === "awaiting-seed"
                  ? "5단계가 모두 완료되었습니다. 옆 사이드바의 안내를 확인해주세요."
                  : currentQuestion?.format === "open"
                    ? "주관식으로 답해주세요. 한두 문장이면 충분합니다. (Cmd/Ctrl+Enter)"
                    : "여기에 답을 적어주세요. (Cmd/Ctrl+Enter 로 전송)"
              }
              value={draft}
              disabled={phase !== "interviewing"}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                } else if (e.key === "Escape" && isStreaming) {
                  e.preventDefault();
                  cancelStream();
                }
              }}
            />
            <div className="wizard-input-actions">
              <span className="wizard-input-hint">
                {isStreaming ? "AI가 답변 중… (Esc 로 중단)" : "Cmd/Ctrl + Enter 로 전송"}
              </span>
              <button
                type="button"
                className="wizard-send-btn"
                disabled={phase !== "interviewing" || !draft.trim()}
                onClick={() => void handleSend()}
                data-testid="wizard-send"
              >
                전송
              </button>
            </div>
          </>
        )}
      </footer>
      )}
    </section>
  );
}

interface ChoiceInputProps {
  options: string[];
  selected: number | null;
  onSelect: (i: number) => void;
  otherDraft: string;
  onOtherChange: (s: string) => void;
  disabled: boolean;
  onSubmit: () => void;
}

function ChoiceInput({
  options,
  selected,
  onSelect,
  otherDraft,
  onOtherChange,
  disabled,
  onSubmit,
}: ChoiceInputProps): JSX.Element {
  const lastIdx = options.length - 1;
  const isOtherSelected = selected === lastIdx;
  const canSubmit =
    selected !== null && (!isOtherSelected || otherDraft.trim().length > 0);
  return (
    <div className="wizard-choice" data-testid="wizard-choice">
      <div className="wizard-choice-list">
        {options.map((opt, i) => (
          <label
            key={i}
            className={
              "wizard-choice-row" +
              (selected === i ? " wizard-choice-row--selected" : "")
            }
          >
            <input
              type="radio"
              name="wizard-choice"
              checked={selected === i}
              onChange={() => onSelect(i)}
              disabled={disabled}
            />
            <span className="wizard-choice-label">
              <span className="wizard-choice-num">{i + 1}.</span> {opt}
            </span>
          </label>
        ))}
      </div>
      {isOtherSelected && (
        <>
          <textarea
            className="wizard-choice-other"
            placeholder="직접 입력해주세요"
            value={otherDraft}
            rows={2}
            onChange={(e) => onOtherChange(e.target.value)}
            disabled={disabled}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <div className="wizard-input-actions">
            <span className="wizard-input-hint">
              입력 후 답변 버튼을 누르세요.
            </span>
            <button
              type="button"
              className="wizard-send-btn"
              disabled={disabled || !canSubmit}
              onClick={onSubmit}
              data-testid="wizard-choice-submit"
            >
              답변
            </button>
          </div>
        </>
      )}
      {!isOtherSelected && (
        <div className="wizard-input-hint" style={{ marginTop: 6, fontSize: 12 }}>
          항목을 클릭하면 바로 다음 질문으로 넘어갑니다.
        </div>
      )}
    </div>
  );
}
