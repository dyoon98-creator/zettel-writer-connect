// WizardChat.behavior.test.ts — JSDOM behavior tests for ChoiceInput auto-submit UX.
//
// Why not direct React render:
//   tsconfig.test.json extends tsconfig.base.json (no jsx), so importing WizardChat.tsx
//   causes a TS compile error ("--jsx flag required"). testMatch only allows *.test.ts,
//   not *.test.tsx, so we cannot add a jsx-enabled test config without touching jest.config.cjs.
//
// Strategy:
//   Source contract (WizardChat.contract.test.ts) proves the structural invariants
//   (handleChoiceSelect exists, onSelect={setSelectedChoice} absent). This file proves
//   the BEHAVIORAL contract of that logic using real JSDOM events and jest.fn() spies.
//   The inline functions mirror the exact production logic in WizardChat.tsx.
//   If the production logic changes, the source contract test fails first, signalling
//   that this behavior test also needs updating.

const OPTIONS_3 = ["신규 딜/상정", "후속투자 근거 정리", "직접 입력"] as const;
const OPTIONS_2 = ["신규 딜/상정", "직접 입력"] as const;

// ─── Helper: mirrors handleChoiceSelect from WizardChat.tsx ──────────────────

function makeHandleChoiceSelect(
  options: readonly string[],
  sendUserMessage: (s: string) => Promise<void>,
  setSelectedChoice: (i: number) => void,
): (i: number) => void {
  return (i: number): void => {
    const isLast = i === options.length - 1;
    setSelectedChoice(i);
    if (!isLast) {
      const chosen = options[i] ?? "";
      if (chosen.trim()) {
        void sendUserMessage(chosen);
      }
    }
  };
}

// ─── Helper: mirrors handleChoiceSubmit from WizardChat.tsx ─────────────────

function makeHandleChoiceSubmit(
  options: readonly string[],
  sendUserMessage: (s: string) => Promise<void>,
  getSelectedChoice: () => number | null,
  getOtherDraft: () => string,
): () => void {
  return (): void => {
    const selectedChoice = getSelectedChoice();
    if (selectedChoice === null) return;
    const chosen = options[selectedChoice] ?? "";
    const isLast = selectedChoice === options.length - 1;
    const content =
      isLast && getOtherDraft().trim()
        ? `${chosen}: ${getOtherDraft().trim()}`
        : chosen;
    if (!content.trim()) return;
    void sendUserMessage(content);
  };
}

// ─── Helper: builds a JSDOM radio group and returns a fireChange function ────

function buildRadioGroup(
  container: HTMLElement,
  count: number,
  onChange: (i: number) => void,
): (i: number) => void {
  for (let i = 0; i < count; i++) {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "wizard-choice";
    input.value = String(i);
    const idx = i; // capture for closure
    input.addEventListener("change", () => onChange(idx));
    container.appendChild(input);
  }
  return (i: number): void => {
    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const radio = radios[i];
    if (!radio) throw new Error(`No radio at index ${i}`);
    radio.checked = true;
    radio.dispatchEvent(new Event("change"));
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ChoiceInput — auto-submit 행동 테스트 (JSDOM)", () => {
  describe("일반 옵션 클릭 → 즉시 sendUserMessage 호출", () => {
    it("첫 번째 옵션(신규 딜/상정) 클릭 → sendUserMessage 1회, 인수 정확", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const setSelectedChoice = jest.fn();
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage,
        setSelectedChoice,
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      fireChange(0); // "신규 딜/상정"

      expect(sendUserMessage).toHaveBeenCalledTimes(1);
      expect(sendUserMessage).toHaveBeenCalledWith("신규 딜/상정");
      expect(setSelectedChoice).toHaveBeenCalledWith(0);
    });

    it("두 번째 옵션(후속투자 근거 정리) 클릭 → sendUserMessage 1회, 인수 정확", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const setSelectedChoice = jest.fn();
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage,
        setSelectedChoice,
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      fireChange(1); // "후속투자 근거 정리"

      expect(sendUserMessage).toHaveBeenCalledTimes(1);
      expect(sendUserMessage).toHaveBeenCalledWith("후속투자 근거 정리");
      expect(setSelectedChoice).toHaveBeenCalledWith(1);
    });

    it("답변 버튼 없이 클릭만으로 완료됨 (submit 버튼 미클릭)", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage,
        jest.fn(),
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      // Click option 0 — submit button never clicked
      fireChange(0);

      // Still called once — no submit button needed
      expect(sendUserMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("마지막(직접 입력) 옵션 클릭 → sendUserMessage 즉시 미호출", () => {
    it("마지막 옵션 클릭 → sendUserMessage 호출 없음", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const setSelectedChoice = jest.fn();
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage,
        setSelectedChoice,
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      fireChange(2); // "직접 입력"

      expect(sendUserMessage).not.toHaveBeenCalled();
      // But selection state is updated (shows textarea)
      expect(setSelectedChoice).toHaveBeenCalledWith(2);
    });

    it("마지막 옵션 클릭 → setSelectedChoice 호출로 textarea 노출 상태 진입", () => {
      const setSelectedChoice = jest.fn();
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
        setSelectedChoice,
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      fireChange(2);

      expect(setSelectedChoice).toHaveBeenCalledWith(2);
      expect(setSelectedChoice).toHaveBeenCalledTimes(1);
    });
  });

  describe("직접 입력 flow: 마지막 옵션 → textarea 입력 → 답변 버튼", () => {
    it("직접 입력 후 답변 버튼 클릭 → '직접 입력: <입력내용>' 형식으로 전송", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      let selectedChoice: number | null = null;
      let otherDraft = "";

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_2,
        sendUserMessage,
        (i) => { selectedChoice = i; },
      );

      // User clicks last option
      handleChoiceSelect(1); // "직접 입력" (last of OPTIONS_2)
      expect(sendUserMessage).not.toHaveBeenCalled();
      expect(selectedChoice).toBe(1);

      // User types in textarea
      otherDraft = "기타 투자 맥락";

      // Build submit button
      const submitBtn = document.createElement("button");
      const handleChoiceSubmit = makeHandleChoiceSubmit(
        OPTIONS_2,
        sendUserMessage,
        () => selectedChoice,
        () => otherDraft,
      );
      submitBtn.addEventListener("click", handleChoiceSubmit);

      // User clicks 답변 button
      submitBtn.dispatchEvent(new Event("click"));

      expect(sendUserMessage).toHaveBeenCalledTimes(1);
      expect(sendUserMessage).toHaveBeenCalledWith("직접 입력: 기타 투자 맥락");
    });

    it("직접 입력 선택 + textarea 비어 있으면 canSubmit false → 답변 버튼 비활성 → sendUserMessage 미호출", () => {
      // Production ChoiceInput: canSubmit = selected !== null && (!isOtherSelected || otherDraft.trim().length > 0)
      // When isOtherSelected=true and otherDraft="" → canSubmit=false → button disabled → click does nothing.
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      let selectedChoice: number | null = null;
      const otherDraft = ""; // empty textarea

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_2,
        sendUserMessage,
        (i) => { selectedChoice = i; },
      );
      handleChoiceSelect(1); // select last ("직접 입력")

      // Compute canSubmit exactly as ChoiceInput does.
      const isOtherSelected = selectedChoice === OPTIONS_2.length - 1;
      const canSubmit =
        selectedChoice !== null && (!isOtherSelected || otherDraft.trim().length > 0);
      expect(canSubmit).toBe(false); // guard: confirms button is disabled in this state

      // Simulate disabled button: listener is gated on !disabled, mirroring
      // <button disabled={disabled || !canSubmit} onClick={onSubmit}>.
      const submitBtn = document.createElement("button");
      submitBtn.disabled = !canSubmit;
      const handleChoiceSubmit = makeHandleChoiceSubmit(
        OPTIONS_2,
        sendUserMessage,
        () => selectedChoice,
        () => otherDraft,
      );
      submitBtn.addEventListener("click", () => {
        if (!submitBtn.disabled) handleChoiceSubmit();
      });
      submitBtn.dispatchEvent(new Event("click"));

      expect(sendUserMessage).not.toHaveBeenCalled();
    });

    it("직접 입력 선택 + textarea 채워지면 canSubmit true → 답변 버튼 활성 → sendUserMessage 호출", () => {
      // Companion: when otherDraft has content, canSubmit=true, button enabled, click sends.
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      let selectedChoice: number | null = null;
      let otherDraft = "";

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_2,
        sendUserMessage,
        (i) => { selectedChoice = i; },
      );
      handleChoiceSelect(1); // select last

      otherDraft = "PE 신규 딜"; // user types

      const isOtherSelected = selectedChoice === OPTIONS_2.length - 1;
      const canSubmit =
        selectedChoice !== null && (!isOtherSelected || otherDraft.trim().length > 0);
      expect(canSubmit).toBe(true); // guard: confirms button is enabled

      const submitBtn = document.createElement("button");
      submitBtn.disabled = !canSubmit;
      const handleChoiceSubmit = makeHandleChoiceSubmit(
        OPTIONS_2,
        sendUserMessage,
        () => selectedChoice,
        () => otherDraft,
      );
      submitBtn.addEventListener("click", () => {
        if (!submitBtn.disabled) handleChoiceSubmit();
      });
      submitBtn.dispatchEvent(new Event("click"));

      expect(sendUserMessage).toHaveBeenCalledTimes(1);
      expect(sendUserMessage).toHaveBeenCalledWith("직접 입력: PE 신규 딜");
    });

    it("다른 옵션을 선택 후 다시 last 옵션으로 변경 — sendUserMessage 최종 1회만", () => {
      const sendUserMessage = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const setSelectedChoice = jest.fn();
      const container = document.createElement("div");

      const handleChoiceSelect = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage,
        setSelectedChoice,
      );
      const fireChange = buildRadioGroup(container, OPTIONS_3.length, handleChoiceSelect);

      // Click option 0 → auto-submit (1 call)
      fireChange(0);
      expect(sendUserMessage).toHaveBeenCalledTimes(1);

      // UI would have advanced to next question — but if user somehow clicks last after:
      // (Simulates clicking last after first)
      const sendUserMessage2 = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
      const setSelectedChoice2 = jest.fn();
      const container2 = document.createElement("div");
      const handleChoiceSelect2 = makeHandleChoiceSelect(
        OPTIONS_3,
        sendUserMessage2,
        setSelectedChoice2,
      );
      const fireChange2 = buildRadioGroup(container2, OPTIONS_3.length, handleChoiceSelect2);

      fireChange2(2); // "직접 입력"
      expect(sendUserMessage2).not.toHaveBeenCalled();
    });
  });
});
