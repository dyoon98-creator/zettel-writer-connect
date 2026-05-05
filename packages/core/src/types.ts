// AI 원고실 — shared types

export const PLUGIN_ID = "ai-manuscript-studio";
export const SCHEMA_VERSION = 1;

export type ProjectStatus =
  | "idea"
  | "planning"
  | "outline"
  | "researching"
  | "drafting"
  | "feedback"
  | "revising"
  | "final"
  | "published";

export const STATUS_LABEL_KO: Record<ProjectStatus, string> = {
  idea: "아이디어",
  planning: "기획 중",
  outline: "뼈대 작성 중",
  researching: "자료 수집 중",
  drafting: "초안 작성 중",
  feedback: "피드백 중",
  revising: "퇴고 중",
  final: "완성",
  published: "발행",
};

export type Genre = "essay" | "practical" | "youtube" | "lecture" | "world";

export const GENRE_LABEL_KO: Record<Genre, string> = {
  essay: "에세이",
  practical: "실용서",
  youtube: "유튜브 대본",
  lecture: "강의안",
  world: "세계관/웹소설",
};

export interface WritingProjectFrontmatter {
  type: "writing";
  status: ProjectStatus;
  genre: Genre;
  created: string;
  updated: string;
  word_goal: number;
  current_words: number;
  target_reader: string;
  core_message: string;
  source_notes: string[];
  plugin: typeof PLUGIN_ID;
  schema_version: number;
  tags: string[];
}
