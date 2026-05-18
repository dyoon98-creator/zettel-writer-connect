import {
  PLUGIN_ID,
  SCHEMA_VERSION,
  STATUS_LABEL_KO,
  GENRE_LABEL_KO,
} from "../src/types";

describe("types", () => {
  it("has the canonical plugin id", () => {
    expect(PLUGIN_ID).toBe("ai-manuscript-studio");
  });

  it("starts at schema version 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it("has Korean labels for every status", () => {
    const statuses = [
      "idea",
      "planning",
      "outline",
      "researching",
      "drafting",
      "feedback",
      "revising",
      "final",
      "published",
    ] as const;
    for (const s of statuses) {
      expect(STATUS_LABEL_KO[s]).toBeTruthy();
    }
  });

  it("has Korean labels for every genre (final six)", () => {
    expect(Object.keys(GENRE_LABEL_KO)).toEqual([
      "investment-strategy-memo",
      "investment-report",
      "legal-accounting-review",
      "column-essay",
      "lecture-presentation",
      "long-form-manuscript",
    ]);
  });

  it("genre labels are final representative set", () => {
    const labels = Object.values(GENRE_LABEL_KO);
    expect(labels).toEqual([
      "투자·전략 메모",
      "투자보고서",
      "법률·회계·계약 검토",
      "칼럼/에세이",
      "강의·발표안",
      "장문 원고",
    ]);
  });

  it("does not contain old generic genre keys", () => {
    const keys = Object.keys(GENRE_LABEL_KO);
    expect(keys).not.toContain("essay");
    expect(keys).not.toContain("practical");
    expect(keys).not.toContain("youtube");
    expect(keys).not.toContain("lecture");
    expect(keys).not.toContain("world");
  });
});
