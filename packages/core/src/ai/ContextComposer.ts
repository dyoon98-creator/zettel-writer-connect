// ContextComposer — assembles the prompt sent to the AI bridge.
//
// Inputs: the active project file path, the optional H2 section anchor (e.g.
// "초안"), the user's free-form input, and an action's prompt template.
// Outputs: a fully-rendered prompt string + telemetry.
//
// Phase A: this module no longer depends on Obsidian. The caller supplies:
//   - VaultAdapter (to read project + source notes)
//   - NoticeAdapter (for "missing placeholder" warnings)
//   - FrontmatterAdapter (to fetch project frontmatter — including source_notes)
//   - WikiResolver (to map wiki-target strings to vault paths)

import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { FrontmatterAdapter } from "../adapters/FrontmatterAdapter";
import { classifyPath, SourceBucket } from "../utils/paths";

export interface MinimalAction {
  id: string;
  promptTemplate: string;
  /** Names of placeholders this action expects to find in promptTemplate. */
  placeholders: string[];
  /** Where the result should be saved. Used downstream by ResultPipeline. */
  saveTo: string;
}

export interface ContextStats {
  sources: number;
  totalChars: number;
  truncated: boolean;
}

export interface ComposedContext {
  prompt: string;
  contextStats: ContextStats;
}

/** Resolve a wiki target string (no alias/anchor) to a vault-relative path. */
export type WikiResolver = (target: string) => string | null;

export interface ComposeInput {
  /** Vault-relative path to the project file. */
  projectPath: string;
  /** Display title (was projectFile.basename in v1). */
  projectTitle: string;
  sectionAnchor?: string;
  userInput?: string;
  action: MinimalAction;
  /** Folders that should be skipped when reading source notes. */
  excludedFolders?: string[];
}

const PER_BUCKET_CHAR_CAPS: Record<SourceBucket, number> = {
  raw: 1500,
  literature: 2000,
  wiki: 2000,
  permanent: 1000,
  other: 1500,
};

const TOTAL_SOURCES_CAP = 12_000;

// Phase 3 expanded the supported placeholder set. The canonical list lives in
// `skillpack/PromptTemplate.ts`; we keep a local copy for typing only.
const PLACEHOLDERS = [
  "manuscript",
  "section",
  "source_notes",
  "reader",
  "core_message",
  "user_input",
  "title",
  "genre",
  "word_goal",
  "current_words",
  "status",
] as const;
type PlaceholderName = (typeof PLACEHOLDERS)[number];

export interface ContextComposerDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  frontmatter: FrontmatterAdapter;
  /** Resolves "note-A" → "1 Literature/note-A.md" or null. */
  resolveWiki: WikiResolver;
  /** Optional: convert a vault path back to a display basename. */
  basenameOf?: (path: string) => string;
}

function defaultBasenameOf(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.md$/i, "");
}

export class ContextComposer {
  constructor(private deps: ContextComposerDeps) {}

  async compose(input: ComposeInput): Promise<ComposedContext> {
    const projectBody = await this.deps.vault.readFile(input.projectPath);
    const fmRaw = await this.deps.frontmatter.read(input.projectPath);
    const fm = fmRaw as Record<string, unknown>;

    const sectionText = input.sectionAnchor
      ? sliceH2Section(projectBody, input.sectionAnchor)
      : "";

    const sourceLinks: string[] = Array.isArray(fm.source_notes)
      ? (fm.source_notes as string[])
      : [];

    const sourcesResult = await this.readSourceNotes(
      sourceLinks,
      input.excludedFolders ?? [],
    );

    const placeholders: Record<PlaceholderName, string> = {
      manuscript: stripFrontmatter(projectBody),
      section: sectionText,
      source_notes: sourcesResult.text,
      reader: String(fm.target_reader ?? ""),
      core_message: String(fm.core_message ?? ""),
      user_input: input.userInput ?? "",
      title: input.projectTitle,
      genre: String(fm.genre ?? ""),
      word_goal: String(fm.word_goal ?? ""),
      current_words: String(fm.current_words ?? ""),
      status: String(fm.status ?? ""),
    };

    const { rendered, missing } = render(
      input.action.promptTemplate,
      placeholders,
    );
    if (missing.length > 0) {
      this.deps.notice.warn(
        `프롬프트 템플릿 누락 플레이스홀더: ${missing.join(", ")}`,
      );
    }

    return {
      prompt: rendered,
      contextStats: {
        sources: sourcesResult.count,
        totalChars: sourcesResult.totalChars,
        truncated: sourcesResult.truncated,
      },
    };
  }

  /** Read each link target, classify, truncate per-bucket, sum-cap. */
  private async readSourceNotes(
    links: string[],
    excludedFolders: string[],
  ): Promise<{ text: string; count: number; totalChars: number; truncated: boolean }> {
    const out: string[] = [];
    let totalChars = 0;
    let truncated = false;
    let count = 0;
    const basenameOf = this.deps.basenameOf ?? defaultBasenameOf;

    for (const raw of links) {
      const target = parseWikiLink(raw);
      if (!target) continue;

      const resolved = this.deps.resolveWiki(target);
      if (!resolved) continue;
      // Filter out files under excluded folder prefixes.
      if (matchesExcludedFolder(resolved, excludedFolders)) continue;

      const bucket = classifyPath(resolved);
      const cap = PER_BUCKET_CHAR_CAPS[bucket] ?? 1500;

      let body = "";
      try {
        body = await this.deps.vault.readFile(resolved);
      } catch {
        continue;
      }
      body = stripFrontmatter(body);
      let snippet = body;
      if (snippet.length > cap) {
        snippet = snippet.slice(0, cap) + "\n…(이후 생략)";
        truncated = true;
      }

      // Total budget check
      const remaining = TOTAL_SOURCES_CAP - totalChars;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (snippet.length > remaining) {
        snippet = snippet.slice(0, remaining) + "\n…(전체 한도 도달)";
        truncated = true;
      }

      const block = `### ${basenameOf(resolved)} (${bucket})\n${snippet}`;
      out.push(block);
      totalChars += snippet.length;
      count += 1;
    }

    return {
      text: out.join("\n\n"),
      count,
      totalChars,
      truncated,
    };
  }
}

/** Strip a YAML frontmatter block from a markdown body. */
export function stripFrontmatter(body: string): string {
  return body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Extract `[[link]]` or `link` → target name (no alias / anchor). */
export function parseWikiLink(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  const inner = trimmed.replace(/^\[\[|\]\]$/g, "");
  return inner.split("|")[0].split("#")[0].trim();
}

/** Slice the body of a single H2 section by header text (e.g. "초안"). */
export function sliceH2Section(body: string, anchor: string): string {
  const heading = `## ${anchor}`;
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "";
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end += 1;
  return lines.slice(start + 1, end).join("\n").trim();
}

export function matchesExcludedFolder(
  filePath: string,
  excluded: string[],
): boolean {
  for (const folder of excluded) {
    const f = folder.trim();
    if (!f) continue;
    if (filePath.startsWith(`${f}/`) || filePath === f) return true;
  }
  return false;
}

/** Replace `{{name}}` tokens in `template` using `values`. */
export function render(
  template: string,
  values: Record<string, string>,
): { rendered: string; missing: string[] } {
  const missing: string[] = [];
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (key in values) {
      return values[key];
    }
    if (!missing.includes(key)) missing.push(key);
    return `[누락: ${key}]`;
  });
  return { rendered, missing };
}
