// FrontmatterAdapter — replaces Obsidian's `App.fileManager.processFrontMatter`.
//
// `update()` is the canonical mutator: callers receive a plain object, mutate
// it in place, and the adapter persists the result back to the file's YAML
// block. `read()` is read-only.

export interface FrontmatterAdapter {
  /** Returns the current frontmatter object, or {} if the file has none. */
  read(relPath: string): Promise<Record<string, unknown>>;
  /**
   * Atomically read → mutate → write the frontmatter of `relPath`.
   * The mutator runs against a mutable copy; the adapter serializes the
   * result back into the file, preserving body content verbatim.
   */
  update(
    relPath: string,
    mutator: (fm: Record<string, unknown>) => void,
  ): Promise<void>;
}
