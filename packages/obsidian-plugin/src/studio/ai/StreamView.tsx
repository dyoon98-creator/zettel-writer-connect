// StreamView.tsx — AI 응답 스트리밍 표시 + 결과 분기 버튼.
//
// Header: 액션 라벨 / 어댑터 이름 / 경과 시간 (live)
// Body  : 누적 텍스트의 markdown 렌더 (debounce 100ms)
// Footer: 스트리밍 중 — "취소" 버튼
//         완료 후    — 4개 버튼 (저장 / 삽입 / 복사 / 무시)

import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";

export type StreamPhase = "streaming" | "done" | "error";

export interface StreamViewProps {
  actionLabel: string;
  adapterName: string;
  /** 스트리밍 중 누적된 텍스트. 부모가 토큰을 받아 set 한다. */
  text: string;
  phase: StreamPhase;
  /** 에러 발생 시 표시 메시지. */
  errorMessage?: string;
  /** 시작 시각 (ms). 기본은 컴포넌트 mount 시각. */
  startedAt?: number;
  /** 완료된 경우의 총 소요 시간(ms). 우선 표시. */
  durationMs?: number;
  /** 저장 버튼 라벨. 기본 "피드백 탭에 저장". */
  saveButtonLabel?: string;
  onCancel?: () => void;
  onSave?: () => void;
  onInsert?: () => void;
  onCopy?: () => void;
  onDiscard?: () => void;
}

/** debounce용 — 100ms 안에 도착한 setText는 합쳐서 한 번만 렌더. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function useElapsed(startedAt: number, running: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, now - startedAt);
}

export function StreamView(props: StreamViewProps): JSX.Element {
  const {
    actionLabel,
    adapterName,
    text,
    phase,
    errorMessage,
    saveButtonLabel = "피드백 탭에 저장",
    onCancel,
    onSave,
    onInsert,
    onCopy,
    onDiscard,
  } = props;

  const startRef = useRef(props.startedAt ?? Date.now());
  const elapsed = useElapsed(startRef.current, phase === "streaming");
  const elapsedMs = phase === "done" ? props.durationMs ?? elapsed : elapsed;

  // 토큰 도착 시마다 marked 호출은 비싸므로 100ms debounce.
  const debounced = useDebouncedValue(text, 100);

  const html = useMemo(() => {
    if (!debounced) return "";
    try {
      // marked.parse는 동기 호출 (async 옵션이 false일 때).
      const out = marked.parse(debounced, { async: false }) as string;
      return out;
    } catch {
      // markdown 파싱 실패 시 raw text를 escaped로 fallback.
      return escapeHtml(debounced);
    }
  }, [debounced]);

  return (
    <div className="stream-view" data-testid="stream-view" data-phase={phase}>
      <header className="stream-view-header">
        <div className="stream-view-title">{actionLabel}</div>
        <div className="stream-view-meta">
          <span className="stream-view-adapter">{adapterName}</span>
          <span className="stream-view-sep">·</span>
          <span className="stream-view-elapsed" data-testid="stream-view-elapsed">
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
      </header>

      {phase === "streaming" && !debounced ? (
        <div className="stream-view-body stream-view-body--loading">
          <span className="stream-view-loading-label">AI 가 분석 중</span>
          <span className="stream-view-loading-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </div>
      ) : (
        <div
          className="stream-view-body"
          data-testid="stream-view-body"
          // 신뢰 가능한 input (우리가 marked 처리한 것). 위험한 사용자 HTML은
          // marked가 escape하므로 안전.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {phase === "streaming" && (
        <footer className="stream-view-footer">
          <button
            type="button"
            className="stream-view-cancel"
            data-testid="stream-view-cancel"
            onClick={onCancel}
          >
            취소
          </button>
        </footer>
      )}

      {phase === "done" && (
        <footer className="stream-view-footer">
          <button
            type="button"
            className="stream-view-action"
            data-testid="stream-view-save"
            onClick={onSave}
          >
            {saveButtonLabel}
          </button>
          <button
            type="button"
            className="stream-view-action"
            data-testid="stream-view-insert"
            onClick={onInsert}
          >
            현재 위치에 삽입
          </button>
          <button
            type="button"
            className="stream-view-action"
            data-testid="stream-view-copy"
            onClick={onCopy}
          >
            복사
          </button>
          <button
            type="button"
            className="stream-view-action stream-view-action--secondary"
            data-testid="stream-view-discard"
            onClick={onDiscard}
          >
            무시
          </button>
        </footer>
      )}

      {phase === "error" && (
        <footer className="stream-view-footer stream-view-footer--error">
          <div className="stream-view-error" data-testid="stream-view-error">
            {errorMessage ?? "AI 호출에 실패했습니다."}
          </div>
          <button
            type="button"
            className="stream-view-action"
            data-testid="stream-view-discard"
            onClick={onDiscard}
          >
            닫기
          </button>
        </footer>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
