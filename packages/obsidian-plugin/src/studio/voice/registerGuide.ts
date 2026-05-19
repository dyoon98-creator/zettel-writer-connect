// registerGuide.ts — register-specific style-guide delta loader/merge.
//
// B3.2 intentionally does not wire this into QuickComposeModal yet. Compose-time
// behavior remains read-only: load a JSON delta from
// <voice folder>/.register-guides/<register>.json and append it to the base
// compressedPrompt without replacing the base voice DNA.

import { invoke } from "../tauriShims/core";

export const REGISTER_GUIDE_VERSION = 1 as const;
export const REGISTER_GUIDE_DIR = ".register-guides";
export const STYLE_GUIDE_FILENAME = ".style-guide.json";
export const STYLE_GUIDE_VERSION = 2 as const;

export const CANONICAL_REGISTERS = [
  "email",
  "kakao",
  "telegram",
  "report",
  "summary",
  "memo",
] as const;

export type Register = (typeof CANONICAL_REGISTERS)[number];

export const REGISTER_GUIDE_OVERRIDE_KEYS = [
  "sentenceBreath",
  "readerDistance",
  "emotionAndAttitude",
  "tone",
  "sentenceLength",
  "endings",
] as const;

export type RegisterGuideOverrideKey =
  (typeof REGISTER_GUIDE_OVERRIDE_KEYS)[number];

export interface StyleGuideDna {
  name: string;
  coreImpression: string;
  sentenceBreath: string;
  sentenceStructure: string;
  vocabulary: string;
  thoughtFlow: string;
  emotionTemperature: string;
  readerDistance: string;
  frequentSentencePatterns: string;
  frequentThoughtPatterns: string;
  strengths: string;
  weaknesses: string;
  keep: string;
  reduce: string;
  nonNegotiable: string;
  oneLineDefinition: string;
}

export interface StyleGuideAxes {
  firstImpression: string[];
  sentenceBreath: string;
  sentenceStructure: string;
  vocabularyTendency: string;
  thoughtFlow: string;
  readerDistance: string;
  emotionAndAttitude: string;
  metaphorAndImagery: string;
  strengths: string;
  weaknesses: string;
  styleDna: StyleGuideDna;
  compressedPrompt: string;
  tone: string;
  sentenceLength: string;
  endings: string;
  vocabulary: string;
  breath: string;
  summary: string;
}

interface StyleGuideCache {
  version: typeof STYLE_GUIDE_VERSION;
  guide: StyleGuideAxes;
  sampleSignatures: unknown[];
}

export interface RegisterGuideDelta {
  version: typeof REGISTER_GUIDE_VERSION;
  register: Register;
  addedInstructions?: string;
  overrides?: Partial<Record<RegisterGuideOverrideKey, string>>;
  note?: string;
  updatedAt?: string;
}

const REGISTER_SET = new Set<string>(CANONICAL_REGISTERS);
const OVERRIDE_KEY_SET = new Set<string>(REGISTER_GUIDE_OVERRIDE_KEYS);
const FORBIDDEN_OVERRIDE_KEYS = new Set<string>([
  "styleDna",
  "compressedPrompt",
]);

export function isRegister(value: string): value is Register {
  return REGISTER_SET.has(value);
}

function warnIgnoredOverride(key: string): void {
  console.warn(`[registerGuide] ignored unsupported override key: ${key}`);
}

async function voicePath(): Promise<string> {
  const { voiceIO } = (await import("./voiceIO")) as {
    voiceIO: { path: () => Promise<string> };
  };
  return voiceIO.path();
}

async function registerGuidePath(register: Register): Promise<string> {
  const dir = await voicePath();
  return `${dir.replace(/\/+$/, "")}/${REGISTER_GUIDE_DIR}/${register}.json`;
}

async function styleGuidePath(): Promise<string> {
  const dir = await voicePath();
  return `${dir.replace(/\/+$/, "")}/${STYLE_GUIDE_FILENAME}`;
}

function parseStringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseOverrides(
  value: unknown,
): Partial<Record<RegisterGuideOverrideKey, string>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: Partial<Record<RegisterGuideOverrideKey, string>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_OVERRIDE_KEYS.has(key) || !OVERRIDE_KEY_SET.has(key)) {
      warnIgnoredOverride(key);
      continue;
    }
    if (typeof raw !== "string") {
      warnIgnoredOverride(key);
      continue;
    }
    const trimmed = raw.trim();
    if (trimmed) {
      result[key as RegisterGuideOverrideKey] = trimmed;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseRegisterGuide(
  raw: string,
  requestedRegister: Register,
): RegisterGuideDelta | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.version !== REGISTER_GUIDE_VERSION) return null;
  if (obj.register !== requestedRegister) return null;
  if (typeof obj.register !== "string" || !isRegister(obj.register)) return null;

  const delta: RegisterGuideDelta = {
    version: REGISTER_GUIDE_VERSION,
    register: obj.register,
  };

  const addedInstructions = parseStringField(obj.addedInstructions);
  if (addedInstructions) delta.addedInstructions = addedInstructions;

  const overrides = parseOverrides(obj.overrides);
  if (overrides) delta.overrides = overrides;

  const note = parseStringField(obj.note);
  if (note) delta.note = note;

  const updatedAt = parseStringField(obj.updatedAt);
  if (updatedAt) delta.updatedAt = updatedAt;

  return delta;
}

function parseStyleGuide(raw: string): StyleGuideCache | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StyleGuideCache>;
    if (!parsed || parsed.version !== STYLE_GUIDE_VERSION) return null;
    if (!parsed.guide || !Array.isArray(parsed.sampleSignatures)) return null;
    return parsed as StyleGuideCache;
  } catch {
    return null;
  }
}

export async function loadRegisterGuide(
  register: string,
): Promise<RegisterGuideDelta | null> {
  if (!isRegister(register)) return null;

  try {
    const path = await registerGuidePath(register);
    const raw = await invoke<string>("vault_read_file", { path });
    return parseRegisterGuide(raw, register);
  } catch {
    return null;
  }
}

function registerGuideLines(delta: RegisterGuideDelta): string[] {
  const lines = [`## 형식별 보정(${delta.register})`];
  if (delta.addedInstructions) lines.push(delta.addedInstructions);

  const overrides = delta.overrides ?? {};
  for (const key of REGISTER_GUIDE_OVERRIDE_KEYS) {
    const value = overrides[key];
    if (value) lines.push(`원래 ${key} → 이 형식에선 ${value}`);
  }

  return lines;
}

export function mergeRegisterGuide(
  base: StyleGuideAxes,
  delta: RegisterGuideDelta | null,
): StyleGuideAxes {
  if (!delta) return base;

  const lines = registerGuideLines(delta);
  if (lines.length <= 1) return base;

  return {
    ...base,
    compressedPrompt: `${base.compressedPrompt.trimEnd()}\n\n${lines.join("\n")}`,
  };
}

export async function loadRegisterStyleGuide(
  register: string,
): Promise<StyleGuideAxes | null> {
  if (!isRegister(register)) return null;

  let base: StyleGuideCache | null = null;
  try {
    const path = await styleGuidePath();
    const raw = await invoke<string>("vault_read_file", { path });
    base = parseStyleGuide(raw);
  } catch {
    return null;
  }
  if (!base) return null;

  const delta = await loadRegisterGuide(register);
  return mergeRegisterGuide(base.guide, delta);
}
