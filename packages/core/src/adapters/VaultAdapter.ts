// VaultAdapter — environment-neutral interface to a vault filesystem.
//
// Both the Obsidian plugin and the Tauri desktop app provide their own
// implementation. Core modules talk to the vault only through this surface.

export type VaultEvent =
  | { type: "create"; path: string }
  | { type: "modify"; path: string }
  | { type: "delete"; path: string }
  | { type: "rename"; from: string; to: string };

export interface VaultDirEntry {
  name: string;
  isDirectory: boolean;
}

export interface VaultAdapter {
  /** Read a file by vault-relative path. Throws if not found. */
  readFile(relPath: string): Promise<string>;
  /** Write a file by vault-relative path. Creates parents if needed. */
  writeFile(relPath: string, content: string): Promise<void>;
  /** True iff the file or directory exists. */
  fileExists(relPath: string): Promise<boolean>;
  /** List immediate children (non-recursive) of a vault-relative directory. */
  listDir(relPath: string): Promise<VaultDirEntry[]>;
  /** Idempotent — does nothing if the directory already exists. */
  ensureDir(relPath: string): Promise<void>;
  /** Delete a file. No-op if missing (caller may pre-check). */
  deleteFile(relPath: string): Promise<void>;
  /** Subscribe to filesystem events under `relPath`. Returns an unsubscribe fn. */
  watch(relPath: string, cb: (event: VaultEvent) => void): () => void;
  /** Absolute filesystem path of the vault root, for skillpack loader etc. */
  getBasePath(): string;
}
