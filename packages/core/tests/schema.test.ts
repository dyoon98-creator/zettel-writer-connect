import {
  BINDER_SCHEMA,
  CONCEPT_DRAFT_SCHEMA,
  DEFAULT_LABELS,
  DEFAULT_STATUSES,
  PROJECT_SCHEMA,
  SCENE_TYPE,
  isBinderNode,
  isBinderTree,
  isConceptDraftSession,
  isLabelDef,
  isProjectMeta,
  isSceneFrontmatter,
  isStatusDef,
} from "../src/project/schema";
import { PLUGIN_ID } from "../src/types";

describe("schema constants and defaults", () => {
  it("schema 식별자가 정확하다", () => {
    expect(PROJECT_SCHEMA).toBe("ai-manuscript-studio.project.v2");
    expect(BINDER_SCHEMA).toBe("ai-manuscript-studio.binder.v2");
    expect(SCENE_TYPE).toBe("writing-scene");
  });

  it("DEFAULT_STATUSES 는 5개이고 정확히 하나가 default", () => {
    expect(DEFAULT_STATUSES).toHaveLength(5);
    const defaults = DEFAULT_STATUSES.filter((s) => s.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("first-draft");
  });

  it("DEFAULT_LABELS 는 7개이고 정확히 하나가 default", () => {
    expect(DEFAULT_LABELS).toHaveLength(7);
    const defaults = DEFAULT_LABELS.filter((l) => l.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("scene");
  });
});

describe("isStatusDef / isLabelDef", () => {
  it("형태가 맞으면 true", () => {
    expect(isStatusDef({ id: "x", name: "X", color: "#abc" })).toBe(true);
    expect(
      isStatusDef({ id: "x", name: "X", color: "#abc", default: true }),
    ).toBe(true);
    expect(isLabelDef({ id: "y", name: "Y", color: "red" })).toBe(true);
  });

  it("필드 누락 시 false", () => {
    expect(isStatusDef({ id: "x", name: "X" })).toBe(false);
    expect(isStatusDef({ name: "X", color: "#abc" })).toBe(false);
    expect(isStatusDef(null)).toBe(false);
    expect(isStatusDef("x")).toBe(false);
  });
});

describe("isProjectMeta", () => {
  const valid = {
    schema: PROJECT_SCHEMA,
    id: "proj-1",
    title: "프로젝트 1",
    genre: "investment-strategy-memo",
    status: "drafting",
    label: "scene",
    wordGoal: 1000,
    currentWords: 0,
    targetReader: "",
    coreMessage: "",
    createdAt: "2026-04-28",
    updatedAt: "2026-04-28",
    customStatuses: DEFAULT_STATUSES,
    customLabels: DEFAULT_LABELS,
    sourceNotes: [],
    plugin: PLUGIN_ID,
  };

  it("올바른 형태는 통과", () => {
    expect(isProjectMeta(valid)).toBe(true);
  });

  it("schema 가 다르면 거부", () => {
    expect(isProjectMeta({ ...valid, schema: "wrong" })).toBe(false);
  });

  it("plugin 이 다르면 거부", () => {
    expect(isProjectMeta({ ...valid, plugin: "other" })).toBe(false);
  });

  it("필수 string 필드가 비어 있어도 통과 (빈 문자열도 string)", () => {
    expect(isProjectMeta({ ...valid, targetReader: "" })).toBe(true);
  });

  it("customStatuses 항목이 깨져 있으면 거부", () => {
    expect(
      isProjectMeta({
        ...valid,
        customStatuses: [{ id: "x", name: "X" } as unknown],
      }),
    ).toBe(false);
  });
});

describe("isBinderTree / isBinderNode", () => {
  const folder = {
    id: "f1",
    type: "folder",
    title: "Ch 1",
    label: "chapter",
    status: "to-do",
    synopsis: "",
    children: [],
  };
  const doc = {
    id: "d1",
    type: "document",
    title: "Scene",
    label: "scene",
    status: "to-do",
    synopsis: "",
    file: "01-x/01-y.md",
  };

  it("folder/document 둘 다 통과", () => {
    expect(isBinderNode(folder)).toBe(true);
    expect(isBinderNode(doc)).toBe(true);
  });

  it("type 이 빠지면 false", () => {
    expect(isBinderNode({ ...folder, type: undefined })).toBe(false);
  });

  it("folder.children 이 array 가 아니면 false", () => {
    expect(isBinderNode({ ...folder, children: "x" })).toBe(false);
  });

  it("document.file 이 없으면 false", () => {
    expect(isBinderNode({ ...doc, file: undefined })).toBe(false);
  });

  it("BinderTree wrapper 검증", () => {
    expect(
      isBinderTree({
        schema: BINDER_SCHEMA,
        root: [folder, doc],
      }),
    ).toBe(true);
    expect(
      isBinderTree({ schema: "x", root: [] }),
    ).toBe(false);
  });
});

describe("isSceneFrontmatter", () => {
  const valid = {
    type: SCENE_TYPE,
    plugin: PLUGIN_ID,
    project: "p1",
    scene_id: "s1",
    status: "to-do",
    label: "scene",
    synopsis: "",
    word_count: 0,
    updated: "2026-04-28",
  };

  it("정확한 형태 통과", () => {
    expect(isSceneFrontmatter(valid)).toBe(true);
  });

  it("type 이 다르면 false", () => {
    expect(isSceneFrontmatter({ ...valid, type: "writing" })).toBe(false);
  });

  it("word_count 가 number 가 아니면 false", () => {
    expect(isSceneFrontmatter({ ...valid, word_count: "0" })).toBe(false);
  });
});

describe("isConceptDraftSession — ConceptTone 8종 검증", () => {
  const base = {
    schema: CONCEPT_DRAFT_SCHEMA,
    id: "sess-1",
    seed: "test seed",
    genre: "investment-report",
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "",
    synopsis: "",
    outline: [],
    stage: "concept",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const ALL_TONES = [
    "decision-memo",
    "analytical-report",
    "customer-report",
    "legal-accounting-review",
    "column-narrative",
    "long-form-reasoning",
    "lecture-presentation",
    "explanatory",
  ];

  for (const tone of ALL_TONES) {
    it(`유효 tone "${tone}" 통과`, () => {
      expect(isConceptDraftSession({ ...base, tone })).toBe(true);
    });
  }

  const OLD_INVALID_TONES = ["novel", "essay", "nonfiction", "screenplay", "investment-committee"];
  for (const tone of OLD_INVALID_TONES) {
    it(`구/무효 tone "${tone}" 거부`, () => {
      expect(isConceptDraftSession({ ...base, tone })).toBe(false);
    });
  }

  it("tone 이 없으면 false", () => {
    const { tone: _t, ...noTone } = { ...base, tone: "decision-memo" };
    expect(isConceptDraftSession(noTone)).toBe(false);
  });

  it("schema 가 다르면 false", () => {
    expect(isConceptDraftSession({ ...base, tone: "decision-memo", schema: "wrong" })).toBe(false);
  });

  describe("genre 6종 유효성 검증", () => {
    const VALID_GENRES = [
      "investment-strategy-memo",
      "investment-report",
      "legal-accounting-review",
      "column-essay",
      "lecture-presentation",
      "long-form-manuscript",
    ];

    for (const genre of VALID_GENRES) {
      it(`유효 genre "${genre}" 통과`, () => {
        expect(
          isConceptDraftSession({ ...base, tone: "decision-memo", genre }),
        ).toBe(true);
      });
    }

    const OLD_GENRES = ["essay", "practical", "youtube", "lecture", "world"];
    for (const genre of OLD_GENRES) {
      it(`구 genre "${genre}" 거부`, () => {
        expect(
          isConceptDraftSession({ ...base, tone: "decision-memo", genre }),
        ).toBe(false);
      });
    }

    it("genre 가 없으면 false", () => {
      const { genre: _g, ...noGenre } = { ...base, tone: "decision-memo", genre: "investment-report" };
      expect(isConceptDraftSession(noGenre)).toBe(false);
    });
  });
});
