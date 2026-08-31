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
  type TreatmentCardRole,
} from "@ai-manuscript-studio/core";

/** 트리트먼트 카드 role 의 한국어 라벨. planning.md / binder 폴더명에 사용. */
const TREATMENT_ROLE_KO: Record<TreatmentCardRole, string> = {
  intro: "도입",
  problem: "문제 제기",
  case: "사례",
  explain: "설명",
  pivot: "전환",
  conclusion: "결론",
};

export interface ConceptSeedDeps extends ProjectV2ManagerDeps {
  vaultPath: string;
  writingRoot?: string; // 기본 "4.Writing"
  /** 작가가 5단계 화면에서 입력한 제목. 비어있으면 synopsis 첫 문장. */
  title: string;
}

export interface ConceptSeedResult {
  vaultPath: string;
  projectFolder: string; // "3 Writing/<slug>"
  projectSlug: string;
}

// 인덱서 설정(`settings.ts` OBSIDIAN_SETTINGS_DEFAULTS.writingFolder)과 같은 값이어야
// 한다. 갈리면 «만드는 곳»과 «목록에 뜨는 곳»이 달라진다 (2026-08-31 실측).
const DEFAULT_WRITING_ROOT = "4.Writing";

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

  // 제목은 project.json 의 title 로 이미 식별되므로 본문에서 또 H1 으로 노출하지 않는다.
  // (에디터에서 본문 첫 줄이 거대한 헤더로 렌더되는 노이즈 방지.)
  // 시놉시스도 인용블록으로 한 번 더 노출하지 않고 ## 시놉시스 섹션에서만 보여준다.

  lines.push("## 컨셉", "");
  lines.push(session.conceptParagraph.trim(), "");

  lines.push("## 시놉시스", "");
  lines.push(session.synopsis.trim(), "");

  // v2 — 의식의 흐름 메모 분석 (있을 때만)
  if (session.memo?.analysis) {
    const a = session.memo.analysis;
    lines.push("## 메모 분석 (의식의 흐름)", "");
    if (a.emotionAxis.trim()) {
      lines.push(`**감정의 축**: ${a.emotionAxis.trim()}`, "");
    }
    if (a.recurringThoughts.length > 0) {
      lines.push("**반복되는 생각**", "");
      for (const t of a.recurringThoughts) lines.push(`- ${t}`);
      lines.push("");
    }
    if (a.hiddenThemes.length > 0) {
      lines.push("**숨은 주제**", "");
      for (const t of a.hiddenThemes) lines.push(`- ${t}`);
      lines.push("");
    }
    if (a.strongSentences.length > 0) {
      lines.push("**힘 있는 문장**", "");
      for (const t of a.strongSentences) lines.push(`- "${t}"`);
      lines.push("");
    }
    if (a.developmentDirections.length > 0) {
      lines.push("**글로 발전 가능한 방향**", "");
      for (const t of a.developmentDirections) lines.push(`- ${t}`);
      lines.push("");
    }
    if (session.memo.raw.trim()) {
      lines.push("**원본 메모 (참고)**", "");
      lines.push("```", session.memo.raw.trim(), "```", "");
    }
  }

  if (session.attachedNotes.length > 0) {
    lines.push("## 참고 노트", "");
    for (const note of session.attachedNotes) {
      lines.push(`- [[${note}]]`);
    }
    lines.push("");
  }

  // v2 — 트리트먼트 카드 우선. 없으면 legacy outline.
  if (session.treatment && session.treatment.length > 0) {
    lines.push("## 트리트먼트", "");
    for (let i = 0; i < session.treatment.length; i++) {
      const card = session.treatment[i];
      lines.push(
        `### ${i + 1}. [${TREATMENT_ROLE_KO[card.role]}] ${card.title}`,
        "",
      );
      if (card.summary.trim()) lines.push(card.summary.trim(), "");
      if (card.keySentence?.trim()) {
        lines.push(`**핵심 문장** — ${card.keySentence.trim()}`, "");
      }
      if (card.readerEmotion?.trim()) {
        lines.push(`**독자 감정** — ${card.readerEmotion.trim()}`, "");
      }
      if (card.note?.trim()) {
        lines.push(`**작가 메모** — ${card.note.trim()}`, "");
      }
    }
  } else if (session.outline.length > 0) {
    lines.push("## 목차", "");
    for (let i = 0; i < session.outline.length; i++) {
      const chap = session.outline[i];
      lines.push(`### ${i + 1}. ${chap.title}`, "");
      lines.push(chap.summary, "");
    }
  }

  // 마지막 줄에 작은 출처 표시 — 옅게 자국만 남기는 정도.
  const stamp = new Date().toISOString().slice(0, 10);
  lines.push(`<sub>컨셉 마법사 — ${stamp}</sub>`);

  return lines.join("\n");
}

// (v2 변경) 트리트먼트 카드 → 다중 챕터/장면 시드는 제거됨. 컨셉은 원고 1편의 한
// "기획 단계 결과물" 이므로 manuscript-root 아래 컨셉 노드 1개만 둔다. 카드의 모든
// 내용은 `concept-summary.md` 본문에 직렬화되어 보존된다.

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
  const genre: Genre = session.genre ?? "investment-strategy-memo";
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

  // 3) 컨셉 마법사 산출물 직렬화 — manuscript-root 아래 \"컨셉\" 노드 1개만.
  //
  // 트리트먼트 카드/메모/시놉시스는 모두 `concept-summary.md` 본문 안에 직렬화되어 들어가고,
  // binder 에는 그 .md 를 가리키는 document 노드 하나만 추가한다. 사용자가 본문 집필 시
  // 트리/장면을 직접 만들도록 비워둔다. 기존 동작(카드별 폴더+장면 자동 시드)은 과했음.
  //
  // planning.md 도 같은 본문으로 작성 — 기획 인터뷰가 시작되기 전까지 헤더의 "기획 결과
  // 보기" 버튼에서 즉시 미리볼 수 있게. 인터뷰가 끝나면 planning.md 는 인터뷰 결과로
  // 덮어쓰이지만 concept-summary.md 는 영구 보관된다.
  const md = buildPlanningMd(deps.title, session, finalSlug);
  await deps.vault.writeFile(`${finalFolder}/concept-summary.md`, md);
  await deps.vault.writeFile(`${finalFolder}/planning.md`, md);

  try {
    await manager.addLinkedDocument(finalFolder, rootId, {
      title: "컨셉 (기획 단계 요약)",
      file: "concept-summary.md",
      synopsis: session.synopsis
        ? session.synopsis.slice(0, 160)
        : session.conceptParagraph.slice(0, 160),
      customMetadata: { ams_node_role: "concept-summary" },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[conceptSeed] concept-summary 노드 추가 실패 (무시):", err);
  }

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
