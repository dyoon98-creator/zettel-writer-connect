// imeSend.test.ts — 「한글로 쓰다가 Cmd+Enter 를 눌러도 전송이 안 된다」의 행동 계약.
//                    (대표 실사용 결함 · 2026-08-31)
//
// 이 파일이 증명하려는 것 (E-026 대조: 「흉내 낸 객체를 넣었더니 핸들러가 불렸다」는
// 아무것도 증명하지 않는다):
//
//   A. 진짜 화면을 진짜 DOM 에 그리고, **한글 조합 중 상태를 실제로 실은 진짜
//      KeyboardEvent** 를 보낸다. 그 이벤트가 정말 조합 중 모양인지(=jsdom 이
//      isComposing/keyCode 를 실어 주는지)부터 먼저 단언한다 — 시험 도구가 거짓말을
//      하면 그 아래 모든 초록이 무의미하다.
//   B. 그 상태에서 «전송이 실제로 일어난다» — 버튼을 누르지 않고, 화면 상태가
//      실제로 바뀌는 것으로 확인한다.
//   C. 조합이 아닐 때·Ctrl 일 때도 되고, 맨 Enter 로는 «안» 된다(줄바꿈을 뺏지 않는다).
//   D. 두 화면(Step2Concept · WizardChat)이 함께 고쳐졌고 갈라지지 못한다.
//   E. 앞 발주가 고친 Esc 그만두기 경로가 그대로 산다.
//
// JSX 없이 React.createElement 로 그린다 (테스트 파일은 .ts).

import * as fs from "fs";
import * as path from "path";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

// ─── 바깥 세계만 가짜로 ─────────────────────────────────────────────────────

const startedSignals: AbortSignal[] = [];

jest.mock("../../../src/studio/ai/streamingChat", () => ({
  extractDisplayText: (t: string) => t,
  buildChatPrompt: () => "",
  startStreamingChat: (opts: { signal?: AbortSignal }) => {
    const signal = opts.signal as AbortSignal;
    startedSignals.push(signal);
    const aborted = new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
    return {
      tokens: async function* () {
        await aborted;
      },
      done: aborted.then(() => {
        throw new Error("사용자가 취소했습니다.");
      }),
      cancel: async () => undefined,
    };
  },
}));

jest.mock("../../../src/studio/vaultAdapter", () => ({
  fetchNotesForContext: async () => ({ context: "", notes: [] }),
  listVaultNotes: async () => [] as string[],
  tauriVaultAdapter: {},
}));

jest.mock(
  "../../../src/studio/wizard/concept/conceptSessionPersist",
  () => ({
    saveSession: async () => undefined,
    listSessions: async () => [],
    deleteSession: async () => undefined,
  }),
);

// wizardStore → CLIWizardBridge 는 `./prompts/*.md?raw` 를 import 한다. 그것은
// esbuild 전용 구문이라 jest 가 풀지 못하고, 이 발주는 jest.config.cjs 를 못 고친다.
// 이 테스트가 보는 것은 «키 처리와 전송 배선» 이지 프롬프트 파일이 아니므로,
// 그 경계만 가짜로 막는다.
jest.mock("../../../src/studio/wizard/CLIWizardBridge", () => ({
  CLIWizardBridge: class {},
}));

import { useConceptWizardStore } from "../../../src/studio/state/conceptWizardStore";
import { useWizardStore } from "../../../src/studio/wizard/wizardStore";
import { Step2Concept } from "../../../src/studio/wizard/concept/Step2Concept";
import { WizardChat } from "../../../src/studio/wizard/WizardChat";

// ─── 렌더 도우미 ────────────────────────────────────────────────────────────

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function q(testId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function click(el: HTMLElement): Promise<void> {
  return act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * 사람이 실제로 타자를 친 것과 같은 경로로 입력칸을 채운다.
 * (React 가 붙여 둔 value setter 를 우회해 값을 넣고 진짜 input 이벤트를 보낸다 —
 *  이렇게 해야 controlled textarea 의 onChange 가 실제로 돈다.)
 */
function type(el: HTMLTextAreaElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set as (v: string) => void;
  return act(async () => {
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** React 상태를 «건너뛰고» 화면에만 글자를 넣는다 — 조합 중 상태 지연 재현. */
function typeWithoutNotifyingReact(el: HTMLTextAreaElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set as (v: string) => void;
  setter.call(el, text);
}

interface KeyShape {
  key: string;
  code?: string;
  keyCode?: number;
  isComposing?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

function makeKeyEvent(shape: KeyShape): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: shape.key,
    code: shape.code ?? "",
    keyCode: shape.keyCode,
    // `isComposing` 은 KeyboardEventInit 의 정식 멤버다.
    isComposing: shape.isComposing ?? false,
    metaKey: shape.metaKey ?? false,
    ctrlKey: shape.ctrlKey ?? false,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit);
}

function press(el: HTMLElement, shape: KeyShape): Promise<void> {
  return act(async () => {
    el.dispatchEvent(makeKeyEvent(shape));
  });
}

/**
 * macOS Chromium 이 «한글 조합 중» 에 보내는 keydown 의 모양.
 * 조합 중에는 논리 키(`key`)가 IME 에게 먹혀 "Process" 로 오고 keyCode 는 229 다.
 * 물리 키(`code`)만 그대로 "Enter" 로 남는다 — 이것이 이 결함의 정체다.
 */
const COMPOSING_CMD_ENTER: KeyShape = {
  key: "Process",
  code: "Enter",
  keyCode: 229,
  isComposing: true,
  metaKey: true,
};

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
  useConceptWizardStore.setState({
    session: null,
    isOpen: false,
    pausedForBinder: false,
  });
  jest.useRealTimers();
});

// ─── A. 시험 도구부터 검사한다 ──────────────────────────────────────────────

describe("시험 도구 자체 검사 — 조합 중 이벤트를 «진짜로» 만들 수 있는가", () => {
  test("보내는 KeyboardEvent 가 실제로 조합 중 모양을 싣고 있다", () => {
    const e = makeKeyEvent(COMPOSING_CMD_ENTER);
    // 이 셋이 거짓이면 아래 모든 초록은 아무것도 증명하지 못한다.
    expect(e.isComposing).toBe(true);
    expect(e.keyCode).toBe(229);
    expect(e.key).toBe("Process");
    expect(e.code).toBe("Enter");
    expect(e.metaKey).toBe(true);
    // 그리고 «옛 코드가 보던 축» 은 실제로 빗나간다 — 이것이 결함의 원인이다.
    expect(e.key === "Enter").toBe(false);
  });
});

// ─── B~C. 컨셉 대화 화면 (대표가 겪은 화면) ─────────────────────────────────

async function mountStep2(): Promise<HTMLTextAreaElement> {
  useConceptWizardStore.getState().start({
    seed: "아이의 첫 등교를 쓰고 싶다",
    tone: "column-narrative",
    genre: "column-essay",
    attachedNotes: [],
  });
  await act(async () => {
    root.render(createElement(Step2Concept, null) as ReactElement);
  });
  // 마운트하면 첫 호출이 자동으로 돈다. 답을 «보내려면» 먼저 그것이 끝나야 한다
  // (진행 중에는 입력칸이 꺼진다). 사용자가 그만두기를 누른 상태에서 이어 쓴다.
  await click(q("concept-wait-bar-cancel") as HTMLButtonElement);
  const ta = q("concept-input") as HTMLTextAreaElement;
  expect(ta.disabled).toBe(false);
  return ta;
}

function sentMessages(): string[] {
  const s = useConceptWizardStore.getState().session;
  return (s?.conversation ?? [])
    .filter((m) => m.role === "user")
    .map((m) => m.content);
}

describe("컨셉 대화 화면 — 한글 조합 중 Cmd+Enter (C6)", () => {
  test("조합 중에도 전송된다 — 버튼을 누르지 않는다", async () => {
    const ta = await mountStep2();
    await type(ta, "아이가 교문 앞에서 뒤를 돌아봤다");

    const before = sentMessages().length;
    await press(ta, COMPOSING_CMD_ENTER);

    const after = sentMessages();
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toBe("아이가 교문 앞에서 뒤를 돌아봤다");
    // 화면도 실제로 답을 기다리는 상태로 넘어간다.
    expect(q("concept-wait-bar")).not.toBeNull();
  });

  test("조합이 아닐 때(영문 등)도 그대로 된다 — 더하되 빼지 않았다", async () => {
    const ta = await mountStep2();
    await type(ta, "plain enter path");
    const before = sentMessages().length;
    await press(ta, { key: "Enter", code: "Enter", keyCode: 13, metaKey: true });
    expect(sentMessages().length).toBe(before + 1);
    expect(sentMessages().pop()).toBe("plain enter path");
  });

  test("Ctrl+Enter 도 된다 (윈도우·리눅스)", async () => {
    const ta = await mountStep2();
    await type(ta, "윈도우에서 보냅니다");
    const before = sentMessages().length;
    await press(ta, { key: "Enter", code: "Enter", keyCode: 13, ctrlKey: true });
    expect(sentMessages().length).toBe(before + 1);
  });

  test("맨 Enter 로는 보내지 않는다 — 줄바꿈을 빼앗지 않는다", async () => {
    const ta = await mountStep2();
    await type(ta, "아직 쓰는 중");
    const before = sentMessages().length;
    await press(ta, { key: "Enter", code: "Enter", keyCode: 13 });
    // 조합 중 맨 Enter(=음절 확정)도 마찬가지로 아무 일이 없어야 한다.
    await press(ta, { key: "Process", code: "Enter", keyCode: 229, isComposing: true });
    expect(sentMessages().length).toBe(before);
  });

  test("조합 때문에 마지막 글자가 빠지지 않는다 — 화면에 보이는 문장이 그대로 간다", async () => {
    const ta = await mountStep2();
    await type(ta, "돌아봤");
    // 조합 중이라 React 상태가 아직 못 따라온 상황을 그대로 재현한다.
    typeWithoutNotifyingReact(ta, "돌아봤다");

    const before = sentMessages().length;
    await press(ta, COMPOSING_CMD_ENTER);

    expect(sentMessages().length).toBe(before + 1);
    // 「돌아봤」이 아니라 「돌아봤다」가 가야 한다.
    expect(sentMessages().pop()).toBe("돌아봤다");
  });

  test("빈 입력칸에서는 아무 일도 없다", async () => {
    const ta = await mountStep2();
    const before = sentMessages().length;
    await press(ta, COMPOSING_CMD_ENTER);
    expect(sentMessages().length).toBe(before);
  });
});

// ─── E. 앞 발주가 고친 Esc 그만두기가 그대로 산다 ───────────────────────────

describe("Esc 그만두기 경로는 그대로다 (앞 발주 회귀 방지)", () => {
  test("답을 만드는 동안 Esc 는 여전히 멈춘다", async () => {
    useConceptWizardStore.getState().start({
      seed: "시드",
      tone: "column-narrative",
      genre: "column-essay",
      attachedNotes: [],
    });
    await act(async () => {
      root.render(createElement(Step2Concept, null) as ReactElement);
    });
    expect(startedSignals[0].aborted).toBe(false);
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(startedSignals[0].aborted).toBe(true);
  });
});

// ─── D. 인터뷰 마법사 화면도 함께 고쳤다 ────────────────────────────────────

describe("인터뷰 마법사 화면 — 같은 결함, 같은 고침 (C6)", () => {
  let sendSpy: jest.Mock;

  async function mountWizardChat(): Promise<HTMLTextAreaElement> {
    sendSpy = jest.fn(async () => undefined);
    useWizardStore.setState({
      engineRef: null,
      isStreaming: false,
      streamingBuffer: "",
      phase: "interviewing",
      currentQuestion: null,
      isAwaitingQuestion: false,
      sendUserMessage: sendSpy,
      rev: 0,
    } as unknown as Partial<ReturnType<typeof useWizardStore.getState>>);

    await act(async () => {
      root.render(createElement(WizardChat, null) as ReactElement);
    });
    const ta = q("wizard-input") as HTMLTextAreaElement;
    expect(ta).not.toBeNull();
    expect(ta.disabled).toBe(false);
    return ta;
  }

  test("조합 중에도 전송된다", async () => {
    const ta = await mountWizardChat();
    await type(ta, "한글로 답합니다");
    await press(ta, COMPOSING_CMD_ENTER);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy).toHaveBeenCalledWith("한글로 답합니다");
  });

  test("맨 Enter 로는 보내지 않는다", async () => {
    const ta = await mountWizardChat();
    await type(ta, "아직 쓰는 중");
    await press(ta, { key: "Enter", code: "Enter", keyCode: 13 });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  test("조합 때문에 마지막 글자가 빠지지 않는다", async () => {
    const ta = await mountWizardChat();
    await type(ta, "답합");
    typeWithoutNotifyingReact(ta, "답합니다");
    await press(ta, COMPOSING_CMD_ENTER);
    expect(sendSpy).toHaveBeenCalledWith("답합니다");
  });
});

// ─── D. 두 화면이 갈라지지 못하게 못박는다 ──────────────────────────────────

const SRC = path.resolve(__dirname, "../../../src");

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), "utf-8");
}

function codeOnly(src: string): string {
  return src
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

const SCREENS = [
  "studio/wizard/concept/Step2Concept.tsx",
  "studio/wizard/WizardChat.tsx",
] as const;

describe("두 화면 소스 계약 — 한쪽만 고쳐진 채로 두지 않는다 (C6)", () => {
  for (const file of SCREENS) {
    describe(file, () => {
      test("Enter 판별을 «물리 키» 로 한다", () => {
        const s = read(file);
        expect(s).toContain('e.code === "Enter"');
        expect(s).toMatch(/function isEnterKey\(/);
      });

      test("전송 분기가 더 이상 e.key 한 축에만 기대지 않는다", () => {
        const s = codeOnly(read(file));
        expect(s).not.toMatch(
          /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key === "Enter"/,
        );
        expect(s).toMatch(/\(e\.metaKey \|\| e\.ctrlKey\) && isEnterKey\(e\)/);
      });

      test("보낼 때 «화면에 지금 있는 글자» 를 쓴다 (조합 지연 대비)", () => {
        expect(read(file)).toContain("handleSend(e.currentTarget.value)");
      });

      test("Esc 그만두기 분기를 빼지 않았다", () => {
        expect(read(file)).toContain('e.key === "Escape"');
      });
    });
  }
});

// ─── C7. 화면 안내와 실제 동작이 일치한다 ───────────────────────────────────

describe("화면 안내와 실제 동작이 일치한다 (C7)", () => {
  test("컨셉 대화 화면 — 적힌 대로 «되게» 했다", async () => {
    const ta = await mountStep2();
    // 화면이 약속하는 문면
    expect(ta.getAttribute("placeholder")).toContain("Cmd/Ctrl+Enter");
    const hint = Array.from(container.querySelectorAll("span"))
      .map((e) => e.textContent ?? "")
      .find((t) => t.includes("Cmd/Ctrl + Enter"));
    expect(hint).toContain("Cmd/Ctrl + Enter 로 전송");

    // 그 약속이 한글 조합 중에도 지켜진다.
    await type(ta, "약속대로 됩니다");
    const before = sentMessages().length;
    await press(ta, COMPOSING_CMD_ENTER);
    expect(sentMessages().length).toBe(before + 1);
  });

  test("인터뷰 마법사 화면 — 적힌 문면이 그대로 남아 있다", () => {
    const s = read("studio/wizard/WizardChat.tsx");
    expect(s).toContain("Cmd/Ctrl+Enter 로 전송");
  });
});
