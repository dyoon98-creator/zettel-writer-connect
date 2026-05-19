// createWritingProjectFromHandoff.ts — W1 bridge: structure note → writing project.

import {
  BinderIO,
  ProjectMetaIO,
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
  const { vault, notice, writingFolder, handoff } = deps;
  const root = writingFolder.replace(/\/+$/, "");

  const baseSlug =
    slugify(handoff.title) || `untitled-${Date.now().toString(36)}`;
  const slug = await chooseAvailableSlug(vault, root, baseSlug);
  const folderPath = `${root}/${slug}`;

  await ProjectMetaIO.create(vault, folderPath, {
    id: slug,
    title: handoff.title,
    genre: "investment-strategy-memo",
    coreMessage: handoff.claim ?? "",
    sourceNotes: [handoff.structureNotePath],
    customMetadata: {
      bridgeVersion: "1",
      bridgeMode: "active-structure-note",
      structureNotePath: handoff.structureNotePath,
      ...(handoff.id ? { structureNoteId: handoff.id } : {}),
    },
  });

  const binder = BinderIO.empty();
  await BinderIO.write(vault, folderPath, binder);

  const planningPath = `${folderPath}/planning.md`;
  if (!(await vault.fileExists(planningPath))) {
    await vault.writeFile(
      planningPath,
      BRIDGE_PLANNING_TEMPLATE(
        handoff.title,
        slug,
        handoff.structureNotePath,
        handoff.title,
        handoff.claim,
      ),
    );
  }

  notice.info(`'${folderPath}/' 폴더가 만들어졌습니다 (구조노트 브릿지).`);

  return { folderPath, slug, title: handoff.title };
}
