// researchMigration.test.ts — 구 binder 노드 → research/ 폴더 이전.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installTauriMocks,
  setVaultFile,
  clearVault,
  readVaultFile,
} from "../__mocks__/tauri";

installTauriMocks();

import { setVaultBasePath, tauriVaultAdapter } from "../../src/vaultAdapter";
import { runResearchMigrationIfNeeded } from "../../src/research/researchMigration";
import { listResearch } from "../../src/research/researchIO";
import type {
  BinderTree,
  ProjectMeta,
} from "@ai-manuscript-studio/core";
import {
  FIXTURE_VAULT_PATH,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_PROJECT_FOLDER,
  makeBinder,
  makeMeta,
  makeSceneFile,
} from "../fixtures";

function setupLegacyResearchScene(): void {
  // binder.json 에 customMetadata.research_source 가 달린 노드 2개를 추가한다.
  const binder: BinderTree = makeBinder();
  binder.root.push({
    id: "research-1",
    type: "document",
    title: "AI 시대의 신입 개발자",
    file: "research-legacy/research-1.md",
    label: "scene",
    status: "draft",
    synopsis: "",
    wordCount: 0,
    customMetadata: {
      research_source: "paper",
      research_prompt: "AI 시대의 신입 개발자 관련 논문 정리",
      links: JSON.stringify(["https://example.com/p1"]),
    },
  });
  binder.root.push({
    id: "research-2",
    type: "document",
    title: "Codex CLI 사례",
    file: "research-legacy/research-2.md",
    label: "scene",
    status: "draft",
    synopsis: "",
    wordCount: 0,
    customMetadata: {
      research_source: "general",
      research_prompt: "Codex CLI 활용 사례",
    },
  });

  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/binder.json`,
    JSON.stringify(binder, null, 2),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/research-legacy/research-1.md`,
    makeSceneFile("research-1", "## 본문 1\n예전에 만들어진 리서치"),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/research-legacy/research-2.md`,
    makeSceneFile("research-2", "## 본문 2"),
  );
  setVaultFile(
    `${FIXTURE_PROJECT_FOLDER}/project.json`,
    JSON.stringify(makeMeta(), null, 2),
  );
}

beforeEach(() => {
  clearVault();
  setVaultBasePath(FIXTURE_VAULT_PATH);
});

afterEach(() => {
  clearVault();
});

describe("researchMigration", () => {
  it("legacy binder 노드 2개를 research/ 폴더로 이동한다", async () => {
    setupLegacyResearchScene();
    const meta = makeMeta();
    const binder = JSON.parse(
      readVaultFile(`${FIXTURE_PROJECT_FOLDER}/binder.json`)!,
    ) as BinderTree;

    const result = await runResearchMigrationIfNeeded({
      vault: tauriVaultAdapter,
      projectFolder: FIXTURE_PROJECT_SLUG,
      meta,
      binder,
    });

    expect(result.migrated).toBe(2);
    expect(result.alreadyDone).toBe(false);
    // binder 에서 사라졌다.
    const ids: string[] = [];
    const walk = (n: BinderTree["root"][number]): void => {
      ids.push(n.id);
      if (n.type === "folder") n.children.forEach(walk);
    };
    result.binder.root.forEach(walk);
    expect(ids).not.toContain("research-1");
    expect(ids).not.toContain("research-2");

    // research/ 폴더에 파일이 만들어졌다.
    const items = await listResearch(tauriVaultAdapter, FIXTURE_PROJECT_SLUG);
    const titles = items.map((i) => i.title).sort();
    expect(titles).toEqual(["AI 시대의 신입 개발자", "Codex CLI 사례"]);

    // 첫 번째는 paper + 링크 보존.
    const first = items.find((i) => i.id === "research-1");
    expect(first?.source).toBe("paper");
    expect(first?.links).toEqual(["https://example.com/p1"]);

    // project.json 에 마이그레이션 플래그가 박혔다.
    const updatedMeta = JSON.parse(
      readVaultFile(`${FIXTURE_PROJECT_FOLDER}/project.json`)!,
    ) as ProjectMeta;
    expect(updatedMeta.customMetadata?.researchMigrationDone).toBe("v1");
  });

  it("두 번째 호출은 idempotent — alreadyDone:true 이고 추가 이동 없음", async () => {
    setupLegacyResearchScene();
    const meta1 = makeMeta();
    const binder1 = JSON.parse(
      readVaultFile(`${FIXTURE_PROJECT_FOLDER}/binder.json`)!,
    ) as BinderTree;

    const r1 = await runResearchMigrationIfNeeded({
      vault: tauriVaultAdapter,
      projectFolder: FIXTURE_PROJECT_SLUG,
      meta: meta1,
      binder: binder1,
    });
    expect(r1.migrated).toBe(2);

    // 두 번째 — 호출자가 새 meta/binder 로 다시 호출한다고 가정.
    const r2 = await runResearchMigrationIfNeeded({
      vault: tauriVaultAdapter,
      projectFolder: FIXTURE_PROJECT_SLUG,
      meta: r1.meta,
      binder: r1.binder,
    });
    expect(r2.alreadyDone).toBe(true);
    expect(r2.migrated).toBe(0);
  });

  it("legacy 가 0건이어도 플래그를 기록해 다음 부팅에서 재스캔하지 않는다", async () => {
    setVaultFile(
      `${FIXTURE_PROJECT_FOLDER}/binder.json`,
      JSON.stringify(makeBinder(), null, 2),
    );
    setVaultFile(
      `${FIXTURE_PROJECT_FOLDER}/project.json`,
      JSON.stringify(makeMeta(), null, 2),
    );
    const r = await runResearchMigrationIfNeeded({
      vault: tauriVaultAdapter,
      projectFolder: FIXTURE_PROJECT_SLUG,
      meta: makeMeta(),
      binder: makeBinder(),
    });
    expect(r.migrated).toBe(0);
    expect(r.meta.customMetadata?.researchMigrationDone).toBe("v1");
  });
});
