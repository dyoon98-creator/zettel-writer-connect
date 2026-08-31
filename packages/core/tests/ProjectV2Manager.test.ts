import {
  ProjectV2Manager,
} from "../src/project/ProjectV2Manager";
import { ProjectMetaIO } from "../src/project/ProjectMetaIO";
import { BinderIO } from "../src/project/BinderIO";
import { SceneIO } from "../src/project/SceneIO";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { InMemoryFrontmatterAdapter } from "../src/adapters/InMemoryFrontmatterAdapter";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";

function makeManager() {
  const vault = new InMemoryVaultAdapter();
  const notice = new InMemoryNoticeAdapter();
  const frontmatter = new InMemoryFrontmatterAdapter(vault);
  const mgr = new ProjectV2Manager({ vault, notice, frontmatter });
  return { vault, notice, frontmatter, mgr };
}

describe("ProjectV2Manager.createProject", () => {
  it("project.json + binder.json + planning.md 를 만든다", async () => {
    const { vault, mgr } = makeManager();
    const meta = await mgr.createProject("3 Writing", {
      id: "test-proj",
      title: "Test",
      genre: "investment-strategy-memo",
      wordGoal: 1000,
    });
    expect(meta.id).toBe("test-proj");
    expect(vault.hasFile("3 Writing/test-proj/project.json")).toBe(true);
    expect(vault.hasFile("3 Writing/test-proj/binder.json")).toBe(true);
    expect(vault.hasFile("3 Writing/test-proj/planning.md")).toBe(true);
  });

  it("seedPlanning=false 면 planning.md 미생성", async () => {
    const { vault, mgr } = makeManager();
    await mgr.createProject("3 Writing", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
      seedPlanning: false,
    });
    expect(vault.hasFile("3 Writing/p/planning.md")).toBe(false);
  });

  it("이미 project.json 이 있으면 throw", async () => {
    const { mgr } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await expect(
      mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" }),
    ).rejects.toThrow(/이미 프로젝트/);
  });
});

describe("ProjectV2Manager.list", () => {
  it("writingRoot 가 비면 빈 배열", async () => {
    const { mgr } = makeManager();
    expect(await mgr.list("3 Writing")).toEqual([]);
  });

  it("project.json 이 있는 폴더만 모음", async () => {
    const { vault, mgr } = makeManager();
    await mgr.createProject("3 Writing", { id: "a", title: "A", genre: "investment-strategy-memo" });
    await mgr.createProject("3 Writing", { id: "b", title: "B", genre: "investment-strategy-memo" });
    // 노이즈 — project.json 없는 폴더
    await vault.writeFile("3 Writing/junk/note.md", "x");
    const list = await mgr.list("3 Writing");
    expect(list.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });
});

describe("ProjectV2Manager binder operations", () => {
  it("addFolder 가 binder 에 추가됨", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    const folder = await mgr.addFolder("3 Writing/p", null, {
      id: "ch1",
      title: "1장",
    });
    expect(folder.id).toBe("ch1");
    const tree = await BinderIO.read(vault, "3 Writing/p");
    expect(BinderIO.findNode(tree, "ch1")?.title).toBe("1장");
  });

  it("addScene 이 binder + scene 파일 둘 다 만든다", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "도입" });
    const scene = await mgr.addScene("3 Writing/p", "ch1", {
      title: "노트북을 펼치다",
      body: "첫 문장.\n",
    });
    expect(scene.id).toBeTruthy();
    expect(vault.hasFile(`3 Writing/p/${scene.file}`)).toBe(true);

    const tree = await BinderIO.read(vault, "3 Writing/p");
    const ch1 = BinderIO.findNode(tree, "ch1");
    expect(ch1?.type).toBe("folder");
    if (ch1?.type === "folder") {
      expect(ch1.children.map((c) => c.id)).toContain(scene.id);
    }

    // scene frontmatter 확인
    const sceneFm = await SceneIO.read(vault, "3 Writing/p", scene.file);
    expect(sceneFm.frontmatter?.scene_id).toBe(scene.id);
    expect(sceneFm.frontmatter?.project).toBe("p");
  });

  it("addScene 이 같은 파일명 충돌 시 자동 회피", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "장1" });
    const a = await mgr.addScene("3 Writing/p", "ch1", {
      title: "같은-제목",
      file: "01-장1/같은-제목.md",
    });
    const b = await mgr.addScene("3 Writing/p", "ch1", {
      title: "같은-제목",
      file: "01-장1/같은-제목.md",
    });
    expect(a.file).not.toBe(b.file);
    expect(vault.hasFile(`3 Writing/p/${a.file}`)).toBe(true);
    expect(vault.hasFile(`3 Writing/p/${b.file}`)).toBe(true);
  });

  it("reuseExistingFile 이면 이미 있는 파일을 «그대로» 쓴다", async () => {
    // 왜 필요한가 (2026-08-31 실측). 마법사가 `planning.md` 를 binder 에
    // 노출시킬 때 충돌 회피가 걸려 `planning-1.md` 라는 빈 껍데기가 생겼고,
    // binder 노드는 그 껍데기를 가리킨 채 실제 기획 본문은 planning.md 에
    // 쓰였다. 볼트에 planning 이 둘 보이고, 「기획 결과 보기」가 껍데기를 읽어
    // 「파싱하지 못했습니다」로 떴다.
    const { mgr } = makeManager();
    await mgr.createProject("3 Writing", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
    });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "장1" });

    const first = await mgr.addScene("3 Writing/p", "ch1", {
      title: "기획 인터뷰",
      file: "planning.md",
    });
    const second = await mgr.addScene("3 Writing/p", "ch1", {
      title: "기획 인터뷰",
      file: "planning.md",
      reuseExistingFile: true,
    });

    // createProject 가 planning.md 를 이미 만들어 둔다 — 실제 마법사 상황과 같다.
    // 플래그 없이 부르면 회피가 걸려 껍데기(planning-1.md)가 생긴다.
    expect(first.file).toBe("planning-1.md");
    // 플래그를 주면 있는 파일 그대로 — 이것이 마법사가 원하는 동작이다.
    expect(second.file).toBe("planning.md");
  });

  it("moveNode 로 노드 위치 이동", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch2", title: "2" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", {
      title: "scene",
    });
    await mgr.moveNode("3 Writing/p", sc.id, "ch2", 0);
    const tree = await BinderIO.read(vault, "3 Writing/p");
    const ch2 = BinderIO.findNode(tree, "ch2");
    if (ch2?.type === "folder") {
      expect(ch2.children.map((c) => c.id)).toContain(sc.id);
    }
    const ch1 = BinderIO.findNode(tree, "ch1");
    if (ch1?.type === "folder") {
      expect(ch1.children.map((c) => c.id)).not.toContain(sc.id);
    }
  });

  it("removeNode + deleteFile 옵션이 파일도 지움", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", { title: "scene" });
    expect(vault.hasFile(`3 Writing/p/${sc.file}`)).toBe(true);
    await mgr.removeNode("3 Writing/p", sc.id, { deleteFile: true });
    expect(vault.hasFile(`3 Writing/p/${sc.file}`)).toBe(false);
  });

  it("removeNode 가 deleteFile 미지정 시 파일 보존", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", { title: "scene" });
    await mgr.removeNode("3 Writing/p", sc.id);
    expect(vault.hasFile(`3 Writing/p/${sc.file}`)).toBe(true);
  });
});

describe("ProjectV2Manager status/label", () => {
  it("setNodeStatus 가 binder + scene frontmatter 모두 갱신", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", { title: "scene" });
    await mgr.setNodeStatus("3 Writing/p", sc.id, "done");
    const tree = await BinderIO.read(vault, "3 Writing/p");
    expect(BinderIO.findNode(tree, sc.id)?.status).toBe("done");
    const r = await SceneIO.read(vault, "3 Writing/p", sc.file);
    expect(r.frontmatter?.status).toBe("done");
  });

  it("setNodeStatus 가 존재하지 않는 statusId 거부 + 사용자 알림", async () => {
    const { mgr, notice } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", { title: "scene" });
    await expect(
      mgr.setNodeStatus("3 Writing/p", sc.id, "missing"),
    ).rejects.toThrow();
    expect(notice.contains("status id")).toBe(true);
  });

  it("setNodeLabel 도 동일하게 갱신", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const sc = await mgr.addScene("3 Writing/p", "ch1", { title: "scene" });
    await mgr.setNodeLabel("3 Writing/p", sc.id, "fragment");
    const r = await SceneIO.read(vault, "3 Writing/p", sc.file);
    expect(r.frontmatter?.label).toBe("fragment");
  });

  it("setProjectStatus 는 project.json.status 만 변경", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", {
      id: "p",
      title: "P",
      genre: "investment-strategy-memo",
      status: "drafting",
    });
    await mgr.setProjectStatus("3 Writing/p", "revising");
    const meta = await ProjectMetaIO.read(vault, "3 Writing/p");
    expect(meta.status).toBe("revising");
  });
});

describe("ProjectV2Manager.getCombinedWordCount", () => {
  it("전체 합 계산", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const a = await mgr.addScene("3 Writing/p", "ch1", { title: "a" });
    const b = await mgr.addScene("3 Writing/p", "ch1", { title: "b" });

    // word_count 직접 갱신 (binder.json 의 wordCount 필드)
    let tree = await BinderIO.read(vault, "3 Writing/p");
    tree = BinderIO.updateNode(tree, a.id, { wordCount: 100 } as Record<string, unknown>);
    tree = BinderIO.updateNode(tree, b.id, { wordCount: 50 } as Record<string, unknown>);
    await BinderIO.write(vault, "3 Writing/p", tree);

    const total = await mgr.getCombinedWordCount("3 Writing/p");
    expect(total).toBe(150);
  });

  it("nodeIds 지정 시 부분 합", async () => {
    const { mgr, vault } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    await mgr.addFolder("3 Writing/p", null, { id: "ch1", title: "1" });
    const a = await mgr.addScene("3 Writing/p", "ch1", { title: "a" });
    const b = await mgr.addScene("3 Writing/p", "ch1", { title: "b" });

    let tree = await BinderIO.read(vault, "3 Writing/p");
    tree = BinderIO.updateNode(tree, a.id, { wordCount: 100 } as Record<string, unknown>);
    tree = BinderIO.updateNode(tree, b.id, { wordCount: 50 } as Record<string, unknown>);
    await BinderIO.write(vault, "3 Writing/p", tree);

    const total = await mgr.getCombinedWordCount("3 Writing/p", [a.id]);
    expect(total).toBe(100);
  });
});

describe("ProjectV2Manager.open", () => {
  it("project.json + binder.json 을 함께 로드", async () => {
    const { mgr } = makeManager();
    await mgr.createProject("3 Writing", { id: "p", title: "P", genre: "investment-strategy-memo" });
    const snapshot = await mgr.open("3 Writing/p");
    expect(snapshot.meta.id).toBe("p");
    expect(snapshot.binder.root).toEqual([]);
  });
});
