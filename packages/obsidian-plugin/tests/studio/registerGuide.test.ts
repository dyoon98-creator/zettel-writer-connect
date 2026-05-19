import {
  loadRegisterGuide,
  loadRegisterStyleGuide,
  mergeRegisterGuide,
  type StyleGuideAxes,
} from "../../src/studio/voice/registerGuide";
import { invoke } from "../../src/studio/tauriShims/core";

jest.mock("../../src/studio/tauriShims/core", () => ({
  invoke: jest.fn(),
}));

jest.mock("../../src/studio/voice/voiceIO", () => ({
  voiceIO: {
    path: jest.fn(async () => "/vault/_attachments/voice"),
  },
}));

const invokeMock = invoke as jest.MockedFunction<typeof invoke>;

function baseGuide(overrides: Partial<StyleGuideAxes> = {}): StyleGuideAxes {
  return {
    firstImpression: ["정확", "차분"],
    sentenceBreath: "긴 호흡과 짧은 단정을 섞음",
    sentenceStructure: "전제-판단-근거",
    vocabularyTendency: "법률·금융 어휘",
    thoughtFlow: "쟁점에서 결론으로 이동",
    readerDistance: "전문가 독자와 가까운 거리",
    emotionAndAttitude: "절제된 확신",
    metaphorAndImagery: "거래와 회계 비유",
    strengths: "논리와 근거",
    weaknesses: "긴 문장",
    styleDna: {
      name: "base dna",
      coreImpression: "분석적",
      sentenceBreath: "dna breath",
      sentenceStructure: "dna structure",
      vocabulary: "dna vocabulary",
      thoughtFlow: "dna thought",
      emotionTemperature: "낮음",
      readerDistance: "dna distance",
      frequentSentencePatterns: "A다. 왜냐하면 B다.",
      frequentThoughtPatterns: "쟁점화 후 판단",
      strengths: "정밀함",
      weaknesses: "밀도 높음",
      keep: "근거",
      reduce: "군더더기",
      nonNegotiable: "정확성",
      oneLineDefinition: "base voice",
    },
    compressedPrompt: "BASE PROMPT",
    tone: "담백함",
    sentenceLength: "중간",
    endings: "단정형",
    vocabulary: "전문어",
    breath: "중간 호흡",
    summary: "base summary",
    ...overrides,
  };
}

function baseStyleGuideJson(guide: StyleGuideAxes = baseGuide()): string {
  return JSON.stringify({
    version: 2,
    analyzedAt: "2026-05-19T12:00:00+09:00",
    provider: "test",
    sampleSignatures: [],
    guide,
  });
}

describe("registerGuide", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("loadRegisterGuide reads canonical register delta from .register-guides", async () => {
    invokeMock.mockImplementation(async (cmd, args) => {
      if (cmd === "voice_path") return "/vault/_attachments/voice";
      if (cmd === "vault_read_file") {
        expect(args).toEqual({
          path: "/vault/_attachments/voice/.register-guides/email.json",
        });
        return JSON.stringify({
          version: 1,
          register: "email",
          addedInstructions: "정중한 도입 1문장",
          overrides: {
            readerDistance: "공적·정중",
            sentenceBreath: "평소보다 짧게",
          },
        });
      }
      throw new Error(`unexpected command ${cmd}`);
    });

    await expect(loadRegisterGuide("email")).resolves.toEqual({
      version: 1,
      register: "email",
      addedInstructions: "정중한 도입 1문장",
      overrides: {
        readerDistance: "공적·정중",
        sentenceBreath: "평소보다 짧게",
      },
    });
  });

  test("mergeRegisterGuide appends email delta and whitelisted override lines without mutating base axes", () => {
    const base = baseGuide();

    const merged = mergeRegisterGuide(base, {
      version: 1,
      register: "email",
      addedInstructions: "결론을 본문 앞단에 배치.",
      overrides: {
        readerDistance: "공적·정중",
        sentenceBreath: "짧고 선명하게",
      },
    });

    expect(merged).not.toBe(base);
    expect(merged.styleDna).toBe(base.styleDna);
    expect(base.compressedPrompt).toBe("BASE PROMPT");
    expect(merged.compressedPrompt).toContain("BASE PROMPT");
    expect(merged.compressedPrompt).toContain("## 형식별 보정(email)");
    expect(merged.compressedPrompt).toContain("결론을 본문 앞단에 배치.");
    expect(merged.compressedPrompt).toContain("원래 readerDistance → 이 형식에선 공적·정중");
    expect(merged.compressedPrompt).toContain("원래 sentenceBreath → 이 형식에선 짧고 선명하게");
    expect(merged.readerDistance).toBe("전문가 독자와 가까운 거리");
    expect(merged.sentenceBreath).toBe("긴 호흡과 짧은 단정을 섞음");
  });

  test("missing register guide falls back to base style guide without throwing", async () => {
    invokeMock.mockImplementation(async (cmd, args) => {
      if (cmd === "voice_path") return "/vault/_attachments/voice/";
      if (cmd === "vault_read_file") {
        const path = String((args as { path: string }).path);
        if (path.endsWith("/.style-guide.json")) return baseStyleGuideJson();
        throw new Error("ENOENT");
      }
      throw new Error(`unexpected command ${cmd}`);
    });

    await expect(loadRegisterGuide("email")).resolves.toBeNull();
    await expect(loadRegisterStyleGuide("email")).resolves.toEqual(baseGuide());
  });

  test.each([
    ["invalid JSON", "{"],
    ["version mismatch", JSON.stringify({ version: 2, register: "email" })],
    ["mismatched register", JSON.stringify({ version: 1, register: "kakao" })],
    ["unknown register", JSON.stringify({ version: 1, register: "fax" })],
  ])("%s falls back without throwing", async (_label, raw) => {
    invokeMock.mockImplementation(async (cmd) => {
      if (cmd === "voice_path") return "/vault/_attachments/voice";
      if (cmd === "vault_read_file") return raw;
      throw new Error(`unexpected command ${cmd}`);
    });

    await expect(loadRegisterGuide("email")).resolves.toBeNull();
  });

  test("styleDna, compressedPrompt, and non-whitelisted overrides are ignored", async () => {
    invokeMock.mockImplementation(async (cmd) => {
      if (cmd === "voice_path") return "/vault/_attachments/voice";
      if (cmd === "vault_read_file") {
        return JSON.stringify({
          version: 1,
          register: "email",
          addedInstructions: "이메일 보정",
          overrides: {
            readerDistance: "공적",
            styleDna: "replace dna",
            compressedPrompt: "REPLACE PROMPT",
            vocabulary: "unauthorized vocabulary",
          },
        });
      }
      throw new Error(`unexpected command ${cmd}`);
    });

    const delta = await loadRegisterGuide("email");
    const merged = mergeRegisterGuide(baseGuide(), delta);

    expect(delta?.overrides).toEqual({ readerDistance: "공적" });
    expect(merged.compressedPrompt).toContain("BASE PROMPT");
    expect(merged.compressedPrompt).toContain("## 형식별 보정(email)");
    expect(merged.compressedPrompt).toContain("원래 readerDistance → 이 형식에선 공적");
    expect(merged.compressedPrompt).not.toContain("REPLACE PROMPT");
    expect(merged.compressedPrompt).not.toContain("unauthorized vocabulary");
    expect(console.warn).toHaveBeenCalled();
  });

  test("invalid requested register safely returns null without vault read", async () => {
    await expect(loadRegisterGuide("fax")).resolves.toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
