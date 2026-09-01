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
    // 2026-09-01 — 이 계약도 «뒤집혔다».
    //
    // 톤에 기본값이 있으면, 톤→장르 추천이 그 기본값을 따라가 결국 사용자가
    // 아무것도 안 골라도 장르가 정해진다. 아래 장르 계약이 막으려던 사고가
    // 한 칸 뒤로 옮겨질 뿐이다. 그래서 톤도 미선택으로 시작한다.
    it("톤도 기본값 없이 시작한다 — 침묵이 문서 종류를 정하지 못하게", () => {
      expect(src).toMatch(/useState<ConceptTone \| null>\(null\)/);
      expect(src).not.toMatch(/useState<ConceptTone>\("[a-z-]+"\)/);
    });

    it("셋(씨앗·문체·장르)이 다 있어야 다음으로 넘어간다", () => {
      expect(src).toMatch(/tone === null/);
      expect(src).toMatch(/genre === null/);
    });

    it("톤을 고르면 장르가 «따라온다» — 흐름이 한 칸에서 멈추지 않게", () => {
      // 원본(vibelabs-web)에 있던 편의. 우리는 장르 체계를 갈아엎으며 잃었다가
      // 되살렸다. 단 사용자가 장르를 직접 만진 뒤에는 덮지 않는다.
      expect(src).toMatch(/suggestGenreForTone/);
      expect(src).toMatch(/genreChosenByUser/);
    });
    // 이 계약은 2026-08-31 에 «뒤집혔다» (대표 지시 — 과제 D).
    //
    // 예전 계약: 장르 기본값이 "investment-strategy-memo" 여야 한다.
    // 그 기본값 때문에 사용자가 장르를 안 고르면 «무엇을 쓰든» 투자·전략 메모가
    // 됐고, 그 값이 project.json → 기획 인터뷰 → 프롬프트까지 그대로 흘러가
    // 연애 이야기를 쓰는 대표에게 인터뷰가 「'test' 투자·전략 메모의 출발점을
    // 잡겠습니다」라고 말했다(실사용 실측).
    //
    // 새 계약: 기본값을 «두지 않는다». 침묵을 확신으로 바꾸지 않는다.
    it("장르 기본값을 하드코딩하지 않는다 — 고르기 전에는 진행 불가", () => {
      expect(src).not.toMatch(/useState<Genre>\("investment-strategy-memo"\)/);
      expect(src).toMatch(/useState<Genre \| null>\(null\)/);
      expect(src).toMatch(/genre === null/);
      // 추천으로 «미리» 채우는 것도 금지 — 그것도 침묵이 값을 정하는 것이다.
      expect(src).not.toMatch(/useState<Genre \| null>\(\s*suggestGenreForTone/);
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
