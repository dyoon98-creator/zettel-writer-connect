// ActionPanel.test.tsx — 자유/Phase 2/스킬팩 액션이 표시되고, 잠긴 액션은 잠금 표시.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  clearAiScript,
  clearVault,
  installTauriMocks,
  setVaultFile,
} from "../__mocks__/tauri";

installTauriMocks();

import { useProjectStore } from "../../src/state/projectStore";
import { useSkillpackStore } from "../../src/state/skillpackStore";
import { useSettingsStore } from "../../src/state/settingsStore";
import { ActionPanel } from "../../src/inspector/ActionPanel";
import {
  FIXTURE_PROJECT_FOLDER,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_VAULT_PATH,
  makeBinder,
  makeMeta,
  makeSceneFile,
} from "../fixtures";

beforeEach(async () => {
  clearVault();
  clearAiScript();
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
  useSettingsStore.getState().reset();
  useSettingsStore.setState({
    settings: {
      aiProvider: "codex",
      codexPath: "/usr/bin/codex",
      codexExtraArgs: "",
      claudeCodePath: "",
      confirmBeforeRun: false,
      enableExecLog: false,
      excludedFolders: "",
      licenseKey: "",
      skillpackFolder: "_skillpacks",
      useMockBridge: false,
    },
    loaded: true,
  });
  await useProjectStore
    .getState()
    .loadProject(FIXTURE_VAULT_PATH, FIXTURE_PROJECT_SLUG);
  // 스킬팩 스토어 초기화 (현재 vault에 스킬팩 폴더가 없으므로 reload 결과는 빈 배열).
  useSkillpackStore.setState({ packs: [], loading: false, error: null });
});

afterEach(() => {
  useProjectStore.getState().clear();
  clearAiScript();
});

describe("ActionPanel", () => {
  it("Phase2 액션 5개 + 무료 액션 1개가 표시된다", () => {
    const node = useProjectStore.getState().binder!.root[0];
    if (node.type !== "folder") throw new Error("fixture invariant");
    const scene = node.children[0];
    render(<ActionPanel node={scene} />);
    const panel = screen.getByTestId("action-panel");
    // Phase 2 액션은 5개.
    expect(
      panel.querySelectorAll('[data-source="phase2"]').length,
    ).toBe(5);
    expect(
      panel.querySelectorAll('[data-source="free"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("잠긴 스킬팩 액션은 자물쇠 + locked 속성을 가진다", () => {
    useSkillpackStore.setState({
      packs: [
        {
          manifest: {
            id: "test-pack",
            name: "테스트",
            version: "1.0",
            vendor: "vendor-x",
            tier: "paid",
            license: { type: "key", issuer: "x", checksum: "xx" },
            actions: [
              {
                id: "test.locked-action",
                label: "잠긴 액션",
                status_show: [],
                prompt_file: "p.md",
                save_to: "feedback",
              },
            ],
          },
          folderPath: "_skillpacks/test-pack",
          promptByActionId: { "test.locked-action": "PROMPT" },
          license: { kind: "missing", reason: "라이선스 키 누락" },
        },
      ],
      loading: false,
      error: null,
    });

    const node = useProjectStore.getState().binder!.root[0];
    if (node.type !== "folder") throw new Error("fixture invariant");
    const scene = node.children[0];
    render(<ActionPanel node={scene} />);
    const btn = screen.getByTestId("action-test.locked-action");
    expect(btn).toHaveAttribute("data-locked", "true");
  });

  it("잠긴 스킬팩 액션 클릭 → tauriNoticeAdapter 경고", () => {
    useSkillpackStore.setState({
      packs: [
        {
          manifest: {
            id: "p",
            name: "p",
            version: "1",
            vendor: "v",
            tier: "paid",
            license: { type: "key", issuer: "x", checksum: "x" },
            actions: [
              {
                id: "p.locked",
                label: "잠긴 액션",
                status_show: [],
                prompt_file: "p.md",
                save_to: "feedback",
              },
            ],
          },
          folderPath: "_skillpacks/p",
          promptByActionId: { "p.locked": "BODY" },
          license: { kind: "missing", reason: "키 없음" },
        },
      ],
      loading: false,
      error: null,
    });

    // console.log 의 [notice:warn] 출력이 일어나는지 확인.
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const node = useProjectStore.getState().binder!.root[0];
    if (node.type !== "folder") throw new Error("fixture invariant");
    const scene = node.children[0];
    render(<ActionPanel node={scene} />);
    fireEvent.click(screen.getByTestId("action-p.locked"));
    const warned = logSpy.mock.calls.some((c) =>
      String(c[0]).includes("[notice:warn]"),
    );
    expect(warned).toBe(true);
    logSpy.mockRestore();
  });
});
