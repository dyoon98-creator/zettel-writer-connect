// manuscriptRoot.test.ts — 단일 루트 마이그레이션의 멱등성/케이스 분기 검증.

import { BinderIO } from "../src/project/BinderIO";
import { BINDER_SCHEMA, type BinderTree } from "../src/project/schema";
import {
  MANUSCRIPT_ROOT_BACKUP_FILE,
  MANUSCRIPT_ROOT_ROLE,
  ensureSingleManuscriptRoot,
  findManuscriptRoot,
  isManuscriptRoot,
  migrateBinderOnDisk,
} from "../src/project/manuscriptRoot";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";

function flatTree(): BinderTree {
  // 평면 구조 — root 에 폴더 두 개와 document 한 개.
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
            id: "sc1",
            title: "Scene 1",
            file: "01/01.md",
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
      BinderIO.newDocument({
        id: "planning-doc",
        title: "기획",
        file: "planning.md",
        label: "manuscript",
        status: "to-do",
      }),
    ],
  };
}

let counter = 0;
const idGen = (): string => {
  counter += 1;
  return `gen-${counter}`;
};

beforeEach(() => {
  counter = 0;
});

describe("ensureSingleManuscriptRoot", () => {
  it("평면 root 를 단일 manuscript-root 로 감싼다", () => {
    const tree = flatTree();
    const result = ensureSingleManuscriptRoot(tree, {
      projectTitle: "내 원고",
      makeId: idGen,
    });
    expect(result.migrated).toBe(true);
    expect(result.reason).toBe("wrap-flat-root");
    expect(result.tree.root.length).toBe(1);
    const root = result.tree.root[0];
    expect(root.type).toBe("folder");
    expect(root.title).toBe("내 원고");
    expect(isManuscriptRoot(root)).toBe(true);
    if (root.type !== "folder") throw new Error("expected folder");
    expect(root.children.length).toBe(3);
    expect(root.children[0].id).toBe("ch1");
    expect(root.children[1].id).toBe("ch2");
    expect(root.children[2].id).toBe("planning-doc");
  });

  it("이미 manuscript-root 가 있으면 noop", () => {
    const tree = flatTree();
    const wrapped = ensureSingleManuscriptRoot(tree, {
      projectTitle: "내 원고",
      makeId: idGen,
    });
    const again = ensureSingleManuscriptRoot(wrapped.tree, {
      projectTitle: "내 원고",
      makeId: idGen,
    });
    expect(again.migrated).toBe(false);
    expect(again.reason).toBe("noop");
    expect(again.tree).toBe(wrapped.tree);
  });

  it("빈 root 는 빈 manuscript-root 로 시드", () => {
    const tree: BinderTree = { schema: BINDER_SCHEMA, root: [] };
    const result = ensureSingleManuscriptRoot(tree, {
      projectTitle: "Hello",
      makeId: idGen,
    });
    expect(result.migrated).toBe(true);
    expect(result.reason).toBe("create-empty");
    expect(result.tree.root.length).toBe(1);
    const root = result.tree.root[0];
    expect(isManuscriptRoot(root)).toBe(true);
    if (root.type !== "folder") throw new Error("folder expected");
    expect(root.children).toEqual([]);
  });

  it("폴더 1개만 있는데 마킹이 없으면 마킹만 부여 (구조 보존)", () => {
    const tree: BinderTree = {
      schema: BINDER_SCHEMA,
      root: [
        BinderIO.newFolder({
          id: "only",
          title: "기존 원고",
          label: "manuscript",
          status: "to-do",
          children: [
            BinderIO.newDocument({
              id: "d1",
              title: "Doc 1",
              file: "x.md",
              label: "scene",
              status: "to-do",
            }),
          ],
        }),
      ],
    };
    const result = ensureSingleManuscriptRoot(tree, {
      projectTitle: "X",
      makeId: idGen,
    });
    expect(result.migrated).toBe(true);
    expect(result.reason).toBe("tag-existing-folder");
    expect(result.tree.root.length).toBe(1);
    const root = result.tree.root[0];
    expect(root.id).toBe("only"); // id 보존
    expect(root.customMetadata?.role).toBe(MANUSCRIPT_ROOT_ROLE);
  });

  it("findManuscriptRoot 는 마킹된 폴더를 반환", () => {
    const tree = flatTree();
    expect(findManuscriptRoot(tree)).toBeNull();
    const wrapped = ensureSingleManuscriptRoot(tree, {
      projectTitle: "T",
      makeId: idGen,
    });
    const r = findManuscriptRoot(wrapped.tree);
    expect(r).not.toBeNull();
    expect(r?.id).toBe("gen-1");
  });
});

describe("migrateBinderOnDisk", () => {
  it("변환 시 백업 파일을 한 번만 만든다", async () => {
    const vault = new InMemoryVaultAdapter();
    const folder = "proj";
    await vault.writeFile(
      `${folder}/binder.json`,
      JSON.stringify(flatTree(), null, 2),
    );

    const r1 = await migrateBinderOnDisk(vault, folder, {
      projectTitle: "내 원고",
      makeId: idGen,
    });
    expect(r1.migrated).toBe(true);
    expect(r1.backupPath).toBe(`${folder}/${MANUSCRIPT_ROOT_BACKUP_FILE}`);
    // 백업이 실제로 디스크에 있다.
    expect(await vault.fileExists(r1.backupPath!)).toBe(true);

    // 두 번째 호출은 noop (이미 단일 루트라 변환 X).
    const r2 = await migrateBinderOnDisk(vault, folder, {
      projectTitle: "내 원고",
      makeId: idGen,
    });
    expect(r2.migrated).toBe(false);
    expect(r2.backupPath).toBeNull();
  });

  it("변환 안 한 경우 디스크 binder.json 을 건드리지 않는다", async () => {
    const vault = new InMemoryVaultAdapter();
    const folder = "proj";
    // 이미 단일 루트로 시드된 상태.
    const wrapped = ensureSingleManuscriptRoot(flatTree(), {
      projectTitle: "T",
      makeId: idGen,
    });
    const before = JSON.stringify(wrapped.tree, null, 2) + "\n";
    await vault.writeFile(`${folder}/binder.json`, before);

    const r = await migrateBinderOnDisk(vault, folder, {
      projectTitle: "T",
      makeId: idGen,
    });
    expect(r.migrated).toBe(false);
    const after = await vault.readFile(`${folder}/binder.json`);
    expect(after).toBe(before);
  });
});
