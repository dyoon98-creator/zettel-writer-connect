// Skillpack — public types shared across loader, registry, license checker, etc.
//
// A "skillpack" is a folder shipped to the user (typically as a zip). When the
// user unzips it under `_skillpacks/`, the loader scans the folder, parses the
// manifest, eagerly reads each prompt file, and produces a `LoadedSkillPack`
// that the rest of the plugin can hand off to `ResultPipeline`.

import { ProjectStatus } from "../types";

/** Where a skillpack action's result should be saved. */
export type SaveTarget =
  | "feedback"
  | "revising"
  | "materials"
  | "draft"
  | "plan";

export interface SkillPackActionManifest {
  /** Stable id, namespaced by pack convention. e.g. "essay.first-sentence". */
  id: string;
  label: string;
  /** Empty list = visible on all statuses. */
  status_show: ProjectStatus[];
  /** Path to the prompt template, relative to the skillpack folder. */
  prompt_file: string;
  save_to: SaveTarget;
  /** Optional H2 anchor inside the project body. */
  section_anchor?: string;
  /** If true, ResultPipeline opens a PromptModal first to capture {{user_input}}. */
  requires_user_input?: boolean;
  /** Declared placeholders. Used to validate the prompt template at load. */
  placeholders?: string[];
}

export interface SkillPackManifest {
  id: string;
  name: string;
  version: string;
  vendor: string;
  tier: "free" | "paid";
  /** Optional. Required (for verification) when tier = "paid". */
  license?: { type: "key"; issuer: string; checksum: string };
  actions: SkillPackActionManifest[];
}

/** Result of running the license check for a single pack. */
export type LicenseStatus =
  | { kind: "ok" }
  | { kind: "free" }
  | { kind: "missing"; reason: string }
  | { kind: "invalid"; reason: string }
  | { kind: "expired"; reason: string };

/** A skillpack loaded into memory and ready to be exposed to the UI. */
export interface LoadedSkillPack {
  manifest: SkillPackManifest;
  /** Vault-relative folder path (e.g. "_skillpacks/writer-starter-pack"). */
  folderPath: string;
  /** Action id → eagerly-read prompt template body. */
  promptByActionId: Record<string, string>;
  license: LicenseStatus;
}
