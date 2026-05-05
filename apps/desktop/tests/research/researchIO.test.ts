// researchIO.test.ts — research/ 폴더 스캔 + 라운드트립.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installTauriMocks,
  setVaultFile,
  clearVault,
  readVaultFile,
} from "../__mocks__/tauri";

installTauriMocks();

import { setVaultBasePath, tauriVaultAdapter } from "../../src/vaultAdapter";
import {
  listResearch,
  parseResearch,
  serializeResearch,
  writeResearchItem,
  deleteResearchFile,
  type ResearchItem,
} from "../../src/research/researchIO";

const VAULT = "/tmp/test-vault";
const PROJECT = "demo-project";
const PROJECT_FOLDER = `${VAULT}/${PROJECT}`;

function makeItem(over?: Partial<ResearchItem>): ResearchItem {
  return {
    id: "r-001",
    title: "Codex CLI 의 활용 사례",
    prompt: "Codex CLI 의 활용 사례를 정리해주세요.",
    source: "general",
    links: ["https://example.com/a", "https://example.com/b"],
    createdAt: "2026-04-29T10:00:00.000Z",
    filePath: "research/r-001.md",
    body: "# Codex CLI\n\n본문입니다.",
    ...over,
  };
}

beforeEach(() => {
  clearVault();
  setVaultBasePath(VAULT);
});

afterEach(() => {
  clearVault();
});

describe("researchIO", () => {
  it("serializeResearch → parseResearch round-trip 으로 메타와 body 가 보존된다", () => {
    const item = makeItem();
    const raw = serializeResearch(item);
    const parsed = parseResearch(raw);
    expect(parsed.frontmatter).not.toBeNull();
    expect(parsed.frontmatter?.id).toBe(item.id);
    expect(parsed.frontmatter?.title).toBe(item.title);
    expect(parsed.frontmatter?.source).toBe(item.source);
    expect(parsed.frontmatter?.links).toEqual(item.links);
    expect(parsed.body).toContain("본문입니다.");
  });

  it("writeResearchItem 후 listResearch 가 항목을 반환한다", async () => {
    const a = makeItem({ id: "r-a", title: "A", createdAt: "2026-01-01T00:00:00.000Z" });
    const b = makeItem({ id: "r-b", title: "B", createdAt: "2026-04-29T10:00:00.000Z" });
    const c = makeItem({ id: "r-c", title: "C", createdAt: "2026-03-01T00:00:00.000Z" });
    await writeResearchItem(tauriVaultAdapter, PROJECT, a);
    await writeResearchItem(tauriVaultAdapter, PROJECT, b);
    await writeResearchItem(tauriVaultAdapter, PROJECT, c);

    const items = await listResearch(tauriVaultAdapter, PROJECT);
    expect(items.map((i) => i.id)).toEqual(["r-b", "r-c", "r-a"]); // 최신 → 과거
    expect(items[0].title).toBe("B");
    // body 도 같이 들어와 있다.
    expect(items.find((i) => i.id === "r-a")?.body).toContain("본문입니다.");
  });

  it("research/ 폴더가 없으면 listResearch 는 빈 배열을 반환한다", async () => {
    const items = await listResearch(tauriVaultAdapter, PROJECT);
    expect(items).toEqual([]);
  });

  it("deleteResearchFile 후 listResearch 결과에서 사라진다", async () => {
    const a = makeItem({ id: "r-a" });
    await writeResearchItem(tauriVaultAdapter, PROJECT, a);
    expect(readVaultFile(`${PROJECT_FOLDER}/research/r-a.md`)).toBeDefined();
    await deleteResearchFile(tauriVaultAdapter, PROJECT, "r-a");
    expect(readVaultFile(`${PROJECT_FOLDER}/research/r-a.md`)).toBeUndefined();
    const items = await listResearch(tauriVaultAdapter, PROJECT);
    expect(items).toEqual([]);
  });

  it("frontmatter 가 type: research 가 아니면 무시한다", async () => {
    setVaultFile(
      `${PROJECT_FOLDER}/research/bad.md`,
      "---\ntype: writing-scene\n---\n본문",
    );
    setVaultFile(
      `${PROJECT_FOLDER}/research/no-frontmatter.md`,
      "그냥 본문",
    );
    const ok = makeItem({ id: "r-ok" });
    await writeResearchItem(tauriVaultAdapter, PROJECT, ok);
    const items = await listResearch(tauriVaultAdapter, PROJECT);
    expect(items.map((i) => i.id)).toEqual(["r-ok"]);
  });
});
