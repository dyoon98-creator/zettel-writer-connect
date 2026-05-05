// manuscriptRoot.ts — binder 의 단일 루트(원고) 컨벤션 헬퍼.
//
// 정책:
//   - 모든 프로젝트의 binder.root 는 정확히 1개의 폴더("원고 루트")로 시작한다.
//   - 이 루트 폴더는 customMetadata.role === "manuscript-root" 로 마킹된다.
//   - 챕터/장면 등 모든 콘텐츠 노드는 이 루트의 자식 또는 후손이다.
//
// 구버전(평면 binder.root) 호환:
//   - ensureSingleManuscriptRoot() 가 한 번 통과하면 멱등.
//   - 평면 → 단일 루트 변환 시 기존 root 노드 전체가 새 루트의 children 으로 이동.
//   - 호출자(projectStore)는 변환된 binder 를 disk 에 저장하기 전에 백업 파일을 따로
//     보존할 책임이 있다 (migrateBinderOnDisk 헬퍼 참조).
//
// 이 모듈은 IO 가 없는 순수 트리 변환 + IO 기반의 disk 마이그레이션 두 가지 함수를
// 모두 노출한다 (테스트/단위 사용 분리를 위함).

import type { VaultAdapter } from "../adapters/VaultAdapter";

import { BinderIO } from "./BinderIO";
import {
  BINDER_SCHEMA,
  type BinderFolder,
  type BinderNode,
  type BinderTree,
} from "./schema";

/** customMetadata.role 값. binder 트리에서 단일 루트 폴더를 식별. */
export const MANUSCRIPT_ROOT_ROLE = "manuscript-root";

/** 마이그레이션 백업 파일 이름. (프로젝트 폴더 안.) */
export const MANUSCRIPT_ROOT_BACKUP_FILE = "binder.before-root-migration.json";

/** 단일 루트 폴더 기본 라벨/스테이터스. */
const ROOT_LABEL_ID = "manuscript";
const ROOT_STATUS_ID = "first-draft";

/** 노드가 manuscript-root 마킹을 가지는지. */
export function isManuscriptRoot(node: BinderNode): boolean {
  return (
    node.type === "folder" &&
    node.customMetadata?.role === MANUSCRIPT_ROOT_ROLE
  );
}

/** binder 의 manuscript-root 폴더를 반환. 없으면 null. */
export function findManuscriptRoot(tree: BinderTree): BinderFolder | null {
  for (const n of tree.root) {
    if (isManuscriptRoot(n)) return n as BinderFolder;
  }
  return null;
}

interface EnsureRootOptions {
  /** 새 루트가 생성될 경우의 제목. 보통 ProjectMeta.title. */
  projectTitle: string;
  /** 새 루트의 id 생성기. 기본은 BinderIO.assignNewId. 테스트 결정성용. */
  makeId?: () => string;
}

export interface EnsureRootResult {
  tree: BinderTree;
  /** 변경이 일어났는지. */
  migrated: boolean;
  /** 변경의 형태 — 디버깅/로깅용. */
  reason: "noop" | "wrap-flat-root" | "tag-existing-folder" | "create-empty";
}

/**
 * binder.root 가 정확히 1개의 manuscript-root 폴더가 되도록 보정.
 *
 * 케이스:
 *   1) 이미 manuscript-root 폴더 1개 → no-op.
 *   2) root 가 비어 있음 → 빈 manuscript-root 생성.
 *   3) root 에 폴더가 정확히 1개 + 그 외 노드 없음 + 마킹 없음 → 그 폴더에 마킹만 추가.
 *      (사용자가 이미 직접 단일 루트 컨벤션을 따르고 있던 경우 보존.)
 *   4) 그 외 (평면 multi-root 또는 mixed) → 새 manuscript-root 로 감싸고 기존 root
 *      배열 전체를 children 으로 이동.
 *
 * 멱등: 결과 tree 를 다시 ensureSingleManuscriptRoot 에 통과시키면 noop.
 */
export function ensureSingleManuscriptRoot(
  tree: BinderTree,
  opts: EnsureRootOptions,
): EnsureRootResult {
  const makeId = opts.makeId ?? (() => BinderIO.assignNewId());
  const title = opts.projectTitle?.trim() || "원고";

  const roots = tree.root;

  // (1) 이미 단일 manuscript-root.
  if (roots.length === 1 && isManuscriptRoot(roots[0])) {
    return { tree, migrated: false, reason: "noop" };
  }

  // (2) 비어 있음.
  if (roots.length === 0) {
    const wrapper = makeManuscriptRootFolder({
      id: makeId(),
      title,
      children: [],
    });
    return {
      tree: { schema: tree.schema ?? BINDER_SCHEMA, root: [wrapper] },
      migrated: true,
      reason: "create-empty",
    };
  }

  // (3) 폴더 1개만 있고 마킹 없음 → 마킹 부여.
  if (roots.length === 1 && roots[0].type === "folder") {
    const folder = roots[0] as BinderFolder;
    const tagged: BinderFolder = {
      ...folder,
      customMetadata: {
        ...(folder.customMetadata ?? {}),
        role: MANUSCRIPT_ROOT_ROLE,
      },
    };
    return {
      tree: { schema: tree.schema ?? BINDER_SCHEMA, root: [tagged] },
      migrated: true,
      reason: "tag-existing-folder",
    };
  }

  // (4) 평면/혼합 → 감싸기.
  const wrapper = makeManuscriptRootFolder({
    id: makeId(),
    title,
    children: roots,
  });
  return {
    tree: { schema: tree.schema ?? BINDER_SCHEMA, root: [wrapper] },
    migrated: true,
    reason: "wrap-flat-root",
  };
}

/** 단일 루트 폴더를 만든다. 외부에서도 (예: 테스트) 사용할 수 있게 export. */
export function makeManuscriptRootFolder(input: {
  id: string;
  title: string;
  children: BinderNode[];
}): BinderFolder {
  return {
    id: input.id,
    type: "folder",
    title: input.title || "원고",
    label: ROOT_LABEL_ID,
    status: ROOT_STATUS_ID,
    synopsis: "",
    children: input.children,
    customMetadata: { role: MANUSCRIPT_ROOT_ROLE },
  };
}

export interface MigrateOnDiskResult {
  migrated: boolean;
  reason: EnsureRootResult["reason"];
  /** 백업 파일을 새로 만든 경우 그 경로. 이미 있던 경우 / 변환 안 한 경우 null. */
  backupPath: string | null;
  /** 디스크에 쓰인 결과 트리. */
  tree: BinderTree;
}

/**
 * 디스크 위의 binder.json 을 단일 루트로 마이그레이션.
 *
 * 흐름:
 *   1) BinderIO.read 로 현재 트리 로드.
 *   2) ensureSingleManuscriptRoot 호출.
 *   3) 변환이 일어났다면:
 *      a) 원본 binder.json 의 raw 를 binder.before-root-migration.json 으로 복사.
 *         이미 같은 이름의 백업 파일이 있으면 건드리지 않는다 (최초 백업 보존).
 *      b) 새 트리를 binder.json 에 쓴다.
 *
 * 변환이 없으면 디스크에 아무것도 쓰지 않는다.
 */
export async function migrateBinderOnDisk(
  vault: VaultAdapter,
  projectFolder: string,
  opts: EnsureRootOptions,
): Promise<MigrateOnDiskResult> {
  const folder = projectFolder.replace(/\/+$/, "");
  const binderPath = `${folder}/binder.json`;
  const backupPath = `${folder}/${MANUSCRIPT_ROOT_BACKUP_FILE}`;

  const tree = await BinderIO.read(vault, projectFolder);
  const result = ensureSingleManuscriptRoot(tree, opts);

  if (!result.migrated) {
    return {
      migrated: false,
      reason: result.reason,
      backupPath: null,
      tree,
    };
  }

  // 변환됨 — 백업 한 번만 작성.
  let writtenBackup: string | null = null;
  const backupExists = await vault.fileExists(backupPath);
  if (!backupExists) {
    try {
      const raw = await vault.readFile(binderPath);
      await vault.writeFile(backupPath, raw);
      writtenBackup = backupPath;
    } catch (err) {
      // 백업 실패해도 마이그레이션 자체는 진행 — 단, 백업 없음 표시.
      // eslint-disable-next-line no-console
      console.warn(
        `[manuscriptRoot] backup write failed (${backupPath}):`,
        err,
      );
    }
  }

  await BinderIO.write(vault, projectFolder, result.tree);

  return {
    migrated: true,
    reason: result.reason,
    backupPath: writtenBackup,
    tree: result.tree,
  };
}
