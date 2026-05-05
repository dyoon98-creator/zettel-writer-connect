import { StatusManager } from "../src/status/StatusManager";
import { isValidColor } from "../src/status/colors";
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
    genre: "essay",
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

describe("isValidColor", () => {
  it("hex 3/6 자리 통과", () => {
    expect(isValidColor("#abc")).toBe(true);
    expect(isValidColor("#ABCDEF")).toBe(true);
    expect(isValidColor("#123")).toBe(true);
  });
  it("CSS 명명 색상 통과", () => {
    expect(isValidColor("red")).toBe(true);
    expect(isValidColor("RED")).toBe(true);
    expect(isValidColor("transparent")).toBe(true);
  });
  it("잘못된 형식 거부", () => {
    expect(isValidColor("rgb(0,0,0)")).toBe(false);
    expect(isValidColor("#12")).toBe(false);
    expect(isValidColor("#12345")).toBe(false);
    expect(isValidColor("")).toBe(false);
    expect(isValidColor(123 as unknown)).toBe(false);
  });
});

describe("StatusManager.list", () => {
  it("clone 을 반환 — 원본 변경 영향 없음", () => {
    const meta = makeMeta();
    const list = StatusManager.list(meta);
    list[0].name = "X";
    expect(meta.customStatuses[0].name).not.toBe("X");
  });
});

describe("StatusManager.add", () => {
  it("새 status 추가", () => {
    const meta = makeMeta();
    const next = StatusManager.add(meta, {
      id: "new",
      name: "New",
      color: "#abc",
    });
    expect(next.customStatuses.find((s) => s.id === "new")).toBeDefined();
    expect(meta.customStatuses.find((s) => s.id === "new")).toBeUndefined();
  });

  it("default:true 로 추가하면 기존 default 해제", () => {
    const meta = makeMeta();
    const next = StatusManager.add(meta, {
      id: "new",
      name: "New",
      color: "#abc",
      default: true,
    });
    const defaults = next.customStatuses.filter((s) => s.default);
    expect(defaults.map((s) => s.id)).toEqual(["new"]);
  });

  it("중복 id 거부", () => {
    const meta = makeMeta();
    expect(() =>
      StatusManager.add(meta, {
        id: "to-do",
        name: "Dup",
        color: "#abc",
      }),
    ).toThrow(/이미 존재/);
  });

  it("invalid color 거부", () => {
    const meta = makeMeta();
    expect(() =>
      StatusManager.add(meta, {
        id: "x",
        name: "x",
        color: "not-a-color",
      }),
    ).toThrow(/color/);
  });
});

describe("StatusManager.update", () => {
  it("이름·색상 변경", () => {
    const meta = makeMeta();
    const next = StatusManager.update(meta, "to-do", {
      name: "할 일",
      color: "#fff",
    });
    const item = next.customStatuses.find((s) => s.id === "to-do");
    expect(item?.name).toBe("할 일");
    expect(item?.color).toBe("#fff");
  });

  it("invalid color 거부", () => {
    const meta = makeMeta();
    expect(() =>
      StatusManager.update(meta, "to-do", { color: "garbage" }),
    ).toThrow();
  });

  it("default:true 로 업데이트하면 기존 default 해제", () => {
    const meta = makeMeta();
    const next = StatusManager.update(meta, "to-do", { default: true });
    const defaults = next.customStatuses.filter((s) => s.default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe("to-do");
  });

  it("없는 id 거부", () => {
    const meta = makeMeta();
    expect(() =>
      StatusManager.update(meta, "missing", { name: "x" }),
    ).toThrow(/찾을 수 없/);
  });
});

describe("StatusManager.remove", () => {
  it("일반 항목 제거", () => {
    const meta = makeMeta();
    const next = StatusManager.remove(meta, "to-do");
    expect(next.customStatuses.map((s) => s.id)).not.toContain("to-do");
  });

  it("default 항목 제거 거부", () => {
    const meta = makeMeta();
    expect(() => StatusManager.remove(meta, "first-draft")).toThrow(
      /default/,
    );
  });

  it("없는 id 거부", () => {
    const meta = makeMeta();
    expect(() => StatusManager.remove(meta, "missing")).toThrow();
  });
});

describe("StatusManager.setDefault / getDefault / exists", () => {
  it("setDefault 가 단 하나만 default 로 만든다", () => {
    const meta = makeMeta();
    const next = StatusManager.setDefault(meta, "done");
    const defaults = next.customStatuses.filter((s) => s.default);
    expect(defaults.map((s) => s.id)).toEqual(["done"]);
  });

  it("getDefault 는 default 로 표시된 항목", () => {
    const meta = makeMeta();
    expect(StatusManager.getDefault(meta)?.id).toBe("first-draft");
  });

  it("exists 는 id 포함 여부", () => {
    const meta = makeMeta();
    expect(StatusManager.exists(meta, "to-do")).toBe(true);
    expect(StatusManager.exists(meta, "missing")).toBe(false);
  });
});
