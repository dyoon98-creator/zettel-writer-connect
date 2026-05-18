import { LabelManager } from "../src/status/LabelManager";
import {
  DEFAULT_LABELS,
  DEFAULT_STATUSES,
  PROJECT_SCHEMA,
  ProjectMeta,
} from "../src/project/schema";
import { PLUGIN_ID } from "../src/types";

function makeMeta(): ProjectMeta {
  return {
    schema: PROJECT_SCHEMA,
    id: "p",
    title: "P",
    genre: "investment-strategy-memo",
    status: "drafting",
    label: "scene",
    wordGoal: 0,
    currentWords: 0,
    targetReader: "",
    coreMessage: "",
    createdAt: "2026-04-28",
    updatedAt: "2026-04-28",
    customStatuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    customLabels: DEFAULT_LABELS.map((l) => ({ ...l })),
    sourceNotes: [],
    plugin: PLUGIN_ID,
  };
}

describe("LabelManager.add", () => {
  it("새 label 추가, immutability 유지", () => {
    const meta = makeMeta();
    const next = LabelManager.add(meta, {
      id: "act",
      name: "막",
      color: "#cba",
    });
    expect(next.customLabels.find((l) => l.id === "act")).toBeDefined();
    expect(meta.customLabels.find((l) => l.id === "act")).toBeUndefined();
  });

  it("중복 id 거부", () => {
    const meta = makeMeta();
    expect(() =>
      LabelManager.add(meta, { id: "scene", name: "x", color: "#abc" }),
    ).toThrow(/이미 존재/);
  });

  it("invalid color 거부", () => {
    const meta = makeMeta();
    expect(() =>
      LabelManager.add(meta, { id: "x", name: "x", color: "garbage" }),
    ).toThrow();
  });

  it("default:true 로 추가하면 기존 default 해제", () => {
    const meta = makeMeta();
    const next = LabelManager.add(meta, {
      id: "act",
      name: "막",
      color: "#cba",
      default: true,
    });
    const defaults = next.customLabels.filter((l) => l.default);
    expect(defaults.map((l) => l.id)).toEqual(["act"]);
  });
});

describe("LabelManager.update / remove / setDefault", () => {
  it("update 로 색상 변경", () => {
    const meta = makeMeta();
    const next = LabelManager.update(meta, "scene", { color: "#000000" });
    expect(next.customLabels.find((l) => l.id === "scene")?.color).toBe(
      "#000000",
    );
  });

  it("default 항목 제거 거부", () => {
    const meta = makeMeta();
    expect(() => LabelManager.remove(meta, "scene")).toThrow();
  });

  it("setDefault 가 단 하나만 default", () => {
    const meta = makeMeta();
    const next = LabelManager.setDefault(meta, "note");
    expect(
      next.customLabels.filter((l) => l.default).map((l) => l.id),
    ).toEqual(["note"]);
  });

  it("getDefault 는 default 표시된 것", () => {
    const meta = makeMeta();
    expect(LabelManager.getDefault(meta)?.id).toBe("scene");
  });

  it("exists 는 id 포함 여부", () => {
    const meta = makeMeta();
    expect(LabelManager.exists(meta, "scene")).toBe(true);
    expect(LabelManager.exists(meta, "missing")).toBe(false);
  });
});
