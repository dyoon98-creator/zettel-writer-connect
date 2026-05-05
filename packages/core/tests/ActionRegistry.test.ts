// ActionRegistry merges Phase 2 builtins, free actions, and skillpack actions.
// We verify that:
//   - All sources surface in listAll()
//   - status_show filtering works
//   - findById is unique
//   - Phase 2 actions are hidden when status = "idea"

import { ActionRegistry } from "../src/actions/ActionRegistry";
import { LoadedSkillPack } from "../src/skillpack/types";
import { ProjectStatus } from "../src/types";
import { PHASE2_ACTIONS } from "../src/ai/Phase2Actions";

function makePack(
  id: string,
  vendor: string,
  actions: Array<{
    id: string;
    label: string;
    status_show?: ProjectStatus[];
    save_to?: "feedback" | "plan" | "draft" | "materials" | "revising";
    prompt_file?: string;
    placeholders?: string[];
  }>,
  opts?: { tier?: "free" | "paid"; license?: LoadedSkillPack["license"] },
): LoadedSkillPack {
  const promptByActionId: Record<string, string> = {};
  for (const a of actions) {
    promptByActionId[a.id] = `prompt for ${a.id}`;
  }
  return {
    manifest: {
      id,
      name: id,
      version: "1.0.0",
      vendor,
      tier: opts?.tier ?? "free",
      actions: actions.map((a) => ({
        id: a.id,
        label: a.label,
        status_show: a.status_show ?? [],
        prompt_file: a.prompt_file ?? "p.md",
        save_to: a.save_to ?? "feedback",
        placeholders: a.placeholders,
      })),
    },
    folderPath: `_skillpacks/${id}`,
    promptByActionId,
    license: opts?.license ?? { kind: "free" },
  };
}

describe("ActionRegistry", () => {
  it("listAll surfaces phase2 + skillpack actions", () => {
    const status: ProjectStatus | null = "drafting";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([
      makePack("pack-a", "vendor-a", [
        { id: "a.one", label: "A1" },
        { id: "a.two", label: "A2" },
      ]),
    ]);
    const all = reg.listAll();
    // 5 phase2 + 2 skillpack
    expect(all.length).toBe(PHASE2_ACTIONS.length + 2);
    expect(all.find((x) => x.id === "a.one")?.source).toBe("skillpack");
    expect(all.find((x) => x.id === PHASE2_ACTIONS[0].id)?.source).toBe(
      "phase2",
    );
  });

  it("listForCurrentStatus filters phase2 out at status=idea", () => {
    const status: ProjectStatus | null = "idea";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([]);
    expect(reg.listForCurrentStatus().length).toBe(0);
  });

  it("listForCurrentStatus filters skillpack actions by status_show", () => {
    const status: ProjectStatus | null = "feedback";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([
      makePack("p1", "v", [
        { id: "p1.draft-only", label: "Drafting only", status_show: ["drafting"] },
        { id: "p1.always", label: "Always", status_show: [] },
        { id: "p1.feedback", label: "Feedback only", status_show: ["feedback"] },
      ]),
    ]);
    const list = reg.listForCurrentStatus();
    const ids = list.map((a) => a.id);
    expect(ids).toContain("p1.always");
    expect(ids).toContain("p1.feedback");
    expect(ids).not.toContain("p1.draft-only");
  });

  it("findById returns the matching action across sources", () => {
    const status: ProjectStatus | null = "drafting";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([makePack("p1", "v", [{ id: "p1.x", label: "X" }])]);

    expect(reg.findById("p1.x")?.source).toBe("skillpack");
    expect(reg.findById(PHASE2_ACTIONS[0].id)?.source).toBe("phase2");
    expect(reg.findById("never-exists")).toBeNull();
  });

  it("propagates license status from pack to UnifiedAction", () => {
    const status: ProjectStatus | null = "drafting";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([
      makePack(
        "paid-pack",
        "vendor",
        [{ id: "paid.a", label: "Paid A" }],
        { tier: "paid", license: { kind: "missing", reason: "키 없음" } },
      ),
    ]);
    const a = reg.findById("paid.a");
    expect(a?.license.kind).toBe("missing");
  });

  it("with no skillpacks installed, only phase2 actions surface", () => {
    const status: ProjectStatus | null = "drafting";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([]);
    const list = reg.listForCurrentStatus();
    expect(list.length).toBe(PHASE2_ACTIONS.length);
    expect(list.every((a) => a.source === "phase2")).toBe(true);
  });

  it("ids are unique across sources", () => {
    const status: ProjectStatus | null = "drafting";
    const reg = new ActionRegistry(() => status);
    reg.setSkillpacks([
      makePack("p1", "v1", [{ id: "p1.uniq", label: "X" }]),
      makePack("p2", "v2", [{ id: "p2.uniq", label: "Y" }]),
    ]);
    const all = reg.listAll();
    const ids = all.map((a) => a.id);
    const seen = new Set<string>();
    for (const id of ids) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });
});
