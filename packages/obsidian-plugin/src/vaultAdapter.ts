// vaultAdapter.ts — Obsidian-side implementation of core's VaultAdapter.
//
// Phase G: the slim indexer only needs read/list/exists + watch (for live
// re-render of project cards). Writes are still implemented for
// future-proofing (e.g. updating updatedAt when the user edits via the app).

import { App, FileSystemAdapter, TAbstractFile } from "obsidian";
import type {
  VaultAdapter,
  VaultDirEntry,
  VaultEvent,
} from "@ai-manuscript-studio/core/adapters";

export class ObsidianVaultAdapter implements VaultAdapter {
  constructor(private readonly app: App) {}

  async readFile(relPath: string): Promise<string> {
    return this.app.vault.adapter.read(relPath);
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    // Ensure parent directory exists for writes that might create new files.
    const slash = relPath.lastIndexOf("/");
    if (slash > 0) {
      await this.ensureDir(relPath.slice(0, slash));
    }
    await this.app.vault.adapter.write(relPath, content);
  }

  async fileExists(relPath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(relPath);
  }

  async listDir(relPath: string): Promise<VaultDirEntry[]> {
    try {
      const result = await this.app.vault.adapter.list(relPath);
      const out: VaultDirEntry[] = [];
      for (const folder of result.folders) {
        const name = folder.split("/").filter(Boolean).pop() ?? folder;
        out.push({ name, isDirectory: true });
      }
      for (const file of result.files) {
        const name = file.split("/").filter(Boolean).pop() ?? file;
        out.push({ name, isDirectory: false });
      }
      return out;
    } catch {
      // Treat "directory missing" as empty.
      return [];
    }
  }

  async ensureDir(relPath: string): Promise<void> {
    if (!relPath || relPath === "/" || relPath === ".") return;
    const exists = await this.app.vault.adapter.exists(relPath);
    if (exists) return;
    try {
      await this.app.vault.createFolder(relPath);
    } catch (err) {
      // createFolder throws on race; tolerate it.
      const stillMissing = !(await this.app.vault.adapter.exists(relPath));
      if (stillMissing) throw err;
    }
  }

  async deleteFile(relPath: string): Promise<void> {
    const exists = await this.app.vault.adapter.exists(relPath);
    if (!exists) return;
    await this.app.vault.adapter.remove(relPath);
  }

  watch(relPath: string, cb: (event: VaultEvent) => void): () => void {
    const prefix = relPath.replace(/\/+$/, "");

    const matches = (path: string): boolean => {
      if (!prefix) return true;
      return path === prefix || path.startsWith(prefix + "/");
    };

    const onCreate = this.app.vault.on("create", (file: TAbstractFile) => {
      if (matches(file.path)) cb({ type: "create", path: file.path });
    });
    const onModify = this.app.vault.on("modify", (file: TAbstractFile) => {
      if (matches(file.path)) cb({ type: "modify", path: file.path });
    });
    const onDelete = this.app.vault.on("delete", (file: TAbstractFile) => {
      if (matches(file.path)) cb({ type: "delete", path: file.path });
    });
    const onRename = this.app.vault.on(
      "rename",
      (file: TAbstractFile, oldPath: string) => {
        if (matches(file.path) || matches(oldPath)) {
          cb({ type: "rename", from: oldPath, to: file.path });
        }
      },
    );

    return () => {
      this.app.vault.offref(onCreate);
      this.app.vault.offref(onModify);
      this.app.vault.offref(onDelete);
      this.app.vault.offref(onRename);
    };
  }

  getBasePath(): string {
    const adapter = this.app.vault.adapter as unknown;
    if (
      typeof adapter === "object" &&
      adapter !== null &&
      typeof (adapter as FileSystemAdapter).getBasePath === "function"
    ) {
      return (adapter as FileSystemAdapter).getBasePath();
    }
    return "";
  }
}
