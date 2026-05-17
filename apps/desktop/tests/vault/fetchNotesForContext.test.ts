// fetchNotesForContext.test.ts — 옵시디언 노트 컨텍스트 fetch 단위 테스트.
//
// 메모리 vault (__mocks__/tauri.ts) 를 사용해 vault_read_file / vault_exists /
// vault_list_dir Tauri invoke 를 시뮬레이션한다. 직접 vaultAdapter export 를
// jest/vi.mock 으로 가로채지 않으므로 fetchNotesForContext 본체 로직이 그대로
// 실행된다.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  installTauriMocks,
  setVaultFile,
  clearVault,
} from "../__mocks__/tauri";

installTauriMocks();

import {
  fetchNotesForContext,
  setVaultBasePath,
} from "../../src/vaultAdapter";

const VAULT = "/tmp/test-vault";

beforeEach(() => {
  clearVault();
  setVaultBasePath(VAULT);
});

afterEach(() => {
  clearVault();
  vi.restoreAllMocks();
});

describe("fetchNotesForContext", () => {
  it("빈 입력은 즉시 빈 결과를 반환한다", async () => {
    const result = await fetchNotesForContext([]);
    expect(result).toEqual({ context: "", found: [], notFound: [] });
  });

  it("[[X]] 정규화 + vault root 직속 .md 를 찾고 frontmatter 를 제거한다", async () => {
    setVaultFile(
      `${VAULT}/Big Idea.md`,
      "---\ntype: permanent\nid: 1a\n---\n\n핵심 본문 한 줄.",
    );
    const result = await fetchNotesForContext(["[[Big Idea]]"]);
    expect(result.found).toEqual(["Big Idea"]);
    expect(result.notFound).toEqual([]);
    expect(result.context).toContain("### [[Big Idea]]");
    expect(result.context).toContain("핵심 본문 한 줄.");
    expect(result.context).not.toContain("type: permanent");
    expect(result.context).not.toContain("---");
  });

  it("root 미스 시 BFS 로 깊은 폴더의 노트를 찾는다", async () => {
    setVaultFile(
      `${VAULT}/2 Permanent/1a/Deep Note.md`,
      "깊은 위치 본문.",
    );
    const result = await fetchNotesForContext(["Deep Note"]);
    expect(result.found).toEqual(["Deep Note"]);
    expect(result.notFound).toEqual([]);
    expect(result.context).toContain("### [[Deep Note]]");
    expect(result.context).toContain("깊은 위치 본문.");
  });

  it("어디에도 없는 노트는 graceful skip + console.warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchNotesForContext(["Ghost Note"]);
    expect(result.found).toEqual([]);
    expect(result.notFound).toEqual(["Ghost Note"]);
    expect(result.context).toBe("");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("frontmatter 가 없는 .md 도 본문 그대로 포함한다", async () => {
    setVaultFile(`${VAULT}/Plain.md`, "  순수 본문만.\n");
    const result = await fetchNotesForContext(["[[Plain]]"]);
    expect(result.found).toEqual(["Plain"]);
    expect(result.context).toContain("순수 본문만.");
    // 헤더 한 줄 + 본문 한 줄 + trailing newline 1 — frontmatter 마커 없음.
    expect(result.context).not.toMatch(/^---/);
  });

  it("다중 링크: 찾은 것 2 + 못찾은 것 1", async () => {
    setVaultFile(`${VAULT}/A.md`, "A 의 본문.");
    setVaultFile(`${VAULT}/folder/B.md`, "B 의 본문.");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchNotesForContext([
      "[[A]]",
      "folder/B.md",
      "[[Nope]]",
    ]);
    expect(result.found).toEqual(["A", "B"]);
    expect(result.notFound).toEqual(["Nope"]);
    expect(result.context).toContain("### [[A]]");
    expect(result.context).toContain("### [[B]]");
    expect(result.context).toContain("A 의 본문.");
    expect(result.context).toContain("B 의 본문.");
    expect(warnSpy).toHaveBeenCalled();
  });
});
