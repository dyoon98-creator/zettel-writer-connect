// wizardSeed.test.ts — in-memory adapters 위에서 wizardSeed 가 project.json /
// binder.json / planning.md 를 만든다.

import { describe, expect, it } from "vitest";

import {
  InMemoryFrontmatterAdapter,
  InMemoryNoticeAdapter,
  InMemoryVaultAdapter,
  isProjectMeta,
  isBinderTree,
  isManuscriptRoot,
  WizardEngine,
  WIZARD_STAGES,
  type WizardSummary,
} from "@ai-manuscript-studio/core";

import { seedProjectFromSummary } from "../../src/wizard/wizardSeed";

function buildSummary(): WizardSummary {
  const engine = new WizardEngine({ draftTitle: "AI 시대의 작가" });
  engine.setDraftGenre("essay");
  for (const stage of WIZARD_STAGES) {
    engine.startStage(stage);
    engine.addMessage("assistant", `${stage} 단계 첫 질문`, stage);
    engine.addMessage("user", `${stage} 단계 답`, stage);
    const decisions: Record<string, string> = {};
    if (stage === "motive") decisions.motive = "AI 시대 작가의 자리에 의문";
    if (stage === "audience-message") {
      decisions.target_reader = "기록은 많지만 원고로 못 만드는 사람";
      decisions.core_message = "AI는 작가를 대체하지 않는다";
    }
    if (stage === "tone") decisions.tone = "따뜻한 회의주의자";
    engine.completeStage(stage, `${stage} 요약`, decisions);
  }
  return engine.finalize([
    { id: "c1", title: "도입", synopsis: "왜 이 책인가" },
    { id: "c2", title: "전개", synopsis: "도구의 한계" },
    { id: "c3", title: "절정", synopsis: "작가의 역할" },
    { id: "c4", title: "결말", synopsis: "약속" },
  ]);
}

describe("wizardSeed", () => {
  it("project.json + binder.json + planning.md 를 시드한다", async () => {
    const vault = new InMemoryVaultAdapter({ basePath: "/vault" });
    const notice = new InMemoryNoticeAdapter();
    const frontmatter = new InMemoryFrontmatterAdapter(vault);

    const summary = buildSummary();
    const result = await seedProjectFromSummary(summary, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      writingRoot: "3 Writing",
    });

    expect(result.vaultPath).toBe("/vault");
    expect(result.projectFolder.startsWith("3 Writing/")).toBe(true);
    expect(result.projectSlug).toContain("AI");

    // project.json
    const projectJsonRaw = vault.getFile(`${result.projectFolder}/project.json`);
    const projectMeta: unknown = JSON.parse(projectJsonRaw);
    expect(isProjectMeta(projectMeta)).toBe(true);
    if (isProjectMeta(projectMeta)) {
      expect(projectMeta.title).toBe("AI 시대의 작가");
      expect(projectMeta.targetReader).toContain("기록");
      expect(projectMeta.coreMessage).toContain("AI");
    }

    // binder.json — 단일 manuscript-root 안에 4 폴더(장).
    const binderRaw = vault.getFile(`${result.projectFolder}/binder.json`);
    const binder: unknown = JSON.parse(binderRaw);
    expect(isBinderTree(binder)).toBe(true);
    if (isBinderTree(binder)) {
      expect(binder.root.length).toBe(1);
      const root = binder.root[0];
      expect(root.type).toBe("folder");
      expect(isManuscriptRoot(root)).toBe(true);
      if (root.type !== "folder") throw new Error("root is folder");
      expect(root.title).toBe("AI 시대의 작가");
      expect(root.children.length).toBe(4);
      const titles = root.children.map((n) => n.title);
      expect(titles).toEqual(["도입", "전개", "절정", "결말"]);
      // 각 챕터 폴더에 빈 장면 1개씩.
      for (const folder of root.children) {
        expect(folder.type).toBe("folder");
        if (folder.type === "folder") {
          expect(folder.children.length).toBe(1);
          expect(folder.children[0].type).toBe("document");
        }
      }
    }

    // planning.md
    expect(vault.hasFile(`${result.projectFolder}/planning.md`)).toBe(true);
    const planning = vault.getFile(`${result.projectFolder}/planning.md`);
    expect(planning).toContain("type: writing-planning");
    expect(planning).toContain("phase: completed");
    expect(planning).toContain("AI 시대의 작가");
  });

  it("같은 slug 가 이미 있으면 -1, -2 로 회피한다", async () => {
    const vault = new InMemoryVaultAdapter({ basePath: "/vault" });
    const notice = new InMemoryNoticeAdapter();
    const frontmatter = new InMemoryFrontmatterAdapter(vault);

    const summary = buildSummary();
    const r1 = await seedProjectFromSummary(summary, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      writingRoot: "3 Writing",
    });
    const r2 = await seedProjectFromSummary(summary, {
      vault,
      notice,
      frontmatter,
      vaultPath: "/vault",
      writingRoot: "3 Writing",
    });
    expect(r1.projectSlug).not.toBe(r2.projectSlug);
    expect(r2.projectSlug).toMatch(/-1$/);
  });
});
