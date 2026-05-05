// frontmatterAdapter.ts — Obsidian-side implementation of core's
// FrontmatterAdapter.
//
// Uses `app.fileManager.processFrontMatter` for atomic mutation and falls
// back to `metadataCache` for read-only access.

import { App, TFile } from "obsidian";
import type { FrontmatterAdapter } from "@ai-manuscript-studio/core/adapters";

export class ObsidianFrontmatterAdapter implements FrontmatterAdapter {
  constructor(private readonly app: App) {}

  async read(relPath: string): Promise<Record<string, unknown>> {
    const file = this.getFile(relPath);
    if (!file) return {};
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm) return {};
    // metadataCache exposes the parsed frontmatter; copy to avoid mutation.
    return { ...fm };
  }

  async update(
    relPath: string,
    mutator: (fm: Record<string, unknown>) => void,
  ): Promise<void> {
    const file = this.getFile(relPath);
    if (!file) {
      throw new Error(`FrontmatterAdapter.update: 파일을 찾을 수 없습니다 (${relPath})`);
    }
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      mutator(fm as Record<string, unknown>);
    });
  }

  private getFile(relPath: string): TFile | null {
    const f = this.app.vault.getAbstractFileByPath(relPath);
    return f instanceof TFile ? f : null;
  }
}
