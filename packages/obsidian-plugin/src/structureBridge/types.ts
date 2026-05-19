// types.ts — W1 Structure-note → Writing project bridge types.

import type { Genre, ProjectStatus } from "@ai-manuscript-studio/core/browser";

/** Parsed representation of an active 3.Structure note. */
export interface ParsedStructureNote {
  /** Vault-relative path (always under 3.Structure/). */
  structureNotePath: string;
  /** H1 heading or filename fallback (no extension). */
  title: string;
  /** frontmatter id field, if present. */
  id?: string;
  /** frontmatter topic field, if present. */
  topic?: string;
  /** frontmatter claim or ## 🗂 주장 blockquote extraction. */
  claim?: string;
  /** frontmatter related_notes array, if present. */
  relatedNotes?: string[];
}

export interface WritingHandoffProjectMeta {
  title?: string;
  genre?: Genre;
  wordGoal?: number;
  status?: ProjectStatus;
}

/** Input for createWritingProjectFromHandoff. */
export interface StructureNoteHandoff extends ParsedStructureNote {
  /** Additional vault-relative source note paths, after structureNotePath. */
  sourceNotes?: string[];
  /** Bridge contract mode, e.g. new-structure-to-writing. */
  bridgeMode?: string;
  /** Bridge contract version. */
  bridgeVersion?: string;
  /** Vault-relative handoff JSON path, if imported from _index. */
  handoffPath?: string;
  /** Optional target writing root from the JSON handoff. */
  targetWritingFolder?: string;
  /** Optional project metadata from the JSON handoff. */
  project?: WritingHandoffProjectMeta;
}
