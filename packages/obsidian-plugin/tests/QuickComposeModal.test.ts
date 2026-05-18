jest.mock("../src/adapters/appSettings", () => ({
  ObsidianAppSettingsStore: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue({
      aiProvider: "mock",
      codexPath: "",
      codexExtraArgs: "",
      claudeCodePath: "",
      useMockBridge: true,
      skillpackFolder: "_skillpacks",
      voiceFolder: "_voice-samples",
    }),
  })),
}));

jest.mock("../src/adapters/aiBridge", () => ({
  startAiInvocation: jest.fn().mockReturnValue({
    done: Promise.resolve({ fullText: "테스트 결과 텍스트", durationMs: 100, exitCode: 0 }),
  }),
}));

import { App } from "obsidian";
import { QuickComposeModal } from "../src/QuickComposeModal";

function createModal() {
  const app = new App();
  const modal = new QuickComposeModal(app);
  modal.onOpen();
  return modal;
}

function getSelects(contentEl: HTMLElement): HTMLSelectElement[] {
  return Array.from(contentEl.querySelectorAll("select")) as HTMLSelectElement[];
}

function getOptions(select: HTMLSelectElement): string[] {
  return Array.from(select.options).map((o: HTMLOptionElement) => o.value);
}

describe("QuickComposeModal — field presence", () => {
  it("has a register (형식) select", () => {
    const { contentEl } = createModal();
    const allOptions = getSelects(contentEl).flatMap(getOptions);
    expect(allOptions).toContain("email");
    expect(allOptions).toContain("kakao");
    expect(allOptions).toContain("telegram");
    expect(allOptions).toContain("report");
    expect(allOptions).toContain("summary");
    expect(allOptions).toContain("memo");
  });

  it("has an intent textarea", () => {
    const { contentEl } = createModal();
    expect(contentEl.querySelector("textarea[data-field='intent']")).not.toBeNull();
  });

  it("has a source textarea", () => {
    const { contentEl } = createModal();
    expect(contentEl.querySelector("textarea[data-field='source']")).not.toBeNull();
  });

  it("has a reader text input", () => {
    const { contentEl } = createModal();
    expect(contentEl.querySelector("input[data-field='reader']")).not.toBeNull();
  });

  it("has a length select with 짧게/보통/길게 options", () => {
    const { contentEl } = createModal();
    const lengthSelect = getSelects(contentEl).find((s) => {
      const opts = getOptions(s);
      return opts.includes("짧게") && opts.includes("보통") && opts.includes("길게");
    });
    expect(lengthSelect).toBeDefined();
  });

  it("has a style mode select", () => {
    const { contentEl } = createModal();
    const styleModeSelect = getSelects(contentEl).find((s) =>
      getOptions(s).includes("manual"),
    );
    expect(styleModeSelect).toBeDefined();
  });

  it("has a style guide textarea for manual paste", () => {
    const { contentEl } = createModal();
    expect(contentEl.querySelector("textarea[data-field='style-guide']")).not.toBeNull();
  });
});

function getButtons(contentEl: HTMLElement): HTMLButtonElement[] {
  return Array.from(contentEl.querySelectorAll("button")) as HTMLButtonElement[];
}

describe("QuickComposeModal — buttons", () => {
  it("has 생성 button", () => {
    const { contentEl } = createModal();
    expect(getButtons(contentEl).some((b) => b.textContent?.includes("생성"))).toBe(true);
  });

  it("has 복사 button", () => {
    const { contentEl } = createModal();
    expect(getButtons(contentEl).some((b) => b.textContent?.includes("복사"))).toBe(true);
  });

  it("has 현재 파일에 삽입 button", () => {
    const { contentEl } = createModal();
    expect(getButtons(contentEl).some((b) => b.textContent?.includes("삽입"))).toBe(true);
  });

  it("has 닫기 button", () => {
    const { contentEl } = createModal();
    expect(getButtons(contentEl).some((b) => b.textContent?.includes("닫기"))).toBe(true);
  });
});

describe("QuickComposeModal — intent validation", () => {
  it("생성 button is disabled when intent is empty", () => {
    const { contentEl } = createModal();
    const generateBtn = getButtons(contentEl).find((b) => b.textContent?.includes("생성"));
    expect(generateBtn).toBeDefined();
    expect(generateBtn!.disabled).toBe(true);
  });

  it("생성 button becomes enabled when intent has text", () => {
    const { contentEl } = createModal();
    const intentEl = contentEl.querySelector(
      "textarea[data-field='intent']",
    ) as HTMLTextAreaElement | null;
    const generateBtn = getButtons(contentEl).find((b) => b.textContent?.includes("생성"));

    expect(intentEl).not.toBeNull();
    expect(generateBtn).toBeDefined();

    intentEl!.value = "미팅 일정 조율 요청";
    intentEl!.dispatchEvent(new Event("input"));
    expect(generateBtn!.disabled).toBe(false);
  });
});

describe("QuickComposeModal — no external send", () => {
  it("has no Gmail/Kakao/Telegram send button", () => {
    const { contentEl } = createModal();
    const buttonTexts = getButtons(contentEl).map((b) => b.textContent ?? "");
    expect(buttonTexts.join(" ")).not.toMatch(/gmail|kakao.*send|telegram.*send|발송|전송/i);
  });
});
