// SceneIO — 장면 .md 파일 (frontmatter + body) 의 read/write/create.
//
// frontmatter 직렬화는 WritingNoteIO 의 hand-rolled YAML 헬퍼와 같은
// 스타일로 작성한다. 유일한 의존성은 VaultAdapter + FrontmatterAdapter.

import { PLUGIN_ID } from "../types";
import { todayIso } from "../utils/paths";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { FrontmatterAdapter } from "../adapters/FrontmatterAdapter";
import { SCENE_TYPE, SceneFrontmatter } from "./schema";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function escapeYamlString(s: string): string {
  if (s === "") return '""';
  if (
    /^[\w\-./가-힣ᄀ-ᇿ㄰-㆏\s]+$/.test(s) &&
    !/^\s|\s$/.test(s) &&
    !s.includes(":")
  ) {
    return s;
  }
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** SceneFrontmatter 를 YAML 블록으로 직렬화. */
export function serializeScene(fm: SceneFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`type: ${fm.type}`);
  lines.push(`plugin: ${fm.plugin}`);
  lines.push(`project: ${escapeYamlString(fm.project)}`);
  lines.push(`scene_id: ${escapeYamlString(fm.scene_id)}`);
  lines.push(`status: ${escapeYamlString(fm.status)}`);
  lines.push(`label: ${escapeYamlString(fm.label)}`);
  lines.push(`synopsis: ${escapeYamlString(fm.synopsis)}`);
  lines.push(`word_count: ${fm.word_count}`);
  lines.push(`updated: ${fm.updated}`);
  lines.push("---");
  return lines.join("\n") + "\n";
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    return v
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

interface ParsedScene {
  frontmatter: SceneFrontmatter | null;
  body: string;
}

export function parseScene(raw: string): ParsedScene {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: null, body: raw };
  const block = m[1];
  const body = m[2];

  const obj: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();
    if (valueRaw === "") {
      obj[key] = "";
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(valueRaw)) {
      obj[key] = Number(valueRaw);
      continue;
    }
    obj[key] = unquote(valueRaw);
  }

  if (obj.type !== SCENE_TYPE || obj.plugin !== PLUGIN_ID) {
    return { frontmatter: null, body };
  }

  const fm: SceneFrontmatter = {
    type: SCENE_TYPE,
    plugin: PLUGIN_ID,
    project: String(obj.project ?? ""),
    scene_id: String(obj.scene_id ?? ""),
    status: String(obj.status ?? ""),
    label: String(obj.label ?? ""),
    synopsis: String(obj.synopsis ?? ""),
    word_count: Number(obj.word_count ?? 0),
    updated: String(obj.updated ?? ""),
  };
  return { frontmatter: fm, body };
}

/** Scene file 의 frontmatter 블록만 통째로 갈아끼우고 body 는 보존. */
export function replaceSceneFrontmatter(
  raw: string,
  fm: SceneFrontmatter,
): string {
  const fmBlock = serializeScene(fm);
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return fmBlock + raw;
  return fmBlock + m[2];
}

function joinPath(folder: string, rel: string): string {
  const f = folder.replace(/\/+$/, "");
  const r = rel.replace(/^\/+/, "");
  return `${f}/${r}`;
}

export interface CreateSceneInput {
  /** 프로젝트 폴더 기준 상대 파일 경로 (예: "01-도입/01-노트북.md"). */
  file: string;
  project: string;
  sceneId: string;
  status: string;
  label: string;
  synopsis?: string;
  body?: string;
  updated?: string;
}

export const SceneIO = {
  /** 장면 파일을 읽고 frontmatter + body 를 반환. frontmatter 가 없거나 식별자가 다르면 null. */
  async read(
    vault: VaultAdapter,
    projectFolder: string,
    relFile: string,
  ): Promise<ParsedScene> {
    const path = joinPath(projectFolder, relFile);
    const raw = await vault.readFile(path);
    return parseScene(raw);
  },

  /** 장면 파일을 frontmatter + body 로 (재)작성. */
  async write(
    vault: VaultAdapter,
    projectFolder: string,
    relFile: string,
    fm: SceneFrontmatter,
    body: string,
  ): Promise<void> {
    const path = joinPath(projectFolder, relFile);
    const fmBlock = serializeScene(fm);
    await vault.writeFile(path, fmBlock + body);
  },

  /** 새 장면 파일을 생성하고 SceneFrontmatter 를 반환. */
  async create(
    vault: VaultAdapter,
    projectFolder: string,
    input: CreateSceneInput,
  ): Promise<SceneFrontmatter> {
    const fm: SceneFrontmatter = {
      type: SCENE_TYPE,
      plugin: PLUGIN_ID,
      project: input.project,
      scene_id: input.sceneId,
      status: input.status,
      label: input.label,
      synopsis: input.synopsis ?? "",
      word_count: 0,
      updated: input.updated ?? todayIso(),
    };
    const body = input.body ?? "";
    await SceneIO.write(vault, projectFolder, input.file, fm, body);
    return fm;
  },

  /** FrontmatterAdapter 로 단일 필드만 갱신. body 는 어댑터가 보존. */
  async updateFrontmatter(
    frontmatter: FrontmatterAdapter,
    projectFolder: string,
    relFile: string,
    mutator: (fm: Record<string, unknown>) => void,
  ): Promise<void> {
    const path = joinPath(projectFolder, relFile);
    await frontmatter.update(path, (fm) => {
      mutator(fm);
      fm.updated = todayIso();
    });
  },

  /** body 텍스트만 변경 (frontmatter 보존). */
  async writeBody(
    vault: VaultAdapter,
    frontmatter: FrontmatterAdapter,
    projectFolder: string,
    relFile: string,
    body: string,
    /** word_count 도 같이 업데이트할지. */
    wordCount?: number,
  ): Promise<void> {
    const path = joinPath(projectFolder, relFile);
    const raw = await vault.readFile(path);
    const m = raw.match(FRONTMATTER_RE);
    if (!m) {
      // frontmatter 없으면 body 만 통째로 덮어쓰기
      await vault.writeFile(path, body);
      return;
    }
    const fmBlock = raw.slice(0, raw.length - m[2].length);
    await vault.writeFile(path, fmBlock + body);
    if (wordCount !== undefined) {
      await frontmatter.update(path, (fm) => {
        fm.word_count = Math.max(0, wordCount | 0);
        fm.updated = todayIso();
      });
    }
  },
};
