// wizardAskLifecycle.test.ts — 「아무것도 안 눌렀는데 «사용자가 취소했습니다»」의 계약.
//                               (대표 실사용 결함 · 2026-08-31)
//
// 무엇이 잘못돼 있었나:
//   기획 인터뷰의 질문 요청은 모듈 전역 AbortController 하나가 소유했는데, 새 요청이
//   그것을 «abort 하지도 기억하지도 않고» 덮어썼다. 그래서
//     (1) 두 요청이 나란히 끝나면 같은 질문이 화면에 두 번 붙고,
//     (2) 어느 경로든 abort 를 걸면 «주인을 잃은» 앞 요청이 끊기는데,
//     (3) 그 끊김이 「사용자가 취소했습니다」라는 빨간 오류로 사용자에게 보였다.
//   사용자는 아무것도 누르지 않았다.
//
// 이 파일이 못박는 것:
//   C12 한 번의 사용자 행동에 질문 요청은 «한 번» 만 나간다. 겹쳐도 질문은 하나만 붙는다.
//   C13 밀려난 요청의 끊김은 «오류로 보이지 않는다». 사용자가 그만둔 경우는 구별된다.
//   C16 컨셉 마법사 경로는 이 변경에 닿지 않는다.

import * as fs from "fs";
import * as path from "path";

// wizardStore → CLIWizardBridge 는 `./prompts/*.md?raw` 를 import 한다. esbuild 전용
// 구문이라 jest 가 풀지 못하고, 이 발주는 jest.config.cjs 를 못 고친다.
jest.mock("../../../src/studio/wizard/CLIWizardBridge", () => ({
  CLIWizardBridge: class {},
}));

const noticeError = jest.fn();
const noticeInfo = jest.fn();
const noticeWarn = jest.fn();

jest.mock("../../../src/studio/noticeAdapter", () => ({
  tauriNoticeAdapter: {
    error: (...a: unknown[]) => noticeError(...a),
    info: (...a: unknown[]) => noticeInfo(...a),
    warn: (...a: unknown[]) => noticeWarn(...a),
  },
}));

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useWizardStore } from "../../../src/studio/wizard/wizardStore";
import { WizardChat } from "../../../src/studio/wizard/WizardChat";

// ─── 손으로 결말을 정하는 가짜 다리 ─────────────────────────────────────────

interface Deferred {
  promise: Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface AskCall {
  signal: AbortSignal | undefined;
  d: Deferred;
}

let calls: AskCall[] = [];

/** 실제 CLI 처럼 «signal 이 끊기면 즉시 취소 오류» 를 내는 가짜 다리. */
function makeBridge(): { askNextQuestion: jest.Mock } {
  return {
    askNextQuestion: jest.fn((_session: unknown, opts?: { signal?: AbortSignal }) => {
      const d = deferred();
      const signal = opts?.signal;
      calls.push({ signal, d });
      if (signal) {
        if (signal.aborted) {
          d.reject(new Error("사용자가 취소했습니다."));
        } else {
          signal.addEventListener(
            "abort",
            () => d.reject(new Error("사용자가 취소했습니다.")),
            { once: true },
          );
        }
      }
      return d.promise;
    }),
  };
}

/**
 * abort 를 «무시하고» 끝내 답을 돌려주는 다리.
 * 실제 CLI 는 응답이 이미 날아오는 중이면 끊어도 답이 도착한다. 「늦게 온 답을
 * 화면에 붙이지 않는다」는 장치는 그때만 시험된다.
 */
function makeStubbornBridge(): { askNextQuestion: jest.Mock } {
  return {
    askNextQuestion: jest.fn((_s: unknown, opts?: { signal?: AbortSignal }) => {
      const d = deferred();
      calls.push({ signal: opts?.signal, d });
      return d.promise;
    }),
  };
}

function question(text: string): Record<string, unknown> {
  return { question: text, format: "open" };
}

/** 떠 있는 promise 들이 정착할 때까지 microtask 를 흘린다. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

function assistantMessages(): string[] {
  const engine = useWizardStore.getState().engineRef;
  if (!engine) return [];
  return engine.session.messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.content);
}

beforeEach(() => {
  calls = [];
  noticeError.mockClear();
  noticeInfo.mockClear();
  noticeWarn.mockClear();
});

afterEach(() => {
  useWizardStore.getState().close();
});

// ─── C12. 한 번의 행동 = 한 번의 요청, 질문도 하나 ──────────────────────────

describe("C12 — 질문이 두 번 붙지 않는다", () => {
  test("마법사를 시작하면 질문 요청은 «한 번» 만 나간다", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();

    expect(bridge.askNextQuestion).toHaveBeenCalledTimes(1);

    calls[0].d.resolve(question("이 메모를 쓰게 된 계기가 무엇입니까?"));
    await settle();

    expect(assistantMessages()).toHaveLength(1);
  });

  test("요청이 겹쳐도 화면에 붙는 질문은 «하나» 다 (앞 요청은 밀려난다)", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();
    expect(calls).toHaveLength(1);

    // 첫 요청이 아직 도는 중에 다른 경로가 새 질문을 부른다.
    useWizardStore.getState().revisitStage("motive");
    await settle();
    expect(calls).toHaveLength(2);

    // 앞 요청은 실제로 끊겼다 — 참조만 버려지지 않았다.
    expect(calls[0].signal?.aborted).toBe(true);

    // 늦게라도 앞 요청의 답이 도착한들 화면에 붙지 않는다.
    calls[0].d.resolve(question("이 메모를 쓰게 된 계기가 무엇입니까?"));
    calls[1].d.resolve(question("이 메모를 지금 쓰게 된 계기가 무엇입니까?"));
    await settle();

    const msgs = assistantMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("지금 쓰게 된");
  });

  test("밀려난 요청의 답이 «늦게 도착해도» 화면에 붙지 않는다", async () => {
    // 이것이 대표 스크린샷의 「같은 질문 두 개」를 만든 경로다.
    const bridge = makeStubbornBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();
    useWizardStore.getState().revisitStage("motive");
    await settle();
    expect(calls).toHaveLength(2);

    // 뒤 요청이 먼저 정착하고, 밀려난 앞 요청의 답이 «그 뒤에» 도착한다.
    calls[1].d.resolve(question("이 메모를 지금 쓰게 된 계기가 무엇입니까?"));
    await settle();
    calls[0].d.resolve(question("이 메모를 쓰게 된 계기가 무엇입니까?"));
    await settle();

    const msgs = assistantMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("지금 쓰게 된");
  });
});

// ─── C13·C16. 끊김 세 갈래 ──────────────────────────────────────────────────

describe("C13 — 밀려난 끊김은 사용자에게 오류로 보이지 않는다", () => {
  test("겹친 요청의 앞쪽이 끊겨도 빨간 오류가 뜨지 않는다", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();
    useWizardStore.getState().revisitStage("motive");
    await settle();

    // 앞 요청은 끊겨 「사용자가 취소했습니다」로 실패한다 — 그러나 사용자는
    // 아무것도 누르지 않았다. 화면에 오류가 뜨면 안 된다.
    expect(noticeError).not.toHaveBeenCalled();
    expect(noticeInfo).not.toHaveBeenCalled();

    calls[1].d.resolve(question("두 번째 질문"));
    await settle();
    expect(noticeError).not.toHaveBeenCalled();
  });

  test("사용자가 «직접» 그만두면 그것은 구별된다 (조용히 삼키지 않는다)", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();

    // WizardChat 의 Esc 가 부르는 바로 그 경로.
    useWizardStore.getState().cancelStream();
    await settle();

    expect(calls[0].signal?.aborted).toBe(true);
    // 고장이 아니므로 빨간 오류가 아니라 담담한 안내다.
    expect(noticeError).not.toHaveBeenCalled();
    expect(noticeInfo).toHaveBeenCalledTimes(1);
    expect(String(noticeInfo.mock.calls[0][0])).toContain("그만뒀습니다");
  });

  test("진짜 실패는 여전히 오류로 보인다 (전부 삼켜 버리지 않았다)", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();

    // 끊긴 것이 아니라 정말로 실패한 경우.
    calls[0].d.reject(new Error("AI 프로그램을 찾지 못했습니다"));
    await settle();

    expect(noticeError).toHaveBeenCalledTimes(1);
    expect(String(noticeError.mock.calls[0][0])).toContain(
      "AI 프로그램을 찾지 못했습니다",
    );
  });

  test("밀려난 요청은 대기 표시를 꺼뜨리지 않는다 (뒤 요청이 이어받는다)", async () => {
    const bridge = makeBridge();
    useWizardStore.getState().start({ bridge: bridge as never });
    await settle();
    useWizardStore.getState().revisitStage("motive");
    await settle();

    // 앞 요청이 끊겨도 화면은 여전히 «기다리는 중» 이어야 한다.
    expect(useWizardStore.getState().isAwaitingQuestion).toBe(true);
  });
});

// ─── 소스 계약 ──────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../../../src");
const read = (rel: string): string =>
  fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("소스 계약 — 근원이 닫혔는가", () => {
  const store = () => read("studio/wizard/wizardStore.ts");

  test("새 요청은 앞 요청을 «말없이 버리지» 않는다", () => {
    // 결함의 정체: activeAbortController 를 abort 없이 덮어쓰기.
    expect(store()).toContain("function supersedeActiveAsk()");
    expect(store()).toMatch(/supersedeActiveAsk\(\);\s*\n\s*const myTurn/);
  });

  test("「밀려남」과 「사용자가 그만둠」이 서로 다른 경로다", () => {
    const s = store();
    expect(s).toContain("userStoppedTurn");
    // 내부 전환은 cancelStream() 을 부르지 않는다 — 그것은 사용자 뜻이다.
    expect(s).not.toMatch(/\/\/ 진행 중 스트림 중지[\s\S]{0,40}get\(\)\.cancelStream\(\)/);
  });

  test("끊긴 호출을 재시도하지 않는다 (오류 세 줄의 정체)", () => {
    const bridge = read("studio/wizard/CLIWizardBridge.ts");
    expect(bridge).toContain('readAiFailureKind(e) === "canceled"');
    expect(bridge).toContain("opts?.signal?.aborted");
  });

  test("원인을 모르는데 「다른 모델을 써 보라」고 하지 않는다", () => {
    const bridge = read("studio/wizard/CLIWizardBridge.ts");
    // 낡은 모델 이름을 예시로 들던 안내를 걷어냈다.
    expect(bridge).not.toContain("gpt-5-codex");
    // 원인별 안내는 종류를 보고 고른다.
    expect(bridge).toContain("hintFor");
  });
});

describe("C16 — 컨셉 마법사 경로는 건드리지 않았다", () => {
  test("컨셉 마법사 스토어에는 여전히 abort 소유권 문제가 «없다»", () => {
    const concept = read("studio/state/conceptWizardStore.ts");
    // 그쪽은 컴포넌트(useStreamingChat)가 각자 소유한다 — 전역 controller 가 없다.
    expect(concept).not.toContain("AbortController");
    expect(concept).not.toContain("supersedeActiveAsk");
  });

  test("이 발주의 변경은 기획 인터뷰 쪽에만 있다", () => {
    expect(read("studio/wizard/wizardStore.ts")).toContain("supersedeActiveAsk");
  });
});


// ─── C14. 「직접 입력」의 [답변] 버튼이 보이고 눌린다 ────────────────────────
//
// 증상: 「직접 입력」을 고르고 글을 넣었는데 [답변] 버튼이 «안 보인다».
//       코드에도 있고 CSS 에도 있는데 화면에 없다.
// 원인: 대화 흐름(.wizard-thread, overflow-y:auto) «아래쪽에» 답변칸과 버튼이
//       새로 펼쳐지는데, 자동 스크롤이 messages/streaming 만 보고 있어서 따라가지
//       않았다. 버튼은 화면 «밖» 에 있었다.

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("C14 — 「직접 입력」 답변 버튼", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sendSpy: jest.Mock;

  const OPTIONS = ["새 딜 검토", "후속 투자 근거", "직접 입력"];

  function q2(testId: string): HTMLElement | null {
    return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  async function mountChoice(): Promise<void> {
    sendSpy = jest.fn(async () => undefined);
    useWizardStore.setState({
      engineRef: null,
      isStreaming: false,
      streamingBuffer: "",
      phase: "interviewing",
      isAwaitingQuestion: false,
      currentQuestion: {
        question: "이 메모를 쓰게 된 계기는 무엇입니까?",
        format: "choice",
        options: OPTIONS,
      },
      sendUserMessage: sendSpy,
      rev: 1,
    } as unknown as Partial<ReturnType<typeof useWizardStore.getState>>);

    await act(async () => {
      root.render(createElement(WizardChat, null) as ReactElement);
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("「직접 입력」을 고르면 답변칸과 [답변] 버튼이 실제로 나타난다", async () => {
    await mountChoice();
    expect(q2("wizard-choice")).not.toBeNull();
    // 고르기 전에는 버튼이 없다 (그게 정상).
    expect(q2("wizard-choice-submit")).toBeNull();

    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    expect(radios).toHaveLength(OPTIONS.length);

    await act(async () => {
      radios[OPTIONS.length - 1].click(); // 「직접 입력」
    });

    const btn = q2("wizard-choice-submit") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("답변");
    // 숨겨져 있지 않다 — 「안 보인다」의 원인이 CSS 가 아님을 못박는다.
    expect(btn.style.display).not.toBe("none");
    expect(btn.style.visibility).not.toBe("hidden");
    expect(btn.hidden).toBe(false);
  });

  test("글자를 넣으면 눌리는 상태가 되고, 진짜 클릭이 실제로 답을 보낸다", async () => {
    await mountChoice();
    const radios = container.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    await act(async () => {
      radios[OPTIONS.length - 1].click();
    });

    const btn = q2("wizard-choice-submit") as HTMLButtonElement;
    // 아직 아무것도 안 썼으니 못 누른다.
    expect(btn.disabled).toBe(true);

    const ta = container.querySelector(
      "textarea.wizard-choice-other",
    ) as HTMLTextAreaElement;
    expect(ta).not.toBeNull();

    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set as (v: string) => void;
    await act(async () => {
      setter.call(ta, "작년에 놓친 딜이 계속 걸린다");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // 이제 눌린다.
    const btn2 = q2("wizard-choice-submit") as HTMLButtonElement;
    expect(btn2.disabled).toBe(false);

    await act(async () => {
      btn2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith(
      "직접 입력: 작년에 놓친 딜이 계속 걸린다",
    );
  });

  test("펼쳐진 답변칸이 화면 밖에 남지 않게 스크롤이 따라간다", () => {
    const src = fs.readFileSync(
      path.join(SRC, "studio/wizard/WizardChat.tsx"),
      "utf-8",
    );
    // 자동 스크롤이 «고른 항목» 과 «직접 입력 글자» 를 함께 본다.
    expect(src).toMatch(
      /\[messages\.length, streamingBuffer, isStreaming, selectedChoice, otherDraft\]/,
    );
  });
});
