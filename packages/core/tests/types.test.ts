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

  it("has Korean labels for every genre", () => {
    expect(Object.keys(GENRE_LABEL_KO)).toEqual([
      "essay",
      "practical",
      "youtube",
      "lecture",
      "world",
    ]);
  });
});
