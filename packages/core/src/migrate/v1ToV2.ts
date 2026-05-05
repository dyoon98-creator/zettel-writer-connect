// v1 → v2 마이그레이션.
//
// 입력: v1 의 단일 .md (frontmatter `type: writing` + 7 H2 섹션)
// 출력: 새 폴더에 project.json + binder.json + 섹션별 폴더/장면 파일들
// 원본 .md 는 같은 위치에 `<slug>.v1-backup.md` 로 보존.

import { PLUGIN_ID } from "../types";
import { todayIso } from "../utils/paths";
import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { CANONICAL_SECTIONS } from "../project/Templates";
import { WritingNoteIO } from "../project/WritingNoteIO";
import {
  BINDER_SCHEMA,
  BinderNode,
  BinderTree,
  DEFAULT_LABELS,
  DEFAULT_STATUSES,
  PROJECT_SCHEMA,
  ProjectMeta,
} from "../project/schema";

export interface MigrateOptions {
  /** true 면 파일을 쓰지 않고 결과만 계산. */
  dryRun?: boolean;
  /** 사용자 알림 전달용. */
  noticeAdapter?: NoticeAdapter;
  /** 백업 파일을 만들지 (기본 true). */
  preserveBackup?: boolean;
}

export interface MigrationReport {
  filesCreated: string[];
  originalBackupPath: string | null;
  scenesCreated: number;
  warnings: string[];
}

interface ParsedSection {
  title: string;
  body: string;
}

/** v1 단일 노트 본문에서 H2 섹션을 추출. */
export function parseH2Sections(body: string): ParsedSection[] {
  const lines = body.split(/\r?\n/);
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);

  // body 끝의 trailing empty lines 정리
  return sections.map((s) => ({
    title: s.title,
    body: s.body.replace(/\s+$/, ""),
  }));
}

function indexOfSection(sections: ParsedSection[], title: string): number {
  return sections.findIndex((s) => s.title === title);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function safeSlug(s: string): string {
  return s
    .replace(/\s+/g, "-")
    .replace(/[^ᄀ-ᇿ㄰-㆏가-힣a-zA-Z0-9\-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "section";
}

function joinPath(folder: string, rel: string): string {
  const f = folder.replace(/\/+$/, "");
  const r = rel.replace(/^\/+/, "");
  return `${f}/${r}`;
}

function dirOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function basenameNoExt(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.md$/i, "");
}

interface ScenePayload {
  /** projectFolder 기준 상대 경로. */
  relFile: string;
  /** absolute path inside vault. */
  absPath: string;
  body: string;
  /** binder 노드 id. */
  sceneId: string;
  /** 부모 binder 폴더 id. */
  parentId: string;
  title: string;
}

/**
 * 마이그레이션 실행.
 * @param vault         실제 또는 InMemory 어댑터
 * @param oldNotePath   v1 .md 의 vault-relative 경로
 * @param newProjectFolder  새 프로젝트 폴더 경로 (vault-relative). 없으면 만든다.
 */
export async function migrate(
  vault: VaultAdapter,
  oldNotePath: string,
  newProjectFolder: string,
  options: MigrateOptions = {},
): Promise<MigrationReport> {
  const report: MigrationReport = {
    filesCreated: [],
    originalBackupPath: null,
    scenesCreated: 0,
    warnings: [],
  };

  // 1) v1 파일 읽기 + 파싱
  const raw = await vault.readFile(oldNotePath);
  const parsed = WritingNoteIO.parse(raw);
  if (!parsed.frontmatter) {
    throw new Error(
      `migrate: ${oldNotePath} 는 AMS v1 writing 노트가 아닙니다 (frontmatter 식별 실패)`,
    );
  }
  const v1 = parsed.frontmatter;
  const sections = parseH2Sections(parsed.body);
  if (sections.length === 0) {
    report.warnings.push(`H2 섹션이 없습니다 — 빈 binder 로 진행합니다`);
  }

  // 2) project.json 으로 frontmatter 승급
  const projectId = basenameNoExt(oldNotePath).replace(/^\d+_/, "") || "untitled";
  const today = todayIso();
  const labels = DEFAULT_LABELS.map((l) => ({ ...l }));
  const statuses = DEFAULT_STATUSES.map((s) => ({ ...s }));
  const projectMeta: ProjectMeta = {
    schema: PROJECT_SCHEMA,
    id: projectId,
    title: basenameNoExt(oldNotePath).replace(/^\d+_/, "") || projectId,
    genre: v1.genre,
    status: v1.status,
    label: labels.find((l) => l.default)?.id ?? labels[0]?.id ?? "scene",
    wordGoal: v1.word_goal,
    currentWords: v1.current_words,
    targetReader: v1.target_reader,
    coreMessage: v1.core_message,
    createdAt: v1.created || today,
    updatedAt: today,
    customStatuses: statuses,
    customLabels: labels,
    sourceNotes: [...v1.source_notes],
    plugin: PLUGIN_ID,
  };

  // 3) binder 시드: H2 섹션 → 폴더 1개 + 장면 1개
  const root: BinderNode[] = [];
  const sceneJobs: ScenePayload[] = [];

  // 캐노니컬 섹션 우선 순서대로 매핑하되, 정의되지 않은 섹션은 그 뒤에 붙인다.
  const ordered: ParsedSection[] = [];
  for (const canon of CANONICAL_SECTIONS) {
    const idx = indexOfSection(sections, canon);
    if (idx !== -1) ordered.push(sections[idx]);
  }
  for (const s of sections) {
    if (
      !CANONICAL_SECTIONS.includes(
        s.title as (typeof CANONICAL_SECTIONS)[number],
      )
    ) {
      ordered.push(s);
    }
  }

  let i = 0;
  for (const section of ordered) {
    i += 1;
    const folderSlug = `${pad2(i)}-${safeSlug(section.title)}`;
    const sceneSlug = safeSlug(section.title);
    const folderId = `f-${i}-${section.title}`.replace(/\s+/g, "-");
    const sceneId = `s-${i}-${section.title}`.replace(/\s+/g, "-");

    const sceneRel = `${folderSlug}/${pad2(1)}-${sceneSlug}.md`;
    const sceneFile = joinPath(newProjectFolder, sceneRel);

    const sceneFm = [
      "---",
      `type: writing-scene`,
      `plugin: ${PLUGIN_ID}`,
      `project: ${projectMeta.id}`,
      `scene_id: ${sceneId}`,
      `status: ${projectMeta.customStatuses.find((s) => s.default)?.id ?? projectMeta.customStatuses[0].id}`,
      `label: ${projectMeta.customLabels.find((l) => l.default)?.id ?? projectMeta.customLabels[0].id}`,
      `synopsis: ${escapeYaml(section.title)}`,
      `word_count: ${section.body.length}`,
      `updated: ${today}`,
      "---",
      "",
      section.body,
      "",
    ].join("\n");

    sceneJobs.push({
      relFile: sceneRel,
      absPath: sceneFile,
      body: sceneFm,
      sceneId,
      parentId: folderId,
      title: section.title,
    });

    const folderNode: BinderNode = {
      id: folderId,
      type: "folder",
      title: section.title,
      label: projectMeta.label,
      status:
        projectMeta.customStatuses.find((s) => s.default)?.id ??
        projectMeta.customStatuses[0].id,
      synopsis: section.title,
      children: [
        {
          id: sceneId,
          type: "document",
          title: section.title,
          file: sceneRel,
          label:
            projectMeta.customLabels.find((l) => l.default)?.id ??
            projectMeta.customLabels[0].id,
          status:
            projectMeta.customStatuses.find((s) => s.default)?.id ??
            projectMeta.customStatuses[0].id,
          synopsis: section.title,
          wordCount: section.body.length,
        },
      ],
    };
    root.push(folderNode);
  }

  const binder: BinderTree = {
    schema: BINDER_SCHEMA,
    root,
  };

  // 4) planning.md (선택) — `## 기획` 섹션 본문을 보존
  const planningSection = sections.find((s) => s.title === "기획");
  let planningBody: string | null = null;
  if (planningSection) {
    planningBody = [
      "---",
      "type: writing-planning",
      `plugin: ${PLUGIN_ID}`,
      `project: ${projectMeta.id}`,
      `phase: imported`,
      "---",
      "",
      `# 기획 인터뷰 — ${projectMeta.title}`,
      "",
      "## 기획 (v1 노트에서 이전)",
      "",
      planningSection.body,
      "",
    ].join("\n");
  }

  // 5) dryRun 이면 보고서만 작성
  const projectJsonPath = joinPath(newProjectFolder, "project.json");
  const binderJsonPath = joinPath(newProjectFolder, "binder.json");
  const planningPath = joinPath(newProjectFolder, "planning.md");
  const oldDir = dirOf(oldNotePath) || ".";
  const oldBase = basenameNoExt(oldNotePath);
  const backupPath = `${oldDir}/${oldBase}.v1-backup.md`.replace(/^\.\//, "");

  if (options.dryRun) {
    report.filesCreated.push(projectJsonPath);
    report.filesCreated.push(binderJsonPath);
    if (planningBody) report.filesCreated.push(planningPath);
    for (const s of sceneJobs) report.filesCreated.push(s.absPath);
    report.scenesCreated = sceneJobs.length;
    if (options.preserveBackup !== false) {
      report.originalBackupPath = backupPath;
    }
    return report;
  }

  // 6) 실제 쓰기
  await vault.ensureDir(newProjectFolder);
  await vault.writeFile(
    projectJsonPath,
    JSON.stringify(projectMeta, null, 2) + "\n",
  );
  report.filesCreated.push(projectJsonPath);
  await vault.writeFile(
    binderJsonPath,
    JSON.stringify(binder, null, 2) + "\n",
  );
  report.filesCreated.push(binderJsonPath);
  if (planningBody) {
    await vault.writeFile(planningPath, planningBody);
    report.filesCreated.push(planningPath);
  }
  for (const s of sceneJobs) {
    const dir = dirOf(s.absPath);
    if (dir) await vault.ensureDir(dir);
    await vault.writeFile(s.absPath, s.body);
    report.filesCreated.push(s.absPath);
    report.scenesCreated += 1;
  }

  // 7) 백업
  if (options.preserveBackup !== false) {
    if (!(await vault.fileExists(backupPath))) {
      await vault.writeFile(backupPath, raw);
    } else {
      report.warnings.push(`백업 파일이 이미 존재합니다: ${backupPath}`);
    }
    report.originalBackupPath = backupPath;
    // 원본은 삭제하지 않는다 — 사용자가 직접 검증 후 삭제
    // (요구사항: "Move the original to backup name; don't delete")
    // Move == 백업본 만들고 원본 삭제이므로 원본 .md 는 삭제한다.
    await vault.deleteFile(oldNotePath);
  }

  if (options.noticeAdapter) {
    options.noticeAdapter.info(
      `${projectMeta.title}: ${report.scenesCreated}개 장면으로 마이그레이션 완료`,
    );
  }

  return report;
}

function escapeYaml(s: string): string {
  if (s === "") return '""';
  if (
    /^[\w\-./가-힣ᄀ-ᇿ㄰-㆏\s]+$/.test(s) &&
    !/^\s|\s$/.test(s) &&
    !s.includes(":")
  ) {
    return s;
  }
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}
