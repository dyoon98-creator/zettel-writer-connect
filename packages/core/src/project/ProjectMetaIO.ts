// ProjectMetaIO — project.json 파일의 read/write/create.
//
// JSON 직렬화 규칙: 2-space indent, \n 줄바꿈, 키 정렬 안 함 (insertion order 유지).

import { Genre, PLUGIN_ID, ProjectStatus } from "../types";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { todayIso } from "../utils/paths";
import {
  DEFAULT_LABELS,
  DEFAULT_STATUSES,
  isProjectMeta,
  PROJECT_SCHEMA,
  ProjectMeta,
  StatusDef,
  LabelDef,
} from "./schema";

const PROJECT_JSON = "project.json";

export interface CreateProjectMetaInput {
  id: string;
  title: string;
  genre: Genre;
  status?: ProjectStatus;
  /** 프로젝트 자체의 label id (기본: customLabels 의 default 또는 첫 항목). */
  label?: string;
  wordGoal?: number;
  currentWords?: number;
  targetReader?: string;
  coreMessage?: string;
  customStatuses?: StatusDef[];
  customLabels?: LabelDef[];
  sourceNotes?: string[];
  customMetadata?: Record<string, string>;
  /** YYYY-MM-DD; 없으면 오늘. */
  createdAt?: string;
}

function projectJsonPath(projectFolder: string): string {
  const folder = projectFolder.replace(/\/+$/, "");
  return `${folder}/${PROJECT_JSON}`;
}

function pickDefaultLabelId(labels: LabelDef[]): string {
  const def = labels.find((l) => l.default);
  if (def) return def.id;
  if (labels.length > 0) return labels[0].id;
  return "";
}

export const ProjectMetaIO = {
  /** project.json 파일을 읽어 ProjectMeta 로 반환. 스키마 불일치 시 throw. */
  async read(
    vault: VaultAdapter,
    projectFolder: string,
  ): Promise<ProjectMeta> {
    const path = projectJsonPath(projectFolder);
    const raw = await vault.readFile(path);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `ProjectMetaIO.read: JSON 파싱 실패 (${path}): ${(err as Error).message}`,
      );
    }
    if (!isProjectMeta(parsed)) {
      throw new Error(
        `ProjectMetaIO.read: project.json 스키마 위반 (${path})`,
      );
    }
    return parsed;
  },

  /** project.json 파일을 쓴다. updatedAt 을 오늘로 갱신. */
  async write(
    vault: VaultAdapter,
    projectFolder: string,
    meta: ProjectMeta,
  ): Promise<void> {
    const path = projectJsonPath(projectFolder);
    const next: ProjectMeta = { ...meta, updatedAt: todayIso() };
    const json = JSON.stringify(next, null, 2) + "\n";
    await vault.writeFile(path, json);
  },

  /** projectFolder 가 존재하지 않으면 만들고, project.json 을 초기화하여 작성. */
  async create(
    vault: VaultAdapter,
    projectFolder: string,
    init: CreateProjectMetaInput,
  ): Promise<ProjectMeta> {
    if (!init.id || !init.title) {
      throw new Error("ProjectMetaIO.create: id 와 title 이 필요합니다");
    }
    await vault.ensureDir(projectFolder);
    const today = init.createdAt ?? todayIso();
    const labels =
      init.customLabels && init.customLabels.length > 0
        ? init.customLabels.map((l) => ({ ...l }))
        : DEFAULT_LABELS.map((l) => ({ ...l }));
    const statuses =
      init.customStatuses && init.customStatuses.length > 0
        ? init.customStatuses.map((s) => ({ ...s }))
        : DEFAULT_STATUSES.map((s) => ({ ...s }));

    const meta: ProjectMeta = {
      schema: PROJECT_SCHEMA,
      id: init.id,
      title: init.title,
      genre: init.genre,
      status: init.status ?? "planning",
      label: init.label ?? pickDefaultLabelId(labels),
      wordGoal: Math.max(0, (init.wordGoal ?? 0) | 0),
      currentWords: Math.max(0, (init.currentWords ?? 0) | 0),
      targetReader: init.targetReader ?? "",
      coreMessage: init.coreMessage ?? "",
      createdAt: today,
      updatedAt: today,
      customStatuses: statuses,
      customLabels: labels,
      sourceNotes: init.sourceNotes ?? [],
      plugin: PLUGIN_ID,
    };
    if (init.customMetadata) {
      meta.customMetadata = { ...init.customMetadata };
    }
    await ProjectMetaIO.write(vault, projectFolder, meta);
    return meta;
  },

  /** project.json 의 존재 확인. */
  async exists(
    vault: VaultAdapter,
    projectFolder: string,
  ): Promise<boolean> {
    return vault.fileExists(projectJsonPath(projectFolder));
  },
};
