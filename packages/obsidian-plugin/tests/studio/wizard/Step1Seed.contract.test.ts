// Step1Seed.contract.test.ts — source-contract tests via fs.readFileSync.
// tsconfig.test.json excludes jsx, so .tsx cannot be imported directly.
// These tests assert invariants by reading source text.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC_PATH = join(
  __dirname,
  "../../../src/studio/wizard/concept/Step1Seed.tsx",
);

const src = readFileSync(SRC_PATH, "utf8");

describe("Step1Seed — taxonomy contract (B2.6)", () => {
  describe("old labels absent", () => {
    it("does not contain 소설", () => {
      expect(src).not.toMatch(/["']소설["']/);
    });
    it("does not contain 논픽션", () => {
      expect(src).not.toContain("논픽션");
    });
    it("does not contain 시나리오", () => {
      expect(src).not.toContain("시나리오");
    });
    it("does not contain 실용서", () => {
      expect(src).not.toContain("실용서");
    });
    it("does not contain 유튜브 대본", () => {
      expect(src).not.toContain("유튜브 대본");
    });
    it("does not contain 세계관/웹소설", () => {
      expect(src).not.toContain("세계관/웹소설");
    });
    it("does not contain DEFAULT_GENRE_FOR_TONE", () => {
      expect(src).not.toContain("DEFAULT_GENRE_FOR_TONE");
    });
    it("does not contain userChangedGenre", () => {
      expect(src).not.toContain("userChangedGenre");
    });
  });

  describe("8 tone labels present", () => {
    it("contains 간결한 의사결정체", () => {
      expect(src).toContain("간결한 의사결정체");
    });
    it("contains 분석적 보고체", () => {
      expect(src).toContain("분석적 보고체");
    });
    it("contains 고객 보고체 (customer-report label)", () => {
      expect(src).toContain("고객 보고체");
    });
    it("does not contain 투자위원회 보고체 (old label removed)", () => {
      expect(src).not.toContain("투자위원회 보고체");
    });
    it("contains 법률·회계 검토체", () => {
      expect(src).toContain("법률·회계 검토체");
    });
    it("contains 칼럼형 서술체", () => {
      expect(src).toContain("칼럼형 서술체");
    });
    it("contains 장문 원고형 사유체", () => {
      expect(src).toContain("장문 원고형 사유체");
    });
    it("contains 강의·발표체", () => {
      expect(src).toContain("강의·발표체");
    });
    it("contains 친절한 설명체", () => {
      expect(src).toContain("친절한 설명체");
    });
  });

  describe("copy and defaults", () => {
    it("does not contain 어떤 책을 쓰고 싶나요", () => {
      expect(src).not.toContain("어떤 책을 쓰고 싶나요");
    });
    it("contains 어떤 글/문서를 만들까요", () => {
      expect(src).toContain("어떤 글/문서를 만들까요");
    });
    it("placeholder mentions 목적, 독자, 핵심 메시지", () => {
      expect(src).toContain("목적, 독자, 핵심 메시지");
    });
    it("tone section label is 문체·논조", () => {
      expect(src).toContain("문체·논조");
    });
    it("default tone is decision-memo", () => {
      expect(src).toMatch(/useState<ConceptTone>\("decision-memo"\)/);
    });
    it("default genre is investment-strategy-memo", () => {
      expect(src).toMatch(/useState<Genre>\("investment-strategy-memo"\)/);
    });
  });

  describe("genre options sourced from GENRE_LABEL_KO", () => {
    it("imports GENRE_LABEL_KO from core", () => {
      expect(src).toMatch(/GENRE_LABEL_KO.*@ai-manuscript-studio\/core/s);
    });
    it("derives GENRE_OPTIONS from GENRE_LABEL_KO", () => {
      expect(src).toContain("Object.entries(GENRE_LABEL_KO)");
    });
  });
});
