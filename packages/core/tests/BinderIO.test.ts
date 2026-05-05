import { BinderIO } from "../src/project/BinderIO";
import { BinderTree, BINDER_SCHEMA } from "../src/project/schema";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";

function makeTree(): BinderTree {
  return {
    schema: BINDER_SCHEMA,
    root: [
      BinderIO.newFolder({
        id: "ch1",
        title: "Chapter 1",
        label: "chapter",
        status: "to-do",
        children: [
          BinderIO.newDocument({
            id: "ch1-sc1",
            title: "Scene 1",
            file: "01-도입/01-scene.md",
            label: "scene",
            status: "to-do",
          }),
          BinderIO.newDocument({
            id: "ch1-sc2",
            title: "Scene 2",
            file: "01-도입/02-scene.md",
            label: "scene",
            status: "to-do",
          }),
        ],
      }),
      BinderIO.newFolder({
        id: "ch2",
        title: "Chapter 2",
        label: "chapter",
        status: "to-do",
      }),
    ],
  };
}

describe("BinderIO findNode / pathToId / walk", () => {
  it("findNode 로 깊은 노드를 찾는다", () => {
    const tree = makeTree();
    const node = BinderIO.findNode(tree, "ch1-sc2");
    expect(node?.id).toBe("ch1-sc2");
    expect(BinderIO.findNode(tree, "missing")).toBeNull();
  });

  it("pathToId 는 root → 자기 자신까지의 id 배열", () => {
    const tree = makeTree();
    expect(BinderIO.pathToId(tree, "ch1-sc1")).toEqual(["ch1", "ch1-sc1"]);
    expect(BinderIO.pathToId(tree, "ch2")).toEqual(["ch2"]);
    expect(BinderIO.pathToId(tree, "missing")).toEqual([]);
  });

  it("walk 가 모든 노드를 dfs 로 방문", () => {
    const tree = makeTree();
    const visited: string[] = [];
    BinderIO.walk(tree, (n) => {
      visited.push(n.id);
    });
    expect(visited).toEqual(["ch1", "ch1-sc1", "ch1-sc2", "ch2"]);
  });

  it("walk 의 visitor 가 false 반환 시 중단", () => {
    const tree = makeTree();
    const visited: string[] = [];
    BinderIO.walk(tree, (n) => {
      visited.push(n.id);
      if (n.id === "ch1-sc1") return false;
    });
    expect(visited).toEqual(["ch1", "ch1-sc1"]);
  });
});

describe("BinderIO addNode / removeNode (immutability)", () => {
  it("addNode 는 새 tree 를 반환하고 원본을 변경하지 않는다", () => {
    const tree = makeTree();
    const before = JSON.stringify(tree);
    const node = BinderIO.newDocument({
      id: "new-doc",
      title: "New",
      file: "01-도입/03.md",
      label: "scene",
      status: "to-do",
    });
    const next = BinderIO.addNode(tree, "ch1", node);
    expect(JSON.stringify(tree)).toBe(before);
    expect(BinderIO.findNode(next, "new-doc")).not.toBeNull();
  });

  it("addNode 에 parentId=null 이면 root 에 추가", () => {
    const tree = makeTree();
    const node = BinderIO.newFolder({
      id: "ch3",
      title: "Chapter 3",
      label: "chapter",
      status: "to-do",
    });
    const next = BinderIO.addNode(tree, null, node);
    expect(next.root.map((n) => n.id)).toEqual(["ch1", "ch2", "ch3"]);
  });

  it("addNode 에 index 를 주면 그 위치에 삽입", () => {
    const tree = makeTree();
    const node = BinderIO.newFolder({
      id: "ch1.5",
      title: "Half",
      label: "chapter",
      status: "to-do",
    });
    const next = BinderIO.addNode(tree, null, node, 1);
    expect(next.root.map((n) => n.id)).toEqual(["ch1", "ch1.5", "ch2"]);
  });

  it("addNode 가 중복 id 거부", () => {
    const tree = makeTree();
    const dup = BinderIO.newFolder({
      id: "ch1",
      title: "dup",
      label: "chapter",
      status: "to-do",
    });
    expect(() => BinderIO.addNode(tree, null, dup)).toThrow(/이미 존재/);
  });

  it("addNode 가 document 부모를 거부", () => {
    const tree = makeTree();
    const node = BinderIO.newDocument({
      id: "x",
      title: "x",
      file: "x.md",
      label: "scene",
      status: "to-do",
    });
    expect(() => BinderIO.addNode(tree, "ch1-sc1", node)).toThrow(
      /folder/,
    );
  });

  it("removeNode 는 자식을 함께 제거", () => {
    const tree = makeTree();
    const next = BinderIO.removeNode(tree, "ch1");
    expect(next.root.map((n) => n.id)).toEqual(["ch2"]);
    expect(BinderIO.findNode(next, "ch1-sc1")).toBeNull();
  });

  it("removeNode 가 깊은 노드도 제거", () => {
    const tree = makeTree();
    const next = BinderIO.removeNode(tree, "ch1-sc1");
    expect(BinderIO.findNode(next, "ch1-sc1")).toBeNull();
    expect(BinderIO.findNode(next, "ch1-sc2")).not.toBeNull();
  });
});

describe("BinderIO moveNode", () => {
  it("같은 부모 안에서 reorder", () => {
    const tree = makeTree();
    const next = BinderIO.moveNode(tree, "ch1-sc2", "ch1", 0);
    const ch1 = BinderIO.findNode(next, "ch1");
    expect(ch1?.type).toBe("folder");
    if (ch1?.type === "folder") {
      expect(ch1.children.map((c) => c.id)).toEqual(["ch1-sc2", "ch1-sc1"]);
    }
  });

  it("다른 폴더로 이동", () => {
    const tree = makeTree();
    const next = BinderIO.moveNode(tree, "ch1-sc1", "ch2", 0);
    const ch2 = BinderIO.findNode(next, "ch2");
    if (ch2?.type === "folder") {
      expect(ch2.children.map((c) => c.id)).toEqual(["ch1-sc1"]);
    }
    const ch1 = BinderIO.findNode(next, "ch1");
    if (ch1?.type === "folder") {
      expect(ch1.children.map((c) => c.id)).toEqual(["ch1-sc2"]);
    }
  });

  it("root 로 이동", () => {
    const tree = makeTree();
    const next = BinderIO.moveNode(tree, "ch1-sc1", null, 0);
    expect(next.root[0].id).toBe("ch1-sc1");
  });

  it("자기 자신으로 이동 거부", () => {
    const tree = makeTree();
    expect(() => BinderIO.moveNode(tree, "ch1", "ch1", 0)).toThrow();
  });

  it("자손으로 이동 거부", () => {
    const tree = makeTree();
    expect(() => BinderIO.moveNode(tree, "ch1", "ch1-sc1", 0)).toThrow();
  });
});

describe("BinderIO read/write via InMemoryVaultAdapter", () => {
  it("write 후 read 로 동일한 tree", async () => {
    const vault = new InMemoryVaultAdapter();
    const tree = makeTree();
    await BinderIO.write(vault, "Writing/proj", tree);
    const round = await BinderIO.read(vault, "Writing/proj");
    expect(round).toEqual(tree);
  });

  it("스키마 위반 시 read 가 throw", async () => {
    const vault = new InMemoryVaultAdapter({
      files: {
        "Writing/proj/binder.json": JSON.stringify({ schema: "wrong", root: [] }),
      },
    });
    await expect(BinderIO.read(vault, "Writing/proj")).rejects.toThrow(
      /스키마 위반/,
    );
  });

  it("JSON parse 실패 시 read 가 throw", async () => {
    const vault = new InMemoryVaultAdapter({
      files: { "Writing/proj/binder.json": "not json" },
    });
    await expect(BinderIO.read(vault, "Writing/proj")).rejects.toThrow(
      /JSON 파싱/,
    );
  });
});

describe("BinderIO assignNewId", () => {
  it("호출마다 unique 한 id 를 만든다", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) ids.add(BinderIO.assignNewId());
    expect(ids.size).toBe(50);
  });

  it("id 형식이 timestamp-random", () => {
    const id = BinderIO.assignNewId();
    expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]{6}$/);
  });
});

describe("BinderIO updateNode / allIds", () => {
  it("updateNode 는 부분 갱신 + 원본 보존", () => {
    const tree = makeTree();
    const next = BinderIO.updateNode(tree, "ch1", { title: "변경" });
    expect(BinderIO.findNode(next, "ch1")?.title).toBe("변경");
    expect(BinderIO.findNode(tree, "ch1")?.title).toBe("Chapter 1");
  });

  it("allIds 는 모든 id 수집", () => {
    const tree = makeTree();
    const ids = BinderIO.allIds(tree);
    expect(ids.sort()).toEqual(["ch1", "ch1-sc1", "ch1-sc2", "ch2"]);
  });
});
