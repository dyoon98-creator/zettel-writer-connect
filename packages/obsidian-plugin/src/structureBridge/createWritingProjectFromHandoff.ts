// createWritingProjectFromHandoff.ts — W1 bridge: structure note → writing project.

import {
  BinderIO,
  ProjectMetaIO,
  type Genre,
  type ProjectStatus,
} from "@ai-manuscript-studio/core/browser";
import type {
  VaultAdapter,
  NoticeAdapter,
} from "@ai-manuscript-studio/core/adapters";
import type { StructureNoteHandoff } from "./types";

export interface CreateFromHandoffDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  writingFolder: string;
  handoff: StructureNoteHandoff;
}

export interface CreateFromHandoffResult {
  folderPath: string;
  slug: string;
  title: string;
}

const VALID_GENRES = new Set<Genre>([
  "investment-strategy-memo",
  "investment-report",
  "legal-accounting-review",
  "column-essay",
  "lecture-presentation",
  "long-form-manuscript",
]);

const VALID_STATUSES = new Set<ProjectStatus>([
  "idea",
  "planning",
  "outline",
  "researching",
  "drafting",
  "feedback",
  "revising",
  "final",
  "published",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function isVaultRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\0") &&
    !path.includes("\\") &&
    !path.includes("..") &&
    !/^[a-z]:[\\/]/i.test(path) &&
    !/^[a-z][a-z0-9+.-]*:\/\//i.test(path)
  );
}

function assertVaultRelativePath(path: string, field: string): string {
  if (!isVaultRelativePath(path)) {
    throw new Error(`writing-handoff JSON ${field}는 vault-relative path여야 합니다`);
  }
  return path;
}

function assertStructureNotePath(path: string): string {
  assertVaultRelativePath(path, "structureNote.path");
  if (!path.startsWith("3.Structure/") || !path.endsWith(".md")) {
    throw new Error(
      "writing-handoff JSON structureNote.path는 3.Structure/ 아래의 vault-relative .md path여야 합니다",
    );
  }
  return path;
}

function normalizeGenre(v: unknown): Genre | undefined {
  const value = asString(v);
  if (!value) return undefined;
  if (value === "essay") return "column-essay";
  return VALID_GENRES.has(value as Genre) ? (value as Genre) : undefined;
}

function normalizeStatus(v: unknown): ProjectStatus | undefined {
  const value = asString(v);
  if (!value) return undefined;
  return VALID_STATUSES.has(value as ProjectStatus)
    ? (value as ProjectStatus)
    : undefined;
}

function uniqueSourceNotes(paths: string[]): string[] {
  const out: string[] = [];
  for (const path of paths) {
    if (!path || out.includes(path)) continue;
    out.push(path);
  }
  return out;
}

export function parseWritingHandoffJson(
  raw: string,
  handoffPath = "_index/writing-handoff.json",
): StructureNoteHandoff {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`writing-handoff JSON 파싱 실패: ${(err as Error).message}`);
  }
  if (!isRecord(parsed)) {
    throw new Error("writing-handoff JSON은 object여야 합니다");
  }

  const structureNote = parsed.structureNote;
  if (!isRecord(structureNote)) {
    throw new Error("writing-handoff JSON structureNote.path가 필요합니다");
  }
  const structureNotePath = asString(structureNote.path);
  if (!structureNotePath) {
    throw new Error("writing-handoff JSON structureNote.path가 필요합니다");
  }
  assertStructureNotePath(structureNotePath);

  const picked = Array.isArray(parsed.picked) ? parsed.picked : [];
  const pickedPaths = picked
    .map((item) => (isRecord(item) ? asString(item.path) : undefined))
    .filter((path): path is string => Boolean(path))
    .map((path) => assertVaultRelativePath(path, "picked[].path"));

  const project = isRecord(parsed.project) ? parsed.project : undefined;
  const targetWritingFolder = asString(parsed.targetWritingFolder);
  if (targetWritingFolder) {
    assertVaultRelativePath(targetWritingFolder, "targetWritingFolder");
  }

  const version =
    typeof parsed.version === "number" || typeof parsed.version === "string"
      ? String(parsed.version)
      : "1";
  const mode = asString(parsed.mode) ?? "new-structure-to-writing";
  const title =
    project && asString(project.title)
      ? asString(project.title)!
      : (asString(structureNote.title) ?? defaultTitleFromPath(structureNotePath));

  return {
    structureNotePath,
    title,
    id: asString(structureNote.id),
    claim: asString(structureNote.claim),
    sourceNotes: pickedPaths,
    bridgeMode: mode,
    bridgeVersion: version,
    handoffPath,
    targetWritingFolder,
    project: project
      ? {
          title: asString(project.title),
          genre: normalizeGenre(project.genre),
          wordGoal:
            typeof project.wordGoal === "number" && Number.isFinite(project.wordGoal)
              ? project.wordGoal
              : undefined,
          status: normalizeStatus(project.status),
        }
      : undefined,
  };
}

function defaultTitleFromPath(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.md$/i, "") || "Untitled";
}

function slugify(s: string): string {
  const trimmed = s.trim().toLowerCase();
  return trimmed
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function chooseAvailableSlug(
  vault: VaultAdapter,
  writingFolder: string,
  baseSlug: string,
): Promise<string> {
  const folder = writingFolder.replace(/\/+$/, "");
  const tryExists = (slug: string) =>
    vault.fileExists(`${folder}/${slug}/project.json`);
  if (!(await tryExists(baseSlug))) return baseSlug;
  for (let i = 2; i < 100; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await tryExists(candidate))) return candidate;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
}

const BRIDGE_PLANNING_TEMPLATE = (
  title: string,
  slug: string,
  structureNotePath: string,
  structureNoteTitle: string,
  claim: string | undefined,
) => `---
type: writing-planning
plugin: ai-manuscript-studio
project: ${slug}
phase: draft
bridge: active-structure-note
---

# 기획 — ${title}

> 구조노트 [[${structureNotePath}]] (${structureNoteTitle})에서 가져온 원고 프로젝트.

## 핵심 주장

${claim ? `> ${claim}` : "> (핵심 주장을 여기에 적어 두세요.)"}

## 기획

## 뼈대

## 자료

<!-- 관련 구조노트 및 영구노트를 [[위키링크]]로 여기에 추가하세요. -->

## 초안

`;

export async function createWritingProjectFromHandoff(
  deps: CreateFromHandoffDeps,
): Promise<CreateFromHandoffResult> {
  const { vault, notice, handoff } = deps;
  const root = (handoff.targetWritingFolder ?? deps.writingFolder).replace(/\/+$/, "");
  const projectTitle = handoff.project?.title ?? handoff.title;

  const baseSlug =
    slugify(projectTitle) || `untitled-${Date.now().toString(36)}`;
  const slug = await chooseAvailableSlug(vault, root, baseSlug);
  const folderPath = `${root}/${slug}`;
  const sourceNotes = uniqueSourceNotes([
    handoff.structureNotePath,
    ...(handoff.sourceNotes ?? []),
  ]);

  await ProjectMetaIO.create(vault, folderPath, {
    id: slug,
    title: projectTitle,
    genre: handoff.project?.genre ?? "investment-strategy-memo",
    status: handoff.project?.status,
    wordGoal: handoff.project?.wordGoal,
    coreMessage: handoff.claim ?? "",
    sourceNotes,
    customMetadata: {
      bridgeVersion: handoff.bridgeVersion ?? "1",
      bridgeMode: handoff.bridgeMode ?? "active-structure-note",
      structureNotePath: handoff.structureNotePath,
      ...(handoff.id ? { structureNoteId: handoff.id } : {}),
      ...(handoff.handoffPath ? { handoffPath: handoff.handoffPath } : {}),
    },
  });

  const binder = BinderIO.empty();
  await BinderIO.write(vault, folderPath, binder);

  const planningPath = `${folderPath}/planning.md`;
  if (!(await vault.fileExists(planningPath))) {
    await vault.writeFile(
      planningPath,
      BRIDGE_PLANNING_TEMPLATE(
        projectTitle,
        slug,
        handoff.structureNotePath,
        handoff.title,
        handoff.claim,
      ),
    );
  }

  notice.info(`'${folderPath}/' 폴더가 만들어졌습니다 (구조노트 브릿지).`);

  return { folderPath, slug, title: projectTitle };
}
