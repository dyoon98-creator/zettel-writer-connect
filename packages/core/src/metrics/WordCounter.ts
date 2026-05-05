// Korean-aware word and char counter.
// Strips frontmatter and code fences. For [[wiki|alias]] keeps "alias",
// for [[wiki]] keeps "wiki".
//
// Phase A: the bucketSourceNotes helper used to accept Obsidian's `App` to
// resolve linkpath → TFile via `metadataCache.getFirstLinkpathDest`. In core
// we replace that with a small `WikiResolver` callback the host supplies.

import { classifyPath, SourceBucket } from "../utils/paths";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]*`/g;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Visible-text normalization shared by both counters. */
function normalize(body: string): string {
  let s = body;
  s = s.replace(FRONTMATTER_RE, "");
  s = s.replace(FENCE_RE, "");
  s = s.replace(INLINE_CODE_RE, "");
  s = s.replace(HTML_COMMENT_RE, "");
  s = s.replace(WIKILINK_RE, (_m, inner: string) => {
    // [[file|alias]] → alias; [[file]] → file
    const pipe = inner.indexOf("|");
    if (pipe !== -1) return inner.slice(pipe + 1);
    // Strip heading anchor: [[file#section]] → file
    const hash = inner.indexOf("#");
    if (hash !== -1) return inner.slice(0, hash);
    return inner;
  });
  return s;
}

/**
 * 한국어 "글자수" 카운터 — 공백 포함, 줄바꿈만 제외.
 *
 * 한국의 온라인 글쓰기 도구(네이버, 브런치 등)와 원고지 글자수 관행이
 * 공백을 포함하므로 이 표준을 따른다. 줄바꿈(\\n, \\r)은 구조 문자라 제외.
 * Frontmatter / 코드블록 / 인라인 코드 / HTML 주석 / wiki 링크 문법은
 * normalize() 단계에서 이미 visible text 로 환원된다.
 */
export function countChars(body: string): number {
  const s = normalize(body);
  let n = 0;
  for (const ch of s) {
    if (ch === "\n" || ch === "\r") continue;
    n += 1;
  }
  return n;
}

/** Count "words" — split on whitespace and punctuation. Korean "words" use spaces. */
export function countWords(body: string): number {
  const s = normalize(body);
  // Split on whitespace + most punctuation. Keep latin/digit/Hangul tokens.
  const tokens = s
    .split(/[\s\.,!?;:()\[\]{}<>"'`~@#$%^&*=+\-/\\|·…—–]+/u)
    .filter((t) => t.length > 0);
  return tokens.length;
}

export type SourceBuckets = Record<SourceBucket, number>;

/**
 * Resolve a wiki target name to its vault path, or null if it doesn't
 * resolve. Provided by the host (Obsidian's `metadataCache.getFirstLinkpathDest`
 * in the plugin; a vault-index lookup in Tauri).
 */
export type WikiResolver = (target: string) => string | null;

/** Resolve a wiki-link string ("[[path]]" or bare "path") to its bucket. */
function bucketForLink(resolver: WikiResolver, link: string): SourceBucket {
  const trimmed = link.trim().replace(/^\[\[|\]\]$/g, "");
  // Drop alias and heading anchor.
  const noAlias = trimmed.split("|")[0];
  const noAnchor = noAlias.split("#")[0];
  const target = noAnchor.trim();
  if (!target) return "other";

  const resolved = resolver(target);
  if (resolved) return classifyPath(resolved);
  // Last resort: classify on the raw string if it includes a folder prefix.
  return classifyPath(target);
}

export function bucketSourceNotes(
  resolver: WikiResolver,
  sourceNotes: string[],
): SourceBuckets {
  const acc: SourceBuckets = {
    raw: 0,
    literature: 0,
    wiki: 0,
    permanent: 0,
    other: 0,
  };
  for (const link of sourceNotes) {
    const bucket = bucketForLink(resolver, link);
    acc[bucket] += 1;
  }
  return acc;
}

export const WordCounter = {
  countChars,
  countWords,
  bucketSourceNotes,
};
