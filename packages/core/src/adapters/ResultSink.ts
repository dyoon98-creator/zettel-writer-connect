// ResultSink — environment-neutral target for AI-generated text.
//
// Obsidian provides an editor + MarkdownRenderer; Tauri provides a custom
// editor surface. The pipeline shouldn't care which — it just calls these
// methods and lets the host handle the actual UI side effects.

export interface ResultSink {
  /** Append text under a section heading inside a project file. */
  appendUnderSection(
    projectPath: string,
    section: string,
    text: string,
    heading?: string,
  ): Promise<void>;
  /** Insert text at the user's current cursor (no-op if not applicable). */
  insertAtCursor?(text: string): Promise<void>;
  /** Render markdown to HTML. Optional; consumers may fall back to raw text. */
  renderMarkdown?(markdown: string): Promise<string>;
}
