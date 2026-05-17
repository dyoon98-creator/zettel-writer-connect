// useStreamingChat.ts — 다턴 chat 토큰 스트림을 React 상태에 누적하는 훅.
//
// 사용 예:
//   const { run, buffer, isStreaming, error, cancel, reset } = useStreamingChat();
//   await run({ messages: [...], systemPrompt: "...", notesContext: "..." });
//
// - buffer: 실시간 누적 토큰 (UI 가 그대로 렌더).
// - run() 은 fullText 를 resolve 한다 (실패 시 throw).
// - cancel(): 진행 중 스트림 abort.
// - reset(): buffer/error 초기화.
// - 컴포넌트 unmount 시 자동 abort (StrictMode 안전).

import { useCallback, useEffect, useRef, useState } from "react";

import {
  extractDisplayText,
  startStreamingChat,
  type StreamingChatOptions,
} from "./streamingChat";

export interface UseStreamingChatResult {
  run: (opts: StreamingChatOptions) => Promise<string>;
  buffer: string;
  isStreaming: boolean;
  error: string | null;
  cancel: () => void;
  reset: () => void;
}

export function useStreamingChat(): UseStreamingChatResult {
  const [buffer, setBuffer] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // unmount 시 진행 중 스트림 자동 취소.
  useEffect(() => {
    return () => {
      const ctrl = ctrlRef.current;
      if (ctrl && !ctrl.signal.aborted) {
        ctrl.abort();
      }
    };
  }, []);

  const cancel = useCallback((): void => {
    const ctrl = ctrlRef.current;
    if (ctrl && !ctrl.signal.aborted) {
      ctrl.abort();
    }
  }, []);

  const reset = useCallback((): void => {
    setBuffer("");
    setError(null);
  }, []);

  const run = useCallback(
    async (opts: StreamingChatOptions): Promise<string> => {
      // 기존 controller 가 살아있으면 abort.
      const prev = ctrlRef.current;
      if (prev && !prev.signal.aborted) {
        prev.abort();
      }
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;

      setIsStreaming(true);
      setBuffer("");
      setError(null);

      try {
        const handle = startStreamingChat({ ...opts, signal: ctrl.signal });
        for await (const tok of handle.tokens()) {
          // codex CLI JSONL 이벤트는 사용자에게 안 보이게 필터링.
          // 의미 있는 텍스트(item.text 등)만 buffer 에 누적.
          const display = extractDisplayText(tok);
          if (display.length > 0) {
            setBuffer((prev) => prev + display);
          }
        }
        const result = await handle.done;
        // streaming 중 buffer 가 비었을 수 있으니 (codex 가 last-message 파일에만
        // 진짜 응답을 쓰는 경우) 최종 fullText 로 buffer 갱신.
        if (result.fullText.trim().length > 0) {
          setBuffer(result.fullText);
        }
        return result.fullText;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setIsStreaming(false);
        if (ctrlRef.current === ctrl) {
          ctrlRef.current = null;
        }
      }
    },
    [],
  );

  return { run, buffer, isStreaming, error, cancel, reset };
}
