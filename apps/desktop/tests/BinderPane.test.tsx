// BinderPane.test.tsx — 렌더 / 클릭 / Cmd+클릭 / 펼침 토글.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { installTauriMocks, setVaultFile, clearVault } from "./__mocks__/tauri";

installTauriMocks();

import { useProjectStore } from "../src/state/projectStore";
import { BinderPane } from "../src/binder/BinderPane";
import {
  FIXTURE_PROJECT_FOLDER,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_VAULT_PATH,
  makeBinder,
  makeMeta,
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
  useProjectStore.getState().clear();
  await useProjectStore
    .getState()
    .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);
});

afterEach(() => {
  useProjectStore.getState().clear();
});

describe("BinderPane", () => {
  it("픽스처 binder를 트리로 렌더한다", () => {
    render(<BinderPane />);
    expect(screen.getByText("1부")).toBeInTheDocument();
    expect(screen.getByText("2부")).toBeInTheDocument();
    // 1부는 기본 펼쳐져 있으므로 자식들도 보인다
    expect(screen.getByText("첫 장면")).toBeInTheDocument();
    expect(screen.getByText("두 번째 장면")).toBeInTheDocument();
  });

  it("행 클릭으로 단일 선택이 된다", () => {
    render(<BinderPane />);
    const row = screen.getByTestId("binder-row-scene-1");
    fireEvent.mouseDown(row, { button: 0 });
    expect(useProjectStore.getState().selectedNodeIds).toEqual(["scene-1"]);
  });

  it("Cmd+Click으로 다중 선택이 된다", () => {
    render(<BinderPane />);
    fireEvent.mouseDown(screen.getByTestId("binder-row-scene-1"), { button: 0 });
    fireEvent.mouseDown(screen.getByTestId("binder-row-scene-2"), {
      button: 0,
      metaKey: true,
    });
    const sel = useProjectStore.getState().selectedNodeIds;
    expect(sel).toContain("scene-1");
    expect(sel).toContain("scene-2");
    expect(sel.length).toBe(2);
  });

  it("폴더 caret 클릭으로 자식이 숨겨졌다 보인다", () => {
    render(<BinderPane />);
    // 처음엔 자식이 보임
    expect(screen.queryByText("첫 장면")).toBeInTheDocument();
    // folder-1의 caret 클릭
    const carets = screen.getAllByLabelText(/접기|펼치기/);
    // 첫 번째 caret = folder-1
    act(() => {
      fireEvent.click(carets[0]);
    });
    expect(screen.queryByText("첫 장면")).not.toBeInTheDocument();
    // 다시 펼치기
    const caretsAfter = screen.getAllByLabelText(/접기|펼치기/);
    act(() => {
      fireEvent.click(caretsAfter[0]);
    });
    expect(screen.queryByText("첫 장면")).toBeInTheDocument();
  });
});
