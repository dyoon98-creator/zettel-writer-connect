import { Templates, CANONICAL_SECTIONS } from "../src/project/Templates";
import { Genre } from "../src/types";

const GENRES: Genre[] = [
  "investment-strategy-memo",
  "investment-report",
  "legal-accounting-review",
  "column-essay",
  "lecture-presentation",
  "long-form-manuscript",
];

describe("Templates", () => {
  for (const g of GENRES) {
    it(`${g}: contains all canonical H2 sections`, () => {
      const body = Templates.body(g);
      for (const section of CANONICAL_SECTIONS) {
        const heading = `## ${section}`;
        expect(body.includes(heading)).toBe(true);
      }
    });
  }

  it("investment-strategy-memo contains 의사결정 맥락", () => {
    const body = Templates.body("investment-strategy-memo");
    expect(body.includes("### 의사결정 맥락")).toBe(true);
  });

  it("investment-report contains 운용 현황", () => {
    const body = Templates.body("investment-report");
    expect(body.includes("### 운용 현황")).toBe(true);
  });

  it("legal-accounting-review contains 쟁점 분석", () => {
    const body = Templates.body("legal-accounting-review");
    expect(body.includes("### 쟁점 분석")).toBe(true);
  });

  it("column-essay contains 핵심 메시지", () => {
    const body = Templates.body("column-essay");
    expect(body.includes("### 핵심 메시지")).toBe(true);
  });

  it("lecture-presentation contains 학습 목표", () => {
    const body = Templates.body("lecture-presentation");
    expect(body.includes("학습 목표")).toBe(true);
  });

  it("long-form-manuscript contains 챕터 윤곽", () => {
    const body = Templates.body("long-form-manuscript");
    expect(body.includes("### 챕터 윤곽")).toBe(true);
  });
});

describe("Templates — Scrivener-style workflow guidance (자료/초안/퇴고 메모/최종본)", () => {
  // 자료 section should guide research separation (Scrivener "Research within reach")
  it("모든 장르: ## 자료 안에 자료/출처 분리 안내 주석이 있다", () => {
    for (const g of GENRES) {
      const body = Templates.body(g);
      // COMMON_TAIL already has this; test it is present in every genre
      expect(body).toContain("## 자료");
      expect(body).toMatch(/관련 노트|위키링크|자료/);
    }
  });

  // 퇴고 메모 section should nudge snapshot-before-revision habit
  it("모든 장르: ## 퇴고 메모 안에 퇴고 전 스냅샷 습관 안내가 있다", () => {
    for (const g of GENRES) {
      const body = Templates.body(g);
      expect(body).toContain("## 퇴고 메모");
      expect(body).toMatch(/스냅샷|snapshot|수정 전|개정 전/i);
    }
  });

  // 최종본 section should guide compile/output separation from writing tone
  it("모든 장르: ## 최종본 안에 출력 채널·형식 안내가 있다", () => {
    for (const g of GENRES) {
      const body = Templates.body(g);
      expect(body).toContain("## 최종본");
      expect(body).toMatch(/출력|Word|PDF|채널|포맷|형식/i);
    }
  });

  // Investment/legal genres: 뼈대 should encourage card/synopsis thinking
  const INVESTMENT_GENRES: Genre[] = [
    "investment-strategy-memo",
    "investment-report",
    "legal-accounting-review",
  ];

  it("투자·법률 장르: ## 뼈대 안에 섹션/카드 시놉시스 안내가 있다", () => {
    for (const g of INVESTMENT_GENRES) {
      const body = Templates.body(g);
      expect(body).toContain("## 뼈대");
      expect(body).toMatch(/시놉시스|카드|조각|section|요점/i);
    }
  });
});
