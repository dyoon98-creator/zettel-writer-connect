// aiWaitBar.test.ts — 기다리는 동안 보이는 대기 표시의 «행동» 계약.
//
// 이 파일이 증명하려는 것 (E-026 대조: 「버튼이 보인다」 는 아무것도 잡지 못한다):
//   A. 진짜 AiWaitBar 를 진짜 DOM 에 그린다 — 문면·경과 시간·접근성.
//   B. 그 버튼을 진짜로 «클릭» 하면 진짜 useStreamingChat().cancel 이 돌고,
//      진행 중이던 호출의 AbortSignal 이 실제로 abort 되며, run() 이 끝난다.
//      (abort → 프로세스 종료까지는 tests/adapters/aiBridgeLifecycle.test.ts 가 이미 덮는다)
//   C. 네 화면이 그 배선을 실제로 하고 있다 — 원본 소스 계약.
//
// JSX 없이 React.createElement 로 그린다 (테스트 파일은 .ts).

import * as fs from "fs";
import * as path from "path";
import { act, createElement, useEffect, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import {
  AiStoppedNotice,
  AiWaitBar,
  DEFAULT_LIMIT_SECS,
  ELAPSED_REVEAL_SECS,
  formatDuration,
  isUserStopped,
} from "../../../src/studio/wizard/AiWaitBar";

// ─── useStreamingChat 이 부르는 바깥 세계만 가짜로 바꾼다 ────────────────────
// 훅 자체(취소 배선)는 진짜를 쓴다 — 그게 검사 대상이다.

const startedSignals: AbortSignal[] = [];

jest.mock("../../../src/studio/ai/streamingChat", () => ({
  extractDisplayText: (t: string) => t,
  startStreamingChat: (opts: { signal?: AbortSignal }) => {
    const signal = opts.signal as AbortSignal;
    startedSignals.push(signal);
    const aborted = new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    return {
      // 답이 통째로 올 때까지 아무것도 흘리지 않는 실제 codex 동작을 흉내낸다.
      tokens: async function* () {
        await aborted;
      },
      done: aborted.then(() => {
        throw new Error("사용자가 취소했습니다.");
      }),
      cancel: async () => {
        /* 이 테스트에서는 signal 경로만 쓴다 */
      },
    };
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { useStreamingChat } from "../../../src/studio/ai/useStreamingChat";

// ─── 렌더 도우미 ────────────────────────────────────────────────────────────

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function mount(el: ReactElement): void {
  act(() => {
    root.render(el);
  });
}

function q(testId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

beforeEach(() => {
  startedSignals.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  jest.useRealTimers();
});

// ─── A. 문면 ────────────────────────────────────────────────────────────────

describe("AiWaitBar — 사용자가 읽는 문면", () => {
  test("무슨 일이 일어나는 중인지 한 줄로 말한다", () => {
    mount(
      createElement(AiWaitBar, {
        label: "메모를 읽고 있습니다",
        onCancel: jest.fn(),
      }),
    );
    expect(q("ai-wait-bar")?.textContent).toContain("메모를 읽고 있습니다");
  });

  test("컴퓨터 용어를 쓰지 않는다", () => {
    mount(
      createElement(AiWaitBar, {
        label: "목차를 짜고 있습니다",
        onCancel: jest.fn(),
      }),
    );
    const text = q("ai-wait-bar")?.textContent ?? "";
    for (const jargon of [
      "스트리밍",
      "타임아웃",
      "프로세스",
      "토큰",
      "abort",
      "cancel",
    ]) {
      expect(text).not.toContain(jargon);
    }
  });

  test("처음 5초 동안은 숫자를 세지 않는다 — 짧은 기다림을 길게 만들지 않는다", () => {
    jest.useFakeTimers();
    mount(
      createElement(AiWaitBar, {
        label: "카드를 만들고 있습니다",
        onCancel: jest.fn(),
      }),
    );
    act(() => {
      jest.advanceTimersByTime((ELAPSED_REVEAL_SECS - 1) * 1000);
    });
    expect(q("ai-wait-bar-elapsed")).toBeNull();
    expect(q("ai-wait-bar")?.textContent).toContain("잠시만 기다려 주세요");
  });

  test("5초가 지나면 경과 시간과 «저절로 멈추는 때» 를 함께 보인다", () => {
    jest.useFakeTimers();
    mount(
      createElement(AiWaitBar, {
        label: "시놉시스를 쓰고 있습니다",
        onCancel: jest.fn(),
      }),
    );
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(q("ai-wait-bar-elapsed")?.textContent).toContain("5초째 기다리는 중");
    expect(q("ai-wait-bar")?.textContent).toContain(
      "3분이 지나면 저절로 멈춥니다",
    );
  });

  test("1분이 넘으면 분·초로 읽어 준다", () => {
    jest.useFakeTimers();
    mount(
      createElement(AiWaitBar, {
        label: "시놉시스를 쓰고 있습니다",
        onCancel: jest.fn(),
      }),
    );
    act(() => {
      jest.advanceTimersByTime(72_000);
    });
    expect(q("ai-wait-bar-elapsed")?.textContent).toContain(
      "1분 12초째 기다리는 중",
    );
  });

  test("한계 시간은 화면이 정하는 대로 문면에 반영된다", () => {
    jest.useFakeTimers();
    mount(
      createElement(AiWaitBar, {
        label: "점검하고 있습니다",
        onCancel: jest.fn(),
        limitSecs: 240,
      }),
    );
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(q("ai-wait-bar")?.textContent).toContain(
      "4분이 지나면 저절로 멈춥니다",
    );
  });

  test("마법사 네 화면의 기본 한계는 aiBridge 기본값(180초)과 같다", () => {
    expect(DEFAULT_LIMIT_SECS).toBe(180);
  });

  test("초 단위 숫자는 화면 낭독기에 매초 되풀이되지 않는다", () => {
    jest.useFakeTimers();
    mount(
      createElement(AiWaitBar, { label: "읽고 있습니다", onCancel: jest.fn() }),
    );
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    // 살아있음을 알리는 창(role=status)은 하나, 매초 바뀌는 숫자는 낭독 대상 밖.
    expect(q("ai-wait-bar")?.getAttribute("role")).toBe("status");
    expect(q("ai-wait-bar")?.getAttribute("aria-live")).toBe("polite");
    expect(q("ai-wait-bar-elapsed")?.getAttribute("aria-hidden")).toBe("true");
    // 반대로 «언제 저절로 끝나는가» 는 숨기지 않는다 — 한 번은 읽혀야 한다.
    expect(q("ai-wait-bar")?.textContent).toContain("저절로 멈춥니다");
  });

  test("그만두기 버튼은 이름과 종류가 분명하다", () => {
    mount(
      createElement(AiWaitBar, { label: "읽고 있습니다", onCancel: jest.fn() }),
    );
    const btn = q("ai-wait-bar-cancel") as HTMLButtonElement;
    expect(btn.textContent).toBe("그만두기");
    expect(btn.type).toBe("button");
    expect(btn.getAttribute("aria-label")).toContain("그만두기");
  });

  test("formatDuration — 초·분·분초", () => {
    expect(formatDuration(0)).toBe("0초");
    expect(formatDuration(59)).toBe("59초");
    expect(formatDuration(60)).toBe("1분");
    expect(formatDuration(72)).toBe("1분 12초");
    expect(formatDuration(180)).toBe("3분");
  });
});

describe("AiStoppedNotice — 그만둔 뒤 무엇이 남는지", () => {
  test("쓰던 내용이 그대로임을 말한다", () => {
    mount(createElement(AiStoppedNotice, null));
    const text = q("ai-stopped-notice")?.textContent ?? "";
    expect(text).toContain("그만뒀습니다");
    expect(text).toContain("쓰시던 내용은 그대로 있습니다");
  });

  test("사용자의 그만두기는 «고장» 과 구별된다", () => {
    expect(isUserStopped("사용자가 취소했습니다.")).toBe(true);
    expect(isUserStopped("AI 호출 시간 초과 (180s)")).toBe(false);
    expect(isUserStopped(null)).toBe(false);
    expect(isUserStopped("")).toBe(false);
  });
});

// ─── C1. 문면이 바뀌어도 판별이 안 깨진다 ───────────────────────────────────
//
// 이 묶음이 이 발주의 합격선이다. 종전 판별은 `"사용자가 취소했습니다"` 라는
// «한국어 문장» 을 문자열로 찾는 것뿐이었다. 그 문장을 한 글자만 고치면 판별이
// 조용히 깨지고, 사용자는 자기가 누른 그만두기에 빨간 오류 배너를 다시 본다.
// 이제는 오류에 실린 «종류» 를 먼저 보므로 문장을 통째로 갈아도 안 깨진다.

/** 브리지가 던지는 오류의 모양(문면은 자리마다 다르다). */
function bridgeError(message: string, failure?: string): unknown {
  const e = new Error(message) as Error & { kind: string; failure?: string };
  e.name = "AiInvocationError";
  e.kind = "ai-error";
  if (failure) e.failure = failure;
  return e;
}

describe("C1 — 취소 판별이 «문면» 이 아니라 «종류» 로 갈린다", () => {
  test("취소 문면을 아예 다른 문장으로 바꿔도 여전히 취소로 판별한다", () => {
    // 아래 셋 중 어느 것도 종전의 표시 문구를 담고 있지 «않다».
    for (const sentence of [
      "AI를 그만뒀습니다 (사용자 요청)",
      "중단됨",
      "",
    ]) {
      expect(isUserStopped(bridgeError(sentence, "canceled"))).toBe(true);
    }
  });

  test("종류가 문면을 «이긴다» — 문면이 취소처럼 보여도 종류가 아니면 고장이다", () => {
    const timedOut = bridgeError("사용자가 취소했습니다.", "timeout");
    expect(isUserStopped(timedOut)).toBe(false);
  });

  test("종류가 «없는» 옛 오류 객체는 종전대로 문면으로 떨어진다 (더하되 빼지 않음)", () => {
    expect(isUserStopped(bridgeError("사용자가 취소했습니다."))).toBe(true);
    expect(isUserStopped(bridgeError("AI 호출 시간 초과 (180s)"))).toBe(false);
  });

  test("화면들이 지금 넘기는 «문자열» 도 그대로 받는다 (겉모양 유지)", () => {
    // 네 화면은 useStreamingChat 의 `error`(문자열)를 넘긴다. 인자 모양을
    // 넓히기만 했으므로 그 자리는 손댈 필요가 없다.
    expect(isUserStopped("AI 호출 실패: 사용자가 취소했습니다.")).toBe(true);
    expect(isUserStopped("AI 호출 실패 (CLI 종료 코드 2)")).toBe(false);
    expect(isUserStopped(undefined)).toBe(false);
  });

  test("모르는 값이 취소인 척 지나가지 못한다", () => {
    expect(isUserStopped(bridgeError("무엇이든", "cancelled"))).toBe(false);
    expect(isUserStopped({ failure: "canceled" })).toBe(true);
    expect(isUserStopped({})).toBe(false);
  });
});

// ─── B. 눌렀을 때 진짜로 멈추는가 ───────────────────────────────────────────

/**
 * 네 화면이 하는 배선(F4)을 그대로 한 최소 화면.
 * useStreamingChat 도 AiWaitBar 도 «진짜» 다 — 가짜는 CLI 를 부르는 바깥뿐이다.
 * 이 배선을 네 화면이 실제로 하고 있다는 것은 아래 C(소스 계약)가 증명한다.
 */
function CancelHarness(props: {
  onSettled: (err: unknown) => void;
}): ReactElement {
  const { run, isStreaming, cancel, error } = useStreamingChat();

  useEffect(() => {
    void run({ messages: [{ role: "user", content: "메모" }] }).then(
      () => props.onSettled(null),
      (e) => props.onSettled(e),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isStreaming) {
    return createElement(AiWaitBar, {
      label: "메모를 읽고 있습니다",
      onCancel: cancel,
    });
  }
  return createElement(
    "div",
    { "data-testid": "idle" },
    error ? `멈춤: ${error}` : "대기 없음",
  );
}

describe("그만두기 — 눌렀을 때 진행 중인 호출이 실제로 멈춘다", () => {
  test("클릭 → cancel → 진행 중이던 호출이 abort 되고 대기 표시가 사라진다", async () => {
    const settled = jest.fn();

    await act(async () => {
      root.render(createElement(CancelHarness, { onSettled: settled }));
    });

    // 호출이 시작됐고 대기 표시가 떠 있다.
    expect(startedSignals).toHaveLength(1);
    expect(startedSignals[0].aborted).toBe(false);
    expect(q("ai-wait-bar")).not.toBeNull();
    expect(settled).not.toHaveBeenCalled();

    // 사용자가 «그만두기» 를 누른다 — 진짜 DOM 클릭.
    const btn = q("ai-wait-bar-cancel") as HTMLButtonElement;
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // 1) 진행 중이던 호출이 실제로 끊겼다.
    expect(startedSignals[0].aborted).toBe(true);
    // 2) run() 이 끝났다 — 화면이 영원히 기다리지 않는다.
    expect(settled).toHaveBeenCalledTimes(1);
    expect(String(settled.mock.calls[0][0])).toContain("사용자가 취소했습니다");
    // 3) 대기 표시가 사라지고, 그만둔 사실이 남는다.
    expect(q("ai-wait-bar")).toBeNull();
    expect(q("idle")?.textContent).toContain("사용자가 취소했습니다");
  });

  test("누르지 않으면 abort 되지 않는다 (버튼이 원인임을 확인)", async () => {
    const settled = jest.fn();
    await act(async () => {
      root.render(createElement(CancelHarness, { onSettled: settled }));
    });
    expect(startedSignals[0].aborted).toBe(false);
    expect(settled).not.toHaveBeenCalled();
  });
});

// ─── C. 네 화면이 실제로 그 배선을 하는가 ───────────────────────────────────

const CONCEPT_DIR = path.resolve(
  __dirname,
  "../../../src/studio/wizard/concept",
);

interface ScreenCase {
  file: string;
  /** 그 화면이 AiWaitBar 에 넘겨야 하는 취소 함수 표현식 */
  cancelExprs: string[];
  /** 그 표현식의 출처가 useStreamingChat 임을 보이는 선언 */
  hookDecls: RegExp[];
}

const SCREENS: ScreenCase[] = [
  {
    file: "Step2Memo.tsx",
    cancelExprs: ["onCancel={cancel}"],
    hookDecls: [/const\s*\{[^}]*\bcancel\b[^}]*\}\s*=\s*useStreamingChat\(\)/],
  },
  {
    file: "Step3Synopsis.tsx",
    cancelExprs: ["onCancel={cancel}"],
    hookDecls: [/const\s*\{[^}]*\bcancel\b[^}]*\}\s*=\s*useStreamingChat\(\)/],
  },
  {
    file: "Step4Outline.tsx",
    cancelExprs: ["onCancel={streaming.cancel}", "onCancel={singleStreaming.cancel}"],
    hookDecls: [
      /const\s+streaming\s*=\s*useStreamingChat\(\)/,
      /const\s+singleStreaming\s*=\s*useStreamingChat\(\)/,
    ],
  },
  {
    file: "Step5Treatment.tsx",
    cancelExprs: ["onCancel={cancel}"],
    hookDecls: [/const\s*\{[^}]*\bcancel\b[^}]*\}\s*=\s*useStreamingChat\(\)/],
  },
];

describe("네 화면 소스 계약 — 하나도 빠뜨리지 않는다", () => {
  const sources = new Map<string, string>();
  beforeAll(() => {
    for (const s of SCREENS) {
      sources.set(s.file, fs.readFileSync(path.join(CONCEPT_DIR, s.file), "utf-8"));
    }
  });

  for (const screen of SCREENS) {
    describe(screen.file, () => {
      test("공용 대기 표시를 가져다 쓴다 (제 것을 따로 만들지 않는다)", () => {
        const src = sources.get(screen.file) as string;
        expect(src).toMatch(/from\s+"\.\.\/AiWaitBar"/);
        // 이름 뒤 경계까지 본다 — "<AiWaitBarSomethingElse" 를 통과시키지 않는다.
        expect(src).toMatch(/<AiWaitBar[\s/>]/);
      });

      test("모든 대기 표시에 취소 함수와 사람 말 label 이 함께 붙어 있다", () => {
        const src = sources.get(screen.file) as string;
        const bars = src.match(/<AiWaitBar[\s/>][\s\S]*?\/>/g) ?? [];
        expect(bars.length).toBeGreaterThan(0);
        for (const bar of bars) {
          expect(bar).toContain("label=");
          expect(bar).toMatch(/onCancel=\{[a-zA-Z.]+\}/); // 빈 함수 배선 금지
          expect(bar).not.toMatch(/onCancel=\{\s*\(\s*\)\s*=>/);
        }
      });

      test("그 취소 함수는 useStreamingChat 이 준 것이다", () => {
        const src = sources.get(screen.file) as string;
        for (const decl of screen.hookDecls) {
          expect(src).toMatch(decl);
        }
        for (const expr of screen.cancelExprs) {
          expect(src).toContain(expr);
        }
      });

      test("사용자가 그만둔 것을 빨간 오류로 보여주지 않는다", () => {
        const src = sources.get(screen.file) as string;
        expect(src).toContain("isUserStopped");
        expect(src).toContain("<AiStoppedNotice");
      });
    });
  }

  test("네 화면 모두가 붙었다", () => {
    const attached = SCREENS.filter((s) =>
      /<AiWaitBar[\s/>]/.test(sources.get(s.file) as string),
    );
    expect(attached).toHaveLength(4);
  });
});
