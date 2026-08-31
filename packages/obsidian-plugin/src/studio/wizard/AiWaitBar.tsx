// AiWaitBar.tsx — AI 가 답을 만드는 동안 화면에 보이는 «단 하나의» 대기 표시.
//
// 왜 필요한가:
//   codex 는 글자를 한 자씩 흘려보내지 않는다. 답은 한 턴이 끝난 뒤 통째로 한 번
//   온다. 그 사이 화면은 완전히 정지한다 — 짧은 질문도 7~9초, 원고 길이면 몇 분.
//   사용자에게는 그 정지가 «고장» 으로 보인다. 이 부품은 그 시간 동안 세 가지를
//   보장한다.
//     1) 지금 무엇을 하는 중인지 (label)
//     2) 얼마나 지났는지 (스스로 재는 경과 시간 — 살아 있다는 유일한 증거)
//     3) 언제 저절로 끝나는지 + 지금 그만둘 수 있는지 (한계 시간 + 그만두기)
//
// 설계 판정 (근거는 docs/변경기록_aiwait-ui-9b3ce5f0.md):
//   - 경과 시간은 «5초가 지난 뒤부터» 보인다. 7초짜리 호출에까지 숫자가 번쩍이면
//     짧은 기다림이 오히려 길게 느껴진다.
//   - 한계 시간은 «얼마나 걸린다» 가 아니라 «언제 저절로 끝난다» 로 말한다.
//     끝이 있는 기다림은 견딜 만하고, 끝이 없는 기다림은 견딜 수 없다.
//   - 화면이 달라도 이 부품의 생김새·문면·버튼은 같다. 다른 것은 label 한 줄뿐.
//
// 화면에 컴퓨터 용어를 쓰지 않는다 — 「스트리밍」·「타임아웃」·「프로세스」 금지.

import { useEffect, useRef, useState } from "react";

import {
  readAiFailureKind,
  type AiFailureKind,
} from "../../adapters/aiBridge";

// ─── 색 (다른 마법사 화면과 같은 팔레트) ────────────────────────────────────

const ACCENT = "#1f7a4a";
const BORDER = "#e0dcd4";
const TEXT = "#2b2620";
const TEXT_MUTED = "#786f63";
const RADIUS = 6;

/**
 * 경과 시간을 몇 초 뒤부터 보여줄지.
 * 이보다 짧게 끝나는 호출에는 숫자를 아예 띄우지 않는다.
 */
export const ELAPSED_REVEAL_SECS = 5;

/**
 * 한계 시간 기본값(초).
 * 마법사 네 화면은 timeoutSecs 를 넘기지 않으므로 aiBridge 기본값 180초가 걸린다
 * (src/adapters/aiBridge.ts — `input.timeoutSecs ?? 180`).
 */
export const DEFAULT_LIMIT_SECS = 180;

/**
 * aiBridge 가 «사용자가 그만둠» 에 붙이는 문면.
 *
 * 이것은 이제 **2차** 판별이다. 1차는 아래 `USER_STOP_KIND`(오류에 실린 종류)다.
 * 그래도 지우지 않는다 — 종류가 없는 옛 오류 객체가 흘러들 수 있고, 화면들이
 * 지금도 «문자열» 만 넘겨 준다(`useStreamingChat` 의 `error` 는 문자열이다).
 */
const USER_STOP_MARK = "사용자가 취소했습니다";

/**
 * aiBridge 가 «사용자가 그만둠» 에 붙이는 **종류**.
 *
 * 문면이 아니라 이 값이 1차 판별 근거다. 타입을 박아 두었으므로 브리지에서
 * 종류 이름이 바뀌면 여기서 «컴파일이» 깨진다 — 조용히 어긋나지 않는다.
 */
const USER_STOP_KIND: AiFailureKind = "canceled";

// ─── 문면 헬퍼 ──────────────────────────────────────────────────────────────

/** 12 → "12초", 72 → "1분 12초", 120 → "2분". */
export function formatDuration(totalSecs: number): string {
  const secs = Math.max(0, Math.floor(totalSecs));
  if (secs < 60) return `${secs}초`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

/**
 * 이 오류가 «사용자가 직접 그만둔 것» 인가.
 * 그만두기는 고장이 아니므로 빨간 오류 배너로 보여서는 안 된다.
 *
 * 보는 순서는 둘, 그리고 이 순서가 이 함수의 전부다.
 *   1) **종류** — 오류에 실려 온 종류가 있으면 «그것으로 끝난다». 취소면 참,
 *      다른 종류면 거짓. 문면을 어떤 문장으로 바꿔도 판별이 안 깨진다.
 *   2) **문면** — 종류가 «없을 때만» 종전의 문자열 포함 검사로 떨어진다.
 *      종류가 없는 옛 오류 객체와, 문자열만 들고 있는 화면들을 위해 남긴다.
 *
 * 종류의 «인정 범위» 는 브리지가 정한다(`readAiFailureKind`). 여기서 「빈 문자열이
 * 아니면 종류」로 대충 보면, 오타난 값이 종류인 척 지나가 2차 문면 판별까지
 * 건너뛴다 — 사용자가 자기가 누른 그만두기에 빨간 배너를 보는 처음 문제로
 * 되돌아간다.
 *
 * 받는 것은 «문자열» 이거나 «오류 객체» 다. 인자를 넓히기만 했으므로 지금
 * 부르는 네 화면(문자열을 넘긴다)은 한 글자도 고칠 필요가 없다. `unknown` 인
 * 이유는 부르는 자리가 대개 `catch (e)` 라서다 — 옆 `readAiFailureKind` 와 같다.
 */
export function isUserStopped(source: unknown): boolean {
  if (!source) return false;
  // 1차 — 종류. 있으면 여기서 끝난다.
  const failure = readAiFailureKind(source);
  if (failure) return failure === USER_STOP_KIND;
  // 2차 — 문면.
  if (typeof source === "string") return source.includes(USER_STOP_MARK);
  if (typeof source !== "object") return false;
  const message = (source as { message?: unknown }).message;
  return typeof message === "string" && message.includes(USER_STOP_MARK);
}

// ─── 그만둔 뒤 안내 ─────────────────────────────────────────────────────────

export interface AiStoppedNoticeProps {
  style?: React.CSSProperties;
}

/**
 * 사용자가 그만두기를 누른 «뒤» 에 보이는 한 줄.
 * 무엇이 남았는지(=쓰던 내용)를 분명히 말한다.
 */
export function AiStoppedNotice({
  style,
}: AiStoppedNoticeProps): JSX.Element {
  return (
    <div
      role="status"
      data-testid="ai-stopped-notice"
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        background: "#f7f5f2",
        color: TEXT_MUTED,
        fontSize: 13,
        lineHeight: 1.6,
        padding: "10px 14px",
        marginBottom: 16,
        ...style,
      }}
    >
      AI를 그만뒀습니다. 쓰시던 내용은 그대로 있습니다 — 언제든 다시 시작할 수
      있습니다.
    </div>
  );
}

// ─── 대기 표시 ──────────────────────────────────────────────────────────────

export interface AiWaitBarProps {
  /**
   * 지금 무엇을 하는 중인지 사람 말 한 줄.
   * 예: "메모를 읽고 있습니다" / "목차를 짜고 있습니다".
   */
  label: string;
  /**
   * 그만두기를 눌렀을 때. useStreamingChat() 이 주는 cancel 을 그대로 넘긴다.
   */
  onCancel: () => void;
  /** 몇 초가 지나면 저절로 멈추는지. 기본 180초. */
  limitSecs?: number;
  /** 화면마다 다른 여백·너비만 바깥에서 조정한다. 생김새 자체는 바꾸지 않는다. */
  style?: React.CSSProperties;
  /** 테스트·디버그용 식별자. */
  testId?: string;
}

export function AiWaitBar({
  label,
  onCancel,
  limitSecs = DEFAULT_LIMIT_SECS,
  style,
  testId = "ai-wait-bar",
}: AiWaitBarProps): JSX.Element {
  // 경과 시간은 이 부품이 «스스로» 잰다 — 부르는 쪽이 초를 셀 필요가 없다.
  const startedAtRef = useRef<number>(Date.now());
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => {
      setElapsedSecs(
        Math.floor((Date.now() - startedAtRef.current) / 1000),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const showElapsed = elapsedSecs >= ELAPSED_REVEAL_SECS;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${BORDER}`,
        borderRadius: RADIUS,
        background: "rgba(31,122,74,0.06)",
        padding: "10px 14px",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* 왼쪽 — 무슨 일이 일어나는 중인지 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: TEXT,
            fontWeight: 500,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: ACCENT,
              flexShrink: 0,
            }}
          />
          <span>{label}</span>
        </div>

        {/* 아래 줄 — 5초 전에는 자리만 지키고, 그 뒤에 숫자를 보인다.
            (숫자가 나타날 때 화면이 튀지 않도록 줄 자체는 늘 있다) */}
        <div
          style={{
            marginTop: 4,
            marginLeft: 15,
            fontSize: 12,
            color: TEXT_MUTED,
            lineHeight: 1.5,
          }}
        >
          {showElapsed ? (
            <>
              {/* 매초 바뀌는 숫자는 눈으로만 본다 — 화면 낭독기가 1초마다
                  같은 말을 되풀이하면 오히려 방해가 된다. */}
              <span data-testid={`${testId}-elapsed`} aria-hidden="true">
                {formatDuration(elapsedSecs)}째 기다리는 중 ·{" "}
              </span>
              {/* 「언제 저절로 끝나는가」는 낭독 대상이다 — 한 번만 읽힌다. */}
              <span>{formatDuration(limitSecs)}이 지나면 저절로 멈춥니다</span>
            </>
          ) : (
            <span>잠시만 기다려 주세요. 길면 몇 분 걸립니다.</span>
          )}
        </div>
      </div>

      {/* 오른쪽 — 그만두기. 자리는 늘 같다(왼쪽 글자가 길어져도 움직이지 않는다) */}
      <button
        type="button"
        onClick={onCancel}
        data-testid={`${testId}-cancel`}
        aria-label="AI 그만두기"
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          borderRadius: RADIUS,
          border: `1px solid ${BORDER}`,
          background: "#fff",
          color: TEXT_MUTED,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        그만두기
      </button>
    </div>
  );
}
