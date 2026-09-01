// PlanningMdWriter — WizardSummary ↔ planning.md 의 직렬화/파싱.
//
// 형식:
//   ---
//   type: writing-planning
//   plugin: ai-manuscript-studio
//   project: <project-slug>
//   sessionId: <wizard session id>
//   phase: completed
//   turns: <message count>
//   ---
//
//   # 기획 인터뷰 — YYYY-MM-DD
//
//   ## 1단계: 관율
//   **AI:** 첫 질문 ...
//   **작가:** 답변 ...
//   ...
//   ### 단계 요약
//   summary
//
//   ## 2단계: 독자
//   ...
//
//   ## 최종 기획 요약
//   - **계기:** ...
//   - **독자:** ...
//   - **핵심 메시지:** ...
//   - **톤:** ...
//   - **구조 제안:**
//     1. <장 제목> — <시놉시스>
//     2. ...
//
//   ## 전사
//   원래 채팅 시간순 기록 (재분석용).

import { PLUGIN_ID } from "../types";
import type { Genre } from "../types";
import { todayIso } from "../utils/paths";
import {
  STAGE_DESCRIPTION_KO,
  STAGE_LABEL_KO,
  WIZARD_STAGES,
  WizardMessage,
  WizardStageId,
  WizardSummary,
  DEFAULT_DRAFT_GENRE,
} from "./types";

const FRONTMATTER_DELIM = "---";
const SECTION_FINAL = "## 최종 기획 요약";
const SECTION_TRANSCRIPT = "## 전사";

function escapeYamlValue(v: string): string {
  // 한글 문자열에 특별한 yaml 이스케이프가 필요하지 않지만, 콜론/줄바꿈은 따옴표로 감싼다.
  if (v === "" || /[:#\n\r]/.test(v) || /^\s|\s$/.test(v)) {
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return v;
}

function buildFrontmatter(
  summary: WizardSummary,
  projectSlug: string,
  turns: number,
): string {
  const lines = [FRONTMATTER_DELIM];
  lines.push(`type: writing-planning`);
  lines.push(`plugin: ${PLUGIN_ID}`);
  lines.push(`project: ${escapeYamlValue(projectSlug)}`);
  lines.push(`sessionId: ${escapeYamlValue(summary.sessionId)}`);
  lines.push(`phase: completed`);
  lines.push(`turns: ${turns}`);
  if (summary.title) lines.push(`title: ${escapeYamlValue(summary.title)}`);
  if (summary.genre) lines.push(`genre: ${escapeYamlValue(summary.genre)}`);
  lines.push(`completedAt: ${escapeYamlValue(summary.completedAt)}`);
  lines.push(FRONTMATTER_DELIM);
  return lines.join("\n");
}

function messagesByStage(
  messages: WizardMessage[],
  stage: WizardStageId,
): WizardMessage[] {
  return messages.filter((m) => m.stage === stage && m.role !== "system");
}

function renderStageSection(
  stageIdx: number,
  stage: WizardStageId,
  messages: WizardMessage[],
  stageSummary: string,
): string {
  const lines: string[] = [];
  lines.push(
    `## ${stageIdx + 1}단계: ${STAGE_LABEL_KO[stage]} (${STAGE_DESCRIPTION_KO[stage]})`,
  );
  for (const m of messages) {
    if (m.role === "assistant") {
      lines.push(`**AI:** ${m.content.trim()}`);
    } else if (m.role === "user") {
      lines.push(`**작가:** ${m.content.trim()}`);
    }
    lines.push("");
  }
  if (stageSummary) {
    lines.push(`### 단계 요약`);
    lines.push(stageSummary);
    lines.push("");
  }
  return lines.join("\n");
}

function renderFinalSummary(summary: WizardSummary): string {
  const lines: string[] = [];
  lines.push(SECTION_FINAL);
  lines.push("");
  if (summary.motive) lines.push(`- **계기:** ${summary.motive}`);
  if (summary.targetReader) lines.push(`- **독자:** ${summary.targetReader}`);
  if (summary.coreMessage)
    lines.push(`- **핵심 메시지:** ${summary.coreMessage}`);
  if (summary.tone) lines.push(`- **톤:** ${summary.tone}`);
  lines.push(`- **구조 제안:**`);
  summary.structureProposal.forEach((c, i) => {
    lines.push(
      `    ${i + 1}. ${c.title}${c.synopsis ? ` — ${c.synopsis}` : ""}`,
    );
  });
  lines.push("");
  return lines.join("\n");
}

function renderTranscript(messages: WizardMessage[]): string {
  const lines: string[] = [];
  lines.push(SECTION_TRANSCRIPT);
  lines.push("");
  for (const m of messages) {
    if (m.role === "system") continue;
    const speaker =
      m.role === "assistant" ? "AI" : m.role === "user" ? "작가" : "시스템";
    lines.push(`- _${m.createdAt}_ **${speaker}** (${STAGE_LABEL_KO[m.stage]})`);
    // body 는 큰 따옴표 들여쓰기 인용
    for (const line of m.content.split(/\r?\n/)) {
      lines.push(`  > ${line}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export const PlanningMdWriter = {
  /** WizardSummary 를 planning.md 의 마크다운 텍스트로 직렬화. */
  serialize(
    summary: WizardSummary,
    opts: { projectSlug: string; stageSummaries?: Partial<Record<WizardStageId, string>> },
  ): string {
    const { projectSlug, stageSummaries = {} } = opts;
    const turns = summary.transcript.filter((m) => m.role !== "system").length;

    const out: string[] = [];
    out.push(buildFrontmatter(summary, projectSlug, turns));
    out.push("");
    out.push(`# 기획 인터뷰 — ${todayIso()}`);
    out.push("");
    out.push(`> **${summary.title}**`);
    if (summary.coreMessage) {
      out.push(`> 핵심 메시지: ${summary.coreMessage}`);
    }
    out.push("");

    WIZARD_STAGES.forEach((stage, idx) => {
      const stageMessages = messagesByStage(summary.transcript, stage);
      const stageSummary = stageSummaries[stage] ?? "";
      out.push(renderStageSection(idx, stage, stageMessages, stageSummary));
    });

    out.push(renderFinalSummary(summary));
    out.push(renderTranscript(summary.transcript));
    // 끝에 개행 한 개 보장.
    return out.join("\n").replace(/\n+$/, "\n");
  },

  /**
   * planning.md 의 마크다운에서 WizardSummary 를 복원. 실패 시 null.
   * 완전한 round-trip 은 보장하지 않는다 — 사용자가 편집했을 수 있으므로
   * 우리는 frontmatter + 최종 요약 섹션 + 전사 섹션만 신뢰한다.
   */
  parse(content: string): WizardSummary | null {
    const fm = parseFrontmatterBlock(content);
    if (!fm) return null;

    const sessionId = fm.values.sessionid ?? fm.values.sessionId ?? "";
    const title = fm.values.title ?? "";
    const genre = (fm.values.genre as Genre) ?? DEFAULT_DRAFT_GENRE;
    const completedAt = fm.values.completedat ?? fm.values.completedAt ?? "";

    const body = content.slice(fm.endIndex);

    const final = extractFinalSummary(body);
    const transcript = extractTranscript(body);

    if (!sessionId || !title) return null;

    return {
      sessionId,
      title,
      genre,
      motive: final.motive,
      targetReader: final.targetReader,
      coreMessage: final.coreMessage,
      tone: final.tone,
      structureProposal: final.structureProposal,
      transcript,
      completedAt: completedAt || todayIso(),
    };
  },
};

// ---------- internal parsing helpers ----------

interface ParsedFrontmatter {
  values: Record<string, string>;
  endIndex: number;
}

function parseFrontmatterBlock(text: string): ParsedFrontmatter | null {
  if (!text.startsWith(FRONTMATTER_DELIM)) return null;
  const after = text.indexOf("\n", FRONTMATTER_DELIM.length);
  if (after === -1) return null;
  const closeMarker = `\n${FRONTMATTER_DELIM}`;
  const close = text.indexOf(closeMarker, after);
  if (close === -1) return null;

  const yaml = text.slice(after + 1, close);
  const values: Record<string, string> = {};
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    let val = line.slice(colon + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val
        .slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
    values[key] = val;
  }
  // endIndex 는 닫는 --- 다음 줄.
  let end = close + closeMarker.length;
  if (text[end] === "\n") end += 1;
  return { values, endIndex: end };
}

function extractFinalSummary(body: string): {
  motive: string;
  targetReader: string;
  coreMessage: string;
  tone: string;
  structureProposal: WizardSummary["structureProposal"];
} {
  const out = {
    motive: "",
    targetReader: "",
    coreMessage: "",
    tone: "",
    structureProposal: [] as WizardSummary["structureProposal"],
  };
  const idx = body.indexOf(SECTION_FINAL);
  if (idx === -1) return out;
  const tail = body.slice(idx + SECTION_FINAL.length);
  const next = tail.indexOf("\n## ");
  const block = next === -1 ? tail : tail.slice(0, next);

  const lines = block.split(/\r?\n/);
  let inStructure = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("- **계기:**")) {
      out.motive = line.replace("- **계기:**", "").trim();
      inStructure = false;
    } else if (line.startsWith("- **독자:**")) {
      out.targetReader = line.replace("- **독자:**", "").trim();
      inStructure = false;
    } else if (line.startsWith("- **핵심 메시지:**")) {
      out.coreMessage = line.replace("- **핵심 메시지:**", "").trim();
      inStructure = false;
    } else if (line.startsWith("- **톤:**")) {
      out.tone = line.replace("- **톤:**", "").trim();
      inStructure = false;
    } else if (line.startsWith("- **구조 제안:**")) {
      inStructure = true;
    } else if (inStructure) {
      // "1. <title> — <synopsis>" 패턴
      const m = line.match(/^(\d+)\.\s*(.*)$/);
      if (m) {
        const rest = m[2];
        const sep = rest.match(/^([^—\-:]+)[—\-:]+\s*(.*)$/);
        const title = (sep ? sep[1] : rest).trim();
        const synopsis = (sep ? sep[2] : "").trim();
        out.structureProposal.push({
          id: `chap-${out.structureProposal.length + 1}`,
          title,
          synopsis,
        });
      }
    }
  }
  return out;
}

function extractTranscript(body: string): WizardMessage[] {
  const idx = body.indexOf(SECTION_TRANSCRIPT);
  if (idx === -1) return [];
  const tail = body.slice(idx + SECTION_TRANSCRIPT.length);
  const next = tail.indexOf("\n## ");
  const block = next === -1 ? tail : tail.slice(0, next);

  const out: WizardMessage[] = [];
  const lines = block.split(/\r?\n/);
  let cur: WizardMessage | null = null;
  let counter = 0;
  // pattern: "- _<iso>_ **AI** (관율)"
  const headerRe = /^-\s+_(.+?)_\s+\*\*(AI|작가|시스템)\*\*\s+\(([^)]+)\)$/;
  // 모든 단계를 WIZARD_STAGES에서 파생 — 단계 누락 시 잘못된 fallback 방지
  // (이전: structure-pick 누락으로 해당 전사 메시지가 motive로 오복원됨)
  const stageByLabel: Record<string, WizardStageId> = Object.fromEntries(
    WIZARD_STAGES.map((s) => [STAGE_LABEL_KO[s], s]),
  );
  for (const raw of lines) {
    const m = raw.match(headerRe);
    if (m) {
      if (cur) out.push(cur);
      counter += 1;
      const role: WizardMessage["role"] =
        m[2] === "AI" ? "assistant" : m[2] === "작가" ? "user" : "system";
      const stage = stageByLabel[m[3]] ?? "motive";
      cur = {
        id: `parsed-${counter}`,
        stage,
        role,
        content: "",
        createdAt: m[1],
      };
    } else if (cur && raw.startsWith("  > ")) {
      cur.content += (cur.content ? "\n" : "") + raw.slice(4);
    }
  }
  if (cur) out.push(cur);
  return out;
}
