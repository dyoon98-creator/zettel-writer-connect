// projectStore.ts — 현재 열린 프로젝트의 상태 (Zustand).
//
// Phase D 확장:
// - selectedNodeIds / expandedFolderIds (binder 네비게이션)
// - sceneCache (열려 있는 장면 본문 캐시)
// - mutateBinder (BinderIO 위에 얹은 헬퍼; 디스크 동기화 포함)
// - addScene / addFolder / renameNode / deleteNode / moveNode
// - setNodeStatus / setNodeLabel
// - viewMode ("editor" | "corkboard")

import { create } from "zustand";
import {
  BinderIO,
  isProjectMeta,
  isBinderTree,
  migrateBinderOnDisk,
  findManuscriptRoot,
  parseScene,
  serializeScene,
  todayIso,
  WordCounter,
  type BinderDocument,
  type BinderNode,
  type BinderTree,
  type ProjectMeta,
  type SceneFrontmatter,
} from "@ai-manuscript-studio/core";
import {
  tauriVaultAdapter,
  setVaultBasePath,
  writeAttachmentBinary,
  copyExternalFile,
} from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { findBinderNode } from "./binderQueries";
import { runResearchMigrationIfNeeded } from "../research/researchMigration";
import { useResearchStore } from "./researchStore";

export type ViewMode = "editor" | "corkboard";

export interface SceneCacheEntry {
  /** 마지막으로 디스크에서 읽은 frontmatter. null = frontmatter 없음. */
  frontmatter: SceneFrontmatter | null;
  /** 마지막으로 디스크에 저장된 body. */
  body: string;
  /** 사용자가 편집 중인 dirty body — null이면 저장된 body와 동일. */
  draft: string | null;
  /** 마지막 저장 시각. */
  lastSavedAt: number | null;
}

export interface ProjectStoreState {
  vaultPath: string | null;
  projectFolder: string | null;
  projectSlug: string | null;
  meta: ProjectMeta | null;
  binder: BinderTree | null;

  selectedNodeIds: string[];
  expandedFolderIds: Set<string>;
  viewMode: ViewMode;

  isLoading: boolean;
  error: string | null;

  /** 열린 장면의 본문 캐시. key = binder node id. */
  sceneCache: Record<string, SceneCacheEntry>;

  // ---- lifecycle ----
  loadProject: (vaultPath: string, projectSlug: string) => Promise<void>;
  clear: () => void;

  // ---- binder navigation ----
  selectNodes: (ids: string[]) => void;
  toggleSelection: (id: string, mode: "single" | "additive" | "range") => void;
  toggleFolder: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  setViewMode: (mode: ViewMode) => void;

  // ---- binder mutations ----
  addScene: (parentId: string | null, title?: string) => Promise<string | null>;
  addFolder: (parentId: string | null, title?: string) => Promise<string | null>;
  /** 외부 파일을 vault 안 .attachments/ 로 복사하고 새 binder document 노드(첨부 모드)를 만든다. */
  addAttachment: (
    parentId: string | null,
    file: File,
    insertIndex?: number,
  ) => Promise<string | null>;
  /** OS 절대 경로에서 파일을 읽어 vault 안 .attachments/ 로 복사하고 새 binder document 노드를 만든다.
   *  Tauri webview 의 native drag-drop 이 paths 를 주므로 File 객체를 거치지 않는다. */
  addAttachmentByPath: (
    parentId: string | null,
    absolutePath: string,
    insertIndex?: number,
  ) => Promise<string | null>;
  /** 기존 binder 노드를 외부 파일 shortcut 으로 *변환*. 노드의 children/위치는 그대로,
   *  본문만 절대 경로의 파일과 양방향 동기화된다 (Scrivener "folder-with-text" 모델). */
  convertNodeToShortcut: (
    nodeId: string,
    absolutePath: string,
  ) => Promise<void>;
  renameNode: (id: string, title: string) => Promise<void>;
  deleteNode: (id: string, deleteFiles: boolean) => Promise<void>;
  moveNode: (
    id: string,
    newParentId: string | null,
    index: number,
  ) => Promise<void>;
  setNodeStatus: (id: string, statusId: string) => Promise<void>;
  setNodeLabel: (id: string, labelId: string) => Promise<void>;
  updateNodeSynopsis: (id: string, synopsis: string) => Promise<void>;
  updateNodeCustomMetadata: (
    id: string,
    metadata: Record<string, string>,
  ) => Promise<void>;

  // ---- project mutations ----
  setProjectTitle: (title: string) => Promise<void>;
  setProjectStatus: (status: ProjectMeta["status"]) => Promise<void>;
  setProjectWordGoal: (goal: number) => Promise<void>;

  // ---- scene IO ----
  ensureSceneLoaded: (id: string) => Promise<void>;
  setSceneDraft: (id: string, body: string) => void;
  saveScene: (id: string) => Promise<void>;
}

function projectFolderPath(slug: string): string {
  return slug;
}

function defaultStatusId(meta: ProjectMeta): string {
  return (
    meta.customStatuses.find((s) => s.default)?.id ??
    meta.customStatuses[0]?.id ??
    ""
  );
}

function defaultLabelId(meta: ProjectMeta): string {
  return (
    meta.customLabels.find((l) => l.default)?.id ??
    meta.customLabels[0]?.id ??
    ""
  );
}

/** ensureSceneLoaded 동시 호출 결정성 — 같은 id 에 대해 in-flight Promise 를 공유.
 *  연속 selection 변경 / 드롭 직후 selection 점프 시 race 로 cache=undefined 가 잘못 굳는
 *  blank-state 회귀의 직접 원인이었다. */
const sceneLoadInflight: Map<string, Promise<void>> = new Map();

/** 안전하게 binder를 읽고, ProjectMeta의 currentWords와 sync. */
async function recomputeProjectWords(binder: BinderTree): Promise<number> {
  let total = 0;
  const visit = (n: BinderNode): void => {
    if (n.type === "document") {
      total += n.wordCount ?? 0;
    } else {
      for (const c of n.children) visit(c);
    }
  };
  for (const r of binder.root) visit(r);
  return total;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  vaultPath: null,
  projectFolder: null,
  projectSlug: null,
  meta: null,
  binder: null,

  selectedNodeIds: [],
  expandedFolderIds: new Set(),
  viewMode: "editor",

  isLoading: false,
  error: null,
  sceneCache: {},

  // ---------------------------------------------------------------- lifecycle

  async loadProject(vaultPath, projectSlug) {
    set({ isLoading: true, error: null });
    setVaultBasePath(vaultPath);

    const folder = projectFolderPath(projectSlug);
    try {
      const [metaRaw, binderRaw] = await Promise.all([
        tauriVaultAdapter.readFile(`${folder}/project.json`),
        tauriVaultAdapter.readFile(`${folder}/binder.json`),
      ]);
      const metaParsed: unknown = JSON.parse(metaRaw);
      const binderParsed: unknown = JSON.parse(binderRaw);

      if (!isProjectMeta(metaParsed)) {
        throw new Error("project.json 스키마가 올바르지 않습니다.");
      }
      if (!isBinderTree(binderParsed)) {
        throw new Error("binder.json 스키마가 올바르지 않습니다.");
      }

      // 구 리서치 노드 → research/ 폴더 일회성 이전.
      // 실패해도 프로젝트 로드 자체는 막지 않는다.
      let finalMeta = metaParsed;
      let finalBinder = binderParsed;
      try {
        const mig = await runResearchMigrationIfNeeded({
          vault: tauriVaultAdapter,
          projectFolder: folder,
          meta: metaParsed,
          binder: binderParsed,
        });
        finalMeta = mig.meta;
        finalBinder = mig.binder;
        if (mig.migrated > 0) {
          tauriNoticeAdapter.info(
            `리서치 노트 ${mig.migrated}개를 research/ 폴더로 이동했습니다.`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tauriNoticeAdapter.warn(`리서치 마이그레이션 건너뜀: ${msg}`);
      }

      // 단일 manuscript-root 마이그레이션 — 평면 binder 를 프로젝트 제목 폴더로 감싼다.
      // 멱등이며, 변환이 일어났을 때만 디스크 갱신 + 백업 (binder.before-root-migration.json).
      try {
        const rootMig = await migrateBinderOnDisk(tauriVaultAdapter, folder, {
          projectTitle: finalMeta.title || projectSlug,
        });
        finalBinder = rootMig.tree;
        if (rootMig.migrated) {
          if (rootMig.backupPath) {
            tauriNoticeAdapter.info(
              `binder 구조를 단일 루트로 보정했습니다 (백업: ${rootMig.backupPath
                .split("/")
                .pop()}).`,
            );
          } else {
            tauriNoticeAdapter.info(
              "binder 구조를 단일 루트로 보정했습니다.",
            );
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tauriNoticeAdapter.warn(`단일 루트 마이그레이션 건너뜀: ${msg}`);
      }

      // 첫 진입 UX — manuscript-root 는 자동 expand. 그 외 1단계 자식 폴더도 expand.
      const initialExpanded = new Set<string>();
      const root = findManuscriptRoot(finalBinder);
      if (root) {
        initialExpanded.add(root.id);
        for (const child of root.children) {
          if (child.type === "folder") initialExpanded.add(child.id);
        }
      } else {
        for (const n of finalBinder.root) {
          if (n.type === "folder") initialExpanded.add(n.id);
        }
      }

      set({
        vaultPath,
        projectFolder: folder,
        projectSlug,
        meta: finalMeta,
        binder: finalBinder,
        selectedNodeIds: [],
        expandedFolderIds: initialExpanded,
        viewMode: "editor",
        sceneCache: {},
        isLoading: false,
        error: null,
      });

      // research store 시드 — 프로젝트 폴더 기준 research/ 스캔.
      try {
        await useResearchStore.getState().loadProject(folder);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tauriNoticeAdapter.warn(`리서치 폴더 로드 실패: ${msg}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        isLoading: false,
        error: `프로젝트를 불러올 수 없습니다: ${msg}`,
      });
    }
  },

  clear() {
    set({
      vaultPath: null,
      projectFolder: null,
      projectSlug: null,
      meta: null,
      binder: null,
      selectedNodeIds: [],
      expandedFolderIds: new Set(),
      viewMode: "editor",
      sceneCache: {},
      isLoading: false,
      error: null,
    });
    useResearchStore.getState().reset();
  },

  // ---------------------------------------------------------------- nav

  selectNodes(ids) {
    set({ selectedNodeIds: ids });
  },

  toggleSelection(id, mode) {
    const cur = get().selectedNodeIds;
    if (mode === "single") {
      set({ selectedNodeIds: [id] });
      return;
    }
    if (mode === "additive") {
      if (cur.includes(id)) {
        set({ selectedNodeIds: cur.filter((x) => x !== id) });
      } else {
        set({ selectedNodeIds: [...cur, id] });
      }
      return;
    }
    if (mode === "range") {
      // 범위 선택: 가장 최근 선택을 기준점으로 트리 순회 순서를 따라 사이의
      // 모든 노드를 선택한다.
      const binder = get().binder;
      if (!binder || cur.length === 0) {
        set({ selectedNodeIds: [id] });
        return;
      }
      const flat: string[] = [];
      const walk = (nodes: BinderNode[]): void => {
        for (const n of nodes) {
          flat.push(n.id);
          if (n.type === "folder") walk(n.children);
        }
      };
      walk(binder.root);
      const anchor = cur[cur.length - 1];
      const i = flat.indexOf(anchor);
      const j = flat.indexOf(id);
      if (i === -1 || j === -1) {
        set({ selectedNodeIds: [id] });
        return;
      }
      const [a, b] = i < j ? [i, j] : [j, i];
      set({ selectedNodeIds: flat.slice(a, b + 1) });
    }
  },

  toggleFolder(id) {
    const cur = new Set(get().expandedFolderIds);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    set({ expandedFolderIds: cur });
  },

  setExpanded(id, expanded) {
    const cur = new Set(get().expandedFolderIds);
    if (expanded) cur.add(id);
    else cur.delete(id);
    set({ expandedFolderIds: cur });
  },

  setViewMode(mode) {
    set({ viewMode: mode });
  },

  // ---------------------------------------------------------------- binder mutations

  async addScene(parentId, title = "새 장면") {
    const { meta, binder, projectFolder } = get();
    if (!meta || !binder || !projectFolder) return null;

    const id = BinderIO.assignNewId();
    const labelId = defaultLabelId(meta);
    const statusId = defaultStatusId(meta);

    // 부모 폴더의 경로 추론. parentId가 root인 경우 projectFolder 직속.
    let folderPath = "";
    if (parentId) {
      const parent = findBinderNode(binder, parentId);
      if (parent && parent.type === "folder") {
        // 자식 중 첫 document에서 폴더 path 추출
        for (const c of parent.children) {
          if (c.type === "document" && c.file.includes("/")) {
            folderPath = c.file.slice(0, c.file.lastIndexOf("/"));
            break;
          }
        }
        if (!folderPath) {
          // fallback: parent.title을 slug로
          const slug = (parent.title || parent.id)
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9가-힣\-_.]/gi, "")
            .toLowerCase()
            .slice(0, 80);
          folderPath = slug || parent.id;
        }
      }
    }

    const slug = id.slice(0, 12);
    const relFile = folderPath ? `${folderPath}/${slug}.md` : `${slug}.md`;
    const absFile = `${projectFolder}/${relFile}`;

    // scene 파일 생성
    const fm: SceneFrontmatter = {
      type: "writing-scene",
      plugin: "ai-manuscript-studio",
      project: meta.id,
      scene_id: id,
      status: statusId,
      label: labelId,
      synopsis: "",
      word_count: 0,
      updated: todayIso(),
    };
    try {
      await tauriVaultAdapter.writeFile(absFile, serializeScene(fm));

      const node = BinderIO.newDocument({
        id,
        title,
        file: relFile,
        label: labelId,
        status: statusId,
        synopsis: "",
        wordCount: 0,
      });
      const next = BinderIO.addNode(binder, parentId, node);
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      set({ binder: next, selectedNodeIds: [id] });
      tauriNoticeAdapter.info(`새 장면 추가: ${title}`);
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`장면 추가 실패: ${msg}`);
      return null;
    }
  },

  async addAttachment(parentId, file, insertIndex) {
    const { meta, binder, projectFolder } = get();
    if (!meta || !binder || !projectFolder) return null;

    const id = BinderIO.assignNewId();
    const labelId = defaultLabelId(meta);
    const statusId = defaultStatusId(meta);

    // 부모 폴더 안의 .md shell 위치 추론 (addScene 패턴 재사용).
    let folderPath = "";
    if (parentId) {
      const parent = findBinderNode(binder, parentId);
      if (parent && parent.type === "folder") {
        for (const c of parent.children) {
          if (c.type === "document" && c.file.includes("/")) {
            folderPath = c.file.slice(0, c.file.lastIndexOf("/"));
            break;
          }
        }
        if (!folderPath) {
          const slug = (parent.title || parent.id)
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9가-힣\-_.]/gi, "")
            .toLowerCase()
            .slice(0, 80);
          folderPath = slug || parent.id;
        }
      }
    }

    const slugId = id.slice(0, 12);
    const relShell = folderPath ? `${folderPath}/${slugId}.md` : `${slugId}.md`;
    const absShell = `${projectFolder}/${relShell}`;

    // 첨부 파일 안전 이름.
    const safeName = file.name
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/^\.+/, "_") || "file";
    const attachmentRel = `${projectFolder}/.attachments/${id}/${safeName}`;

    // 파일명에서 확장자 제외한 title 추출.
    const dotIdx = file.name.lastIndexOf(".");
    const titleFromName = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;

    try {
      // 1. 빈 .md shell 작성 (frontmatter only — 본문 없음).
      const fm: SceneFrontmatter = {
        type: "writing-scene",
        plugin: "ai-manuscript-studio",
        project: meta.id,
        scene_id: id,
        status: statusId,
        label: labelId,
        synopsis: "",
        word_count: 0,
        updated: todayIso(),
      };
      await tauriVaultAdapter.writeFile(absShell, serializeScene(fm));

      // 2. binary file 을 .attachments/<id>/ 로 복사.
      const buf = new Uint8Array(await file.arrayBuffer());
      await writeAttachmentBinary(attachmentRel, buf);

      // 3. binder document 노드 생성. customMetadata 에 attachment 경로/이름 박음.
      const docNode = BinderIO.newDocument({
        id,
        title: titleFromName,
        file: relShell,
        label: labelId,
        status: statusId,
        synopsis: "",
        wordCount: 0,
      });
      // BinderIO.newDocument 가 customMetadata 직접 설정 못 할 수도 있어 분리 갱신.
      let next = BinderIO.addNode(binder, parentId, docNode);
      next = BinderIO.updateNode(next, id, {
        customMetadata: {
          attachment: attachmentRel,
          attachment_name: file.name,
        },
      });

      // insertIndex 가 주어지면 트리 안에서 위치 재조정.
      if (typeof insertIndex === "number") {
        try {
          next = BinderIO.moveNode(next, id, parentId, insertIndex);
        } catch {
          /* 위치 실패해도 노드는 살아 있음 — 끝에 박힘 */
        }
      }

      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      // selection 변경 *전에* cache 를 채워 둔다 — race 로 EditorPane 이 영원히
      // "불러오는 중…" 상태로 굳던 회귀 방지.
      set({ binder: next });
      await get().ensureSceneLoaded(id);
      set({ selectedNodeIds: [id] });
      tauriNoticeAdapter.info(`첨부 추가: ${file.name}`);
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`첨부 실패: ${msg}`);
      return null;
    }
  },

  async addAttachmentByPath(parentId, absolutePath, insertIndex) {
    const { meta, binder, projectFolder } = get();
    if (!meta || !binder || !projectFolder) return null;

    const id = BinderIO.assignNewId();
    const labelId = defaultLabelId(meta);
    const statusId = defaultStatusId(meta);

    let folderPath = "";
    if (parentId) {
      const parent = findBinderNode(binder, parentId);
      if (parent && parent.type === "folder") {
        for (const c of parent.children) {
          if (c.type === "document" && c.file.includes("/")) {
            folderPath = c.file.slice(0, c.file.lastIndexOf("/"));
            break;
          }
        }
        if (!folderPath) {
          const slug = (parent.title || parent.id)
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9가-힣\-_.]/gi, "")
            .toLowerCase()
            .slice(0, 80);
          folderPath = slug || parent.id;
        }
      }
    }

    const slugId = id.slice(0, 12);
    const relShell = folderPath ? `${folderPath}/${slugId}.md` : `${slugId}.md`;
    const absShell = `${projectFolder}/${relShell}`;

    const fileName = absolutePath.split("/").pop() ?? "file";
    const safeName =
      fileName.replace(/[/\\:*?"<>|]/g, "_").replace(/^\.+/, "_") || "file";
    const attachmentRel = `${projectFolder}/.attachments/${id}/${safeName}`;

    const dotIdx = fileName.lastIndexOf(".");
    const titleFromName = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;

    try {
      const fm: SceneFrontmatter = {
        type: "writing-scene",
        plugin: "ai-manuscript-studio",
        project: meta.id,
        scene_id: id,
        status: statusId,
        label: labelId,
        synopsis: "",
        word_count: 0,
        updated: todayIso(),
      };
      await tauriVaultAdapter.writeFile(absShell, serializeScene(fm));

      // 절대 경로 → vault 안 attachment 위치로 binary 복사 (Rust vault_copy_file).
      await copyExternalFile(absolutePath, attachmentRel);

      const docNode = BinderIO.newDocument({
        id,
        title: titleFromName,
        file: relShell,
        label: labelId,
        status: statusId,
        synopsis: "",
        wordCount: 0,
      });
      let next = BinderIO.addNode(binder, parentId, docNode);
      next = BinderIO.updateNode(next, id, {
        customMetadata: {
          attachment: attachmentRel,
          attachment_name: fileName,
        },
      });

      if (typeof insertIndex === "number") {
        try {
          next = BinderIO.moveNode(next, id, parentId, insertIndex);
        } catch {
          /* 위치 실패해도 노드는 살아 있음 — 끝에 박힘 */
        }
      }

      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      set({ binder: next });
      await get().ensureSceneLoaded(id);
      set({ selectedNodeIds: [id] });
      tauriNoticeAdapter.info(`첨부 추가: ${fileName}`);
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`첨부 실패: ${msg}`);
      return null;
    }
  },

  async convertNodeToShortcut(nodeId, absolutePath) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;
    const node = findBinderNode(binder, nodeId);
    if (!node) return;

    try {
      const next = BinderIO.updateNode(binder, nodeId, {
        linkedFile: { absolutePath },
      });
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      // 기존 cache 무효화 — 새 source 로 갱신.
      const cache = { ...get().sceneCache };
      delete cache[nodeId];
      set({ binder: next, sceneCache: cache });
      // cache populate 까지 await 후 selection 변경 (race 방지).
      await get().ensureSceneLoaded(nodeId);
      set({ selectedNodeIds: [nodeId] });
      const fileName = absolutePath.split("/").pop() ?? absolutePath;
      tauriNoticeAdapter.info(`연결됨 (shortcut): ${fileName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`shortcut 변환 실패: ${msg}`);
    }
  },

  async addFolder(parentId, title = "새 폴더") {
    const { meta, binder, projectFolder } = get();
    if (!meta || !binder || !projectFolder) return null;

    const id = BinderIO.assignNewId();
    const node = BinderIO.newFolder({
      id,
      title,
      label: defaultLabelId(meta),
      status: defaultStatusId(meta),
      synopsis: "",
    });

    try {
      const next = BinderIO.addNode(binder, parentId, node);
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      const expanded = new Set(get().expandedFolderIds);
      expanded.add(id);
      set({ binder: next, selectedNodeIds: [id], expandedFolderIds: expanded });
      tauriNoticeAdapter.info(`새 폴더 추가: ${title}`);
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`폴더 추가 실패: ${msg}`);
      return null;
    }
  },

  async renameNode(id, title) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;
    const next = BinderIO.updateNode(binder, id, { title });
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ binder: next });
  },

  async deleteNode(id, deleteFiles) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;

    const target = findBinderNode(binder, id);
    if (!target) return;

    const filesToDelete: string[] = [];
    if (deleteFiles) {
      const collect = (n: BinderNode): void => {
        if (n.type === "document") {
          filesToDelete.push(`${projectFolder}/${n.file}`);
        } else {
          for (const c of n.children) collect(c);
        }
      };
      collect(target);
    }

    const next = BinderIO.removeNode(binder, id);
    try {
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      for (const f of filesToDelete) {
        try {
          await tauriVaultAdapter.deleteFile(f);
        } catch {
          /* swallow */
        }
      }
      const stillSelected = get().selectedNodeIds.filter((x) => x !== id);
      const cache = { ...get().sceneCache };
      delete cache[id];
      set({ binder: next, selectedNodeIds: stillSelected, sceneCache: cache });
      tauriNoticeAdapter.info("삭제했습니다");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`삭제 실패: ${msg}`);
    }
  },

  async moveNode(id, newParentId, index) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;
    try {
      const next = BinderIO.moveNode(binder, id, newParentId, index);
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(next, null, 2) + "\n",
      );
      set({ binder: next });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`이동 실패: ${msg}`);
    }
  },

  async setNodeStatus(id, statusId) {
    const { binder, meta, projectFolder } = get();
    if (!binder || !meta || !projectFolder) return;
    if (!meta.customStatuses.some((s) => s.id === statusId)) {
      tauriNoticeAdapter.warn(`존재하지 않는 status: ${statusId}`);
      return;
    }
    const next = BinderIO.updateNode(binder, id, { status: statusId });
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ binder: next });

    // document면 frontmatter도 갱신
    const node = findBinderNode(next, id);
    if (node && node.type === "document") {
      try {
        const raw = await tauriVaultAdapter.readFile(
          `${projectFolder}/${node.file}`,
        );
        const parsed = parseScene(raw);
        if (parsed.frontmatter) {
          const fm: SceneFrontmatter = {
            ...parsed.frontmatter,
            status: statusId,
            updated: todayIso(),
          };
          await tauriVaultAdapter.writeFile(
            `${projectFolder}/${node.file}`,
            serializeScene(fm) + parsed.body,
          );
        }
      } catch {
        /* swallow */
      }
    }
  },

  async setNodeLabel(id, labelId) {
    const { binder, meta, projectFolder } = get();
    if (!binder || !meta || !projectFolder) return;
    if (!meta.customLabels.some((l) => l.id === labelId)) {
      tauriNoticeAdapter.warn(`존재하지 않는 label: ${labelId}`);
      return;
    }
    const next = BinderIO.updateNode(binder, id, { label: labelId });
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ binder: next });

    const node = findBinderNode(next, id);
    if (node && node.type === "document") {
      try {
        const raw = await tauriVaultAdapter.readFile(
          `${projectFolder}/${node.file}`,
        );
        const parsed = parseScene(raw);
        if (parsed.frontmatter) {
          const fm: SceneFrontmatter = {
            ...parsed.frontmatter,
            label: labelId,
            updated: todayIso(),
          };
          await tauriVaultAdapter.writeFile(
            `${projectFolder}/${node.file}`,
            serializeScene(fm) + parsed.body,
          );
        }
      } catch {
        /* swallow */
      }
    }
  },

  async updateNodeSynopsis(id, synopsis) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;
    const next = BinderIO.updateNode(binder, id, { synopsis });
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ binder: next });

    const node = findBinderNode(next, id);
    if (node && node.type === "document") {
      try {
        const raw = await tauriVaultAdapter.readFile(
          `${projectFolder}/${node.file}`,
        );
        const parsed = parseScene(raw);
        if (parsed.frontmatter) {
          const fm: SceneFrontmatter = {
            ...parsed.frontmatter,
            synopsis,
            updated: todayIso(),
          };
          await tauriVaultAdapter.writeFile(
            `${projectFolder}/${node.file}`,
            serializeScene(fm) + parsed.body,
          );
        }
      } catch {
        /* swallow */
      }
    }
  },

  async updateNodeCustomMetadata(id, metadata) {
    const { binder, projectFolder } = get();
    if (!binder || !projectFolder) return;
    const next = BinderIO.updateNode(binder, id, { customMetadata: metadata });
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/binder.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ binder: next });
  },

  // ---------------------------------------------------------------- project mutations

  async setProjectTitle(title) {
    const { meta, projectFolder } = get();
    if (!meta || !projectFolder) return;
    const next: ProjectMeta = { ...meta, title, updatedAt: todayIso() };
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/project.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ meta: next });
  },

  async setProjectStatus(status) {
    const { meta, projectFolder } = get();
    if (!meta || !projectFolder) return;
    const next: ProjectMeta = { ...meta, status, updatedAt: todayIso() };
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/project.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ meta: next });
  },

  async setProjectWordGoal(goal) {
    const { meta, projectFolder } = get();
    if (!meta || !projectFolder) return;
    const next: ProjectMeta = {
      ...meta,
      wordGoal: Math.max(0, goal | 0),
      updatedAt: todayIso(),
    };
    await tauriVaultAdapter.writeFile(
      `${projectFolder}/project.json`,
      JSON.stringify(next, null, 2) + "\n",
    );
    set({ meta: next });
  },

  // ---------------------------------------------------------------- scene IO

  async ensureSceneLoaded(id) {
    const inflight = sceneLoadInflight.get(id);
    if (inflight) return inflight;

    const { binder, projectFolder, sceneCache } = get();
    if (!binder || !projectFolder) return;
    if (sceneCache[id]) return;

    const node = findBinderNode(binder, id);
    if (!node) return;

    // shortcut 노드: 절대 경로의 외부 파일을 진실의 원천으로 read.
    // folder + linkedFile 도 허용 (Scrivener folder-with-text).
    const linkedAbs = node.linkedFile?.absolutePath;
    if (linkedAbs) {
      const p = (async (): Promise<void> => {
        try {
          const raw = await tauriVaultAdapter.readFile(linkedAbs);
          // 외부 .md 는 frontmatter 가 없는 경우가 일반적. parseScene 이 안전하게 분리한다.
          const parsed = parseScene(raw);
          const cache = { ...get().sceneCache };
          cache[id] = {
            frontmatter: parsed.frontmatter,
            body: parsed.body,
            draft: null,
            lastSavedAt: null,
          };
          set({ sceneCache: cache });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          tauriNoticeAdapter.error(`연결된 파일을 읽을 수 없습니다: ${msg}`);
          // cache 에 빈 entry 라도 박아 EditorPane 이 영원히 "불러오는 중…" 으로 굳지 않게.
          const cache = { ...get().sceneCache };
          cache[id] = {
            frontmatter: null,
            body: `> 연결된 파일을 읽지 못했습니다: ${linkedAbs}\n> ${msg}\n`,
            draft: null,
            lastSavedAt: null,
          };
          set({ sceneCache: cache });
        }
      })();
      sceneLoadInflight.set(id, p);
      try {
        await p;
      } finally {
        sceneLoadInflight.delete(id);
      }
      return;
    }

    if (node.type !== "document") return;

    const p = (async (): Promise<void> => {
      try {
        const raw = await tauriVaultAdapter.readFile(
          `${projectFolder}/${node.file}`,
        );
        const parsed = parseScene(raw);
        const cache = { ...get().sceneCache };
        cache[id] = {
          frontmatter: parsed.frontmatter,
          body: parsed.body,
          draft: null,
          lastSavedAt: null,
        };

        const freshCount = WordCounter.countChars(parsed.body);
        const stored = (node as BinderDocument).wordCount ?? -1;
        if (freshCount !== stored) {
          const nextBinder = BinderIO.updateNode(binder, id, {});
          const cloned = findBinderNode(nextBinder, id);
          if (cloned && cloned.type === "document") {
            cloned.wordCount = freshCount;
            set({ binder: nextBinder, sceneCache: cache });
            return;
          }
        }
        set({ sceneCache: cache });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tauriNoticeAdapter.error(`장면을 불러올 수 없습니다: ${msg}`);
      }
    })();
    sceneLoadInflight.set(id, p);
    try {
      await p;
    } finally {
      sceneLoadInflight.delete(id);
    }
  },

  setSceneDraft(id, body) {
    const cache = { ...get().sceneCache };
    const cur = cache[id];
    if (!cur) return;
    cache[id] = { ...cur, draft: body };
    set({ sceneCache: cache });
  },

  async saveScene(id) {
    const { binder, projectFolder, sceneCache } = get();
    if (!binder || !projectFolder) return;
    const node = findBinderNode(binder, id);
    if (!node) return;
    const entry = sceneCache[id];
    if (!entry || entry.draft === null) return;

    // shortcut 노드: 절대 경로 파일에 write-through. frontmatter 가 원래 있던 외부 파일이면
    // 그대로 보존, 없었으면 추가하지 않는다 (사용자의 외부 파일 형식 존중).
    const linkedAbs = node.linkedFile?.absolutePath;
    if (linkedAbs) {
      const newBody = entry.draft;
      try {
        const out = entry.frontmatter
          ? serializeScene(entry.frontmatter) + newBody
          : newBody;
        await tauriVaultAdapter.writeFile(linkedAbs, out);
        const cache = { ...get().sceneCache };
        cache[id] = {
          frontmatter: entry.frontmatter,
          body: newBody,
          draft: null,
          lastSavedAt: Date.now(),
        };
        set({ sceneCache: cache });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tauriNoticeAdapter.error(`연결된 파일 저장 실패: ${msg}`);
      }
      return;
    }

    if (node.type !== "document") return;
    const newBody = entry.draft;
    // 한국어 문서는 글자 수가 표준. countChars는 공백 포함, 줄바꿈만 제외 (네이버/브런치 표준).
    const wordCount = WordCounter.countChars(newBody);

    const fm: SceneFrontmatter = entry.frontmatter
      ? {
          ...entry.frontmatter,
          word_count: wordCount,
          updated: todayIso(),
        }
      : {
          type: "writing-scene",
          plugin: "ai-manuscript-studio",
          project: get().meta?.id ?? "",
          scene_id: id,
          status: node.status,
          label: node.label,
          synopsis: node.synopsis,
          word_count: wordCount,
          updated: todayIso(),
        };

    try {
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/${node.file}`,
        serializeScene(fm) + newBody,
      );

      // binder의 wordCount 갱신.
      // BinderIO.updateNode의 patch 타입은 union 공통 필드만 허용하므로
      // document-only 필드인 wordCount는 직접 노드를 갈아끼운다.
      const documentNode = findBinderNode(binder, id);
      if (!documentNode || documentNode.type !== "document") return;
      const nextBinder = BinderIO.updateNode(binder, id, {});
      // Replace the wordCount in the cloned tree using mutation through
      // findBinderNode (the previous call already returned a cloned tree).
      const cloned = findBinderNode(nextBinder, id);
      if (cloned && cloned.type === "document") {
        cloned.wordCount = wordCount;
      }
      await tauriVaultAdapter.writeFile(
        `${projectFolder}/binder.json`,
        JSON.stringify(nextBinder, null, 2) + "\n",
      );

      const cache = { ...get().sceneCache };
      cache[id] = {
        frontmatter: fm,
        body: newBody,
        draft: null,
        lastSavedAt: Date.now(),
      };

      // 프로젝트 currentWords 재계산
      const total = await recomputeProjectWords(nextBinder);
      const meta = get().meta;
      if (meta && meta.currentWords !== total) {
        const nextMeta: ProjectMeta = {
          ...meta,
          currentWords: total,
          updatedAt: todayIso(),
        };
        await tauriVaultAdapter.writeFile(
          `${projectFolder}/project.json`,
          JSON.stringify(nextMeta, null, 2) + "\n",
        );
        set({ binder: nextBinder, sceneCache: cache, meta: nextMeta });
      } else {
        set({ binder: nextBinder, sceneCache: cache });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`저장 실패: ${msg}`);
    }
  },
}));
