// binderActions.test.ts — addScene → store.binder reflects new node.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installTauriMocks, setVaultFile, clearVault } from "./__mocks__/tauri";

installTauriMocks();

import { BinderIO } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../src/state/projectStore";
import {
  addSceneNearSelection,
  deleteSelectedNode,
} from "../src/binder/binderActions";
import { findBinderNode } from "../src/state/binderQueries";
import {
  FIXTURE_PROJECT_FOLDER,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_VAULT_PATH,
  makeBinder,
  makeMeta,
  makeSceneFile,
} from "./fixtures";

beforeEach(() => {
  clearVault();
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/project.json`,
    JSON.stringify(makeMeta(), null, 2),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/binder.json`,
    JSON.stringify(makeBinder(), null, 2),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/1부/scene-1.md`,
    makeSceneFile("scene-1", "첫 장면 본문"),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/1부/scene-2.md`,
    makeSceneFile("scene-2", "두 번째 장면 본문"),
  );
  // store reset
  useProjectStore.getState().clear();
});

afterEach(() => {
  useProjectStore.getState().clear();
});

describe("binderActions", () => {
  it("addSceneNearSelection이 선택된 폴더의 자식으로 새 장면을 추가한다", async () => {
    await useProjectStore
      .getState()
      .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);
    expect(useProjectStore.getState().binder).not.toBeNull();

    // 폴더 1을 선택
    useProjectStore.getState().selectNodes(["folder-1"]);

    const newId = await addSceneNearSelection();
    expect(newId).not.toBeNull();

    const tree = useProjectStore.getState().binder!;
    const folder1 = findBinderNode(tree, "folder-1")!;
    expect(folder1.type).toBe("folder");
    if (folder1.type === "folder") {
      expect(folder1.children.some((c) => c.id === newId)).toBe(true);
      expect(folder1.children.length).toBe(3); // 2 + 1
    }
  });

  it("addSceneNearSelection이 선택된 장면의 형제로 추가한다", async () => {
    await useProjectStore
      .getState()
      .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);
    useProjectStore.getState().selectNodes(["scene-1"]);

    const newId = await addSceneNearSelection();
    expect(newId).not.toBeNull();
    const tree = useProjectStore.getState().binder!;
    const folder1 = findBinderNode(tree, "folder-1")!;
    if (folder1.type === "folder") {
      // scene-1과 같은 부모(folder-1)에 새 노드가 들어가 있어야 한다
      expect(folder1.children.some((c) => c.id === newId)).toBe(true);
    }
  });

  it("deleteSelectedNode가 confirm을 거부하면 트리가 변하지 않는다", async () => {
    await useProjectStore
      .getState()
      .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);

    const before = useProjectStore.getState().binder;
    const beforeIds = before ? BinderIO.allIds(before).sort() : [];

    const confirm = vi.fn(async () => false);
    await deleteSelectedNode("scene-1", { confirm });
    expect(confirm).toHaveBeenCalledOnce();

    const after = useProjectStore.getState().binder;
    const afterIds = after ? BinderIO.allIds(after).sort() : [];
    expect(afterIds).toEqual(beforeIds);
  });

  it("deleteSelectedNode가 confirm을 승인하면 노드를 삭제한다", async () => {
    await useProjectStore
      .getState()
      .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);

    const confirm = vi.fn(async () => true);
    await deleteSelectedNode("scene-1", { confirm });

    const after = useProjectStore.getState().binder!;
    const folder1 = findBinderNode(after, "folder-1")!;
    if (folder1.type === "folder") {
      expect(folder1.children.some((c) => c.id === "scene-1")).toBe(false);
    }
  });
});
