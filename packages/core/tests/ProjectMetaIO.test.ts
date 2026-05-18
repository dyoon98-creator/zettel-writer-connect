import { ProjectMetaIO } from "../src/project/ProjectMetaIO";
import {
  DEFAULT_LABELS,
  DEFAULT_STATUSES,
  PROJECT_SCHEMA,
  ProjectMeta,
} from "../src/project/schema";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { PLUGIN_ID } from "../src/types";

describe("ProjectMetaIO.create", () => {
  it("기본 customStatuses/customLabels 를 채워준다", async () => {
    const vault = new InMemoryVaultAdapter();
    const meta = await ProjectMetaIO.create(vault, "Writing/p1", {
      id: "p1",
      title: "Project 1",
      genre: "investment-strategy-memo",
    });
    expect(meta.customStatuses).toHaveLength(DEFAULT_STATUSES.length);
    expect(meta.customLabels).toHaveLength(DEFAULT_LABELS.length);
    expect(meta.label).toBe("scene"); // DEFAULT_LABELS 의 default
    expect(meta.status).toBe("planning"); // 기본 init 값
    expect(meta.plugin).toBe(PLUGIN_ID);
    expect(meta.schema).toBe(PROJECT_SCHEMA);
  });

  it("pretty-printed JSON 에 \\n 포함하고 schema 식별 가능", async () => {
    const vault = new InMemoryVaultAdapter();
    await ProjectMetaIO.create(vault, "Writing/p1", {
      id: "p1",
      title: "P",
      genre: "investment-strategy-memo",
    });
    const raw = vault.getFile("Writing/p1/project.json");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.includes("\n  ")).toBe(true);
    expect(raw.includes(`"schema": "${PROJECT_SCHEMA}"`)).toBe(true);
  });

  it("custom statuses/labels 를 init 으로 전달하면 그대로 사용", async () => {
    const vault = new InMemoryVaultAdapter();
    const customStatuses = [
      { id: "x", name: "X", color: "#abc", default: true },
    ];
    const meta = await ProjectMetaIO.create(vault, "Writing/p", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
      customStatuses,
    });
    expect(meta.customStatuses).toEqual(customStatuses);
  });

  it("id 또는 title 이 비면 throw", async () => {
    const vault = new InMemoryVaultAdapter();
    await expect(
      ProjectMetaIO.create(vault, "Writing/p", {
        id: "",
        title: "",
        genre: "investment-strategy-memo",
      }),
    ).rejects.toThrow();
  });
});

describe("ProjectMetaIO.read / write round-trip", () => {
  it("write 후 read 로 동일 메타 (updatedAt 제외)", async () => {
    const vault = new InMemoryVaultAdapter();
    const orig = await ProjectMetaIO.create(vault, "Writing/p", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
    });
    const round = await ProjectMetaIO.read(vault, "Writing/p");
    expect(round.id).toBe(orig.id);
    expect(round.customStatuses).toEqual(orig.customStatuses);
    expect(round.customLabels).toEqual(orig.customLabels);
  });

  it("write 가 updatedAt 을 갱신", async () => {
    const vault = new InMemoryVaultAdapter();
    const meta = await ProjectMetaIO.create(vault, "Writing/p", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
      createdAt: "2020-01-01",
    });
    expect(meta.createdAt).toBe("2020-01-01");
    const direct = await ProjectMetaIO.read(vault, "Writing/p");
    expect(direct.updatedAt).not.toBe("2020-01-01");
  });

  it("schema 위반 시 read throw", async () => {
    const vault = new InMemoryVaultAdapter({
      files: {
        "Writing/p/project.json": JSON.stringify({ schema: "wrong" }),
      },
    });
    await expect(ProjectMetaIO.read(vault, "Writing/p")).rejects.toThrow(
      /스키마 위반/,
    );
  });

  it("invalid JSON 시 read throw", async () => {
    const vault = new InMemoryVaultAdapter({
      files: { "Writing/p/project.json": "{" },
    });
    await expect(ProjectMetaIO.read(vault, "Writing/p")).rejects.toThrow(
      /JSON 파싱/,
    );
  });
});

describe("ProjectMetaIO.exists", () => {
  it("project.json 유무 검사", async () => {
    const vault = new InMemoryVaultAdapter();
    expect(await ProjectMetaIO.exists(vault, "Writing/p")).toBe(false);
    await ProjectMetaIO.create(vault, "Writing/p", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
    });
    expect(await ProjectMetaIO.exists(vault, "Writing/p")).toBe(true);
  });
});

describe("ProjectMetaIO.write preserves explicit customMetadata", () => {
  it("customMetadata 를 round-trip", async () => {
    const vault = new InMemoryVaultAdapter();
    const meta: ProjectMeta = await ProjectMetaIO.create(vault, "Writing/p", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
      customMetadata: { mood: "warm" },
    });
    expect(meta.customMetadata?.mood).toBe("warm");
    const round = await ProjectMetaIO.read(vault, "Writing/p");
    expect(round.customMetadata?.mood).toBe("warm");
  });
});
