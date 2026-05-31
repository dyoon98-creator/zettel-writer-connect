// structureBridge.test.ts — TDD: RED first, then GREEN after implementation.
// Tests parseStructureNote and createWritingProjectFromHandoff.

import {
  InMemoryVaultAdapter,
  InMemoryNoticeAdapter,
} from "@ai-manuscript-studio/core/adapters";
import { isProjectMeta } from "@ai-manuscript-studio/core/browser";
import { parseStructureNote } from "../src/structureBridge/parseStructureNote";
import {
  createWritingProjectFromHandoff,
  parseWritingHandoffJson,
} from "../src/structureBridge/createWritingProjectFromHandoff";

// ── parseStructureNote ────────────────────────────────────────────

describe("parseStructureNote", () => {
  it("rejects non-3.Structure paths with a friendly error", () => {
    expect(() =>
      parseStructureNote("2.Permanent/some-note.md", "# title"),
    ).toThrow(/3\.Structure/);
  });

  it("rejects vault-root md paths (not under 3.Structure)", () => {
    expect(() =>
      parseStructureNote("random-note.md", "# note"),
    ).toThrow(/3\.Structure/);
  });

  it("rejects parent traversal under 3.Structure", () => {
    expect(() =>
      parseStructureNote("3.Structure/../secret.md", "# note"),
    ).toThrow(/vault-relative path/);
  });

  it("rejects backslash separators under 3.Structure", () => {
    expect(() =>
      parseStructureNote("3.Structure\\secret.md", "# note"),
    ).toThrow(/vault-relative path/);
  });

  it("rejects directory-like structure paths without markdown extension", () => {
    expect(() =>
      parseStructureNote("3.Structure/strategy-folder/", "# note"),
    ).toThrow(/vault-relative path/);
  });

  it("rejects NUL characters under 3.Structure", () => {
    expect(() =>
      parseStructureNote("3.Structure/secret\0.md", "# note"),
    ).toThrow(/vault-relative path/);
  });

  it("rejects duplicate slash segments under 3.Structure", () => {
    expect(() =>
      parseStructureNote("3.Structure//safe.md", "# note"),
    ).toThrow(/vault-relative path/);
  });

  it("extracts title from H1 in content", () => {
    const result = parseStructureNote(
      "3.Structure/헤지펀드-전략.md",
      "# 헤지펀드 포트폴리오 전략\n\n본문",
    );
    expect(result.title).toBe("헤지펀드 포트폴리오 전략");
  });

  it("falls back to filename (without extension) when no H1", () => {
    const result = parseStructureNote(
      "3.Structure/헤지펀드-전략.md",
      "본문만 있고 H1 없음",
    );
    expect(result.title).toBe("헤지펀드-전략");
  });

  it("extracts frontmatter id, topic, and claim", () => {
    const md = `---
id: hf-strategy-001
topic: 포트폴리오 리밸런싱
claim: 분기별 리밸런싱이 장기 수익률을 높인다
---

# 헤지펀드 전략
`;
    const result = parseStructureNote("3.Structure/hf-strategy.md", md);
    expect(result.id).toBe("hf-strategy-001");
    expect(result.claim).toBe("분기별 리밸런싱이 장기 수익률을 높인다");
  });

  it("extracts claim from ## 🗂 주장 blockquote fallback", () => {
    const md = `# 분석 노트

## 🗂 주장

> 데이터 기반 의사결정이 직관보다 우수하다.

본문
`;
    const result = parseStructureNote("3.Structure/analysis.md", md);
    expect(result.claim).toBe("데이터 기반 의사결정이 직관보다 우수하다.");
  });

  it("sets structureNotePath as vault-relative path", () => {
    const result = parseStructureNote(
      "3.Structure/strategy-note.md",
      "# Strategy",
    );
    expect(result.structureNotePath).toBe("3.Structure/strategy-note.md");
  });

  it("includes related_notes from frontmatter as relatedNotes array", () => {
    const md = `---
related_notes:
  - "[[2.Permanent/some-note]]"
  - "3.Structure/related.md"
---
# title
`;
    const result = parseStructureNote("3.Structure/note.md", md);
    expect(result.relatedNotes).toBeDefined();
    expect(result.relatedNotes!.length).toBe(2);
  });
});

// ── createWritingProjectFromHandoff ──────────────────────────────

describe("createWritingProjectFromHandoff", () => {
  function makeHandoff(overrides?: object) {
    return {
      structureNotePath: "3.Structure/strategy-note.md",
      title: "헤지펀드 전략 보고서",
      id: "hf-strategy-001",
      claim: "분기별 리밸런싱이 장기 수익률을 높인다",
      relatedNotes: [],
      ...overrides,
    };
  }

  it("creates project.json, binder.json, planning.md under 4.Writing/<slug>/", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff: makeHandoff(),
    });

    const slugs = (await vault.listDir("4.Writing")).filter((e) => e.isDirectory);
    expect(slugs.length).toBe(1);
    const slug = slugs[0].name;
    const folder = `4.Writing/${slug}`;

    expect(await vault.fileExists(`${folder}/project.json`)).toBe(true);
    expect(await vault.fileExists(`${folder}/binder.json`)).toBe(true);
    expect(await vault.fileExists(`${folder}/planning.md`)).toBe(true);
  });

  it("project.json passes isProjectMeta and sourceNotes includes structure note path", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff: makeHandoff(),
    });

    const slugs = (await vault.listDir("4.Writing")).filter((e) => e.isDirectory);
    const slug = slugs[0].name;
    const raw = await vault.readFile(`4.Writing/${slug}/project.json`);
    const parsed = JSON.parse(raw);

    expect(isProjectMeta(parsed)).toBe(true);
    expect(parsed.sourceNotes).toContain("3.Structure/strategy-note.md");
  });

  it("creates project from writing-handoff JSON with structure and picked source notes deduped", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();
    const handoff = parseWritingHandoffJson(
      JSON.stringify({
        version: 1,
        mode: "new-structure-to-writing",
        structureNote: {
          path: "3.Structure/example.md",
          title: "Example Title",
          id: "S-1",
          claim: "핵심 주장",
        },
        picked: [
          { path: "2.Permanent/A.md", id: "A", claim: "A claim" },
          { path: "2.Permanent/B.md", id: "B", claim: "B claim" },
          { path: "2.Permanent/A.md", id: "A-dup" },
        ],
        project: {
          title: "Project Title",
          genre: "column-essay",
          wordGoal: 3000,
          status: "planning",
        },
        targetWritingFolder: "4.Writing/Longform",
      }),
      "_index/writing-handoff.json",
    );

    const result = await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff,
    });

    expect(result.folderPath.startsWith("4.Writing/Longform/")).toBe(true);
    const raw = await vault.readFile(`${result.folderPath}/project.json`);
    const parsed = JSON.parse(raw);

    expect(isProjectMeta(parsed)).toBe(true);
    expect(parsed.title).toBe("Project Title");
    expect(parsed.genre).toBe("column-essay");
    expect(parsed.wordGoal).toBe(3000);
    expect(parsed.sourceNotes).toEqual([
      "3.Structure/example.md",
      "2.Permanent/A.md",
      "2.Permanent/B.md",
    ]);
    expect(parsed.customMetadata?.bridgeMode).toBe("new-structure-to-writing");
    expect(parsed.customMetadata?.bridgeVersion).toBe("1");
    expect(parsed.customMetadata?.handoffPath).toBe("_index/writing-handoff.json");
  });

  it("rejects unusable writing-handoff JSON before creating a project", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({ version: 1, picked: [{ path: "2.Permanent/A.md" }] }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/structureNote\.path/);
    expect(() =>
      parseWritingHandoffJson("{", "_index/writing-handoff.json"),
    ).toThrow(/JSON/);
  });

  // ── path-rejection regression (Opus-Verify W3A) ──────────────────

  it("rejects absolute path in structureNote.path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "/abs/secret.md", title: "T" },
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects parent traversal in picked[].path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.md", title: "T" },
          picked: [{ path: "../x.md" }],
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects Windows drive absolute path in picked[].path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.md", title: "T" },
          picked: [{ path: "C:\\Users\\me\\secret.md" }],
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects backslash path separators in structureNote.path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure\\s.md", title: "T" },
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects non-structure folder in structureNote.path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "2.Permanent/s.md", title: "T" },
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/3\.Structure/);
  });

  it("rejects non-markdown structureNote.path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.txt", title: "T" },
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/\.md path/);
  });

  it("rejects NUL characters in picked[].path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.md", title: "T" },
          picked: [{ path: "2.Permanent/A\0.md" }],
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects duplicate slash segments in picked[].path", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.md", title: "T" },
          picked: [{ path: "2.Permanent//A.md" }],
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("rejects parent traversal in targetWritingFolder", () => {
    expect(() =>
      parseWritingHandoffJson(
        JSON.stringify({
          version: 1,
          structureNote: { path: "3.Structure/s.md", title: "T" },
          targetWritingFolder: "../Writing",
        }),
        "_index/writing-handoff.json",
      ),
    ).toThrow(/vault-relative path/);
  });

  it("project.json coreMessage is set from claim", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff: makeHandoff({ claim: "테스트 핵심 주장" }),
    });

    const slugs = (await vault.listDir("4.Writing")).filter((e) => e.isDirectory);
    const raw = await vault.readFile(`4.Writing/${slugs[0].name}/project.json`);
    const parsed = JSON.parse(raw);
    expect(parsed.coreMessage).toBe("테스트 핵심 주장");
  });

  it("project.json customMetadata includes bridgeVersion, bridgeMode, structureNotePath", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff: makeHandoff(),
    });

    const slugs = (await vault.listDir("4.Writing")).filter((e) => e.isDirectory);
    const raw = await vault.readFile(`4.Writing/${slugs[0].name}/project.json`);
    const parsed = JSON.parse(raw);
    expect(parsed.customMetadata?.bridgeVersion).toBe("1");
    expect(parsed.customMetadata?.bridgeMode).toBe("active-structure-note");
    expect(parsed.customMetadata?.structureNotePath).toBe(
      "3.Structure/strategy-note.md",
    );
  });

  it("planning.md references structure note path and claim", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff: makeHandoff({ claim: "리밸런싱 핵심 주장" }),
    });

    const slugs = (await vault.listDir("4.Writing")).filter((e) => e.isDirectory);
    const planning = await vault.readFile(
      `4.Writing/${slugs[0].name}/planning.md`,
    );
    expect(planning).toContain("3.Structure/strategy-note.md");
    expect(planning).toContain("리밸런싱 핵심 주장");
  });

  it("chooses slug-2 when slug already exists", async () => {
    const vault = new InMemoryVaultAdapter();
    const notice = new InMemoryNoticeAdapter();
    const handoff = makeHandoff({ title: "중복 테스트" });

    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff,
    });
    await createWritingProjectFromHandoff({
      vault,
      notice,
      writingFolder: "4.Writing",
      handoff,
    });

    const slugs = (await vault.listDir("4.Writing"))
      .filter((e) => e.isDirectory)
      .map((e) => e.name);
    expect(slugs.length).toBe(2);
    expect(slugs.some((s) => s.endsWith("-2"))).toBe(true);
  });
});
