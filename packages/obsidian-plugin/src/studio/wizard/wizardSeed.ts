// wizardSeed.ts — WizardSummary → 디스크 위에 새 프로젝트 + binder 시드.
//
// 호출자: WizardOverlay 가 사용자 동의 후 wizardStore.acceptSeed() 안에서.
//
// 책임:
//  1. 슬러그 결정 (slugify(title) + 날짜)
//  2. ProjectV2Manager.createProject(...) 호출
//  3. structureProposal[] 만큼 폴더 + 빈 장면 1개씩
//  4. planning.md 를 PlanningMdWriter 가 생성한 마크다운으로 덮어쓰기
//  5. { vaultPath, projectFolder, projectSlug } 반환

import {
  BinderIO,
  PlanningMdWriter,
  ProjectMetaIO,
  ProjectV2Manager,
  ensureSingleManuscriptRoot,
  findManuscriptRoot,
  slugify,
  todayDateStamp,
  type Genre,
  type ProjectV2ManagerDeps,
  type WizardSummary,
  DEFAULT_DRAFT_GENRE,
} from "@ai-manuscript-studio/core";

export interface WizardSeedDeps extends ProjectV2ManagerDeps {
  /** 원고 폴더 (예: "4.Writing"). vault root 기준 상대 경로. */
  writingRoot?: string;
  /** vault 의 절대 경로. 결과에 그대로 반환. */
  vaultPath: string;
}

export interface WizardSeedResult {
  vaultPath: string;
  projectFolder: string; // vault-root 기준 상대 경로 (예: "3 Writing/ai-시대의-작가-20260428")
  projectSlug: string; // 폴더명 (= ProjectMeta.id)
}

// 인덱서 설정(`settings.ts` OBSIDIAN_SETTINGS_DEFAULTS.writingFolder)과 같은 값이어야
// 한다. 갈리면 «만드는 곳»과 «목록에 뜨는 곳»이 달라져 만든 원고가 사라진 것처럼
// 보인다 (2026-08-31 실측 — 대표가 만든 프로젝트가 사이드바에 안 떴다).
const DEFAULT_WRITING_ROOT = "4.Writing";

function makeProjectSlug(title: string, dateStamp: string = todayDateStamp()): string {
  const base = slugify(title);
  // slugify 가 "untitled" 를 반환했어도 날짜 stamp 를 붙여 충돌 회피.
  return `${base}-${dateStamp}`;
}

export async function seedProjectFromSummary(
  summary: WizardSummary,
  deps: WizardSeedDeps,
): Promise<WizardSeedResult> {
  const writingRoot = (deps.writingRoot ?? DEFAULT_WRITING_ROOT).replace(/\/+$/, "");
  const slug = makeProjectSlug(summary.title);
  const projectFolder = `${writingRoot}/${slug}`;

  const manager = new ProjectV2Manager({
    vault: deps.vault,
    notice: deps.notice,
    frontmatter: deps.frontmatter,
  });

  // Sanity: 같은 slug 가 이미 있으면 -2, -3 ... 의 형태로 회피.
  let attempt = 0;
  let finalFolder = projectFolder;
  while (await deps.vault.fileExists(`${finalFolder}/project.json`)) {
    attempt += 1;
    finalFolder = `${projectFolder}-${attempt}`;
  }
  const finalSlug = finalFolder.slice(writingRoot.length + 1);

  // 1) 새 프로젝트 (project.json + 빈 binder.json + planning.md placeholder).
  const genre: Genre = summary.genre ?? DEFAULT_DRAFT_GENRE;
  await manager.createProject(writingRoot, {
    id: finalSlug,
    title: summary.title,
    genre,
    targetReader: summary.targetReader,
    coreMessage: summary.coreMessage,
    folderName: finalSlug,
    seedPlanning: false, // 우리가 직접 마법사 결과로 덮어쓴다.
  });

  // 2) 단일 manuscript-root 폴더로 binder 를 시드. 이후 모든 챕터는 이 루트의 자식.
  //    (createProject 가 빈 root[] 로 만들었으므로 ensure → "create-empty" 케이스.)
  const emptyTree = await BinderIO.read(deps.vault, finalFolder);
  const ensured = ensureSingleManuscriptRoot(emptyTree, {
    projectTitle: summary.title,
  });
  await BinderIO.write(deps.vault, finalFolder, ensured.tree);
  const manuscriptRoot = findManuscriptRoot(ensured.tree);
  const rootId = manuscriptRoot?.id ?? null;

  // 3) structureProposal[] 만큼 폴더 + 빈 장면 — manuscript-root 의 자식으로.
  for (const chap of summary.structureProposal) {
    try {
      const folder = await manager.addFolder(finalFolder, rootId, {
        title: chap.title,
        synopsis: chap.synopsis,
      });
      await manager.addScene(finalFolder, folder.id, {
        title: `${chap.title} 첫 장면`,
        synopsis: chap.synopsis,
      });
    } catch (err) {
      // 한 장 실패해도 나머지는 계속.
      // eslint-disable-next-line no-console
      console.warn(`[wizardSeed] addFolder/addScene 실패 (${chap.title})`, err);
    }
  }

  // 3) planning.md 를 마법사 결과로 덮어쓰기.
  const md = PlanningMdWriter.serialize(summary, { projectSlug: finalSlug });
  await deps.vault.writeFile(`${finalFolder}/planning.md`, md);

  return {
    vaultPath: deps.vaultPath,
    projectFolder: finalFolder,
    projectSlug: finalSlug,
  };
}

/**
 * 기존 프로젝트(이미 만들어져 있는 폴더)에 마법사 결과를 시드한다.
 *
 * 동작:
 *  - project.json 의 targetReader / coreMessage / genre 등을 마법사 결과로 갱신
 *  - 기존 binder 가 비어 있으면 structureProposal[] 만큼 폴더+장면 추가
 *    (이미 챕터가 있으면 건드리지 않는다 — 작가의 기존 작업 보존)
 *  - planning.md 를 마법사 결과로 덮어쓰기 (placeholder 였을 가능성 큼)
 */
/** structureProposal 이 비어있을 때 fallback 으로 사용할 4-chapter 기본 구조. */
const FALLBACK_STRUCTURE = [
  { id: "ch-1", title: "1부 — 도입", synopsis: "독자가 이 책에 들어오는 입구. 핵심 메시지의 단서가 한 번 깜빡인다." },
  { id: "ch-2", title: "2부 — 전개", synopsis: "메시지를 뒷받침하는 사례·통찰을 펼친다. 작가의 경험이 흐른다." },
  { id: "ch-3", title: "3부 — 절정", synopsis: "메시지가 가장 또렷해지는 결정적 장면 또는 주장." },
  { id: "ch-4", title: "4부 — 결말", synopsis: "독자가 책을 덮었을 때 남는 한 문장. 약속과 여운." },
];

export async function applySummaryToExistingProject(
  summary: WizardSummary,
  projectFolder: string,
  deps: ProjectV2ManagerDeps,
): Promise<{
  chaptersAdded: number;
  planningWritten: boolean;
  planningHasBinderEntry: boolean;
  changes: string[];
}> {
  const manager = new ProjectV2Manager(deps);
  const slug = projectFolder.split("/").pop() ?? projectFolder;
  const changes: string[] = [];

  // 1) project.json 갱신.
  try {
    const snap = await manager.open(projectFolder);
    const fields: Array<keyof typeof snap.meta> = [
      "title",
      "genre",
      "targetReader",
      "coreMessage",
    ];
    const next = {
      ...snap.meta,
      title: snap.meta.title || summary.title,
      genre: summary.genre ?? snap.meta.genre,
      targetReader: summary.targetReader || snap.meta.targetReader,
      coreMessage: summary.coreMessage || snap.meta.coreMessage,
    };
    for (const f of fields) {
      if (snap.meta[f] !== next[f]) {
        changes.push(`project.${String(f)}: ${String(next[f]).slice(0, 60)}`);
      }
    }
    await ProjectMetaIO.write(deps.vault, projectFolder, next);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[wizardSeed] project.json 갱신 실패 — planning.md 만 쓴다", err);
  }

  // 2) binder 를 단일 manuscript-root 컨벤션으로 보정한 뒤 그 자식으로 챕터 시드.
  //    fallback 보장 — structureProposal 이 비어 있어도 placeholder 4부 구조라도 만든다.
  let chaptersAdded = 0;
  let planningHasBinderEntry = false;
  try {
    // (a) 단일 루트 보정 — 멱등. projectStore 가 이미 마이그레이션했더라도 안전.
    const { meta: openedMeta, binder: openedBinder } = await manager.open(
      projectFolder,
    );
    const ensured = ensureSingleManuscriptRoot(openedBinder, {
      projectTitle: openedMeta.title || summary.title,
    });
    if (ensured.migrated) {
      await BinderIO.write(deps.vault, projectFolder, ensured.tree);
      changes.push(`binder 단일 루트 보정 (${ensured.reason})`);
    }
    const root = findManuscriptRoot(ensured.tree);
    const rootId = root?.id ?? null;
    const rootChildren = root?.children ?? ensured.tree.root;

    const planningEntryExists = rootChildren.some(
      (n) => n.type === "document" && (n as { file?: string }).file === "planning.md",
    );

    // "이미 챕터(folder)가 manuscript-root 안에 있으면 보존, 없으면 시드".
    const hasExistingChapters = rootChildren.some((n) => n.type === "folder");
    if (!hasExistingChapters) {
      const proposal =
        summary.structureProposal && summary.structureProposal.length > 0
          ? summary.structureProposal
          : FALLBACK_STRUCTURE;
      for (const chap of proposal) {
        try {
          const folder = await manager.addFolder(projectFolder, rootId, {
            title: chap.title,
            synopsis: chap.synopsis,
          });
          await manager.addScene(projectFolder, folder.id, {
            title: `${chap.title} 첫 장면`,
            synopsis: chap.synopsis,
          });
          chaptersAdded += 1;
          changes.push(`binder + ${chap.title}`);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(`[wizardSeed] addFolder/addScene 실패 (${chap.title})`, err);
        }
      }
    } else {
      changes.push(
        `기존 챕터 ${rootChildren.filter((n) => n.type === "folder").length}개 보존`,
      );
    }

    // planning.md 를 manuscript-root 안에 가시화. 이미 있으면 skip.
    if (!planningEntryExists) {
      try {
        await manager.addScene(projectFolder, rootId, {
          title: "기획 인터뷰",
          synopsis: "마법사가 작성한 기획 결과 (planning.md)",
          file: "planning.md",
          // 이미 있는 planning.md 를 binder 에 «노출»시키는 것이다. 번호를
          // 붙이면 빈 껍데기(planning-1.md)가 생기고 노드가 그것을 가리킨다.
          reuseExistingFile: true,
          body: "(아래에서 PlanningMdWriter 가 덮어씀)",
        });
        planningHasBinderEntry = true;
        changes.push("binder + 기획 인터뷰 (planning.md)");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[wizardSeed] planning binder 노드 추가 실패", err);
      }
    } else {
      planningHasBinderEntry = true;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[wizardSeed] binder.json 시드 실패", err);
  }

  // 3) planning.md 를 마법사 결과로 덮어쓰기.
  let planningWritten = false;
  try {
    const md = PlanningMdWriter.serialize(summary, { projectSlug: slug });
    await deps.vault.writeFile(`${projectFolder}/planning.md`, md);
    planningWritten = true;
    changes.push("planning.md 갱신");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[wizardSeed] planning.md 쓰기 실패", err);
  }

  return { chaptersAdded, planningWritten, planningHasBinderEntry, changes };
}

/** 외부 노출용 — 시드 후 projectStore.loadProject 호출에 쓸 수 있다. */
export const _internal = {
  makeProjectSlug,
};
