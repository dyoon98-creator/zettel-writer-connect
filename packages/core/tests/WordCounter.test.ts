import { countChars, countWords } from "../src/metrics/WordCounter";

describe("WordCounter.countChars (공백 포함, 줄바꿈 제외)", () => {
  it("counts Korean glyphs", () => {
    expect(countChars("안녕하세요")).toBe(5);
  });

  it("counts spaces and punctuation (한국어 글자수 표준 = 공백 포함)", () => {
    // 안녕, 세상! → 안 녕 , [space] 세 상 ! = 7
    expect(countChars("안녕, 세상!")).toBe(7);
  });

  it("excludes frontmatter, includes spaces in body", () => {
    const body = `---
type: writing
status: drafting
---

본문 이다.`;
    // 본 문 [space] 이 다 . = 6
    expect(countChars(body)).toBe(6);
  });

  it("excludes fenced code blocks but includes body spaces", () => {
    const body = "본문\n\n```\nconst x = 1;\n```\n\n계속";
    // 본 문 계 속 = 4 (줄바꿈은 제외, 코드는 normalize 단계에서 제거)
    expect(countChars(body)).toBe(4);
  });

  it("excludes inline code, keeps surrounding spaces", () => {
    const body = "텍스트 `code()` 끝";
    // 텍 스 트 [space] [space] 끝 = 6 (인라인 코드만 제거, 양쪽 공백은 유지)
    expect(countChars(body)).toBe(6);
  });

  it("uses wiki link alias when present", () => {
    const body = "[[file|읽기]]";
    expect(countChars(body)).toBe(2); // 읽 기
  });

  it("uses wiki link target when no alias", () => {
    const body = "[[abc]]";
    expect(countChars(body)).toBe(3); // a b c
  });

  it("strips heading anchor in wiki link", () => {
    const body = "[[file#section]]";
    expect(countChars(body)).toBe(4); // f i l e
  });

  it("excludes HTML comments", () => {
    const body = "본문<!-- 숨김 -->끝";
    expect(countChars(body)).toBe(3); // 본 문 끝
  });

  it("excludes line breaks but counts spaces", () => {
    // "한 줄.\n다음 줄." → 한 [sp] 줄 . 다 음 [sp] 줄 . = 9 (줄바꿈만 제외)
    expect(countChars("한 줄.\n다음 줄.")).toBe(9);
  });
});

describe("WordCounter.countWords", () => {
  it("splits Korean text on spaces", () => {
    expect(countWords("나는 글을 쓴다")).toBe(3);
  });

  it("ignores empty tokens from punctuation", () => {
    expect(countWords("안녕, 세상!")).toBe(2);
  });

  it("counts wiki alias as one or more tokens", () => {
    // "본문 [[file|두 단어]] 끝" → 본문 / 두 / 단어 / 끝 = 4
    expect(countWords("본문 [[file|두 단어]] 끝")).toBe(4);
  });

  it("excludes frontmatter and code", () => {
    const body = `---
key: value
---

가나 다라

\`\`\`
ignore me
\`\`\``;
    expect(countWords(body)).toBe(2); // 가나 / 다라
  });
});
