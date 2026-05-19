import {
  ContextComposer,
  matchesExcludedFolder,
  render,
  sliceH2Section,
  stripFrontmatter,
} from "../src/ai/ContextComposer";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";
import { InMemoryFrontmatterAdapter } from "../src/adapters/InMemoryFrontmatterAdapter";

describe("ContextComposer pure helpers", () => {
  it("stripFrontmatter removes YAML block", () => {
    const body = "---\ntype: x\n---\n# hello\n본문";
    expect(stripFrontmatter(body)).toBe("# hello\n본문");
  });

  it("sliceH2Section returns body of named section only", () => {
    const body = "# t\n\n## 기획\n계획\n\n## 초안\n첫 줄\n둘째 줄\n\n## 피드백\n피드백 본문";
    const drafted = sliceH2Section(body, "초안");
    expect(drafted).toContain("첫 줄");
    expect(drafted).toContain("둘째 줄");
    expect(drafted).not.toContain("피드백 본문");
  });

  it("render fills placeholders, reports missing", () => {
    const out = render("a={{a}} b={{b}} c={{c}}", { a: "1", b: "2" });
    expect(out.rendered).toBe("a=1 b=2 c=[누락: c]");
    expect(out.missing).toEqual(["c"]);
  });

  it("matchesExcludedFolder uses prefix match", () => {
    expect(matchesExcludedFolder("0 raw/private/secrets.md", ["0 raw/private"])).toBe(true);
    expect(matchesExcludedFolder("0 raw/public/note.md", ["0 raw/private"])).toBe(false);
    expect(matchesExcludedFolder("0 raw/private", ["0 raw/private"])).toBe(true);
  });
});

describe("ContextComposer.compose", () => {
  const action = {
    id: "test.basic",
    promptTemplate:
      "원고:\n{{manuscript}}\n\n섹션:\n{{section}}\n\n자료:\n{{source_notes}}\n\n독자: {{reader}}\n핵심: {{core_message}}\n사용자: {{user_input}}",
    placeholders: ["manuscript", "section", "source_notes", "reader", "core_message", "user_input"],
    saveTo: "feedback",
  };

  const PROJECT_PATH = "3 Writing/test.md";
  const PROJECT_TITLE = "test";

  function buildComposer(opts: {
    vault: InMemoryVaultAdapter;
    /** name → path lookup; falls back to null. */
    nameToPath: Record<string, string>;
    /** Project frontmatter object (will be persisted into project file). */
    projectFm: Record<string, unknown>;
    projectBody: string;
  }) {
    const { vault, nameToPath, projectFm, projectBody } = opts;
    // Persist project file (frontmatter + body) so frontmatter adapter reads it.
    const fmLines: string[] = ["---"];
    for (const [k, v] of Object.entries(projectFm)) {
      if (Array.isArray(v)) {
        fmLines.push(`${k}: [${(v as unknown[]).map((x) => String(x)).join(", ")}]`);
      } else if (typeof v === "number") {
        fmLines.push(`${k}: ${v}`);
      } else {
        const sv = String(v);
        // Quote if contains spaces or hangul
        if (/^[\w\-]+$/.test(sv)) fmLines.push(`${k}: ${sv}`);
        else fmLines.push(`${k}: ${sv}`);
      }
    }
    fmLines.push("---");
    const projectRaw = fmLines.join("\n") + "\n" + projectBody;
    vault.setFile(PROJECT_PATH, projectRaw);

    const notice = new InMemoryNoticeAdapter();
    const composer = new ContextComposer({
      vault,
      notice,
      frontmatter: new InMemoryFrontmatterAdapter(vault),
      resolveWiki: (target) => nameToPath[target] ?? null,
    });
    return { composer, notice };
  }

  it("fills placeholders and respects section anchor", async () => {
    const vault = new InMemoryVaultAdapter();
    vault.setFile(
      "1 Literature/note-A.md",
      "# A\nA 본문",
    );
    const projectBody = "# 제목\n\n## 기획\n기획 본문\n\n## 초안\n초안 한 줄\n초안 두 줄\n";
    const { composer } = buildComposer({
      vault,
      nameToPath: { "note-A": "1 Literature/note-A.md" },
      projectFm: {
        type: "writing",
        source_notes: ["[[note-A]]", "[[note-B]]", "[[note-C]]"],
        target_reader: "30대 직장인",
        core_message: "쓰는 자가 살아남는다",
      },
      projectBody,
    });

    const r = await composer.compose({
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
      sectionAnchor: "초안",
      userInput: "한 줄 더 부탁",
      action,
    });

    expect(r.prompt).toContain("초안 한 줄");
    const sectionRegion = r.prompt.split("섹션:")[1]?.split("자료:")[0] ?? "";
    expect(sectionRegion).toContain("초안 한 줄");
    expect(sectionRegion).not.toContain("기획 본문");
    expect(r.prompt).toContain("note-A");
    expect(r.prompt).toContain("30대 직장인"); // reader
    expect(r.prompt).toContain("한 줄 더 부탁");
    expect(r.contextStats.sources).toBe(1); // note-B and note-C don't resolve
  });

  it("uses sibling project.json sourceNotes as canonical v2 source over scene frontmatter", async () => {
    const vault = new InMemoryVaultAdapter();
    vault.setFile("2.Permanent/A.md", "---\ntag: keep\n---\nA note body");
    vault.setFile("3.Structure/B.md", "B structure body");
    vault.setFile("2.Permanent/legacy.md", "legacy body should not be used");
    vault.setFile(
      "4.Writing/p/scene.md",
      "---\ntype: writing-scene\nsource_notes: [legacy]\n---\n# Scene\n\n## 초안\nScene draft",
    );
    vault.setFile(
      "4.Writing/p/project.json",
      JSON.stringify({ sourceNotes: ["[[A]]", "3.Structure/B.md"] }),
    );

    const notice = new InMemoryNoticeAdapter();
    const composer = new ContextComposer({
      vault,
      notice,
      frontmatter: new InMemoryFrontmatterAdapter(vault),
      resolveWiki: (target) => ({ A: "2.Permanent/A.md", legacy: "2.Permanent/legacy.md" })[target] ?? null,
    });

    const r = await composer.compose({
      projectPath: "4.Writing/p/scene.md",
      projectTitle: "p",
      sectionAnchor: "초안",
      action,
    });

    expect(r.prompt).toContain("A note body");
    expect(r.prompt).toContain("B structure body");
    expect(r.prompt).not.toContain("legacy body should not be used");
    expect(r.contextStats.sources).toBe(2);
  });

  it("emits [누락: name] for missing placeholder", async () => {
    const vault = new InMemoryVaultAdapter();
    const action2 = {
      id: "test.missing",
      promptTemplate: "ok={{manuscript}} oops={{nope}}",
      placeholders: ["manuscript"],
      saveTo: "feedback",
    };
    const { composer, notice } = buildComposer({
      vault,
      nameToPath: {},
      projectFm: { type: "writing" },
      projectBody: "본문",
    });

    const r = await composer.compose({
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
      action: action2,
    });
    expect(r.prompt).toContain("[누락: nope]");
    expect(notice.contains("누락 플레이스홀더")).toBe(true);
  });

  it("excluded folder source notes are skipped", async () => {
    const vault = new InMemoryVaultAdapter();
    vault.setFile("0 raw/private/secret.md", "비밀 본문");
    vault.setFile("1 Literature/keep.md", "공개 본문");
    const { composer } = buildComposer({
      vault,
      nameToPath: {
        secret: "0 raw/private/secret.md",
        keep: "1 Literature/keep.md",
      },
      projectFm: {
        type: "writing",
        source_notes: ["[[secret]]", "[[keep]]"],
      },
      projectBody: "본문",
    });
    const r = await composer.compose({
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
      action,
      excludedFolders: ["0 raw/private"],
    });
    expect(r.prompt).toContain("공개 본문");
    expect(r.prompt).not.toContain("비밀 본문");
    expect(r.contextStats.sources).toBe(1);
  });

  it("truncates a single source over its bucket cap", async () => {
    const vault = new InMemoryVaultAdapter();
    const big = "가".repeat(3000);
    vault.setFile("0 raw/big.md", big);
    const { composer } = buildComposer({
      vault,
      nameToPath: { big: "0 raw/big.md" },
      projectFm: { type: "writing", source_notes: ["[[big]]"] },
      projectBody: "본문",
    });
    const r = await composer.compose({
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
      action,
    });
    // "raw" bucket cap is 1500 chars
    expect(r.contextStats.truncated).toBe(true);
    expect(r.contextStats.totalChars).toBeLessThanOrEqual(1500 + 30 /* trailing marker */);
  });

  it("respects total cap across many sources", async () => {
    const vault = new InMemoryVaultAdapter();
    const links: string[] = [];
    const nameToPath: Record<string, string> = {};
    for (let i = 0; i < 10; i += 1) {
      const name = `lit-${i}`;
      links.push(`[[${name}]]`);
      const p = `1 Literature/${name}.md`;
      nameToPath[name] = p;
      vault.setFile(p, "글".repeat(2000));
    }
    const { composer } = buildComposer({
      vault,
      nameToPath,
      projectFm: { type: "writing", source_notes: links },
      projectBody: "본문",
    });
    const r = await composer.compose({
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
      action,
    });
    // After per-bucket cap of 2000 each × 10 = 20000 → bounded by total 12000
    expect(r.contextStats.totalChars).toBeLessThanOrEqual(12_000 + 30);
    expect(r.contextStats.truncated).toBe(true);
  });
});
