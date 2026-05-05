// ProjectV2Manager — Phase B 의 high-level API.
//
// 이 매니저가 ProjectMetaIO + BinderIO + SceneIO 를 한 곳에 묶어
// 옵시디언 플러그인 / Tauri 앱이 바라보는 단일 표면을 제공한다.
//
// 모든 변경은 가능하면 atomic: binder 와 scene 파일을 한 묶음으로 갱신하고
// 실패 시 가능한 롤백을 시도한다.

import { ProjectStatus, PLUGIN_ID } from "../types";
import { todayIso, slugify } from "../utils/paths";
import { log } from "../utils/logger";
import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { FrontmatterAdapter } from "../adapters/FrontmatterAdapter";

import {
  BinderDocument,
  BinderFolder,
  BinderNode,
  BinderTree,
  ProjectMeta,
} from "./schema";
import {
  CreateProjectMetaInput,
  ProjectMetaIO,
} from "./ProjectMetaIO";
import { BinderIO } from "./BinderIO";
import { SceneIO } from "./SceneIO";
import { StatusManager } from "../status/StatusManager";
import { LabelManager } from "../status/LabelManager";

export interface ProjectV2ManagerDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  frontmatter: FrontmatterAdapter;
}

export interface AddSceneInput {
  /** binder 노드 title. */
  title: string;
  /** 사용자 직접 지정한 binder id (없으면 자동 생성). */
  id?: string;
  /** label id (없으면 customLabels 의 default). */
  label?: string;
  /** status id (없으면 customStatuses 의 default). */
  status?: string;
  synopsis?: string;
  /** 시작 본문 (없으면 빈 본문). */
  body?: string;
  /** 명시적 파일 경로(프로젝트 폴더 기준). 없으면 부모 폴더 + slug.md. */
  file?: string;
  customMetadata?: Record<string, string>;
}

export interface AddFolderInput {
  title: string;
  id?: string;
  label?: string;
  status?: string;
  synopsis?: string;
  customMetadata?: Record<string, string>;
}

export interface ProjectV2Snapshot {
  meta: ProjectMeta;
  binder: BinderTree;
}

function ensureLeafSlug(title: string, fallback: string): string {
  const s = slugify(title);
  return s === "untitled" ? fallback : s;
}

function findFolderPathForNode(
  tree: BinderTree,
  parentBinderId: string | null,
  /** projectFolder 안의 prefix 가 될 디렉터리 (예: "01-도입"). */
): string | null {
  if (parentBinderId === null) return null;
  // 부모 폴더 안의 어떤 document 의 file 을 보면 부모 폴더의 디스크 경로를 추론할 수 있다.
  const parent = BinderIO.findNode(tree, parentBinderId);
  if (!parent || parent.type !== "folder") return null;
  for (const child of parent.children) {
    if (child.type === "document" && child.file.includes("/")) {
      const idx = child.file.lastIndexOf("/");
      return child.file.slice(0, idx);
    }
  }
  // 자식이 없거나 모두 문서가 아닌 경우, title 기반으로 새로 만든다.
  return ensureLeafSlug(parent.title, parent.id);
}

export class ProjectV2Manager {
  constructor(private deps: ProjectV2ManagerDeps) {}

  /** writingRoot 아래의 모든 ProjectMeta 를 수집. project.json 이 있는 폴더만. */
  async list(writingRoot: string): Promise<ProjectMeta[]> {
    const root = writingRoot.replace(/\/+$/, "");
    if (!(await this.deps.vault.fileExists(root))) return [];
    const entries = await this.deps.vault.listDir(root);
    const out: ProjectMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory) continue;
      const folder = `${root}/${e.name}`;
      const has = await ProjectMetaIO.exists(this.deps.vault, folder);
      if (!has) continue;
      try {
        const meta = await ProjectMetaIO.read(this.deps.vault, folder);
        out.push(meta);
      } catch (err) {
        log.warn(
          `ProjectV2Manager.list: skip ${folder}: ${(err as Error).message}`,
        );
      }
    }
    out.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    return out;
  }

  async open(projectFolder: string): Promise<ProjectV2Snapshot> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    let binder: BinderTree;
    if (
      await this.deps.vault.fileExists(`${projectFolder}/binder.json`)
    ) {
      binder = await BinderIO.read(this.deps.vault, projectFolder);
    } else {
      binder = BinderIO.empty();
      await BinderIO.write(this.deps.vault, projectFolder, binder);
    }
    return { meta, binder };
  }

  /**
   * 새 프로젝트를 만든다. project.json + binder.json + (optional) planning.md.
   * 실패 시 부분 결과는 그대로 두지만 notice 로 알린다.
   */
  async createProject(
    writingRoot: string,
    init: CreateProjectMetaInput & {
      /** 폴더명. 없으면 init.id 사용. */
      folderName?: string;
      /** 빈 planning.md 를 생성할지 (기본 true). */
      seedPlanning?: boolean;
    },
  ): Promise<ProjectMeta> {
    const root = writingRoot.replace(/\/+$/, "");
    await this.deps.vault.ensureDir(root);
    const folderName = init.folderName ?? init.id;
    const projectFolder = `${root}/${folderName}`;
    if (await this.deps.vault.fileExists(projectFolder)) {
      // 이미 폴더가 있으면 project.json 까지 있는지 확인 — 있으면 거부.
      if (await ProjectMetaIO.exists(this.deps.vault, projectFolder)) {
        throw new Error(
          `ProjectV2Manager.createProject: 이미 프로젝트가 있습니다: ${projectFolder}`,
        );
      }
    }

    const meta = await ProjectMetaIO.create(this.deps.vault, projectFolder, init);
    // 빈 binder
    await BinderIO.write(this.deps.vault, projectFolder, BinderIO.empty());

    if (init.seedPlanning !== false) {
      const planningPath = `${projectFolder}/planning.md`;
      if (!(await this.deps.vault.fileExists(planningPath))) {
        await this.deps.vault.writeFile(
          planningPath,
          this.buildEmptyPlanning(meta),
        );
      }
    }

    return meta;
  }

  /** binder.json 에 새 폴더 추가. parentBinderId === null 이면 root. */
  async addFolder(
    projectFolder: string,
    parentBinderId: string | null,
    folder: AddFolderInput,
  ): Promise<BinderFolder> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const node = BinderIO.newFolder({
      id: folder.id,
      title: folder.title,
      label: folder.label ?? this.defaultLabelId(meta),
      status: folder.status ?? this.defaultStatusId(meta),
      synopsis: folder.synopsis,
      customMetadata: folder.customMetadata,
    });
    const next = BinderIO.addNode(tree, parentBinderId, node);
    await BinderIO.write(this.deps.vault, projectFolder, next);
    return node;
  }

  /**
   * binder.json 에 새 장면 노드를 추가하고 실제 .md 파일을 생성한다.
   * - file 이 명시되지 않으면 부모 folder 의 디렉터리 + slug.md 로 결정
   * - parentBinderId === null 이면 root (장면을 root 에 직접 두는 흐름은 흔치 않지만 허용)
   */
  async addScene(
    projectFolder: string,
    parentBinderId: string | null,
    scene: AddSceneInput,
  ): Promise<BinderDocument> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const id = scene.id ?? BinderIO.assignNewId();
    const labelId = scene.label ?? this.defaultLabelId(meta);
    const statusId = scene.status ?? this.defaultStatusId(meta);

    let relFile = scene.file;
    if (!relFile) {
      const folderPath = findFolderPathForNode(tree, parentBinderId);
      const slug = ensureLeafSlug(scene.title, id);
      relFile = folderPath ? `${folderPath}/${slug}.md` : `${slug}.md`;
    }

    // 충돌 회피
    let attempt = 0;
    let candidate = relFile;
    while (
      await this.deps.vault.fileExists(`${projectFolder}/${candidate}`)
    ) {
      attempt += 1;
      const dot = relFile.lastIndexOf(".");
      candidate =
        dot === -1
          ? `${relFile}-${attempt}`
          : `${relFile.slice(0, dot)}-${attempt}${relFile.slice(dot)}`;
    }
    relFile = candidate;

    // 1) scene 파일 작성
    await SceneIO.create(this.deps.vault, projectFolder, {
      file: relFile,
      project: meta.id,
      sceneId: id,
      status: statusId,
      label: labelId,
      synopsis: scene.synopsis,
      body: scene.body,
    });

    // 2) binder 갱신 — 실패 시 scene 파일을 롤백
    const node = BinderIO.newDocument({
      id,
      title: scene.title,
      file: relFile,
      label: labelId,
      status: statusId,
      synopsis: scene.synopsis,
      customMetadata: scene.customMetadata,
    });
    try {
      const next = BinderIO.addNode(tree, parentBinderId, node);
      await BinderIO.write(this.deps.vault, projectFolder, next);
    } catch (err) {
      // 롤백
      try {
        await this.deps.vault.deleteFile(`${projectFolder}/${relFile}`);
      } catch {
        /* swallow rollback failure */
      }
      throw err;
    }
    return node;
  }

  async moveNode(
    projectFolder: string,
    nodeId: string,
    newParentId: string | null,
    index: number,
  ): Promise<void> {
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const next = BinderIO.moveNode(tree, nodeId, newParentId, index);
    await BinderIO.write(this.deps.vault, projectFolder, next);
  }

  /**
   * 노드 제거. options.deleteFile=true 이면 document 파일까지 삭제.
   * folder 의 경우 자식들의 file 도 같이 삭제하는지 결정.
   */
  async removeNode(
    projectFolder: string,
    nodeId: string,
    options?: { deleteFile?: boolean },
  ): Promise<void> {
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const target = BinderIO.findNode(tree, nodeId);
    if (!target) {
      throw new Error(
        `ProjectV2Manager.removeNode: id를 찾을 수 없음: ${nodeId}`,
      );
    }

    const filesToDelete: string[] = [];
    if (options?.deleteFile) {
      const collect = (n: BinderNode): void => {
        if (n.type === "document") {
          filesToDelete.push(`${projectFolder}/${n.file}`);
        } else {
          for (const c of n.children) collect(c);
        }
      };
      collect(target);
    }

    const next = BinderIO.removeNode(tree, nodeId);
    await BinderIO.write(this.deps.vault, projectFolder, next);

    for (const f of filesToDelete) {
      try {
        await this.deps.vault.deleteFile(f);
      } catch (err) {
        log.warn(
          `ProjectV2Manager.removeNode: 파일 삭제 실패 (${f}): ${(err as Error).message}`,
        );
      }
    }
  }

  /** 노드의 status id 변경 + 파일이 document 면 frontmatter 도 함께 갱신. */
  async setNodeStatus(
    projectFolder: string,
    nodeId: string,
    statusId: string,
  ): Promise<void> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    if (!StatusManager.exists(meta, statusId)) {
      this.deps.notice.warn(`존재하지 않는 status id: ${statusId}`);
      throw new Error(
        `ProjectV2Manager.setNodeStatus: 존재하지 않는 status id: ${statusId}`,
      );
    }
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const node = BinderIO.findNode(tree, nodeId);
    if (!node) {
      throw new Error(
        `ProjectV2Manager.setNodeStatus: id를 찾을 수 없음: ${nodeId}`,
      );
    }
    const next = BinderIO.updateNode(tree, nodeId, { status: statusId });
    await BinderIO.write(this.deps.vault, projectFolder, next);

    if (node.type === "document") {
      await SceneIO.updateFrontmatter(
        this.deps.frontmatter,
        projectFolder,
        node.file,
        (fm) => {
          fm.status = statusId;
        },
      );
    }
  }

  async setNodeLabel(
    projectFolder: string,
    nodeId: string,
    labelId: string,
  ): Promise<void> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    if (!LabelManager.exists(meta, labelId)) {
      this.deps.notice.warn(`존재하지 않는 label id: ${labelId}`);
      throw new Error(
        `ProjectV2Manager.setNodeLabel: 존재하지 않는 label id: ${labelId}`,
      );
    }
    const tree = await BinderIO.read(this.deps.vault, projectFolder);
    const node = BinderIO.findNode(tree, nodeId);
    if (!node) {
      throw new Error(
        `ProjectV2Manager.setNodeLabel: id를 찾을 수 없음: ${nodeId}`,
      );
    }
    const next = BinderIO.updateNode(tree, nodeId, { label: labelId });
    await BinderIO.write(this.deps.vault, projectFolder, next);

    if (node.type === "document") {
      await SceneIO.updateFrontmatter(
        this.deps.frontmatter,
        projectFolder,
        node.file,
        (fm) => {
          fm.label = labelId;
        },
      );
    }
  }

  /** 원고 라이프사이클 status (idea→published) 만 변경. project.json 의 status. */
  async setProjectStatus(
    projectFolder: string,
    status: ProjectStatus,
  ): Promise<void> {
    const meta = await ProjectMetaIO.read(this.deps.vault, projectFolder);
    const next: ProjectMeta = { ...meta, status, updatedAt: todayIso() };
    await ProjectMetaIO.write(this.deps.vault, projectFolder, next);
  }

  /**
   * 단일 장면 또는 여러 장면의 word_count 합. nodeIds 가 비어 있으면 전체 합.
   * 폴더 id 가 들어오면 그 자손 document 들의 합.
   */
  async getCombinedWordCount(
    projectFolder: string,
    nodeIds?: string[],
  ): Promise<number> {
    const tree = await BinderIO.read(this.deps.vault, projectFolder);

    const documents: BinderDocument[] = [];
    const collect = (n: BinderNode): void => {
      if (n.type === "document") documents.push(n);
      else for (const c of n.children) collect(c);
    };

    if (!nodeIds || nodeIds.length === 0) {
      for (const r of tree.root) collect(r);
    } else {
      for (const id of nodeIds) {
        const found = BinderIO.findNode(tree, id);
        if (!found) continue;
        collect(found);
      }
    }

    let total = 0;
    for (const d of documents) {
      if (typeof d.wordCount === "number") {
        total += d.wordCount;
      } else {
        // wordCount 가 없으면 frontmatter 의 word_count 참조
        try {
          const parsed = await SceneIO.read(
            this.deps.vault,
            projectFolder,
            d.file,
          );
          total += parsed.frontmatter?.word_count ?? 0;
        } catch {
          /* 누락 파일 — 0 */
        }
      }
    }
    return total;
  }

  // ---- helpers ----

  private defaultStatusId(meta: ProjectMeta): string {
    const def = StatusManager.getDefault(meta);
    if (def) return def.id;
    throw new Error(
      `ProjectV2Manager: 사용 가능한 status가 없습니다. customStatuses를 채워주세요.`,
    );
  }

  private defaultLabelId(meta: ProjectMeta): string {
    const def = LabelManager.getDefault(meta);
    if (def) return def.id;
    throw new Error(
      `ProjectV2Manager: 사용 가능한 label이 없습니다. customLabels를 채워주세요.`,
    );
  }

  private buildEmptyPlanning(meta: ProjectMeta): string {
    const lines: string[] = [];
    lines.push("---");
    lines.push("type: writing-planning");
    lines.push(`plugin: ${PLUGIN_ID}`);
    lines.push(`project: ${meta.id}`);
    lines.push(`phase: pending`);
    lines.push("---");
    lines.push("");
    lines.push(`# 기획 인터뷰 — ${meta.title}`);
    lines.push("");
    lines.push("<!-- 마법사가 여기에 대화 전사 + 요약을 채웁니다 -->");
    lines.push("");
    return lines.join("\n");
  }
}
