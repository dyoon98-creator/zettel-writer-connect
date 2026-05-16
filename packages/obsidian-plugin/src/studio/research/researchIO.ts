// researchIO.ts — 프로젝트 전용 research/ 폴더의 .md 파일 read/write/scan.
//
// 형식:
//   research/<id>.md
//
//   ---
//   type: research
//   id: <uuid>
//   title: "<title>"
//   prompt: "<prompt 첫 500자>"
//   source: news|paper|literature|general
//   created_at: <ISO>
//   links:
//     - "https://..."
//     - "https://..."
//   ---
//   <마크다운 본문>
//
// 별도 인덱스 파일은 두지 않고 폴더 스캔으로 ResearchItem 목록을 구한다.
// 본문은 lazy 로드 — readResearchBody 로 필요할 때 읽는다.

import type { VaultAdapter } from "@ai-manuscript-studio/core";
import type { ResearchSourceKind } from "./researchRunner";

export interface ResearchItem {
  /** 파일명 슬러그와 동일한 식별자. */
  id: string;
  title: string;
  /** 사용자가 입력한 prompt (500자 컷). */
  prompt: string;
  source: ResearchSourceKind;
  /** 본문에서 추출 또는 사용자가 첨부한 링크. */
  links: string[];
  /** ISO timestamp. */
  createdAt: string;
  /** 프로젝트 폴더 기준 상대 경로 — `research/<id>.md`. */
  filePath: string;
  /** 본문 — 폴더 스캔 직후엔 비어 있고 readResearchBody 로 채운다. */
  body: string;
}

const RESEARCH_DIR = "research";
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function escapeYaml(s: string): string {
  if (s === "") return '""';
  if (
    /^[\w\-./가-힣ᄀ-ᇿ㄰-㆏\s]+$/.test(s) &&
    !/^\s|\s$/.test(s) &&
    !s.includes(":")
  ) {
    return s;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function isResearchSource(s: string): s is ResearchSourceKind {
  return s === "news" || s === "paper" || s === "literature" || s === "general";
}

export function serializeResearch(item: ResearchItem): string {
  const lines: string[] = ["---"];
  lines.push("type: research");
  lines.push(`id: ${escapeYaml(item.id)}`);
  lines.push(`title: ${escapeYaml(item.title)}`);
  lines.push(`prompt: ${escapeYaml(item.prompt)}`);
  lines.push(`source: ${item.source}`);
  lines.push(`created_at: ${item.createdAt}`);
  if (item.links.length === 0) {
    lines.push("links: []");
  } else {
    lines.push("links:");
    for (const u of item.links) {
      lines.push(`  - ${escapeYaml(u)}`);
    }
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n") + item.body;
}

interface ParsedResearch {
  /** filePath 외 메타 필드만. body 는 별도. */
  frontmatter:
    | (Pick<ResearchItem, "id" | "title" | "prompt" | "source" | "createdAt" | "links">)
    | null;
  body: string;
}

export function parseResearch(raw: string): ParsedResearch {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: raw };
  const block = m[1];
  const body = m[2];

  const obj: Record<string, string> = {};
  const links: string[] = [];
  const lines = block.split(/\r?\n/);
  let inLinksList = false;
  for (const line of lines) {
    if (inLinksList) {
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item) {
        links.push(unquote(item[1]));
        continue;
      }
      // 들여쓰기 끝 → 일반 키-값 모드 복귀.
      inLinksList = false;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();
    if (key === "links") {
      if (valueRaw === "" || valueRaw === "[]") {
        inLinksList = valueRaw === "";
        continue;
      }
      // 인라인 배열 `["a","b"]` 정도만 단순 파싱.
      const inline = valueRaw.match(/^\[(.*)\]$/);
      if (inline) {
        for (const part of inline[1].split(",")) {
          const v = unquote(part.trim());
          if (v) links.push(v);
        }
      }
      continue;
    }
    obj[key] = unquote(valueRaw);
  }

  if (obj.type !== "research" || !obj.id) {
    return { frontmatter: null, body };
  }
  const source = isResearchSource(obj.source ?? "general")
    ? (obj.source as ResearchSourceKind)
    : "general";
  return {
    frontmatter: {
      id: obj.id,
      title: obj.title ?? "(제목 없음)",
      prompt: obj.prompt ?? "",
      source,
      createdAt: obj.created_at ?? "",
      links,
    },
    body,
  };
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+|\/+$/g, "")))
    .filter((p) => p.length > 0)
    .join("/");
}

/** research/<id>.md 한 건의 본문을 읽는다. */
export async function readResearchBody(
  vault: VaultAdapter,
  projectFolder: string,
  id: string,
): Promise<string> {
  const path = joinPath(projectFolder, RESEARCH_DIR, `${id}.md`);
  const raw = await vault.readFile(path);
  return parseResearch(raw).body;
}

/** ResearchItem 한 건을 디스크에 쓴다. id 가 같으면 덮어쓴다. */
export async function writeResearchItem(
  vault: VaultAdapter,
  projectFolder: string,
  item: ResearchItem,
): Promise<void> {
  await vault.ensureDir(joinPath(projectFolder, RESEARCH_DIR));
  const path = joinPath(projectFolder, RESEARCH_DIR, `${item.id}.md`);
  await vault.writeFile(path, serializeResearch(item));
}

export async function deleteResearchFile(
  vault: VaultAdapter,
  projectFolder: string,
  id: string,
): Promise<void> {
  const path = joinPath(projectFolder, RESEARCH_DIR, `${id}.md`);
  try {
    await vault.deleteFile(path);
  } catch {
    /* swallow — 이미 없으면 OK */
  }
}

/**
 * research/ 폴더를 스캔하여 모든 .md 파일을 ResearchItem 으로 파싱.
 * 본문 필드는 비워두고 (lazy), 메타만 채운다.
 * 폴더가 없거나 비어 있으면 빈 배열.
 */
export async function listResearch(
  vault: VaultAdapter,
  projectFolder: string,
): Promise<ResearchItem[]> {
  const dirRel = joinPath(projectFolder, RESEARCH_DIR);
  let entries: { name: string; isDirectory: boolean }[] = [];
  try {
    entries = await vault.listDir(dirRel);
  } catch {
    return [];
  }
  const items: ResearchItem[] = [];
  for (const e of entries) {
    if (e.isDirectory) continue;
    if (!e.name.endsWith(".md")) continue;
    const path = joinPath(dirRel, e.name);
    try {
      const raw = await vault.readFile(path);
      const parsed = parseResearch(raw);
      if (!parsed.frontmatter) continue;
      const fm = parsed.frontmatter;
      items.push({
        id: fm.id,
        title: fm.title,
        prompt: fm.prompt,
        source: fm.source,
        links: fm.links,
        createdAt: fm.createdAt,
        filePath: joinPath(RESEARCH_DIR, e.name),
        body: parsed.body,
      });
    } catch {
      /* 손상된 파일은 건너뜀 */
    }
  }
  // 최신순 정렬 (createdAt 내림차순).
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}
