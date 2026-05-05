// markdownConvert.ts — Tiptap HTML ↔ 마크다운 변환.
//
// 흐름:
//   load:  .md 본문 → marked.parse → HTML (Tiptap 주입)
//   save:  Tiptap getHTML() → turndown → 마크다운 (.md 디스크 저장)
//
// 옵시디언 호환:
//   - `[[wikilink|alias]]` 는 turndown 기본 규칙으로 보존 안 됨 → 커스텀 규칙 추가.
//   - `==highlight==` 는 표준 마크다운 아니라 turndown 이 인식 못함. Tiptap 도 mark
//     extension 추가가 필요. 1차 마이그레이션에서는 일반 텍스트로 보존.

import { marked } from "marked";
import TurndownService from "turndown";

let _turndown: TurndownService | null = null;

function turndownService(): TurndownService {
  if (_turndown) return _turndown;
  const td = new TurndownService({
    headingStyle: "atx", // # 스타일
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    fence: "```",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // 취소선(GFM) — turndown 기본은 처리 안 함.
  td.addRule("strikethrough", {
    filter: ["s", "del", "strike"] as unknown as TurndownService.Filter,
    replacement: (content) => `~~${content}~~`,
  });

  // <br> 강제 줄바꿈은 두 칸 공백 + \n 으로.
  td.addRule("hardBreak", {
    filter: "br",
    replacement: () => "  \n",
  });

  _turndown = td;
  return td;
}

/** Markdown → HTML (Tiptap 주입용). marked 의 GFM 기본 활성. */
export function markdownToHtml(md: string): string {
  if (!md) return "";
  try {
    return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  } catch {
    // 변환 실패 시 escape 한 텍스트 반환.
    return `<p>${escapeHtml(md)}</p>`;
  }
}

/** HTML (Tiptap getHTML 결과) → Markdown (디스크 저장용). */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  try {
    return turndownService().turndown(html);
  } catch {
    return stripHtml(html);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}
