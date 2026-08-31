// aiWaitMouse.test.ts — 「키보드를 모르는 사람에게도 그만두기를 준다」의 행동 계약.
//                        (발주 aiwait-mouse-7f4c1a08 · 2026-08-31)
//
// 이 파일이 증명하려는 것 (E-026 대조: 「버튼이 렌더된다」 는 아무것도 잡지 못한다):
//
//   A. 진짜 Step2Concept 을 진짜 DOM 에 그린 뒤, 키보드를 «한 번도» 쓰지 않고
//      마우스 클릭만으로 진행 중이던 호출의 AbortSignal 이 실제로 끊긴다.
//      (키를 쓰지 않았다는 것도 세어서 증명한다 — 창 전체 keydown 계수기)
//   B. 그 화면의 Esc 취소 경로도 «여전히» 동작한다. 그리고 옛 경로(disabled 된
//      textarea 의 onKeyDown)만으로는 닿을 수 없었다는 사실을 함께 못박는다.
//   C. 대화(왼쪽)와 정리(오른쪽)는 따로 도는 호출이고, 각 「그만두기」는 제 옆의
//      호출만 멈춘다 — 하나를 눌러도 다른 하나는 살아 있다.
//   D. 물음 2~4 의 판정을 소스 계약으로 못박는다. «그대로 둔다» 로 판정한 것도
//      함께 못박는다 — 다음 사람이 반대로 고치는 것을 막는 것이 목적이다.
//
// JSX 없이 React.createElement 로 그린다 (테스트 파일은 .ts).

import * as fs from "fs";
import * as path from "path";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { isUserStopped } from "../../../src/studio/wizard/AiWaitBar";

// ─── 바깥 세계만 가짜로 바꾼다 ──────────────────────────────────────────────
// 취소 배선(useStreamingChat → AbortController → AiWaitBar)은 «진짜» 를 쓴다.
// 그게 검사 대상이다. 가짜는 CLI 를 부르는 경계와 디스크뿐이다.

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
      // 답이 통째로 올 때까지 «한 글자도» 흘리지 않는 실제 codex 동작을 흉내낸다.
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

// 노트 본문 읽기·목록 — 취소 배선과 무관한 디스크 경계.
jest.mock("../../../src/studio/vaultAdapter", () => ({
  fetchNotesForContext: async () => ({ context: "", notes: [] }),
  listVaultNotes: async () => [] as string[],
  tauriVaultAdapter: {},
}));

// 세션 자동저장 — 마법사 상태 저장은 이 발주의 검사 대상이 아니다.
jest.mock(
  "../../../src/studio/wizard/concept/conceptSessionPersist",
  () => ({
    saveSession: async () => undefined,
    listSessions: async () => [],
    deleteSession: async () => undefined,
  }),
);

import { useConceptWizardStore } from "../../../src/studio/state/conceptWizardStore";
import { Step2Concept } from "../../../src/studio/wizard/concept/Step2Concept";

// ─── 렌더 도우미 ────────────────────────────────────────────────────────────

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

/** 이 테스트가 키보드를 «썼는지» 세는 계수기. 마우스 전용 증명에 쓴다. */
let keyEventCount = 0;
const countKey = (): void => {
  keyEventCount += 1;
};

function q(testId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function click(el: HTMLElement): Promise<void> {
  return act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 진짜 세션을 만들고 진짜 Step2Concept 을 그린다. 마운트 즉시 첫 호출이 뜬다. */
async function mountStep2(): Promise<void> {
  useConceptWizardStore.getState().start({
    seed: "아이의 첫 등교를 쓰고 싶다",
    tone: "column-narrative",
    genre: "column-essay",
    attachedNotes: [],
  });
  await act(async () => {
    root.render(createElement(Step2Concept, null) as ReactElement);
  });
}

beforeEach(() => {
  startedSignals.length = 0;
  keyEventCount = 0;
  window.addEventListener("keydown", countKey, true);
  window.addEventListener("keyup", countKey, true);
  window.addEventListener("keypress", countKey, true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.removeEventListener("keydown", countKey, true);
  window.removeEventListener("keyup", countKey, true);
  window.removeEventListener("keypress", countKey, true);
  useConceptWizardStore.setState({
    session: null,
    isOpen: false,
    pausedForBinder: false,
  });
  jest.useRealTimers();
});

// ─── A. 마우스만으로 그만둘 수 있다 ─────────────────────────────────────────

describe("Step2Concept — 마우스만으로 그만두기 (C1)", () => {
  test("마운트하면 호출이 시작되고, 그 옆에 그만두기가 있다", async () => {
    await mountStep2();

    expect(startedSignals).toHaveLength(1);
    expect(startedSignals[0].aborted).toBe(false);

    const bar = q("concept-wait-bar");
    expect(bar).not.toBeNull();
    // 무슨 일이 일어나는 중인지 사람 말로 말한다.
    expect(bar?.textContent).toContain("AI 코치가 답을 쓰고 있습니다");
    // 버튼 이름은 앱 전체에서 하나다.
    expect(q("concept-wait-bar-cancel")?.textContent).toBe("그만두기");
  });

  test("클릭 한 번 — 키를 한 번도 누르지 않고 진행 중이던 호출이 실제로 끊긴다", async () => {
    await mountStep2();
    const btn = q("concept-wait-bar-cancel") as HTMLButtonElement;
    expect(btn).not.toBeNull();

    await click(btn);

    // 1) 진행 중이던 호출이 «실제로» 끊겼다 (렌더 여부가 아니라 신호를 본다).
    expect(startedSignals[0].aborted).toBe(true);
    // 2) 이 테스트는 키보드를 한 번도 쓰지 않았다.
    expect(keyEventCount).toBe(0);
    // 3) 대기 표시가 사라진다 — 화면이 영원히 기다리지 않는다.
    expect(q("concept-wait-bar")).toBeNull();
  });

  test("스스로 그만둔 것을 «고장» 으로 보여주지 않는다", async () => {
    await mountStep2();
    await click(q("concept-wait-bar-cancel") as HTMLButtonElement);

    // 빨간 오류 배너 대신, 무엇이 남았는지 말하는 한 줄.
    expect(q("concept-error-banner")).toBeNull();
    const notice = q("ai-stopped-notice");
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain("쓰시던 내용은 그대로 있습니다");
  });

  test("누르지 않으면 끊기지 않는다 — 끊은 원인이 그 버튼임을 확인한다", async () => {
    await mountStep2();
    expect(startedSignals[0].aborted).toBe(false);
    expect(q("ai-stopped-notice")).toBeNull();
  });

  test("화면 문면에 컴퓨터 용어를 쓰지 않는다", async () => {
    await mountStep2();
    const text = container.textContent ?? "";
    for (const jargon of [
      "스트리밍",
      "타임아웃",
      "프로세스",
      "abort",
      "cancel",
      "중단",
    ]) {
      expect(text).not.toContain(jargon);
    }
  });
});

// ─── B. 키보드 사용자도 잃지 않는다 ─────────────────────────────────────────

describe("Step2Concept — Esc 경로는 여전히 동작한다 (C1)", () => {
  test("Esc 를 누르면 진행 중이던 호출이 끊긴다", async () => {
    await mountStep2();
    expect(startedSignals[0].aborted).toBe(false);

    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(startedSignals[0].aborted).toBe(true);
    expect(q("concept-wait-bar")).toBeNull();
  });

  test("Esc 는 «만드는 동안» 에만 무언가를 멈춘다", async () => {
    await mountStep2();
    await click(q("concept-wait-bar-cancel") as HTMLButtonElement);
    expect(startedSignals).toHaveLength(1);

    // 아무것도 돌지 않을 때 Esc 는 새 호출을 만들지도, 무언가를 깨뜨리지도 않는다.
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(startedSignals).toHaveLength(1);
  });

  test("왜 창 전체 Esc 가 필요했나 — 만드는 동안 입력칸은 꺼져 있어 포커스를 받지 못한다", async () => {
    await mountStep2();

    const textarea = q("concept-input") as HTMLTextAreaElement;
    // 입력칸이 꺼져 있다 = 브라우저가 여기에 포커스를 주지 않는다
    //   = textarea 의 onKeyDown 에만 붙은 Esc 는 «정작 필요한 순간에» 닿지 않는다.
    // 이 사실이 「Esc 가 있으니 괜찮다」 는 착각의 정체였다.
    expect(textarea.disabled).toBe(true);
    expect(document.activeElement).not.toBe(textarea);

    // 그래도 Esc 는 닿는다 — 창 전체 경로를 «더했기» 때문이다.
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(startedSignals[0].aborted).toBe(true);
  });
});

// ─── C. 두 호출은 따로 돈다 — 그래서 그만두기도 둘이다 ──────────────────────

describe("Step2Concept — 각 그만두기는 제 옆의 호출만 멈춘다", () => {
  test("정리하기를 눌러 두 호출이 동시에 돌 때, 정리 쪽만 멈춘다", async () => {
    await mountStep2();
    expect(startedSignals).toHaveLength(1); // 대화

    await click(q("concept-distill-btn") as HTMLButtonElement);
    expect(startedSignals).toHaveLength(2); // 대화 + 정리

    const distillBar = q("concept-distill-wait-bar");
    expect(distillBar).not.toBeNull();
    expect(distillBar?.textContent).toContain("컨셉 단락을 정리하고 있습니다");

    await click(q("concept-distill-wait-bar-cancel") as HTMLButtonElement);

    // 정리는 끊겼고, 대화는 살아 있다 — 「그만두기」가 무엇을 멈췄는지 분명하다.
    expect(startedSignals[1].aborted).toBe(true);
    expect(startedSignals[0].aborted).toBe(false);
    expect(q("concept-distill-wait-bar")).toBeNull();
    expect(q("concept-wait-bar")).not.toBeNull();
    expect(keyEventCount).toBe(0);
  });
});

// ─── D. 판정 박제 — 소스 계약 ───────────────────────────────────────────────

const SRC = path.resolve(__dirname, "../../../src");

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC, rel), "utf-8");
}

/**
 * `//` 주석 줄을 걷어낸다. 판정 근거를 적은 주석에는 「취소」·「▍」 같은 낱말이
 * 일부러 들어 있다 — 화면에 남았는지 보려면 «코드» 만 봐야 한다.
 */
function codeOnly(src: string): string {
  return src
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

describe("판정 4 — 타자기 커서 「▍」 는 없앤다 (C2)", () => {
  // 근거: codex 는 글자를 한 자씩 주지 않는다. 한 글자도 오지 않는 자리에서
  //       커서만 깜빡이는 것은 «타자 치는 중» 이라는 거짓말이다.
  test("Step2Concept — 화면에서 커서가 사라졌다", () => {
    expect(codeOnly(read("studio/wizard/concept/Step2Concept.tsx")))
      .not.toContain("▍");
  });

  test("Step3Synopsis — 화면에서 커서가 사라졌다", () => {
    expect(codeOnly(read("studio/wizard/concept/Step3Synopsis.tsx")))
      .not.toContain("▍");
  });

  test("없앤 자리는 비워 두지 않았다 — 무엇이 남는지 정해져 있다", () => {
    // Step3Synopsis: 글이 «어디에» 나타날지 알려주는 한 줄.
    expect(read("studio/wizard/concept/Step3Synopsis.tsx")).toContain(
      "여기에 시놉시스가 나타납니다.",
    );
    // Step2Concept: 대기 막대가 그 자리를 맡는다. 빈 말풍선은 띄우지 않는다.
    const step2 = read("studio/wizard/concept/Step2Concept.tsx");
    expect(step2).toContain("isStreaming && mainChat.buffer.length > 0");
    expect(step2).toMatch(/<AiWaitBar[\s/>]/);
  });

  test("빈 말풍선이 실제로 뜨지 않는다 (아무것도 오지 않는 동안)", async () => {
    await mountStep2();
    // 대기 막대는 있고, 말풍선은 없다.
    expect(q("concept-wait-bar")).not.toBeNull();
    expect(q("concept-msg-streaming")).toBeNull();
  });
});

describe("판정 2 — ContinuityPanel 은 통일한다 (C2)", () => {
  // 근거: 이미 마우스 취소는 있었다. 그러나 이 앱에서 «가장 오래 걸리는» 호출
  //       (4분)에 경과 시간도, 「언제 저절로 멈추는지」도 없었다.
  //       사용자가 잃던 것은 「일관성」이 아니라 «살아 있다는 증거» 다.
  const src = () => read("studio/inspector/ContinuityPanel.tsx");

  test("공용 대기 표시를 가져다 쓴다 (제 것을 따로 만들지 않는다)", () => {
    expect(src()).toMatch(/from\s+"\.\.\/wizard\/AiWaitBar"/);
    expect(src()).toMatch(/<AiWaitBar[\s/>]/);
    expect(src()).toContain("onCancel={handleCancel}");
  });

  test("화면이 말하는 한계 시간과 실제 한계 시간이 같은 곳에서 온다", () => {
    const s = src();
    expect(s).toContain("const CONTINUITY_TIMEOUT_SECS = 240;");
    expect(s).toContain("timeoutSecs: CONTINUITY_TIMEOUT_SECS");
    expect(s).toContain("limitSecs={CONTINUITY_TIMEOUT_SECS}");
    // 숫자를 직접 적어 두면 둘이 조용히 갈라진다.
    expect(codeOnly(s)).not.toContain("timeoutSecs: 240");
  });

  test("낱말이 「그만두기」로 통일됐다 — 화면에 「취소」가 남지 않았다", () => {
    expect(codeOnly(src())).not.toContain("취소");
    expect(src()).toContain("연속성 점검을 그만뒀습니다.");
  });
});

describe("판정 2 — ResultPreviewModal 은 «그대로 둔다» (C2)", () => {
  // 근거: 이 창은 기다리는 동안 이미 (1) 무슨 일인지 (2) 경과 시간 (3) 마우스로
  //       멈추는 버튼 셋을 준다 — 사용자가 잃고 있는 «기능» 이 없다. 남은 차이는
  //       문면뿐이고 그 문면은 StreamView.tsx 안에 있어 이 발주가 못 건드린다.
  //       여기에 대기 막대를 하나 더 얹으면 한 창에 멈추는 버튼이 둘이 된다.
  const src = () => read("studio/ai/ResultPreviewModal.tsx");

  test("대기 막대를 겹쳐 넣지 않는다 — 한 창에 멈추는 버튼은 하나여야 한다", () => {
    // 주석은 «왜 안 넣는지» 를 설명하느라 이름을 부른다. 코드만 본다.
    expect(codeOnly(src())).not.toContain("AiWaitBar");
  });

  test("이미 있는 마우스 취소 경로를 그대로 둔다", () => {
    expect(src()).toContain("onCancel={handleCancel}");
    expect(src()).toContain("handleRef.current.cancel()");
  });

  test("왜 그대로 두는지가 파일 안에 남아 있다 (다음 사람이 반대로 고치지 않도록)", () => {
    const s = src();
    expect(s).toContain("판정 박제");
    expect(s).toContain("그대로 둔다");
    expect(s).toContain("StreamView.tsx");
  });
});

describe("판정 3 — 낱말은 어디까지 맞추는가 (C2)", () => {
  test("이 발주가 쓴 화면에서 「중단」·「취소」가 사라졌다", () => {
    expect(codeOnly(read("studio/wizard/concept/Step2Concept.tsx")))
      .not.toContain("중단");
    expect(codeOnly(read("studio/inspector/ContinuityPanel.tsx")))
      .not.toContain("취소");
  });

  test("Esc 안내는 사라지지 않고 «닿는 자리» 로 옮겨졌다", () => {
    const s = read("studio/wizard/concept/Step2Concept.tsx");
    expect(s).toContain("Esc 를 눌러도 그만둘 수 있습니다");
  });

  test("옛 Esc 경로를 «빼지» 않았다 — 더하기만 했다", () => {
    const s = read("studio/wizard/concept/Step2Concept.tsx");
    // textarea 에 붙어 있던 옛 처리기는 그대로 있다.
    expect(s).toMatch(/e\.key === "Escape" && mainChat\.isStreaming/);
    // 그 위에 창 전체 경로를 더했다.
    expect(s).toContain('window.addEventListener("keydown", onKey)');
    expect(s).toContain('window.removeEventListener("keydown", onKey)');
  });

  test("«사용자가 취소했습니다» 는 낱말이 아니라 «표식» 이므로 건드리지 않는다", () => {
    // 이 문자열은 화면 문면이 아니라, 호출을 끊은 쪽(aiBridge)이 붙이고
    // AiWaitBar.isUserStopped() 가 맞춰 보는 «기계 표식» 이다. 「그만두기」로
    // 낱말을 통일한다고 여기까지 바꾸면 다섯 화면 전부에서 「그만둠」과 「고장」의
    // 구별이 조용히 깨진다 — 사용자가 스스로 멈춘 자리에 빨간 오류가 뜬다.
    //
    // 그래서 여기서 못박는 것은 «그 파일의 글자» 가 아니라 «판별이 통한다» 는
    // 사실 하나다. 표식을 어떻게 싣는지(문자열이냐 종류냐)는 aiBridge 쪽 판단에
    // 맡기고, 이 화면은 그 판별을 직접 흉내내지 않고 공용 helper 만 쓴다.
    expect(isUserStopped("사용자가 취소했습니다.")).toBe(true);
    expect(isUserStopped("AI 호출 시간 초과 (180s)")).toBe(false);

    // 이 화면은 제 나름의 문자열 비교를 만들지 않는다 — 판별은 한 곳에서만.
    const step2 = read("studio/wizard/concept/Step2Concept.tsx");
    expect(step2).toContain("isUserStopped");
    expect(codeOnly(step2)).not.toContain('"사용자가 취소');
  });
});
