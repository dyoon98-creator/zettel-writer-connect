import {
  SceneIO,
  parseScene,
  serializeScene,
  replaceSceneFrontmatter,
} from "../src/project/SceneIO";
import { SceneFrontmatter, SCENE_TYPE } from "../src/project/schema";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { InMemoryFrontmatterAdapter } from "../src/adapters/InMemoryFrontmatterAdapter";
import { PLUGIN_ID } from "../src/types";

const SAMPLE: SceneFrontmatter = {
  type: SCENE_TYPE,
  plugin: PLUGIN_ID,
  project: "ai-시대의-작가",
  scene_id: "ch1-sc1",
  status: "first-draft",
  label: "scene",
  synopsis: "작가가 노트북을 펼치는 순간",
  word_count: 520,
  updated: "2026-04-28",
};

describe("serializeScene / parseScene", () => {
  it("round-trip", () => {
    const ser = serializeScene(SAMPLE) + "\n본문 내용\n";
    const parsed = parseScene(ser);
    expect(parsed.frontmatter).not.toBeNull();
    expect(parsed.frontmatter).toEqual(SAMPLE);
    expect(parsed.body.trim()).toBe("본문 내용");
  });

  it("plugin 식별자가 다르면 frontmatter null", () => {
    const raw = `---
type: writing-scene
plugin: other
project: x
scene_id: x
status: x
label: x
synopsis: x
word_count: 0
updated: 2026-04-28
---

body`;
    expect(parseScene(raw).frontmatter).toBeNull();
  });

  it("type 이 다르면 frontmatter null", () => {
    const raw = `---
type: writing
plugin: ${PLUGIN_ID}
---

body`;
    expect(parseScene(raw).frontmatter).toBeNull();
  });

  it("replaceSceneFrontmatter 가 body 보존", () => {
    const original = serializeScene(SAMPLE) + "\nbody here\n";
    const updated = { ...SAMPLE, word_count: 999 };
    const next = replaceSceneFrontmatter(original, updated);
    expect(next.includes("word_count: 999")).toBe(true);
    expect(next.includes("body here")).toBe(true);
  });
});

describe("SceneIO.create / read / write", () => {
  it("create 가 새 파일 생성, read 가 동일 frontmatter", async () => {
    const vault = new InMemoryVaultAdapter();
    const fm = await SceneIO.create(vault, "Writing/p", {
      file: "01-도입/01-scene.md",
      project: "p",
      sceneId: "s1",
      status: "to-do",
      label: "scene",
      synopsis: "한 컷",
      body: "본문 첫 줄\n",
    });
    expect(fm.scene_id).toBe("s1");
    const round = await SceneIO.read(vault, "Writing/p", "01-도입/01-scene.md");
    expect(round.frontmatter?.scene_id).toBe("s1");
    expect(round.body.includes("본문 첫 줄")).toBe(true);
  });

  it("write 가 frontmatter + body 작성", async () => {
    const vault = new InMemoryVaultAdapter();
    await SceneIO.write(vault, "Writing/p", "x.md", SAMPLE, "신규 본문");
    const raw = vault.getFile("Writing/p/x.md");
    expect(raw.startsWith("---\n")).toBe(true);
    expect(raw.includes("신규 본문")).toBe(true);
  });

  it("read 가 frontmatter 없으면 null", async () => {
    const vault = new InMemoryVaultAdapter({
      files: { "Writing/p/empty.md": "그냥 본문" },
    });
    const r = await SceneIO.read(vault, "Writing/p", "empty.md");
    expect(r.frontmatter).toBeNull();
    expect(r.body).toBe("그냥 본문");
  });
});

describe("SceneIO.updateFrontmatter / writeBody", () => {
  it("updateFrontmatter 가 단일 필드만 변경 + updated 갱신", async () => {
    const vault = new InMemoryVaultAdapter();
    const frontmatter = new InMemoryFrontmatterAdapter(vault);
    await SceneIO.create(vault, "Writing/p", {
      file: "x.md",
      project: "p",
      sceneId: "s",
      status: "to-do",
      label: "scene",
      body: "B",
    });
    await SceneIO.updateFrontmatter(
      frontmatter,
      "Writing/p",
      "x.md",
      (fm) => {
        fm.status = "done";
      },
    );
    const r = await SceneIO.read(vault, "Writing/p", "x.md");
    expect(r.frontmatter?.status).toBe("done");
    expect(r.frontmatter?.updated).toBeDefined();
  });

  it("writeBody 가 본문만 교체하고 wordCount 업데이트", async () => {
    const vault = new InMemoryVaultAdapter();
    const frontmatter = new InMemoryFrontmatterAdapter(vault);
    await SceneIO.create(vault, "Writing/p", {
      file: "x.md",
      project: "p",
      sceneId: "s",
      status: "to-do",
      label: "scene",
      body: "원본",
    });
    await SceneIO.writeBody(
      vault,
      frontmatter,
      "Writing/p",
      "x.md",
      "새로운 본문 텍스트",
      9,
    );
    const r = await SceneIO.read(vault, "Writing/p", "x.md");
    expect(r.body).toBe("새로운 본문 텍스트");
    expect(r.frontmatter?.word_count).toBe(9);
  });
});
