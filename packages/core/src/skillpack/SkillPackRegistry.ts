// SkillPackRegistry — in-memory catalog of loaded skillpacks. Lightweight
// wrapper that lets the rest of the plugin (ActionRegistry, settings tab)
// query the current state without re-running the loader.
//
// Updated by SkillPackLoader after each scan.

import { LoadedSkillPack, SkillPackActionManifest } from "./types";
import { ProjectStatus } from "../types";

export class SkillPackRegistry {
  private packs: LoadedSkillPack[] = [];

  setPacks(packs: LoadedSkillPack[]): void {
    this.packs = packs;
  }

  getPacks(): LoadedSkillPack[] {
    return this.packs;
  }

  /** Find a single pack that owns the given action id. */
  findPackByActionId(actionId: string): LoadedSkillPack | null {
    for (const pack of this.packs) {
      if (pack.manifest.actions.some((a) => a.id === actionId)) {
        return pack;
      }
    }
    return null;
  }

  /**
   * Flatten all actions across all packs that should appear at this status.
   * `status_show: []` means "always shown".
   */
  getActionsForStatus(
    status: ProjectStatus,
  ): { pack: LoadedSkillPack; action: SkillPackActionManifest }[] {
    const out: { pack: LoadedSkillPack; action: SkillPackActionManifest }[] = [];
    for (const pack of this.packs) {
      for (const action of pack.manifest.actions) {
        if (action.status_show.length === 0 || action.status_show.includes(status)) {
          out.push({ pack, action });
        }
      }
    }
    return out;
  }
}
