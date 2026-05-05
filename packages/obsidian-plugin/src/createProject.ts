// createProject.ts — 인덱서에서 호출되는 빈 프로젝트 시드.
//
// 깊은 마법사 인터뷰는 데스크톱 앱(Phase E)에서 진행한다.
// 옵시디언 측은 작가가 빠르게 시작할 수 있도록 다음만 만든다:
//   - <writingFolder>/<slug>/project.json   (메타)
//   - <writingFolder>/<slug>/binder.json    (빈 트리)
//   - <writingFolder>/<slug>/planning.md    (placeholder + 작가가 직접 채우는 안내)

import {
  BinderIO,
  ProjectMetaIO,
  type Genre,
} from "@ai-manuscript-studio/core/browser";
import type {
  VaultAdapter,
  NoticeAdapter,
} from "@ai-manuscript-studio/core/adapters";
import type { NewProjectInput } from "./NewProjectModal";

export interface CreateProjectDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  writingFolder: string;
  input: NewProjectInput;
}

export interface CreateProjectResult {
  /** 만든 프로젝트 폴더 (vault-relative). */
  folderPath: string;
  /** project.json 의 id (= 폴더 이름의 slug). */
  slug: string;
  /** project.json 의 title. */
  title: string;
}

function slugify(s: string): string {
  // Unicode-friendly slug: 공백/구분자를 '-' 로, 기타 punctuation 제거.
  // 한글/영문/숫자/하이픈 그대로 둔다.
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
  const tryExists = async (slug: string): Promise<boolean> =>
    vault.fileExists(`${folder}/${slug}/project.json`);
  if (!(await tryExists(baseSlug))) return baseSlug;
  for (let i = 2; i < 100; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!(await tryExists(candidate))) return candidate;
  }
  // give up — caller will get a write conflict
  return `${baseSlug}-${Date.now().toString(36)}`;
}

const PLANNING_TEMPLATE = (title: string) => `---
type: writing-planning
plugin: ai-manuscript-studio
project: __SLUG__
phase: draft
---

# 기획 — ${title}

> 깊은 마법사 인터뷰는 데스크톱 앱(AI 원고실)에서 진행할 수 있습니다.
> 여기서는 빠르게 떠오른 메모를 자유롭게 적어 두세요.

## 1단계: 관율 (이 글을 쓰게 된 계기)

## 2단계: 독자

## 3단계: 핵심 메시지

## 4단계: 구조

## 5단계: 톤
`;

export async function createProjectFromInput(
  deps: CreateProjectDeps,
): Promise<CreateProjectResult> {
  const { vault, notice, writingFolder, input } = deps;
  const root = writingFolder.replace(/\/+$/, "");

  const baseSlug = slugify(input.title) || `untitled-${Date.now().toString(36)}`;
  const slug = await chooseAvailableSlug(vault, root, baseSlug);
  const folderPath = `${root}/${slug}`;

  // 1) 폴더 + project.json
  await ProjectMetaIO.create(vault, folderPath, {
    id: slug,
    title: input.title,
    genre: input.genre as Genre,
    wordGoal: input.wordGoal,
  });

  // 2) 빈 binder
  const binder = BinderIO.empty();
  await BinderIO.write(vault, folderPath, binder);

  // 3) planning.md placeholder (작가가 옵시디언에서 직접 적어둘 수도 있고
  //    데스크톱 앱 마법사가 종주되면 덮어씀)
  const planningPath = `${folderPath}/planning.md`;
  if (!(await vault.fileExists(planningPath))) {
    await vault.writeFile(
      planningPath,
      PLANNING_TEMPLATE(input.title).replace("__SLUG__", slug),
    );
  }

  notice.info(`'${root}/${slug}/' 폴더가 만들어졌습니다.`);

  return {
    folderPath,
    slug,
    title: input.title,
  };
}
