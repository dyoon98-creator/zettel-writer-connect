// conceptSeed.ts — ConceptDraftSession → 옵시디언 볼트에 새 프로젝트 시드.
//
// 호출자: Step5Commit 이 "프로젝트 생성" 버튼 클릭 시.
//
// 책임:
//  1. 슬러그 결정 (slugify(title) + 날짜)
//  2. ProjectV2Manager.createProject(...) 호출
//  3. binder 에 단일 manuscript-root + outline 챕터 폴더 + 첫 장면
//  4. planning.md 직렬화 후 vault 에 쓰기
//  5. { vaultPath, projectFolder, projectSlug } 반환

import {
  BinderIO,
  ProjectV2Manager,
  ensureSingleManuscriptRoot,
  findManuscriptRoot,
  slugify,
  todayDateStamp,
  type ConceptDraftSession,
  type Genre,
  type ProjectV2ManagerDeps,
} from "@ai-manuscript-studio/core";

export interface ConceptSeedDeps extends ProjectV2ManagerDeps {
  vaultPath: string;
  writingRoot?: string; // 기본 "3 Writing"
  /** 작가가 5단계 화면에서 입력한 제목. 비어있으면 synopsis 첫 문장. */
  title: string;
}

export interface ConceptSeedResult {
  vaultPath: string;
  projectFolder: string; // "3 Writing/<slug>"
  projectSlug: string;
}

const DEFAULT_WRITING_ROOT = "3 Writing";

function makeProjectSlug(title: string, dateStamp: string = todayDateStamp()): string {
  const base = slugify(title) || "untitled";
  return `${base}-${dateStamp}`;
}

function buildPlanningMd(
  title: string,
  session: ConceptDraftSession,
  finalSlug: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`, "");
  lines.push(`> ${session.synopsis}`, "");

  lines.push("## 컨셉", "");
  lines.push(session.conceptParagraph, "");

  lines.push("## 시놉시스", "");
  lines.push(session.synopsis, "");

  if (session.attachedNotes.length > 0) {
    lines.push("## 참고 노트", "");
    for (const note of session.attachedNotes) {
      lines.push(`- [[${note}]]`);
    }
    lines.push("");
  }

  if (session.outline.length > 0) {
    lines.push("## 목차", "");
    for (let i = 0; i < session.outline.length; i++) {
      const chap = session.outline[i];
      lines.push(`### ${i + 1}. ${chap.title}`, "");
      lines.push(chap.summary, "");
    }
  }

  lines.push("---", "");
  lines.push(`*Concept Wizard 로 생성 — ${new Date().toISOString()}*`);

  return lines.join("\n");
}

export async function seedFromConceptDraft(
  session: ConceptDraftSession,
  deps: ConceptSeedDeps,
): Promise<ConceptSeedResult> {
  const writingRoot = (deps.writingRoot ?? DEFAULT_WRITING_ROOT).replace(/\/+$/, "");
  const slug = makeProjectSlug(deps.title);
  const projectFolder = `${writingRoot}/${slug}`;

  const manager = new ProjectV2Manager({
    vault: deps.vault,
    notice: deps.notice,
    frontmatter: deps.frontmatter,
  });

  // 동일 slug 충돌 시 -1, -2 ... 회피.
  let attempt = 0;
  let finalFolder = projectFolder;
  while (await deps.vault.fileExists(`${finalFolder}/project.json`)) {
    attempt += 1;
    finalFolder = `${projectFolder}-${attempt}`;
  }
  const finalSlug = finalFolder.slice(writingRoot.length + 1);

  // 1) 새 프로젝트 생성 (project.json + 빈 binder.json + planning.md placeholder).
  const genre: Genre = session.genre ?? "essay";
  await manager.createProject(writingRoot, {
    id: finalSlug,
    title: deps.title,
    genre,
    targetReader: "",
    coreMessage: session.conceptParagraph.slice(0, 200),
    folderName: finalSlug,
    seedPlanning: false,
  });

  // 2) 단일 manuscript-root 로 binder 시드.
  const emptyTree = await BinderIO.read(deps.vault, finalFolder);
  const ensured = ensureSingleManuscriptRoot(emptyTree, {
    projectTitle: deps.title,
  });
  await BinderIO.write(deps.vault, finalFolder, ensured.tree);
  const manuscriptRoot = findManuscriptRoot(ensured.tree);
  const rootId = manuscriptRoot?.id ?? null;

  // 3) outline 챕터마다 폴더 + 빈 첫 장면.
  for (const chap of session.outline) {
    try {
      const folder = await manager.addFolder(finalFolder, rootId, {
        title: chap.title,
        synopsis: chap.summary,
      });
      await manager.addScene(finalFolder, folder.id, {
        title: `${chap.title} 첫 장면`,
        synopsis: chap.summary,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[conceptSeed] addFolder/addScene 실패 (${chap.title})`, err);
    }
  }

  // 4) planning.md 직렬화 후 쓰기.
  const md = buildPlanningMd(deps.title, session, finalSlug);
  await deps.vault.writeFile(`${finalFolder}/planning.md`, md);

  return {
    vaultPath: deps.vaultPath,
    projectFolder: finalFolder,
    projectSlug: finalSlug,
  };
}

/** 외부 노출용 — 테스트에서 슬러그 생성 로직 검증에 사용. */
export const _internal = {
  makeProjectSlug,
  buildPlanningMd,
};
