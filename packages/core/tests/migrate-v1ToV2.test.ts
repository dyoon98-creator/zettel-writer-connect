import { promises as fs } from "node:fs";
import path from "node:path";
import { migrate, parseH2Sections } from "../src/migrate/v1ToV2";
import { ProjectMetaIO } from "../src/project/ProjectMetaIO";
import { BinderIO } from "../src/project/BinderIO";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";

const FIXTURE_DIR = path.join(
  __dirname,
  "fixtures",
  "v1-project",
);
const FIXTURE_FILE = "20260101_ai-시대의-작가.md";

async function loadFixture(): Promise<string> {
  return fs.readFile(path.join(FIXTURE_DIR, FIXTURE_FILE), "utf8");
}

async function makeVaultWithFixture(): Promise<InMemoryVaultAdapter> {
  const raw = await loadFixture();
  return new InMemoryVaultAdapter({
    files: {
      [`3 Writing/${FIXTURE_FILE}`]: raw,
    },
  });
}

describe("parseH2Sections", () => {
  it("H2 섹션을 정확히 분할", () => {
    const body = `\n## A\n본문 a\n\n## B\n본문 b 1\n본문 b 2\n`;
    const sections = parseH2Sections(body);
    expect(sections.map((s) => s.title)).toEqual(["A", "B"]);
    expect(sections[0].body).toBe("본문 a");
    expect(sections[1].body).toContain("본문 b 1");
    expect(sections[1].body).toContain("본문 b 2");
  });

  it("H2 가 없으면 빈 배열", () => {
    expect(parseH2Sections("그냥 본문\n")).toEqual([]);
  });
});

describe("migrate dry-run", () => {
  it("파일을 만들지 않고 보고서만 채운다", async () => {
    const vault = await makeVaultWithFixture();
    const before = vault.snapshot();
    const report = await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
      { dryRun: true },
    );
    expect(report.scenesCreated).toBe(7);
    expect(report.filesCreated.length).toBeGreaterThan(0);
    expect(report.originalBackupPath).toContain(".v1-backup.md");
    expect(vault.snapshot()).toEqual(before);
  });
});

describe("migrate (write)", () => {
  it("project.json, binder.json, planning.md, 7 장면을 만든다", async () => {
    const vault = await makeVaultWithFixture();
    const notice = new InMemoryNoticeAdapter();
    const report = await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
      { noticeAdapter: notice },
    );

    expect(report.scenesCreated).toBe(7);
    expect(vault.hasFile("3 Writing/ai-시대의-작가/project.json")).toBe(true);
    expect(vault.hasFile("3 Writing/ai-시대의-작가/binder.json")).toBe(true);
    expect(vault.hasFile("3 Writing/ai-시대의-작가/planning.md")).toBe(true);

    // 백업 파일이 만들어지고 원본은 삭제됨
    expect(report.originalBackupPath).toBeTruthy();
    expect(vault.hasFile(report.originalBackupPath!)).toBe(true);
    expect(vault.hasFile(`3 Writing/${FIXTURE_FILE}`)).toBe(false);

    // notice 발생 확인
    expect(notice.byKind("info").length).toBeGreaterThan(0);
  });

  it("project.json 이 v1 frontmatter 의 메타를 승급한다", async () => {
    const vault = await makeVaultWithFixture();
    await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
    );
    const meta = await ProjectMetaIO.read(vault, "3 Writing/ai-시대의-작가");
    expect(meta.title).toBe("ai-시대의-작가");
    expect(meta.genre).toBe("essay");
    expect(meta.status).toBe("drafting");
    expect(meta.wordGoal).toBe(30000);
    expect(meta.coreMessage).toBe("AI는 작가를 대체하지 않는다");
    expect(meta.targetReader.includes("기록")).toBe(true);
    expect(meta.sourceNotes.length).toBe(2);
    expect(meta.customStatuses.length).toBe(5); // DEFAULT
    expect(meta.customLabels.length).toBe(7);
  });

  it("binder 가 7개의 폴더를 가지며 각 폴더에 1개 장면", async () => {
    const vault = await makeVaultWithFixture();
    await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
    );
    const binder = await BinderIO.read(vault, "3 Writing/ai-시대의-작가");
    expect(binder.root.length).toBe(7);
    for (const node of binder.root) {
      expect(node.type).toBe("folder");
      if (node.type === "folder") {
        expect(node.children.length).toBe(1);
        expect(node.children[0].type).toBe("document");
      }
    }
    // 첫 항목은 "기획"
    expect(binder.root[0].title).toBe("기획");
  });

  it("장면 파일이 H2 본문을 그대로 보존", async () => {
    const vault = await makeVaultWithFixture();
    await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
    );
    const binder = await BinderIO.read(vault, "3 Writing/ai-시대의-작가");
    const planning = binder.root.find((n) => n.title === "기획");
    expect(planning?.type).toBe("folder");
    if (planning?.type === "folder") {
      const doc = planning.children[0];
      if (doc.type === "document") {
        const raw = vault.getFile(`3 Writing/ai-시대의-작가/${doc.file}`);
        expect(raw.includes("핵심 메시지")).toBe(true);
        expect(raw.includes("type: writing-scene")).toBe(true);
      }
    }
  });

  it("planning.md 가 ## 기획 본문을 보존", async () => {
    const vault = await makeVaultWithFixture();
    await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
    );
    const planning = vault.getFile("3 Writing/ai-시대의-작가/planning.md");
    expect(planning.includes("type: writing-planning")).toBe(true);
    expect(planning.includes("핵심 메시지")).toBe(true);
  });

  it("v1 frontmatter 가 없는 노트는 throw", async () => {
    const vault = new InMemoryVaultAdapter({
      files: { "3 Writing/x.md": "그냥 본문" },
    });
    await expect(
      migrate(vault, "3 Writing/x.md", "3 Writing/x"),
    ).rejects.toThrow(/v1 writing/);
  });

  it("preserveBackup=false 면 원본 그대로 두고 백업 만들지 않음", async () => {
    const vault = await makeVaultWithFixture();
    const report = await migrate(
      vault,
      `3 Writing/${FIXTURE_FILE}`,
      "3 Writing/ai-시대의-작가",
      { preserveBackup: false },
    );
    expect(report.originalBackupPath).toBeNull();
    // 원본 그대로 살아있어야 함
    expect(vault.hasFile(`3 Writing/${FIXTURE_FILE}`)).toBe(true);
  });
});
