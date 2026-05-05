// ActionRegistry — single source of truth for action buttons rendered in
// the right-hand pane. Merges three sources:
//   1. "free"     — Phase 4 free actions; never call AI (file/clipboard ops)
//   2. "phase2"   — built-in AI actions defined in src/ai/Phase2Actions.ts
//   3. "skillpack"— actions loaded from `_skillpacks/<id>/skillpack.json`
//
// `ResultPipeline.run()` consumes a `UnifiedAction`. Free actions bypass the
// pipeline entirely and run their `handler`.

import { LoadedSkillPack, LicenseStatus, SaveTarget } from "../skillpack/types";
import { ProjectStatus } from "../types";
import { PHASE2_ACTIONS } from "../ai/Phase2Actions";

export type UnifiedSource = "free" | "phase2" | "skillpack";

export interface UnifiedAction {
  /** Globally-unique id across all sources. */
  id: string;
  source: UnifiedSource;
  /** Skillpack id when source = "skillpack"; undefined otherwise. */
  skillpackId?: string;
  /** Vendor name when source = "skillpack"; useful for grouping in UI. */
  skillpackVendor?: string;
  label: string;
  /** Empty list = always visible. */
  status_show: ProjectStatus[];
  saveTo: SaveTarget;
  sectionAnchor?: string;
  requiresUserInput?: boolean;
  /** The prompt template body (already loaded into memory). */
  promptTemplate: string;
  /** Declared placeholder names (used for warnings, not enforcement). */
  placeholders: string[];
  /** License gate — "free" for any non-paid source. */
  license: LicenseStatus;
  /**
   * Free-action handler: when present, the pane runs this instead of
   * dispatching through ResultPipeline. AI actions leave this undefined.
   */
  handler?: () => void | Promise<void>;
}

/** Provider that supplies the canonical free actions for the current project. */
export interface FreeActionProvider {
  list(): UnifiedAction[];
}

export class ActionRegistry {
  private skillpacks: LoadedSkillPack[] = [];
  private freeProvider: FreeActionProvider | null = null;

  constructor(private getStatus: () => ProjectStatus | null) {}

  setSkillpacks(packs: LoadedSkillPack[]): void {
    this.skillpacks = packs;
  }

  setFreeProvider(provider: FreeActionProvider | null): void {
    this.freeProvider = provider;
  }

  /** All actions, regardless of current status. Used by lookup/findById. */
  listAll(): UnifiedAction[] {
    const out: UnifiedAction[] = [];

    // Free (Phase 4)
    if (this.freeProvider) {
      for (const a of this.freeProvider.list()) out.push(a);
    }

    // Phase 2 builtins
    for (const a of PHASE2_ACTIONS) {
      out.push({
        id: a.id,
        source: "phase2",
        label: a.label,
        status_show: PHASE2_NON_IDEA_STATUSES, // Phase 2 default: anything but "idea"
        saveTo: a.saveTo as SaveTarget,
        sectionAnchor: a.sectionAnchor,
        requiresUserInput: false,
        promptTemplate: a.promptTemplate,
        placeholders: a.placeholders,
        license: { kind: "free" },
      });
    }

    // Skillpacks
    for (const pack of this.skillpacks) {
      for (const action of pack.manifest.actions) {
        const tpl = pack.promptByActionId[action.id] ?? "";
        out.push({
          id: action.id,
          source: "skillpack",
          skillpackId: pack.manifest.id,
          skillpackVendor: pack.manifest.vendor,
          label: action.label,
          status_show: action.status_show,
          saveTo: action.save_to,
          sectionAnchor: action.section_anchor,
          requiresUserInput: action.requires_user_input ?? false,
          promptTemplate: tpl,
          placeholders: action.placeholders ?? [],
          license: pack.license,
        });
      }
    }

    return out;
  }

  /** Filter `listAll()` by the current project status from `getStatus()`. */
  listForCurrentStatus(): UnifiedAction[] {
    const status = this.getStatus();
    if (!status) return [];
    return this.listAll().filter(
      (a) => a.status_show.length === 0 || a.status_show.includes(status),
    );
  }

  /** First action with the given id, or null. */
  findById(id: string): UnifiedAction | null {
    return this.listAll().find((a) => a.id === id) ?? null;
  }
}

/**
 * Phase 2 actions historically displayed when the project was past "idea".
 * We preserve that behavior here so the registry-driven pane matches the
 * pre-refactor UX.
 */
const PHASE2_NON_IDEA_STATUSES: ProjectStatus[] = [
  "planning",
  "outline",
  "researching",
  "drafting",
  "feedback",
  "revising",
  "final",
  "published",
];
