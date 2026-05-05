// 테스트 픽스처 — 작은 ProjectMeta + BinderTree + 장면 본문.

import {
  BINDER_SCHEMA,
  PROJECT_SCHEMA,
  SCENE_TYPE,
  type BinderTree,
  type ProjectMeta,
} from "@ai-manuscript-studio/core";

export const FIXTURE_VAULT_PATH = "/tmp/test-vault";
export const FIXTURE_PROJECT_SLUG = "demo-project";
export const FIXTURE_PROJECT_FOLDER = `${FIXTURE_VAULT_PATH}/${FIXTURE_PROJECT_SLUG}`;

export function makeMeta(overrides?: Partial<ProjectMeta>): ProjectMeta {
  return {
    schema: PROJECT_SCHEMA,
    id: FIXTURE_PROJECT_SLUG,
    title: "데모 프로젝트",
    genre: "essay",
    status: "drafting",
    label: "manuscript",
    wordGoal: 10000,
    currentWords: 1234,
    targetReader: "30대 직장인",
    coreMessage: "자기다움을 회복하는 글쓰기",
    createdAt: "2026-01-01",
    updatedAt: "2026-04-28",
    customStatuses: [
      { id: "todo", name: "To Do", color: "#888888" },
      { id: "draft", name: "초안", color: "#e8a", default: true },
      { id: "done", name: "완료", color: "#7c5" },
    ],
    customLabels: [
      { id: "manuscript", name: "원고", color: "#88a", default: true },
      { id: "scene", name: "장면", color: "#aac" },
    ],
    sourceNotes: ["[[2 Permanent/1a 메모]]", "[[1 Literature/책]]"],
    plugin: "ai-manuscript-studio",
    ...overrides,
  };
}

export function makeBinder(overrides?: Partial<BinderTree>): BinderTree {
  return {
    schema: BINDER_SCHEMA,
    root: [
      {
        id: "folder-1",
        type: "folder",
        title: "1부",
        label: "manuscript",
        status: "draft",
        synopsis: "도입부",
        children: [
          {
            id: "scene-1",
            type: "document",
            title: "첫 장면",
            file: "1부/scene-1.md",
            label: "scene",
            status: "draft",
            synopsis: "주인공 등장",
            wordCount: 250,
          },
          {
            id: "scene-2",
            type: "document",
            title: "두 번째 장면",
            file: "1부/scene-2.md",
            label: "scene",
            status: "todo",
            synopsis: "갈등 발생",
            wordCount: 180,
          },
        ],
      },
      {
        id: "folder-2",
        type: "folder",
        title: "2부",
        label: "manuscript",
        status: "todo",
        synopsis: "전개",
        children: [],
      },
    ],
    ...overrides,
  };
}

export function makeSceneFile(
  sceneId: string,
  body: string,
  status = "draft",
  label = "scene",
): string {
  return [
    "---",
    `type: ${SCENE_TYPE}`,
    "plugin: ai-manuscript-studio",
    `project: ${FIXTURE_PROJECT_SLUG}`,
    `scene_id: ${sceneId}`,
    `status: ${status}`,
    `label: ${label}`,
    "synopsis: \"\"",
    "word_count: 0",
    "updated: 2026-04-28",
    "---",
    "",
    body,
  ].join("\n");
}
