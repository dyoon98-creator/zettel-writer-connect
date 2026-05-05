// researchMigration.ts — 구 모달 시절 binder 안에 만들어진 리서치 노드를
// 프로젝트 폴더 내 research/ 디렉토리로 일회성 이전.
//
// 식별: customMetadata.research_source 또는 customMetadata.research_prompt 가 있는
// document 노드를 리서치로 간주.
//
// 가드: project.json 의 customMetadata.researchMigrationDone === "v1" 이면 즉시 종료.
// 각 파일 단위로 durable — 도중 크래시 시 다음 실행이 남은 것만 처리.

import {
  BinderIO,
  parseScene,
  type BinderNode,
  type BinderTree,
  type ProjectMeta,
  type VaultAdapter,
} from "@ai-manuscript-studio/core";
import {
  writeResearchItem,
  type ResearchItem,
} from "./researchIO";
import type { ResearchSourceKind } from "./researchRunner";

const MIGRATION_FLAG = "researchMigrationDone";
const MIGRATION_VERSION = "v1";

function isResearchSource(s: string): s is ResearchSourceKind {
  return s === "news" || s === "paper" || s === "literature" || s === "general";
}

function collectLegacyNodes(binder: BinderTree): BinderNode[] {
  const out: BinderNode[] = [];
  const walk = (n: BinderNode): void => {
    if (n.type === "document") {
      const m = n.customMetadata;
      if (m && (m.research_source !== undefined || m.research_prompt !== undefined)) {
        out.push(n);
      }
    } else {
      for (const c of n.children) walk(c);
    }
  };
  for (const r of binder.root) walk(r);
  return out;
}

function parseLegacyLinks(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  } catch {
    /* fall through */
  }
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

export interface MigrationResult {
  /** 이번 실행에서 이동된 노드 수. */
  migrated: number;
  /** 이미 처리되어 skip 된 경우 true. */
  alreadyDone: boolean;
  /** 마이그레이션 후 binder. */
  binder: BinderTree;
  /** 마이그레이션 후 meta (researchMigrationDone 추가/유지). */
  meta: ProjectMeta;
}

export interface RunMigrationInput {
  vault: VaultAdapter;
  projectFolder: string;
  meta: ProjectMeta;
  binder: BinderTree;
}

/**
 * 구 리서치 노드를 research/ 폴더로 이전한다.
 * - 이미 v1 으로 처리됐으면 즉시 alreadyDone:true 로 반환.
 * - 처리 후 binder.json / project.json 을 디스크에 저장.
 * - 호출자는 반환된 binder/meta 로 store 를 갱신해야 한다.
 */
export async function runResearchMigrationIfNeeded(
  input: RunMigrationInput,
): Promise<MigrationResult> {
  const { vault, projectFolder, meta, binder } = input;
  const cm = meta.customMetadata ?? {};
  if (cm[MIGRATION_FLAG] === MIGRATION_VERSION) {
    return { migrated: 0, alreadyDone: true, binder, meta };
  }

  const legacy = collectLegacyNodes(binder);
  let nextBinder = binder;
  let migratedCount = 0;

  for (const node of legacy) {
    if (node.type !== "document") continue;
    try {
      const raw = await vault.readFile(`${projectFolder}/${node.file}`);
      const parsed = parseScene(raw);
      const md = node.customMetadata ?? {};
      const sourceRaw = md.research_source ?? "general";
      const source: ResearchSourceKind = isResearchSource(sourceRaw)
        ? sourceRaw
        : "general";
      const links = parseLegacyLinks(md.links);
      const item: ResearchItem = {
        id: node.id,
        title: node.title || "(제목 없음)",
        prompt: md.research_prompt ?? "",
        source,
        links,
        createdAt: parsed.frontmatter?.updated
          ? new Date(parsed.frontmatter.updated).toISOString()
          : new Date().toISOString(),
        filePath: `research/${node.id}.md`,
        body: parsed.body,
      };
      await writeResearchItem(vault, projectFolder, item);
      // 원본 .md 삭제 (이미 옮겨졌으면 스킵 OK).
      try {
        await vault.deleteFile(`${projectFolder}/${node.file}`);
      } catch {
        /* swallow */
      }
      // binder 에서 노드 제거.
      nextBinder = BinderIO.removeNode(nextBinder, node.id);
      migratedCount += 1;
    } catch {
      // 한 건 실패해도 나머지 진행. 다음 실행에서 재시도.
      continue;
    }
  }

  if (migratedCount > 0) {
    await vault.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(nextBinder, null, 2) + "\n",
    );
  }

  // 항상 플래그를 v1 으로 기록 — legacy 가 0건이어도 다음 부팅에서 다시 스캔하지 않도록.
  const nextMeta: ProjectMeta = {
    ...meta,
    customMetadata: {
      ...(meta.customMetadata ?? {}),
      [MIGRATION_FLAG]: MIGRATION_VERSION,
    },
  };
  await vault.writeFile(
    `${projectFolder}/project.json`,
    JSON.stringify(nextMeta, null, 2) + "\n",
  );

  return {
    migrated: migratedCount,
    alreadyDone: false,
    binder: nextBinder,
    meta: nextMeta,
  };
}
