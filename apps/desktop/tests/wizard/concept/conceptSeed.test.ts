// conceptSeed.test.ts — seedFromConceptDraft 단위 테스트.
//
// InMemoryVaultAdapter + InMemoryNoticeAdapter + InMemoryFrontmatterAdapter 를
// 사용하므로 Tauri IPC 불필요.

import { describe, expect, it, beforeEach } from "vitest";
import {
  InMemoryVaultAdapter,
  InMemoryNoticeAdapter,
  InMemoryFrontmatterAdapter,
  isProjectMeta,
  isBinderTree,
  isManuscriptRoot,
  type ConceptDraftSession,
  CONCEPT_DRAFT_SCHEMA,
} from "@ai-manuscript-studio/core";
import { seedFromConceptDraft, _internal } from "../../../src/wizard/concept/conceptSeed";

function makeSession(overrides: Partial<ConceptDraftSession> = {}): ConceptDraftSession {
  return {
    schema: CONCEPT_DRAFT_SCHEMA,
    id: "test-session-1",
    seed: "AI 시대에 작가로 산다는 것",
    tone: "essay",
    genre: "essay",
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "이 책은 AI 도구와 함께 일하면서도 작가 고유의 목소리를 잃지 않는 방법을 탐구한다.",
    synopsis: "AI가 모든 것을 쓸 수 있는 시대에 왜 인간이 써야 하는가.",
    outline: [
      { id: "ch-01", title: "도입", summary: "왜 이 책인가" },
      { id: "ch-02", title: "도구의 한계", summary: "AI 가 못하는 것들" },
      { id: "ch-03", title: "작가의 역할", summary: "고유한 목소리" },
      { id: "ch-04", title: "결말", summary: "약속과 여운" },
    ],
    stage: "done",
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("seedFromConceptDraft", () => {
  let vault: InMemoryVaultAdapter;
  let notice: InMemoryNoticeAdapter;
  let frontmatter: InMemoryFrontmatterAdapter;

  beforeEach(() => {
    vault = new InMemoryVaultAdapter({ basePath: "/vault" });
    notice = new InMemoryNoticeAdapter();
    frontmatter = new InMemoryFrontmatterAdapter(vault);
  });

  it("outline 4장 → 4 folder + 4 scene 생성", async () => {
    const session = makeSession();
    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      writingRoot: "3 Writing",
      title: "AI 시대의 작가",
    });

    expect(result.vaultPath).toBe("/vault");
    expect(result.projectFolder).toMatch(/^3 Writing\//);

    // binder 구조 검증
    const binderRaw = vault.getFile(`${result.projectFolder}/binder.json`);
    expect(binderRaw).toBeTruthy();
    const binder: unknown = JSON.parse(binderRaw);
    expect(isBinderTree(binder)).toBe(true);
    if (!isBinderTree(binder)) throw new Error("not binder tree");

    expect(binder.root.length).toBe(1);
    const root = binder.root[0];
    expect(isManuscriptRoot(root)).toBe(true);
    if (root.type !== "folder") throw new Error("root is folder");

    // 4 챕터 폴더
    const chapFolders = root.children.filter((n) => n.type === "folder");
    expect(chapFolders.length).toBe(4);

    // 각 폴더에 첫 장면 1개씩
    for (const folder of chapFolders) {
      if (folder.type !== "folder") continue;
      expect(folder.children.length).toBeGreaterThanOrEqual(1);
      const scenes = folder.children.filter((n) => n.type === "document");
      expect(scenes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("outline 12장 → 12 folder + 12 scene 생성", async () => {
    const outline = Array.from({ length: 12 }, (_, i) => ({
      id: `ch-${String(i + 1).padStart(2, "0")}`,
      title: `${i + 1}장 제목`,
      summary: `${i + 1}장 요약`,
    }));
    const session = makeSession({ outline });

    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      title: "열두 챕터 책",
    });

    const binderRaw = vault.getFile(`${result.projectFolder}/binder.json`);
    const binder: unknown = JSON.parse(binderRaw);
    if (!isBinderTree(binder)) throw new Error("not binder tree");
    const root = binder.root[0];
    if (root.type !== "folder") throw new Error("root is folder");

    const chapFolders = root.children.filter((n) => n.type === "folder");
    expect(chapFolders.length).toBe(12);
  });

  it("planning.md 에 ## 목차 와 outline title 들 포함", async () => {
    const session = makeSession();
    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      title: "AI 시대의 작가",
    });

    expect(vault.hasFile(`${result.projectFolder}/planning.md`)).toBe(true);
    const planning = vault.getFile(`${result.projectFolder}/planning.md`);
    expect(planning).toContain("## 목차");
    expect(planning).toContain("도입");
    expect(planning).toContain("도구의 한계");
    expect(planning).toContain("작가의 역할");
    expect(planning).toContain("결말");
  });

  it("동일 slug 중복 → -1 suffix 회피", async () => {
    const session = makeSession();
    const deps = {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      writingRoot: "3 Writing",
      title: "AI 시대의 작가",
    };

    const r1 = await seedFromConceptDraft(session, deps);
    const r2 = await seedFromConceptDraft(session, deps);

    expect(r1.projectSlug).not.toBe(r2.projectSlug);
    expect(r2.projectSlug).toMatch(/-1$/);
  });

  it("attachedNotes 빈 배열 → ## 참고 노트 섹션 없음", async () => {
    const session = makeSession({ attachedNotes: [] });
    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      title: "노트 없는 책",
    });

    const planning = vault.getFile(`${result.projectFolder}/planning.md`);
    expect(planning).not.toContain("## 참고 노트");
  });

  it("attachedNotes 있으면 ## 참고 노트 섹션 포함", async () => {
    const session = makeSession({ attachedNotes: ["note1", "note2"] });
    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      title: "노트 있는 책",
    });

    const planning = vault.getFile(`${result.projectFolder}/planning.md`);
    expect(planning).toContain("## 참고 노트");
    expect(planning).toContain("[[note1]]");
    expect(planning).toContain("[[note2]]");
  });

  it("project.json 이 isProjectMeta 통과", async () => {
    const session = makeSession();
    const result = await seedFromConceptDraft(session, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      title: "AI 시대의 작가",
    });

    const projectJsonRaw = vault.getFile(`${result.projectFolder}/project.json`);
    const meta: unknown = JSON.parse(projectJsonRaw);
    expect(isProjectMeta(meta)).toBe(true);
  });
});

describe("_internal.makeProjectSlug", () => {
  it("한글 제목 → 슬러그 + 날짜", () => {
    const slug = _internal.makeProjectSlug("AI 시대의 작가", "20260506");
    expect(slug).toContain("20260506");
    // slugify 결과가 포함돼야 함
    expect(slug.length).toBeGreaterThan("20260506".length);
  });

  it("빈 제목 → untitled-날짜", () => {
    const slug = _internal.makeProjectSlug("", "20260506");
    expect(slug).toMatch(/^untitled-20260506$/);
  });
});
