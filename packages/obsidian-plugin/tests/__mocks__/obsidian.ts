// Minimal Obsidian API mocks for the slim plugin's unit tests.
// Translated and trimmed from v1's obsidian mock — only what Phase G
// touches (Plugin, ItemView, WorkspaceLeaf, Notice, App, Vault adapter,
// FileSystemAdapter, TFile, Platform).

// Obsidian's real .d.ts augments lib.dom's Element/HTMLElement with helpers
// like createDiv/createEl/createSpan/addClass/empty/setText. The test code
// imports those off DOM types via this mock, so we re-augment the same way.
declare global {
  interface Element {
    empty(): void;
    setText(text: string): void;
    addClass(cls: string): void;
    createDiv(opts?: string | { cls?: string; text?: string }): HTMLDivElement;
    createEl(tag: string, opts?: { cls?: string; text?: string }): HTMLElement;
    createSpan(opts?: { cls?: string; text?: string }): HTMLSpanElement;
  }
}
export {};

export class Plugin {
  app: App;
  manifest: unknown;
  constructor(app?: App, manifest?: unknown) {
    this.app = app ?? new App();
    this.manifest = manifest ?? {};
  }
  registerView(_t: string, _f: (leaf: WorkspaceLeaf) => unknown) {}
  addRibbonIcon(_i: string, _t: string, _cb: () => void): HTMLElement {
    return document.createElement("div");
  }
  addCommand(_c: unknown) {}
  addSettingTab(_t: unknown) {}
  registerEvent(_e: unknown) {}
  async loadData(): Promise<unknown> {
    return null;
  }
  async saveData(_d: unknown): Promise<void> {}
  async loadSettings(): Promise<void> {}
}

export class ItemView {
  containerEl: HTMLElement;
  app: App;
  leaf: WorkspaceLeaf;
  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.app ?? new App();
    const root = document.createElement("div");
    const inner = document.createElement("div");
    root.appendChild(document.createElement("div"));
    root.appendChild(inner);
    this.containerEl = root;
    augmentEl(root);
    augmentEl(inner);
  }
}

export class WorkspaceLeaf {
  app: App | null = null;
  view: unknown = null;
  async openFile(_f: TFile): Promise<void> {}
  async setViewState(_s: unknown): Promise<void> {}
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  constructor(app?: App) {
    this.app = app ?? new App();
    const el = document.createElement("div");
    augmentEl(el);
    this.contentEl = el;
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;
  constructor(app: App, _plugin: unknown) {
    this.app = app;
    const el = document.createElement("div");
    augmentEl(el);
    this.containerEl = el;
  }
}

class TextStub {
  setPlaceholder(_p: string) { return this; }
  setValue(_v: string) { return this; }
  onChange(_cb: (v: string) => void) { return this; }
}
class DropdownStub {
  addOption(_v: string, _l: string) { return this; }
  setValue(_v: string) { return this; }
  onChange(_cb: (v: string) => void) { return this; }
}
class ToggleStub {
  setValue(_v: boolean) { return this; }
  onChange(_cb: (v: boolean) => void) { return this; }
}
export class Setting {
  constructor(public containerEl: unknown) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addText(cb?: (t: TextStub) => void) { cb?.(new TextStub()); return this; }
  addDropdown(cb?: (d: DropdownStub) => void) { cb?.(new DropdownStub()); return this; }
  addToggle(cb?: (t: ToggleStub) => void) { cb?.(new ToggleStub()); return this; }
}

class Workspace {
  private leaves: Map<string, WorkspaceLeaf[]> = new Map();
  private activeFile: TFile | null = null;
  private rightLeaf: WorkspaceLeaf | null = null;
  __setActiveFile(f: TFile | null) { this.activeFile = f; }
  __setRightLeaf(l: WorkspaceLeaf | null) { this.rightLeaf = l; }
  __addLeaf(type: string, leaf: WorkspaceLeaf) {
    const arr = this.leaves.get(type) ?? [];
    arr.push(leaf);
    this.leaves.set(type, arr);
  }
  getActiveFile(): TFile | null { return this.activeFile; }
  getLeavesOfType(t: string): WorkspaceLeaf[] { return this.leaves.get(t) ?? []; }
  getRightLeaf(_split: boolean): WorkspaceLeaf | null { return this.rightLeaf; }
  getLeaf(_split: boolean | "tab"): WorkspaceLeaf { return new WorkspaceLeaf(); }
  revealLeaf(_l: WorkspaceLeaf) {}
  on(_e: string, _cb: unknown) { return null; }
  offref(_r: unknown) {}
}

interface AdapterListResult { folders: string[]; files: string[]; }

export class FileSystemAdapter {
  private basePath: string;
  private fs: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();
  constructor(basePath = "/vault") {
    this.basePath = basePath;
  }
  getBasePath(): string { return this.basePath; }
  __setFile(path: string, content: string) {
    this.fs.set(path, content);
    // also register every parent as a directory
    let p = path;
    while (true) {
      const i = p.lastIndexOf("/");
      if (i < 0) break;
      p = p.slice(0, i);
      if (!p) break;
      this.dirs.add(p);
    }
  }
  __setDir(path: string) { this.dirs.add(path); }
  async read(p: string): Promise<string> {
    const v = this.fs.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  }
  async write(p: string, c: string): Promise<void> { this.fs.set(p, c); }
  async exists(p: string): Promise<boolean> {
    return this.fs.has(p) || this.dirs.has(p);
  }
  async list(p: string): Promise<AdapterListResult> {
    const trimmed = p.replace(/\/+$/, "");
    const folders = new Set<string>();
    const files: string[] = [];
    for (const dir of this.dirs) {
      if (dir === trimmed) continue;
      if (dir.startsWith(trimmed + "/")) {
        const rest = dir.slice(trimmed.length + 1);
        const head = rest.split("/")[0];
        folders.add(`${trimmed}/${head}`);
      }
    }
    for (const f of this.fs.keys()) {
      if (f.startsWith(trimmed + "/")) {
        const rest = f.slice(trimmed.length + 1);
        if (!rest.includes("/")) files.push(f);
      }
    }
    return { folders: Array.from(folders), files };
  }
  async remove(p: string): Promise<void> { this.fs.delete(p); }
}

class Vault {
  adapter: FileSystemAdapter;
  private files: Map<string, TFile> = new Map();
  constructor(adapter?: FileSystemAdapter) {
    this.adapter = adapter ?? new FileSystemAdapter();
  }
  getAbstractFileByPath(p: string): TFile | null {
    return this.files.get(p) ?? null;
  }
  __addFile(f: TFile): void {
    this.files.set(f.path, f);
  }
  on(_e: string, _cb: unknown): { ref: number } { return { ref: 0 }; }
  offref(_r: unknown): void {}
  async createFolder(_p: string): Promise<void> {}
  async read(_f: TFile): Promise<string> { return ""; }
  async modify(_f: TFile, _c: string): Promise<void> {}
}

class MetadataCache {
  private map: Map<string, { frontmatter?: Record<string, unknown> }> = new Map();
  __set(path: string, fm: Record<string, unknown>): void {
    this.map.set(path, { frontmatter: fm });
  }
  getFileCache(f: TFile) { return this.map.get(f.path) ?? null; }
}

class FileManager {
  async processFrontMatter(
    _f: TFile,
    _mut: (fm: Record<string, unknown>) => void,
  ): Promise<void> {}
}

export class App {
  workspace: Workspace = new Workspace();
  vault: Vault = new Vault();
  metadataCache: MetadataCache = new MetadataCache();
  fileManager: FileManager = new FileManager();
}

export class TFile {
  path: string = "";
  basename: string = "";
  extension: string = "md";
  parent: { path: string } | null = null;
  stat: { mtime: number } = { mtime: 0 };
  constructor(path: string = "") {
    this.path = path;
    const seg = path.split("/").pop() ?? "";
    const dot = seg.lastIndexOf(".");
    this.basename = dot > 0 ? seg.slice(0, dot) : seg;
    this.extension = dot > 0 ? seg.slice(dot + 1) : "";
  }
}

export class TAbstractFile {
  path: string = "";
}

export class Notice {
  static __log: string[] = [];
  constructor(public message: string, _duration?: number) {
    Notice.__log.push(message);
  }
}

export const Platform = {
  isMobile: false,
  isDesktop: true,
};

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/");
}

// ── Helpers ───────────────────────────────────────────────

// Use a loose interface — we only need the augmented helpers; cast to `any`
// at the call sites to avoid HTMLElementTagNameMap signature conflicts.
type AugmentedEl = HTMLElement & Record<string, unknown>;

function augmentEl(raw: HTMLElement): AugmentedEl {
  // Use defineProperty to attach helpers that overlap with TS lib.dom names
  // (createEl/createDiv) without triggering signature-conflict errors.
  const anyEl = raw as unknown as Record<string, unknown>;
  if (typeof anyEl.empty === "function") return raw as AugmentedEl;

  const define = (name: string, fn: (...args: unknown[]) => unknown) => {
    Object.defineProperty(raw, name, {
      value: fn,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  };

  define("empty", function (this: HTMLElement) {
    while (this.firstChild) this.removeChild(this.firstChild);
  });
  define("setText", function (this: HTMLElement, t: unknown) {
    this.textContent = String(t);
  });
  define("addClass", function (this: HTMLElement, c: unknown) {
    this.classList.add(String(c));
  });
  define("createDiv", function (this: HTMLElement, opts?: unknown) {
    const child = document.createElement("div");
    if (typeof opts === "string") child.className = opts;
    else if (opts && typeof opts === "object") {
      const o = opts as { cls?: string; text?: string };
      if (o.cls) child.className = o.cls;
      if (o.text) child.textContent = o.text;
    }
    this.appendChild(child);
    return augmentEl(child);
  });
  define("createEl", function (this: HTMLElement, tag: unknown, opts?: unknown) {
    const child = document.createElement(String(tag));
    if (opts && typeof opts === "object") {
      const o = opts as { cls?: string; text?: string };
      if (o.cls) child.className = o.cls;
      if (o.text) child.textContent = o.text;
    }
    this.appendChild(child);
    return augmentEl(child);
  });
  define("createSpan", function (this: HTMLElement, opts?: unknown) {
    const child = document.createElement("span");
    if (opts && typeof opts === "object") {
      const o = opts as { cls?: string; text?: string };
      if (o.cls) child.className = o.cls;
      if (o.text) child.textContent = o.text;
    }
    this.appendChild(child);
    return augmentEl(child);
  });
  return raw as AugmentedEl;
}
