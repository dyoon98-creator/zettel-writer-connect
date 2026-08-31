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
        //
        // ── 「통째 덮어쓰기」는 «의도» 다. 되돌리지 마라 (판정 2026-08-31) ──
        // 이 buffer 는 스트리밍 «중» 에는 진행 영역이라 `extractDisplayText` 가
        // 넣은 `[AI 진행]`·`[AI 알림]` 표식 줄을 담고 있다. 그 표식을 원고에서
        // 걷어내는 장치가 이 한 줄뿐이다. 이어붙이기·부분 병합으로 바꾸면
        // 진행 표식이 그대로 원고에 박힌다.
        //
        // 「긴 본문이 먼저 오고 짧은 마무리가 나중에 오는 턴이면 앞 본문이
        // 사라지지 않나」 — 사라진다. 그러나 그것은 이 줄의 결함이 아니라
        // codex 의 `--output-last-message` 정의(= 마지막 메시지)에서 오는
        // 것이고, 1차 경로인 그 파일에서도 똑같이 일어난다. 여기서만 길이
        // heuristic 으로 buffer 를 살리면 «화면에 보이는 것»과 «run() 이
        // 돌려줘 저장되는 것»이 갈라진다 — 지금 지키는 불변식은 정착 후
        // buffer === run() 반환값이다. 화면과 저장본이 어긋나는 쪽이 더 나쁘다.
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
