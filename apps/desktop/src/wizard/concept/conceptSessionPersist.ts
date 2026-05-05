// @TASK P3-T9 — 컨셉 마법사 세션 vault 파일 영속화 + 재진입 복구
//
// 저장 위치: <vault>/.ai-manuscript-studio/wizard-sessions/<id>.json
// 사람 가독용 사이드카: <id>.md (실패 silent)

import {
  CONCEPT_DRAFT_SCHEMA,
  type ConceptDraftSession,
  type ConceptDraftStage,
} from "@ai-manuscript-studio/core";
import { tauriVaultAdapter } from "../../vaultAdapter";
import { getVaultBasePath } from "../../vaultAdapter";

// ─── 상수 ────────────────────────────────────────────────────────────────────

export const SESSION_DIR = ".ai-manuscript-studio/wizard-sessions";

// ─── 타입 가드 ────────────────────────────────────────────────────────────────

const VALID_STAGES: ReadonlySet<ConceptDraftStage> = new Set<ConceptDraftStage>([
  "concept",
  "synopsis",
  "outline",
  "done",
]);

function isConceptDraftSession(v: unknown): v is ConceptDraftSession {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length === 0) return false;
  if (typeof o.seed !== "string") return false;
  if (!VALID_STAGES.has(o.stage as ConceptDraftStage)) return false;
  if (!Array.isArray(o.conversation)) return false;
  if (!Array.isArray(o.outline)) return false;
  return true;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function sessionJsonPath(id: string): string {
  return `${SESSION_DIR}/${id}.json`;
}

function sessionMdPath(id: string): string {
  return `${SESSION_DIR}/${id}.md`;
}

function sessionToMarkdown(s: ConceptDraftSession): string {
  const lines: string[] = [
    `# 컨셉 마법사 세션: ${s.id}`,
    "",
    `- **시드**: ${s.seed}`,
    `- **톤**: ${s.tone}`,
    `- **장르**: ${s.genre}`,
    `- **단계**: ${s.stage}`,
    `- **생성일**: ${s.createdAt}`,
    `- **수정일**: ${s.updatedAt}`,
    "",
  ];
  if (s.conceptParagraph) {
    lines.push("## 컨셉 단락", "", s.conceptParagraph, "");
  }
  if (s.synopsis) {
    lines.push("## 시놉시스", "", s.synopsis, "");
  }
  if (s.outline.length > 0) {
    lines.push("## 목차 초안", "");
    for (const ch of s.outline) {
      lines.push(`### ${ch.title}`, ch.summary, "");
    }
  }
  return lines.join("\n");
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * session 을 <SESSION_DIR>/<id>.json 에 저장.
 * vault 경로 미설정 시 silent no-op.
 */
export async function saveSession(session: ConceptDraftSession): Promise<void> {
  if (!getVaultBasePath()) return;
  try {
    await tauriVaultAdapter.ensureDir(SESSION_DIR);
    await tauriVaultAdapter.writeFile(
      sessionJsonPath(session.id),
      JSON.stringify(session, null, 2),
    );
  } catch (e) {
    console.warn("[conceptSessionPersist] saveSession JSON failed:", e);
    return;
  }

  // 사람 가독용 사이드카 — 실패 silent.
  try {
    await tauriVaultAdapter.writeFile(
      sessionMdPath(session.id),
      sessionToMarkdown(session),
    );
  } catch {
    // silent
  }
}

/**
 * SESSION_DIR 의 .json 파일 목록을 읽어 미완료(stage !== "done") 세션 반환.
 * 개별 파일 파싱 실패 시 console.warn 후 skip.
 */
export async function listSessions(): Promise<ConceptDraftSession[]> {
  if (!getVaultBasePath()) return [];
  let entries: { name: string; isDirectory: boolean }[];
  try {
    entries = await tauriVaultAdapter.listDir(SESSION_DIR);
  } catch {
    return [];
  }

  const results: ConceptDraftSession[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (!entry.name.endsWith(".json")) continue;
    const rel = `${SESSION_DIR}/${entry.name}`;
    try {
      const raw = await tauriVaultAdapter.readFile(rel);
      const parsed: unknown = JSON.parse(raw);
      if (!isConceptDraftSession(parsed)) {
        console.warn("[conceptSessionPersist] invalid session schema:", rel);
        continue;
      }
      if (parsed.stage === "done") continue;
      results.push(parsed);
    } catch (e) {
      console.warn("[conceptSessionPersist] failed to parse session:", rel, e);
    }
  }
  return results;
}

/**
 * session 을 _archive/<id>-<timestamp>.json 으로 이동 (write + delete).
 * vault 경로 미설정 시 silent no-op.
 */
export async function archiveSession(id: string): Promise<void> {
  if (!getVaultBasePath()) return;
  const archiveDir = `${SESSION_DIR}/_archive`;
  const srcRel = sessionJsonPath(id);
  try {
    const raw = await tauriVaultAdapter.readFile(srcRel);
    await tauriVaultAdapter.ensureDir(archiveDir);
    const dstRel = `${archiveDir}/${id}-${Date.now()}.json`;
    await tauriVaultAdapter.writeFile(dstRel, raw);
    await tauriVaultAdapter.deleteFile(srcRel);
  } catch (e) {
    console.warn("[conceptSessionPersist] archiveSession failed:", e);
  }
  // 사이드카 .md 도 정리 — 실패 silent.
  try {
    await tauriVaultAdapter.deleteFile(sessionMdPath(id));
  } catch {
    // silent
  }
}

/**
 * session .json 파일 삭제.
 * vault 경로 미설정 시 silent no-op.
 */
export async function deleteSession(id: string): Promise<void> {
  if (!getVaultBasePath()) return;
  try {
    await tauriVaultAdapter.deleteFile(sessionJsonPath(id));
  } catch (e) {
    console.warn("[conceptSessionPersist] deleteSession failed:", e);
  }
  try {
    await tauriVaultAdapter.deleteFile(sessionMdPath(id));
  } catch {
    // silent
  }
}

// ─── schema 재수출 (테스트에서 schema 버전 비교용) ────────────────────────────

export { CONCEPT_DRAFT_SCHEMA };
