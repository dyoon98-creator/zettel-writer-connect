// ResultPreviewModal.tsx — AI 호출의 스트리밍 표시 + 결과 분기 모달.
//
// 흐름:
//   1) 마운트 시 startAiInvocation() 으로 호출 시작.
//   2) 토큰 스트림을 모아 StreamView 로 점진 렌더.
//   3) 완료 시 phase="done", 사용자가 저장/삽입/복사/무시 버튼 중 하나 선택.
//   4) 사용자 선택 후 onComplete 콜백을 통해 부모에게 결과 + choice 전달.

import { useEffect, useRef, useState } from "react";
import type { UnifiedAction } from "@ai-manuscript-studio/core";

import { startAiInvocation, type StreamingHandle } from "./streamingHandle";
import { StreamView, type StreamPhase } from "./StreamView";

const SAVE_LABELS: Record<string, string> = {
  feedback: "피드백 탭에 저장",
  revising: "퇴고 메모 탭에 저장",
  materials: "자료 탭에 저장",
  draft: "초안 탭에 저장",
  plan: "기획 탭에 저장",
};

export type PreviewChoice = "save" | "insert" | "copy" | "discard";

export interface ResultPreviewModalProps {
  action: UnifiedAction;
  prompt: string;
  /** "Codex CLI" / "Claude Code CLI" / "목업 어댑터" 등. */
  adapterName: string;
  /** Tauri 백엔드에 전달할 binary path (settings에서 결정). */
  binaryPath: string;
  /** 공백 구분 추가 인자. */
  extraArgs: string;
  provider: "codex" | "claude-code" | "mock";
  /** 60초 기본. */
  timeoutSecs?: number;
  /**
   * codex/claude CLI 는 stdout 으로 protocol JSONL 라인을 토큰처럼 흘려보낸다.
   * 그대로 누적하면 `{"type":"thread.started"...}` 같은 가비지가 화면에 보인다.
   * 이 옵션이 true 면 토큰을 화면에 누적하지 않고, done.fullText 만 한번에 보여준다.
   */
  discardStreamTokens?: boolean;
  /**
   * 결과 본문 위에 추가로 렌더할 패널. SelectionPopover 가 스니펫 카드 그리드를
   * 주입할 때 사용. 인자로 현재 fullText 와 phase 를 전달받아 직접 렌더 결정.
   */
  renderTopPanel?: (info: {
    fullText: string;
    phase: "idle" | "streaming" | "done" | "error";
  }) => React.ReactNode;
  /** 닫기 버튼/ESC + choice 결정 후 호출. */
  onComplete: (choice: PreviewChoice, fullText: string) => void;
  /**
   * false 면 mount 시 자동으로 AI 호출하지 않는다. 사용자가 모달 안의
   * '분석 시작' 버튼을 눌러야 시작. 캐시된 결과가 있는 경우 false 로 띄워
   * 사용자가 '다시 분석' 을 선택할 때만 호출하도록 한다.
   * default = true (기존 동작).
   */
  autoStart?: boolean;
  /**
   * 캐시된 이전 결과. 주어지면 phase="done", text=initialFullText 로 시작.
   * '다시 분석' 또는 '분석 시작' 클릭 시 새 호출.
   */
  initialFullText?: string;
  /** 새 호출이 시작되어 새 결과가 나오면 호출 (캐시 갱신 등). */
  onResultReceived?: (fullText: string, durationMs: number) => void;
}

export function ResultPreviewModal(props: ResultPreviewModalProps): JSX.Element {
  const {
    action,
    prompt,
    adapterName,
    binaryPath,
    extraArgs,
    provider,
    timeoutSecs,
    discardStreamTokens = false,
    renderTopPanel,
    onComplete,
    autoStart = true,
    initialFullText,
    onResultReceived,
  } = props;

  // 캐시된 결과로 시작하는 경우 — phase=done, text=initialFullText.
  // autoStart=false 면 사용자가 명시적으로 분석 시작/다시 분석 누르기 전까지 대기.
  const hasInitial = !!(initialFullText && initialFullText.length > 0);
  const [phase, setPhase] = useState<StreamPhase>(
    hasInitial ? "done" : autoStart ? "streaming" : "idle",
  );
  const [text, setText] = useState(initialFullText ?? "");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [durationMs, setDurationMs] = useState<number | undefined>();
  const handleRef = useRef<StreamingHandle | null>(null);
  const fullTextRef = useRef(initialFullText ?? "");
  // 같은 시점에 여러 번 run 트리거되어도 한 핸들만 동작하도록.
  const [runToken, setRunToken] = useState(autoStart && !hasInitial ? 1 : 0);

  useEffect(() => {
    if (runToken === 0) return; // idle / done(캐시) 상태 — 사용자가 시작 누르기 전.
    let mounted = true;
    setPhase("streaming");
    setText("");
    setErrorMessage(undefined);
    setDurationMs(undefined);
    fullTextRef.current = "";

    const handle = startAiInvocation({
      provider,
      binaryPath,
      extraArgs: extraArgs.split(/\s+/).filter((x) => x.length > 0),
      prompt,
      timeoutSecs: timeoutSecs ?? 60,
    });
    handleRef.current = handle;

    const consume = async (): Promise<void> => {
      let acc = "";
      try {
        for await (const tok of handle.tokens()) {
          if (!mounted) return;
          acc += tok;
          if (!discardStreamTokens) {
            fullTextRef.current = acc;
            setText(acc);
          }
        }
      } catch {
        /* done.catch */
      }
    };

    void consume();

    handle.done
      .then((r) => {
        if (!mounted) return;
        if (r.fullText && r.fullText.length > acc(fullTextRef)) {
          fullTextRef.current = r.fullText;
          setText(r.fullText);
        }
        setDurationMs(r.durationMs);
        setPhase("done");
        onResultReceived?.(fullTextRef.current, r.durationMs);
      })
      .catch((e: Error) => {
        if (!mounted) return;
        setErrorMessage(e.message);
        setPhase("error");
      });

    return () => {
      mounted = false;
      if (handleRef.current) {
        void handleRef.current.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken]);

  const startRun = (): void => {
    setRunToken((t) => t + 1);
  };

  const saveButtonLabel =
    SAVE_LABELS[action.saveTo] ?? "피드백 탭에 저장";

  const handleCancel = (): void => {
    if (handleRef.current) void handleRef.current.cancel();
    onComplete("discard", fullTextRef.current);
  };

  const handleChoice = (choice: PreviewChoice): void => {
    onComplete(choice, fullTextRef.current);
  };

  return (
    <div
      className="result-preview-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="result-preview-modal"
    >
      <div className="result-preview-window">
        {renderTopPanel?.({ fullText: fullTextRef.current, phase })}
        <StreamView
          actionLabel={action.label}
          adapterName={adapterName}
          text={text}
          phase={phase}
          errorMessage={errorMessage}
          durationMs={durationMs}
          saveButtonLabel={saveButtonLabel}
          onStart={phase === "idle" || phase === "done" ? startRun : undefined}
          cachedHint={
            hasInitial && runToken === 0
              ? "이전 분석 결과 (캐시)"
              : undefined
          }
          onCancel={handleCancel}
          onSave={() => handleChoice("save")}
          onInsert={() => handleChoice("insert")}
          onCopy={() => handleChoice("copy")}
          onDiscard={() => handleChoice("discard")}
        />
      </div>
    </div>
  );
}

// helper: useRef 안의 string 길이를 안전하게 얻어 비교
function acc(ref: { current: string }): number {
  return ref.current.length;
}
