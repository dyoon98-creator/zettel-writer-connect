// styleGuide.test.ts — voice 폴더 신선도(stale) 감지 + 가드 read/write.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installTauriMocks,
  setVoiceFile,
  clearVoice,
  setVoiceDir,
  clearVault,
} from "../__mocks__/tauri";

installTauriMocks();

import {
  checkFreshness,
  loadStyleGuide,
  saveStyleGuide,
  STYLE_GUIDE_VERSION,
  type StyleGuide,
  type StyleGuideAxes,
  type StyleGuideDna,
} from "../../src/voice/styleGuide";

beforeEach(() => {
  clearVault();
  clearVoice();
  setVoiceDir("/mock/voice");
});

afterEach(() => {
  clearVoice();
  clearVault();
});

function dnaFixture(): StyleGuideDna {
  return {
    name: "사색적 산문",
    coreImpression: "차분하지만 단단한 사유",
    sentenceBreath: "중간 길이 + 짧은 단정문 교차",
    sentenceStructure: "대조 구조 빈번",
    vocabulary: "구체어 우세",
    thoughtFlow: "경험에서 개념으로",
    emotionTemperature: "온도 있는 이성",
    readerDistance: "옆자리 선배",
    frequentSentencePatterns: "A는 B가 아니다. C다.",
    frequentThoughtPatterns: "문제 제기 → 재정의",
    strengths: "리듬감 있는 단정",
    weaknesses: "관념 위험",
    keep: "사유의 흔적",
    reduce: "긴 추상문",
    nonNegotiable: "독자와 함께 생각하는 태도",
    oneLineDefinition: "차분하게 단정하는 사유의 산문",
  };
}

function axesFixture(): StyleGuideAxes {
  return {
    firstImpression: ["사색적", "단정적", "구체적", "회의적", "친근함"],
    sentenceBreath: "x",
    sentenceStructure: "x",
    vocabularyTendency: "x",
    thoughtFlow: "x",
    readerDistance: "x",
    emotionAndAttitude: "x",
    metaphorAndImagery: "x",
    strengths: "x",
    weaknesses: "x",
    styleDna: dnaFixture(),
    compressedPrompt: "압축 프롬프트 본문",
    tone: "차분",
    sentenceLength: "중간",
    endings: "다체",
    vocabulary: "구체적",
    breath: "여유",
    summary: "차분한 산문체",
  };
}

describe("styleGuide.checkFreshness", () => {
  it("폴더 비어 있고 가드 없음 → hasGuide=false, isStale=false (메시지: 폴더 비어 있음)", async () => {
    const r = await checkFreshness();
    expect(r.hasGuide).toBe(false);
    expect(r.isStale).toBe(false);
    expect(r.files).toEqual([]);
    expect(r.message).toContain("비어 있");
  });

  it("파일은 있는데 가드 없음 → isStale=true", async () => {
    setVoiceFile("essay.md", "긴 글…", 1_000);
    const r = await checkFreshness();
    expect(r.hasGuide).toBe(false);
    expect(r.isStale).toBe(true);
    expect(r.files.length).toBe(1);
  });

  it("가드와 파일 signature 가 일치 → isStale=false", async () => {
    const a = "글 A";
    const b = "글 B";
    setVoiceFile("a.md", a, 1_000);
    setVoiceFile("b.md", b, 2_000);
    const guide: StyleGuide = {
      version: STYLE_GUIDE_VERSION,
      analyzedAt: "2026-04-29T00:00:00.000Z",
      provider: "codex",
      sampleSignatures: [
        { name: "a.md", modifiedMs: 1_000, size: a.length },
        { name: "b.md", modifiedMs: 2_000, size: b.length },
      ],
      guide: axesFixture(),
    };
    await saveStyleGuide(guide);
    const r = await checkFreshness();
    expect(r.hasGuide).toBe(true);
    expect(r.isStale).toBe(false);
  });

  it("파일이 수정되면 stale", async () => {
    const a = "글 A";
    setVoiceFile("a.md", a, 1_000);
    const baseGuide: StyleGuide = {
      version: STYLE_GUIDE_VERSION,
      analyzedAt: "2026-04-29T00:00:00.000Z",
      provider: "codex",
      sampleSignatures: [{ name: "a.md", modifiedMs: 1_000, size: a.length }],
      guide: axesFixture(),
    };
    await saveStyleGuide(baseGuide);
    setVoiceFile("a.md", "글 A 수정", 5_000);
    const r = await checkFreshness();
    expect(r.isStale).toBe(true);
  });

  it("새 파일이 추가되면 stale", async () => {
    const a = "글 A";
    setVoiceFile("a.md", a, 1_000);
    const baseGuide: StyleGuide = {
      version: STYLE_GUIDE_VERSION,
      analyzedAt: "2026-04-29T00:00:00.000Z",
      provider: "codex",
      sampleSignatures: [{ name: "a.md", modifiedMs: 1_000, size: a.length }],
      guide: axesFixture(),
    };
    await saveStyleGuide(baseGuide);
    setVoiceFile("b.md", "새 글", 6_000);
    const r = await checkFreshness();
    expect(r.isStale).toBe(true);
  });
});

describe("styleGuide read/write", () => {
  it("save → load 라운드트립", async () => {
    const guide: StyleGuide = {
      version: STYLE_GUIDE_VERSION,
      analyzedAt: "2026-04-29T00:00:00.000Z",
      provider: "claude-code",
      sampleSignatures: [],
      guide: axesFixture(),
    };
    await saveStyleGuide(guide);
    const loaded = await loadStyleGuide();
    expect(loaded?.guide.firstImpression.length).toBe(5);
    expect(loaded?.guide.styleDna.oneLineDefinition).toContain("산문");
    expect(loaded?.provider).toBe("claude-code");
  });

  it("가드 파일이 없으면 null", async () => {
    const loaded = await loadStyleGuide();
    expect(loaded).toBeNull();
  });
});
