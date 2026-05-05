// InspectorPane.test.tsx — 상태 dropdown 변경이 store.setNodeStatus를 호출한다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { installTauriMocks, setVaultFile, clearVault } from "./__mocks__/tauri";

installTauriMocks();

import { useProjectStore } from "../src/state/projectStore";
import { InspectorPane } from "../src/inspector/InspectorPane";
import { findBinderNode } from "../src/state/binderQueries";
import {
  FIXTURE_PROJECT_FOLDER,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_VAULT_PATH,
  makeBinder,
  makeMeta,
  makeSceneFile,
} from "./fixtures";

beforeEach(async () => {
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
    makeSceneFile("scene-1", "본문"),
  );
  useProjectStore.getState().clear();
  await useProjectStore
    .getState()
    .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);
});

afterEach(() => {
  useProjectStore.getState().clear();
});

describe("InspectorPane", () => {
  it("선택 없음 → 프로젝트 메타가 보인다", () => {
    render(<InspectorPane />);
    expect(screen.getByText("프로젝트")).toBeInTheDocument();
    expect(screen.getByText("데모 프로젝트")).toBeInTheDocument();
  });

  it("단일 노드 선택 → 노드 메타가 보이고, 상태 변경이 store에 반영된다", async () => {
    useProjectStore.getState().selectNodes(["scene-1"]);
    render(<InspectorPane />);

    const select = screen.getByTestId("status-select") as HTMLSelectElement;
    expect(select.value).toBe("draft");

    fireEvent.change(select, { target: { value: "done" } });

    await waitFor(() => {
      const tree = useProjectStore.getState().binder!;
      const folder = findBinderNode(tree, "folder-1")!;
      if (folder.type === "folder") {
        const scene = folder.children.find((c) => c.id === "scene-1")!;
        expect(scene.status).toBe("done");
      }
    });
  });

  it("라벨 변경도 동일하게 동작한다", async () => {
    useProjectStore.getState().selectNodes(["scene-1"]);
    render(<InspectorPane />);

    const select = screen.getByTestId("label-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "manuscript" } });

    await waitFor(() => {
      const tree = useProjectStore.getState().binder!;
      const folder = findBinderNode(tree, "folder-1")!;
      if (folder.type === "folder") {
        const scene = folder.children.find((c) => c.id === "scene-1")!;
        expect(scene.label).toBe("manuscript");
      }
    });
  });
});
