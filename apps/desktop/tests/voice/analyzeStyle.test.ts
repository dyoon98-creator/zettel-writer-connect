// analyzeStyle.test.ts — JSON 추출 / 14단계 가드 파싱 단위.

import { describe, expect, it } from "vitest";

import { _internal } from "../../src/voice/analyzeStyle";

const { extractJsonObject, parseAxes } = _internal;

const FULL_DNA = {
  name: "사색적 산문",
  coreImpression: "차분하지만 단단한 사유",
  sentenceBreath: "중간 + 짧은 단정문",
  sentenceStructure: "대조 구조 빈번",
  vocabulary: "구체어 우세",
  thoughtFlow: "경험에서 개념",
  emotionTemperature: "온도 있는 이성",
  readerDistance: "옆자리 선배",
  frequentSentencePatterns: "A는 B가 아니다. C다.",
  frequentThoughtPatterns: "문제 → 재정의",
  strengths: "리듬감",
  weaknesses: "관념 위험",
  keep: "사유의 흔적",
  reduce: "긴 추상문",
  nonNegotiable: "함께 생각하는 태도",
  oneLineDefinition: "차분하게 단정하는 사유의 산문",
};

const FULL_AXES = {
  firstImpression: ["사색적", "단정적", "구체적", "회의적", "친근함"],
  sentenceBreath: "중간 길이가 기본, 짧은 단정문이 끼어든다.",
  sentenceStructure: "A는 B가 아니다. 오히려 C다.",
  vocabularyTendency: "구체어와 일상어 우세.",
  thoughtFlow: "경험에서 개념으로 이동.",
  readerDistance: "옆자리의 선배.",
  emotionAndAttitude: "온도 있는 이성.",
  metaphorAndImagery: "생활적 비유 위주.",
  strengths: "단정문이 명료한 결을 만든다.",
  weaknesses: "관념어 반복 위험.",
  styleDna: FULL_DNA,
  compressedPrompt: "당신은 작가의 차분한 산문 문체를 따른다…",
  tone: "차분",
  sentenceLength: "중간",
  endings: "다체",
  vocabulary: "구체적",
  breath: "여유",
  summary: "차분한 산문체",
};

describe("analyzeStyle.extractJsonObject", () => {
  it("앞뒤 텍스트가 있어도 첫 균형 잡힌 객체를 추출", () => {
    const raw = '응답: ```json\n{ "tone": "차분", "summary": "x" }\n```\n끝.';
    const got = extractJsonObject(raw);
    expect(got).toBe('{ "tone": "차분", "summary": "x" }');
  });

  it("중첩된 객체도 정확히 매칭", () => {
    const raw = '{"a": {"b": 1}, "c": "}"}';
    const got = extractJsonObject(raw);
    expect(got).toBe(raw);
  });

  it("매칭 실패 시 null", () => {
    expect(extractJsonObject("아무것도 없음")).toBeNull();
    expect(extractJsonObject("{불완전")).toBeNull();
  });
});

describe("analyzeStyle.parseAxes (14단계 스키마)", () => {
  it("모든 필수 필드가 채워지면 가드 객체 반환", () => {
    const ax = parseAxes(JSON.stringify(FULL_AXES));
    expect(ax).not.toBeNull();
    expect(ax?.firstImpression.length).toBe(5);
    expect(ax?.styleDna.oneLineDefinition).toContain("산문");
    expect(ax?.compressedPrompt).toContain("차분한 산문");
    expect(ax?.tone).toBe("차분");
  });

  it("firstImpression 배열이 없으면 null", () => {
    const broken = { ...FULL_AXES, firstImpression: undefined };
    expect(parseAxes(JSON.stringify(broken))).toBeNull();
  });

  it("DNA 의 한 필드라도 빠지면 null", () => {
    const brokenDna = { ...FULL_DNA, name: "" };
    const broken = { ...FULL_AXES, styleDna: brokenDna };
    expect(parseAxes(JSON.stringify(broken))).toBeNull();
  });

  it("compressedPrompt 가 빈 문자열이면 null", () => {
    const broken = { ...FULL_AXES, compressedPrompt: "   " };
    expect(parseAxes(JSON.stringify(broken))).toBeNull();
  });

  it("레거시 5축이 빠지면 null", () => {
    const broken = { ...FULL_AXES, summary: undefined };
    expect(parseAxes(JSON.stringify(broken))).toBeNull();
  });

  it("코드 펜스로 감싼 응답에서도 동작", () => {
    const raw = "```json\n" + JSON.stringify(FULL_AXES) + "\n```";
    const ax = parseAxes(raw);
    expect(ax).not.toBeNull();
    expect(ax?.styleDna.name).toBe("사색적 산문");
  });
});
