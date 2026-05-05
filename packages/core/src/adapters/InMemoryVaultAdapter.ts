// InMemoryVaultAdapter — Map-backed vault for unit tests.
//
// Paths are vault-relative POSIX strings (e.g. "3 Writing/test.md"). The
// adapter mimics the surface real adapters expose: file CRUD, dir listing,
// watch subscriptions. `getBasePath()` returns whatever string the test
// passed in (defaults to "/in-memory").

import {
  VaultAdapter,
  VaultDirEntry,
  VaultEvent,
} from "./VaultAdapter";

interface Listener {
  prefix: string; // path the user is watching
  cb: (event: VaultEvent) => void;
}

export interface InMemoryVaultAdapterOptions {
  /** Initial files: map of vault-relative path → content. */
  files?: Record<string, string>;
  /** Optional directories to mark as existing even if no files inside. */
  directories?: string[];
  /** Returned by `getBasePath()`. Useful for skillpack loader tests. */
  basePath?: string;
}

export class InMemoryVaultAdapter implements VaultAdapter {
  private files = new Map<string, string>();
  private dirs = new Set<string>();
  private listeners: Listener[] = [];
  private basePath: string;

  constructor(opts: InMemoryVaultAdapterOptions = {}) {
    this.basePath = opts.basePath ?? "/in-memory";
    for (const [p, body] of Object.entries(opts.files ?? {})) {
      this.files.set(this.norm(p), body);
      this.markParents(p);
    }
    for (const d of opts.directories ?? []) {
      this.dirs.add(this.norm(d));
    }
  }

  // ---- VaultAdapter surface ----

  async readFile(relPath: string): Promise<string> {
    const p = this.norm(relPath);
    const v = this.files.get(p);
    if (v === undefined) {
      throw new Error(`InMemoryVaultAdapter: file not found: ${p}`);
    }
    return v;
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const p = this.norm(relPath);
    const isCreate = !this.files.has(p);
    this.files.set(p, content);
    this.markParents(p);
    this.emit({ type: isCreate ? "create" : "modify", path: p });
  }

  async fileExists(relPath: string): Promise<boolean> {
    const p = this.norm(relPath);
    return this.files.has(p) || this.dirs.has(p);
  }

  async listDir(relPath: string): Promise<VaultDirEntry[]> {
    const dir = this.norm(relPath).replace(/\/+$/, "");
    const prefix = dir === "" ? "" : `${dir}/`;
    const seen = new Map<string, boolean>(); // name → isDir
    for (const p of this.files.keys()) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (rest === "") continue;
      const slash = rest.indexOf("/");
      if (slash === -1) {
        seen.set(rest, false);
      } else {
        const child = rest.slice(0, slash);
        if (!seen.has(child)) seen.set(child, true);
      }
    }
    for (const d of this.dirs) {
      if (!d.startsWith(prefix)) continue;
      const rest = d.slice(prefix.length);
      if (rest === "") continue;
      const slash = rest.indexOf("/");
      const child = slash === -1 ? rest : rest.slice(0, slash);
      if (!seen.has(child)) seen.set(child, true);
    }
    return [...seen.entries()].map(([name, isDirectory]) => ({
      name,
      isDirectory,
    }));
  }

  async ensureDir(relPath: string): Promise<void> {
    const p = this.norm(relPath);
    if (!this.dirs.has(p)) {
      this.dirs.add(p);
      this.markParents(p + "/.placeholder");
      this.emit({ type: "create", path: p });
    }
  }

  async deleteFile(relPath: string): Promise<void> {
    const p = this.norm(relPath);
    if (this.files.delete(p)) {
      this.emit({ type: "delete", path: p });
    }
  }

  watch(relPath: string, cb: (event: VaultEvent) => void): () => void {
    const listener: Listener = { prefix: this.norm(relPath), cb };
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  getBasePath(): string {
    return this.basePath;
  }

  // ---- Test helpers (not part of VaultAdapter) ----

  /** Mutate file content directly, emitting a modify event. */
  setFile(relPath: string, content: string): void {
    const p = this.norm(relPath);
    const isCreate = !this.files.has(p);
    this.files.set(p, content);
    this.markParents(p);
    this.emit({ type: isCreate ? "create" : "modify", path: p });
  }

  /** Read without async wrapping. Throws if not found. */
  getFile(relPath: string): string {
    const p = this.norm(relPath);
    const v = this.files.get(p);
    if (v === undefined) throw new Error(`not found: ${p}`);
    return v;
  }

  /** True iff `relPath` exists as a file (does NOT match dirs). */
  hasFile(relPath: string): boolean {
    return this.files.has(this.norm(relPath));
  }

  /** Snapshot of current files (path → content). */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }

  // ---- internals ----

  private norm(p: string): string {
    return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  }

  private markParents(filePath: string): void {
    const parts = filePath.split("/");
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join("/");
      if (dir) this.dirs.add(dir);
    }
  }

  private emit(event: VaultEvent): void {
    const eventPath =
      event.type === "rename" ? event.to : event.path;
    for (const l of this.listeners) {
      if (l.prefix === "" || eventPath.startsWith(l.prefix)) {
        try {
          l.cb(event);
        } catch {
          /* swallow */
        }
      }
    }
  }
}
