import { WritingNoteIO } from "../src/project/WritingNoteIO";
import {
  PLUGIN_ID,
  SCHEMA_VERSION,
  WritingProjectFrontmatter,
} from "../src/types";

const SAMPLE: WritingProjectFrontmatter = {
  type: "writing",
  status: "drafting",
  genre: "essay",
  created: "2026-04-28",
  updated: "2026-04-28",
  word_goal: 3000,
  current_words: 240,
  target_reader: "30대 직장인",
  core_message: "쓰기는 살아남기다",
  source_notes: ["[[1a 글쓰기 시작]]", "[[2 자료/메모]]"],
  plugin: PLUGIN_ID,
  schema_version: SCHEMA_VERSION,
  tags: ["글쓰기", "원고"],
};

describe("WritingNoteIO", () => {
  it("serialize produces fenced YAML block", () => {
    const out = WritingNoteIO.serialize(SAMPLE);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out.includes("\n---\n")).toBe(true);
    expect(out.includes(`plugin: ${PLUGIN_ID}`)).toBe(true);
    expect(out.includes("type: writing")).toBe(true);
  });

  it("round-trips: serialize → parse → equal frontmatter", () => {
    const ser = WritingNoteIO.serialize(SAMPLE) + "\n# 제목\n\n본문\n";
    const parsed = WritingNoteIO.parse(ser);
    expect(parsed.frontmatter).not.toBeNull();
    expect(parsed.frontmatter).toEqual(SAMPLE);
  });

  it("round-trips a second time stably (idempotent)", () => {
    const a = WritingNoteIO.serialize(SAMPLE);
    const parsedA = WritingNoteIO.parse(a + "\n# t\n\nbody\n");
    const b = WritingNoteIO.serialize(parsedA.frontmatter!);
    expect(b).toBe(a);
  });

  it("returns null frontmatter for non-AMS notes", () => {
    const note = `---
type: permanent
plugin: zettel-connect
---

내용`;
    const parsed = WritingNoteIO.parse(note);
    expect(parsed.frontmatter).toBeNull();
  });

  it("buildInitialNote includes title and template body", () => {
    const out = WritingNoteIO.buildInitialNote(SAMPLE, "제목입니다", "## 기획\n");
    expect(out.includes("# 제목입니다")).toBe(true);
    expect(out.includes("## 기획")).toBe(true);
    expect(out.startsWith("---\n")).toBe(true);
  });

  it("replaceFrontmatter preserves body verbatim", () => {
    const ser = WritingNoteIO.serialize(SAMPLE);
    const original = ser + "\n# 제목\n\n본문\n";
    const updated: WritingProjectFrontmatter = { ...SAMPLE, current_words: 999 };
    const next = WritingNoteIO.replaceFrontmatter(original, updated);
    expect(next.includes("current_words: 999")).toBe(true);
    expect(next.includes("# 제목")).toBe(true);
    expect(next.includes("본문")).toBe(true);
  });
});
