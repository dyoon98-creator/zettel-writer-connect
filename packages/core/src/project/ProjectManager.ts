// ProjectManager — owner of writing-project files.
// All vault writes are scoped to settings.writingFolder.
//
// Phase A: depends on adapters (VaultAdapter, NoticeAdapter, FrontmatterAdapter)
// instead of Obsidian's `App`. The host supplies a `ProjectIndex` callback —
// in the plugin it walks `app.vault.getMarkdownFiles()` + metadata cache; in
// Tauri it walks the disk directly. The host also supplies an `openFile`
// callback (no-op in tests).

import {
  Genre,
  PLUGIN_ID,
  ProjectStatus,
  SCHEMA_VERSION,
  WritingProjectFrontmatter,
} from "../types";
import { Templates } from "./Templates";
import { WritingNoteIO } from "./WritingNoteIO";
import { StatusMachine } from "./StatusMachine";
import { slugify, todayDateStamp, todayIso } from "../utils/paths";
import { log } from "../utils/logger";
import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { FrontmatterAdapter } from "../adapters/FrontmatterAdapter";

export interface CreateProjectInput {
  title: string;
  genre: Genre;
  wordGoal: number;
  sourceNotes?: string[];
  /** Optional starting status; defaults to "planning". */
  status?: ProjectStatus;
}

export interface WritingProject {
  /** Vault-relative path of the project file. */
  path: string;
  frontmatter: WritingProjectFrontmatter;
  /** Display title — basename without extension. */
  title: string;
}

/**
 * Host-provided enumeration of project candidates. Each candidate is an
 * already-detected AMS writing note: the host has already filtered by
 * `type === "writing"` and `plugin === PLUGIN_ID`.
 */
export interface ProjectIndex {
  list(): Promise<{ path: string; frontmatter: Record<string, unknown> }[]>;
}

export interface ProjectManagerDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  frontmatter: FrontmatterAdapter;
  /** Returns the writing folder vault-relative path. */
  getWritingFolder: () => string;
  /** Optional: enumerates AMS-tagged writing notes for `list()`. */
  index?: ProjectIndex;
  /** Optional callback so the host can open a freshly-created file. */
  openFile?: (path: string) => void | Promise<void>;
}

export class ProjectManager {
  constructor(private deps: ProjectManagerDeps) {}

  /** Returns all AMS-owned writing projects, sorted by `updated` desc. */
  async list(): Promise<WritingProject[]> {
    const folder = this.deps.getWritingFolder();
    if (!this.deps.index) return [];
    const candidates = await this.deps.index.list();
    const out: WritingProject[] = [];
    for (const c of candidates) {
      if (folder && !c.path.startsWith(`${folder}/`)) continue;
      const fm = c.frontmatter;
      if (fm.type !== "writing") continue;
      if (fm.plugin !== PLUGIN_ID) continue;
      out.push({
        path: c.path,
        frontmatter: this.coerceFrontmatter(fm),
        title: basenameOf(c.path),
      });
    }
    out.sort((a, b) => {
      const ua = a.frontmatter.updated ?? "";
      const ub = b.frontmatter.updated ?? "";
      return ub.localeCompare(ua);
    });
    return out;
  }

  private coerceFrontmatter(
    raw: Record<string, unknown>,
  ): WritingProjectFrontmatter {
    return {
      type: "writing",
      status: (raw.status as ProjectStatus) ?? "idea",
      genre: (raw.genre as Genre) ?? "investment-strategy-memo",
      created: String(raw.created ?? ""),
      updated: String(raw.updated ?? ""),
      word_goal: Number(raw.word_goal ?? 0),
      current_words: Number(raw.current_words ?? 0),
      target_reader: String(raw.target_reader ?? ""),
      core_message: String(raw.core_message ?? ""),
      source_notes: Array.isArray(raw.source_notes)
        ? (raw.source_notes as string[])
        : [],
      plugin: PLUGIN_ID,
      schema_version: Number(raw.schema_version ?? SCHEMA_VERSION),
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    };
  }

  /** Creates the writing folder if missing. Idempotent. */
  private async ensureFolder(): Promise<string> {
    const folder = this.deps.getWritingFolder();
    await this.deps.vault.ensureDir(folder);
    return folder;
  }

  /** Creates a new writing project file and returns it. Opens it on success. */
  async create(input: CreateProjectInput): Promise<WritingProject> {
    const folder = await this.ensureFolder();
    const stamp = todayDateStamp();
    const slug = slugify(input.title);
    let attempt = 0;
    let path = `${folder}/${stamp}_${slug}.md`;
    while (await this.deps.vault.fileExists(path)) {
      attempt += 1;
      path = `${folder}/${stamp}_${slug}-${attempt}.md`;
    }

    const today = todayIso();
    const fm: WritingProjectFrontmatter = {
      type: "writing",
      status: input.status ?? "planning",
      genre: input.genre,
      created: today,
      updated: today,
      word_goal: Math.max(0, input.wordGoal | 0),
      current_words: 0,
      target_reader: "",
      core_message: "",
      source_notes: input.sourceNotes ?? [],
      plugin: PLUGIN_ID,
      schema_version: SCHEMA_VERSION,
      tags: ["글쓰기", "원고"],
    };

    const body = WritingNoteIO.buildInitialNote(
      fm,
      input.title,
      Templates.body(input.genre),
    );
    await this.deps.vault.writeFile(path, body);

    // If sources were provided, ensure they appear under ## 자료 too.
    if (fm.source_notes.length > 0) {
      await this.appendSourceLinksToBody(path, fm.source_notes);
    }

    if (this.deps.openFile) await this.deps.openFile(path);

    return {
      path,
      frontmatter: fm,
      title: basenameOf(path),
    };
  }

  /** Update status (validated through StatusMachine) and bump `updated`. */
  async setStatus(path: string, next: ProjectStatus): Promise<void> {
    await this.deps.frontmatter.update(path, (fm) => {
      const cur = fm.status as ProjectStatus | undefined;
      if (cur && !StatusMachine.canTransition(cur, next)) {
        this.deps.notice.warn(`허용되지 않은 상태 전이: ${cur} → ${next}`);
        return;
      }
      fm.status = next;
      fm.updated = todayIso();
    });
  }

  async setWordGoal(path: string, goal: number): Promise<void> {
    await this.deps.frontmatter.update(path, (fm) => {
      fm.word_goal = Math.max(0, goal | 0);
      fm.updated = todayIso();
    });
  }

  async setCurrentWords(path: string, count: number): Promise<void> {
    await this.deps.frontmatter.update(path, (fm) => {
      fm.current_words = Math.max(0, count | 0);
      fm.updated = todayIso();
    });
  }

  /** Add a wiki-link string to source_notes (deduped) and to the ## 자료 section. */
  async addSourceNote(path: string, link: string): Promise<void> {
    const wiki = this.normalizeWikiLink(link);
    if (!wiki) return;

    let added = false;
    await this.deps.frontmatter.update(path, (fm) => {
      const arr: string[] = Array.isArray(fm.source_notes) ? fm.source_notes : [];
      if (!arr.includes(wiki)) {
        arr.push(wiki);
        added = true;
      }
      fm.source_notes = arr;
      fm.updated = todayIso();
    });

    if (added) {
      await this.appendSourceLinksToBody(path, [wiki]);
    }
  }

  /** Wraps a path or bare title in [[…]]; returns "" if input is empty. */
  private normalizeWikiLink(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) return trimmed;
    return `[[${trimmed}]]`;
  }

  /** Append `- [[link]]` lines under `## 자료`. Section is created if missing. */
  private async appendSourceLinksToBody(
    path: string,
    links: string[],
  ): Promise<void> {
    const cleaned = links
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (cleaned.length === 0) return;

    const raw = await this.deps.vault.readFile(path);
    let next = raw;
    const hasSection = /\n## 자료\b/.test(`\n${raw}`);
    if (!hasSection) {
      // Append a new section at end of file.
      if (!next.endsWith("\n")) next += "\n";
      next += `\n## 자료\n\n`;
    }
    // Insert lines just after the `## 자료` heading (skipping any existing
    // immediate body lines until next H2 or EOF).
    const lines = next.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim() === "## 자료");
    if (idx === -1) {
      // Shouldn't happen, but be defensive.
      const fallback = next + "\n" + cleaned.map((l) => `- ${l}`).join("\n") + "\n";
      await this.deps.vault.writeFile(path, fallback);
      return;
    }

    // Find end of this section (next H2 or EOF).
    let end = idx + 1;
    while (end < lines.length && !/^## /.test(lines[end])) end += 1;

    // Avoid duplicate lines.
    const sectionSlice = lines.slice(idx + 1, end);
    const existing = new Set(sectionSlice.map((l) => l.trim()));
    const toInsert = cleaned
      .map((l) => `- ${l}`)
      .filter((l) => !existing.has(l));

    if (toInsert.length === 0) {
      await this.deps.vault.writeFile(path, next);
      return;
    }

    // Insert right before the next H2 (or at end of file).
    const insertPos = end;
    const before = lines.slice(0, insertPos);
    const after = lines.slice(insertPos);
    // Ensure a blank line before our additions if the previous line is content.
    const prev = before[before.length - 1];
    const padBefore = prev !== undefined && prev.trim() !== "" ? [""] : [];
    const padAfter = after.length > 0 && after[0].trim() !== "" ? [""] : [];
    const merged = [
      ...before,
      ...padBefore,
      ...toInsert,
      ...padAfter,
      ...after,
    ];
    await this.deps.vault.writeFile(path, merged.join("\n"));

    log.info(`source_notes appended to ${path}: ${cleaned.length} link(s)`);
  }
}

function basenameOf(p: string): string {
  const last = p.split("/").pop() ?? p;
  return last.replace(/\.md$/i, "");
}
