// types.ts — W1 Structure-note → Writing project bridge types.

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

/** Input for createWritingProjectFromHandoff. */
export interface StructureNoteHandoff extends ParsedStructureNote {}
