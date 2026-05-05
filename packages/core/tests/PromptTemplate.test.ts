// PromptTemplate — placeholder enumeration + load-time validation.

import {
  applyTemplate,
  buildPlaceholders,
  SUPPORTED_PLACEHOLDERS,
  validateTemplate,
} from "../src/skillpack/PromptTemplate";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";

describe("PromptTemplate placeholder set", () => {
  it("includes all 11 placeholders", () => {
    const expected = [
      "manuscript",
      "section",
      "source_notes",
      "reader",
      "core_message",
      "user_input",
      "title",
      "genre",
      "word_goal",
      "current_words",
      "status",
    ];
    expect([...SUPPORTED_PLACEHOLDERS].sort()).toEqual([...expected].sort());
    expect(SUPPORTED_PLACEHOLDERS.length).toBe(11);
  });

  it("buildPlaceholders fills every key, defaulting blanks", () => {
    const ph = buildPlaceholders({ title: "테스트", word_goal: "3000" });
    expect(ph.title).toBe("테스트");
    expect(ph.word_goal).toBe("3000");
    // Unset fields default to "".
    expect(ph.manuscript).toBe("");
    expect(ph.status).toBe("");
  });

  it("applyTemplate fills all 11 placeholders when provided", () => {
    const tpl = SUPPORTED_PLACEHOLDERS.map((k) => `${k}={{${k}}}`).join("\n");
    const values = buildPlaceholders({
      manuscript: "M",
      section: "S",
      source_notes: "SN",
      reader: "R",
      core_message: "C",
      user_input: "U",
      title: "T",
      genre: "G",
      word_goal: "WG",
      current_words: "CW",
      status: "ST",
    });
    const out = applyTemplate(tpl, values);
    expect(out.missing).toEqual([]);
    for (const k of SUPPORTED_PLACEHOLDERS) {
      expect(out.rendered).toContain(`${k}=${values[k]}`);
    }
  });

  it("missing placeholder leaves [누락: name]", () => {
    const out = applyTemplate("hi {{nope}}", {});
    expect(out.rendered).toBe("hi [누락: nope]");
    expect(out.missing).toEqual(["nope"]);
  });
});

describe("validateTemplate", () => {
  beforeEach(() => {
    // validateTemplate intentionally emits console.warn for visible warnings.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("issues warning for undeclared placeholder", () => {
    const notice = new InMemoryNoticeAdapter();
    const v = validateTemplate(
      "test-pack",
      "test.action",
      ["manuscript"],
      "원고: {{manuscript}}\n사용자 입력: {{user_input}}",
      notice,
    );
    expect(v.undeclared).toContain("user_input");
    expect(notice.contains("선언되지 않은")).toBe(true);
  });

  it("issues warning for unknown (non-supported) placeholder", () => {
    const notice = new InMemoryNoticeAdapter();
    const v = validateTemplate(
      "test-pack",
      "test.action",
      ["manuscript", "wat"],
      "원고: {{manuscript}}\n알 수 없음: {{wat}}",
      notice,
    );
    expect(v.unknown).toContain("wat");
  });

  it("declared but unused placeholder is reported as unused", () => {
    const v = validateTemplate(
      "test-pack",
      "test.action",
      ["manuscript", "title"],
      "원고: {{manuscript}}",
    );
    expect(v.unused).toContain("title");
  });

  it("no declarations → no undeclared warnings (but unknowns still flagged)", () => {
    const v = validateTemplate(
      "test-pack",
      "test.action",
      undefined,
      "원고: {{manuscript}} bogus: {{xyz}}",
    );
    expect(v.undeclared).toEqual([]);
    expect(v.unknown).toContain("xyz");
  });

  it("normalizes declared placeholders with {{ }} wrappers", () => {
    const v = validateTemplate(
      "test-pack",
      "test.action",
      ["{{manuscript}}", "{{user_input}}"],
      "{{manuscript}} {{user_input}}",
    );
    expect(v.undeclared).toEqual([]);
    expect(v.unused).toEqual([]);
  });
});
