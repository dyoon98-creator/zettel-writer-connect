import { Templates, CANONICAL_SECTIONS } from "../src/project/Templates";
import { Genre } from "../src/types";

const GENRES: Genre[] = ["essay", "practical", "youtube", "lecture", "world"];

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

  it("essay contains H3 prompts inside 기획 (genre-specific)", () => {
    const body = Templates.body("essay");
    expect(body.includes("### 핵심 메시지")).toBe(true);
  });

  it("practical contains 챕터 윤곽 list", () => {
    const body = Templates.body("practical");
    expect(body.includes("### 챕터 윤곽")).toBe(true);
  });

  it("youtube contains Cold open prompt", () => {
    const body = Templates.body("youtube");
    expect(body.includes("Cold open")).toBe(true);
  });

  it("lecture contains 학습 목표 prompt", () => {
    const body = Templates.body("lecture");
    expect(body.includes("학습 목표")).toBe(true);
  });

  it("world contains 세계관 시트 prompt", () => {
    const body = Templates.body("world");
    expect(body.includes("세계관 시트")).toBe(true);
  });
});
