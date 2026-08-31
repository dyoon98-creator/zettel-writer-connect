// wizardHandoff.ts — 「컨셉 마법사가 만든 것」을 「기획 인터뷰」로 넘기는 한 자리.
//
// 왜 이 파일이 생겼나 (대표 실사용 결함 2026-08-31):
//   컨셉 마법사 6단계로 컨셉·시놉시스·트리트먼트를 다 만들어 놓고 넘어갔는데,
//   기획 인터뷰가 백지에서 다시 물었다. 값을 «잃은» 것이 아니다 —
//   `conceptSeed.ts` 가 planning.md 에 잘 저장했는데 **읽는 쪽이 없었다.**
//   `buildStructuredHandoff` 가 AI 에게 싣던 것은 session_id / draft_title /
//   draft_genre / current_stage + 인터뷰 «자신의» 단계 결정뿐이었다.
//
// 왜 CLIWizardBridge 에서 떼어냈나:
//   `CLIWizardBridge.ts` 는 `./prompts/*.md?raw` 를 import 한다. 그 suffix 는
//   vite 전용이라 jest 가 모듈을 못 찾고, 그래서 그 파일 안의 «순수 함수» 는
//   단위 테스트로 못 박을 수가 없다(실측: `Cannot find module './prompts/motive.md?raw'`).
//   프롬프트에 실릴 문자열을 만드는 일은 IO 가 없는 순수 계산이므로 여기로 옮겨
//   테스트가 닿게 했다. 계산 자체는 한 글자도 바뀌지 않았다 —
//   컨셉이 없는 세션의 출력은 예전과 «완전히 동일»하다(회귀 방지 계약).
//
// 이 파일에는 IO 가 없다. 파일 읽기는 호출자(`wizardStore`)가 한다.

import { PlanningMdWriter } from "@ai-manuscript-studio/core";
import type {
  ConceptDraftSession,
  ConceptHandoff,
  ConceptHandoffCard,
  WizardSession,
  WizardStageId,
} from "@ai-manuscript-studio/core";

import { TREATMENT_ROLE_LABELS } from "./concept/treatmentPrompts";

// ─── 프롬프트 부풀림 상한 ─────────────────────────────────────────────────────
//
// 이어받은 값은 `{{structured_handoff}}` 한 자리에 전부 들어간다. 전문을 실으면
// 그 뒤의 출력 규칙·옵션 규칙을 밀어낸다. 그래서 «단계가 판단에 쓰는 만큼만» 싣고,
// 카드 본문 같은 긴 텍스트는 프롬프트가 아니라 binder 구조 제안 쪽에서만 쓴다.

const MAX_PARAGRAPH = 500;
const MAX_LINE = 200;
const MAX_LIST_ITEMS = 5;
const MAX_LIST_ITEM = 160;
const MAX_CARDS = 12;
const MAX_CARD_TITLE = 60;
const MAX_NOTES = 8;
const MAX_DECISION = 240;

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 세션 → 프롬프트 문자열
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pivotrix 의 formatHandoffForPrompt 패턴 — 누적 결정사항을 구조화해 prompt 에 넣는다.
 * 모델이 "이미 정해진 정보는 다시 묻지 마세요" 규칙을 지키기 쉽게 한다.
 *
 * **컨셉을 안 거친 세션의 출력은 예전과 한 글자도 다르지 않다.** 이어받은 것이
 * 있을 때만 `concept_*` 줄이 붙는다. 그 길(F9)은 멀쩡하므로 건드리지 않는다.
 */
export function buildStructuredHandoff(session: WizardSession): string {
  const lines: string[] = [];
  lines.push(`session_id: ${session.id}`);
  if (session.draftTitle) lines.push(`draft_title: ${session.draftTitle}`);
  if (session.draftGenre) lines.push(`draft_genre: ${session.draftGenre}`);
  lines.push(`current_stage: ${session.currentStage}`);

  // ── 컨셉 마법사에서 이어받은 것 ─────────────────────────────────────────────
  lines.push(...conceptHandoffLines(session.conceptHandoff));

  // 단계별 결정사항.
  const stages: WizardStageId[] = ["motive", "audience-message", "tone"];
  for (const s of stages) {
    const outcome = session.stages[s];
    if (!outcome || outcome.status === "pending") continue;
    lines.push(`stage[${s}].status: ${outcome.status}`);
    if (outcome.summary) lines.push(`stage[${s}].summary: ${outcome.summary}`);
    if (outcome.decisions) {
      for (const [k, v] of Object.entries(outcome.decisions)) {
        if (typeof v === "string" && v.trim()) {
          lines.push(`stage[${s}].decision.${k}: ${v.slice(0, MAX_DECISION)}`);
        }
      }
    }
  }

  // 현재 단계의 사용자 답변들 (가장 최근).
  const stage = session.currentStage;
  const userAnswersThisStage = session.messages
    .filter((m) => m.role === "user" && m.stage === stage)
    .map((m, i) => `  ${i + 1}. ${m.content.trim().slice(0, MAX_DECISION)}`);
  if (userAnswersThisStage.length > 0) {
    lines.push(`current_stage_user_answers:`);
    lines.push(...userAnswersThisStage);
  }

  return lines.join("\n");
}

function conceptHandoffLines(handoff?: ConceptHandoff): string[] {
  if (!handoff) return [];
  const out: string[] = [];
  const hasAnything =
    handoff.conceptParagraph ||
    handoff.synopsis ||
    handoff.memoEmotionAxis ||
    (handoff.memoDirections && handoff.memoDirections.length > 0) ||
    (handoff.memoStrongSentences && handoff.memoStrongSentences.length > 0) ||
    (handoff.treatment && handoff.treatment.length > 0) ||
    handoff.priorDecisions;
  if (!hasAnything) return [];

  // 이 한 줄이 프롬프트의 «확인 모드» 스위치다. 프롬프트 셋이 이 키를 보고
  // 「묻기」 대신 「확인받기」로 갈아탄다.
  out.push(`concept_carried: true`);
  out.push(`concept_source: ${handoff.source}`);

  if (handoff.conceptParagraph) {
    out.push(`concept_paragraph: ${clip(handoff.conceptParagraph, MAX_PARAGRAPH)}`);
  }
  if (handoff.synopsis) {
    out.push(`concept_synopsis: ${clip(handoff.synopsis, MAX_PARAGRAPH)}`);
  }
  if (handoff.memoEmotionAxis) {
    out.push(`concept_memo_emotion_axis: ${clip(handoff.memoEmotionAxis, MAX_LINE)}`);
  }
  pushList(out, "concept_memo_directions", handoff.memoDirections);
  pushList(out, "concept_memo_strong_sentences", handoff.memoStrongSentences);

  if (handoff.treatment && handoff.treatment.length > 0) {
    // 카드 «본문» 은 싣지 않는다 — 역할과 제목이면 AI 가 구조가 이미 있음을 안다.
    // 본문은 binder 구조 제안(structureProposal)에서만 쓰인다.
    out.push(`concept_treatment_cards: ${handoff.treatment.length}`);
    handoff.treatment.slice(0, MAX_CARDS).forEach((c, i) => {
      const role = c.role ? `[${c.role}] ` : "";
      out.push(`  ${i + 1}. ${role}${clip(c.title, MAX_CARD_TITLE)}`);
    });
  }

  if (handoff.attachedNotes && handoff.attachedNotes.length > 0) {
    out.push(
      `concept_attached_notes: ${handoff.attachedNotes.slice(0, MAX_NOTES).join(", ")}`,
    );
  }

  const prior = handoff.priorDecisions;
  if (prior) {
    if (prior.motive) out.push(`prior_interview.motive: ${clip(prior.motive, MAX_LINE)}`);
    if (prior.targetReader) {
      out.push(`prior_interview.target_reader: ${clip(prior.targetReader, MAX_LINE)}`);
    }
    if (prior.coreMessage) {
      out.push(`prior_interview.core_message: ${clip(prior.coreMessage, MAX_LINE)}`);
    }
    if (prior.tone) out.push(`prior_interview.tone: ${clip(prior.tone, MAX_LINE)}`);
  }

  return out;
}

function pushList(out: string[], key: string, items?: string[]): void {
  if (!items || items.length === 0) return;
  out.push(`${key}:`);
  items.slice(0, MAX_LIST_ITEMS).forEach((s, i) => {
    out.push(`  ${i + 1}. ${clip(s, MAX_LIST_ITEM)}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 컨셉 마법사 세션 → 이어받기 꾸러미 (새 프로젝트 경로)
// ─────────────────────────────────────────────────────────────────────────────

/** Step5Commit 이 손에 쥔 `ConceptDraftSession` 에서 인터뷰가 쓸 것만 추린다. */
export function conceptHandoffFromDraft(
  session: ConceptDraftSession,
): ConceptHandoff {
  const analysis = session.memo?.analysis;
  const treatment: ConceptHandoffCard[] = (session.treatment ?? []).map((c) => ({
    id: c.id,
    role: TREATMENT_ROLE_LABELS[c.role] ?? "",
    title: c.title,
    summary: c.summary,
  }));
  // v1 세션은 treatment 가 없고 outline 만 있다 — 그것도 구조다.
  const fromOutline: ConceptHandoffCard[] = session.outline.map((ch) => ({
    id: ch.id,
    role: "",
    title: ch.title,
    summary: ch.summary,
  }));
  const cards = treatment.length > 0 ? treatment : fromOutline;

  return {
    source: "concept-wizard",
    conceptParagraph: session.conceptParagraph?.trim() || undefined,
    synopsis: session.synopsis?.trim() || undefined,
    memoEmotionAxis: analysis?.emotionAxis?.trim() || undefined,
    memoDirections: analysis?.developmentDirections?.length
      ? [...analysis.developmentDirections]
      : undefined,
    memoStrongSentences: analysis?.strongSentences?.length
      ? [...analysis.strongSentences]
      : undefined,
    treatment: cards.length > 0 ? cards : undefined,
    attachedNotes: session.attachedNotes.length > 0 ? [...session.attachedNotes] : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 볼트에 저장된 마크다운 → 이어받기 꾸러미 (이미 있는 프로젝트 경로)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `concept-summary.md` / `planning.md` 본문에서 컨셉 결과를 되찾는다.
 *
 * 읽는 대상 둘:
 *  (a) 컨셉 마법사가 쓴 본문 — `## 컨셉` / `## 시놉시스` / `## 메모 분석 …` /
 *      `## 트리트먼트` (`conceptSeed.buildPlanningMd` 가 만든 모양).
 *  (b) 앞서 «끝난» 기획 인터뷰가 쓴 본문 — frontmatter + `## 최종 기획 요약`
 *      (`PlanningMdWriter.serialize` 가 만든 모양).
 *
 * 둘 다 아니면 `null`. 그때는 지금과 똑같이 백지에서 묻는다.
 */
export function parseConceptHandoffFromMarkdown(md: string): ConceptHandoff | null {
  if (!md || !md.trim()) return null;

  const body = stripFrontmatter(md);
  const sections = splitSections(body);

  const conceptParagraph = paragraphOf(sections["컨셉"]);
  const synopsis = paragraphOf(sections["시놉시스"]);

  const memoSection = findSection(sections, "메모 분석");
  const memo = memoSection ? parseMemoSection(memoSection) : null;

  const notesSection = sections["참고 노트"];
  const attachedNotes = notesSection ? bulletItems(notesSection) : [];

  const treatment =
    parseTreatmentSection(sections["트리트먼트"], true) ??
    parseTreatmentSection(sections["목차"], false) ??
    undefined;

  const priorDecisions = parsePriorDecisions(md);

  const found =
    conceptParagraph ||
    synopsis ||
    memo?.emotionAxis ||
    (memo?.directions?.length ?? 0) > 0 ||
    (treatment?.length ?? 0) > 0 ||
    priorDecisions;
  if (!found) return null;

  return {
    source: "planning-md",
    conceptParagraph,
    synopsis,
    memoEmotionAxis: memo?.emotionAxis,
    memoDirections: memo?.directions?.length ? memo.directions : undefined,
    memoStrongSentences: memo?.strongSentences?.length ? memo.strongSentences : undefined,
    treatment,
    attachedNotes: attachedNotes.length > 0 ? attachedNotes : undefined,
    priorDecisions: priorDecisions ?? undefined,
  };
}

function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const after = md.indexOf("\n", 3);
  if (after === -1) return md;
  const close = md.indexOf("\n---", after);
  if (close === -1) return md;
  return md.slice(close + 4);
}

/** `## 제목` 단위로 본문을 쪼갠다. 같은 제목이 둘이면 앞의 것을 쓴다. */
function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = body.split(/^##[ \t]+/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim();
    const content = nl === -1 ? "" : part.slice(nl + 1);
    if (!(heading in out)) out[heading] = content;
  }
  return out;
}

function findSection(sections: Record<string, string>, prefix: string): string | null {
  for (const [k, v] of Object.entries(sections)) {
    if (k.startsWith(prefix)) return v;
  }
  return null;
}

function paragraphOf(section?: string): string | undefined {
  if (!section) return undefined;
  const text = section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("<sub>"))
    .join(" ")
    .trim();
  return text || undefined;
}

function bulletItems(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => unquote(l.slice(2).trim()))
    .filter((l) => l.length > 0);
}

function unquote(s: string): string {
  return s.replace(/^["“”']+/, "").replace(/["“”']+$/, "").trim();
}

interface ParsedMemo {
  emotionAxis?: string;
  directions: string[];
  strongSentences: string[];
}

/**
 * 메모 분석 절 안의 `**굵은 라벨**` 블록을 나눠 읽는다.
 * `**원본 메모 (참고)**` 의 코드펜스가 뒤에 붙어 있어 블록 경계를 지켜야 한다.
 */
function parseMemoSection(section: string): ParsedMemo {
  const out: ParsedMemo = { directions: [], strongSentences: [] };
  const lines = section.split(/\r?\n/);
  let label: string | null = null;
  let buf: string[] = [];

  const flush = (): void => {
    if (!label) return;
    if (label.startsWith("글로 발전 가능한 방향")) out.directions = bulletItems(buf.join("\n"));
    else if (label.startsWith("힘 있는 문장")) out.strongSentences = bulletItems(buf.join("\n"));
    buf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    const inline = line.match(/^\*\*(.+?)\*\*\s*[::]\s*(.*)$/);
    if (inline) {
      flush();
      label = null;
      if (inline[1].startsWith("감정의 축")) out.emotionAxis = inline[2].trim();
      continue;
    }
    const heading = line.match(/^\*\*(.+?)\*\*$/);
    if (heading) {
      flush();
      label = heading[1];
      continue;
    }
    if (label) buf.push(raw);
  }
  flush();
  return out;
}

/**
 * `### N. [역할] 제목` (트리트먼트) 또는 `### N. 제목` (레거시 목차) 블록을 읽는다.
 * summary 는 굵은 라벨(`**핵심 문장** — …`) 이 나오기 전까지의 본문.
 */
function parseTreatmentSection(
  section: string | undefined,
  withRole: boolean,
): ConceptHandoffCard[] | null {
  if (!section) return null;
  const blocks = section.split(/^###[ \t]+/m).slice(1);
  const cards: ConceptHandoffCard[] = [];
  blocks.forEach((block, i) => {
    const nl = block.indexOf("\n");
    const heading = (nl === -1 ? block : block.slice(0, nl)).trim();
    const rest = nl === -1 ? "" : block.slice(nl + 1);

    const m = withRole
      ? heading.match(/^\d+\.\s*(?:\[([^\]]*)\]\s*)?(.*)$/)
      : heading.match(/^\d+\.\s*()(.*)$/);
    const role = (m?.[1] ?? "").trim();
    const title = (m?.[2] ?? heading).trim();

    const summaryLines: string[] = [];
    for (const raw of rest.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("**") || line.startsWith("<sub>")) break;
      if (line) summaryLines.push(line);
    }
    cards.push({
      id: `ch-${String(i + 1).padStart(2, "0")}`,
      role,
      title,
      summary: summaryLines.join(" ").trim(),
    });
  });
  return cards.length > 0 ? cards : null;
}

/** 앞서 «끝난» 기획 인터뷰의 결정. `PlanningMdWriter` 가 정본 파서다. */
function parsePriorDecisions(md: string): ConceptHandoff["priorDecisions"] | null {
  let prior: ReturnType<typeof PlanningMdWriter.parse> = null;
  try {
    prior = PlanningMdWriter.parse(md);
  } catch {
    return null;
  }
  if (!prior) return null;
  const out = {
    motive: prior.motive || undefined,
    targetReader: prior.targetReader || undefined,
    coreMessage: prior.coreMessage || undefined,
    tone: prior.tone || undefined,
  };
  return out.motive || out.targetReader || out.coreMessage || out.tone ? out : null;
}
