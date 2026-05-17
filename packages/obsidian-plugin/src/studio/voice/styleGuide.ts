// styleGuide.ts — 작가 보이스 가드 캐시 read/write + stale 감지.
//
// 가드 파일 위치: <voice 폴더>/.style-guide.json (숨김 파일).
// Rust 측 voice_list_files 가 숨김파일을 필터링하므로, 가드 파일은 별도 read 로
// 절대경로를 합성해 접근한다.
//
// stale 판정:
//   - 가드의 sampleSignatures 배열을 현재 voice 폴더의 .md 파일 signature 와 비교.
//   - signature = `${name}|${modifiedMs}|${size}` — hash 까지 가지 않고 가벼운 키.
//   - 합집합/차집합 어느 쪽이라도 다르면 stale.
//
// v2: 14단계 심층 분석 (사용자 정의 프롬프트). v1 가드는 자동으로 stale 처리되어
// 재분석을 유도한다.

import { invoke } from "@tauri-apps/api/core";
import { voiceIO, type VoiceFileEntry } from "./voiceIO";

export const STYLE_GUIDE_FILENAME = ".style-guide.json";

export const STYLE_GUIDE_VERSION = 2 as const;

/** 14단계 심층 분석 — §11 "내 문체 DNA" 의 16개 하위 필드. */
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

/**
 * 14단계 심층 문체 분석 결과.
 * AI 가 작가의 글 샘플을 읽고 채워주는 한국어 자연어 + 구조화 데이터.
 */
export interface StyleGuideAxes {
  // §1 문체 첫인상 — 5개 키워드.
  firstImpression: string[];
  // §2 문장 호흡 분석.
  sentenceBreath: string;
  // §3 문장 구조 분석 — 반복되는 패턴.
  sentenceStructure: string;
  // §4 어휘 성향 분석.
  vocabularyTendency: string;
  // §5 사고 전개 방식 분석.
  thoughtFlow: string;
  // §6 독자와의 거리 분석.
  readerDistance: string;
  // §7 정서와 태도 분석.
  emotionAndAttitude: string;
  // §8 비유와 이미지 분석.
  metaphorAndImagery: string;
  // §9 문체의 강점.
  strengths: string;
  // §10 문체의 약점.
  weaknesses: string;
  // §11 내 문체 DNA — 16개 압축 필드.
  styleDna: StyleGuideDna;
  // §14 1,500자 이내 문체 지침 프롬프트 — 다른 대화창에서도 그대로 사용 가능.
  compressedPrompt: string;

  // === 레거시 5축 (rewriter / 미니 카드 표시용 호환 필드) ===
  tone: string;
  sentenceLength: string;
  endings: string;
  vocabulary: string;
  breath: string;
  summary: string;
}

export interface StyleGuideSampleSignature {
  name: string;
  modifiedMs: number;
  size: number;
}

export interface StyleGuide {
  version: typeof STYLE_GUIDE_VERSION;
  /** ISO. */
  analyzedAt: string;
  /** 분석 시 사용한 모델/공급자 라벨 (UI 표시용). */
  provider: string;
  /** 분석 입력 파일들의 signature. stale 판정에 사용. */
  sampleSignatures: StyleGuideSampleSignature[];
  /** 분석 결과. */
  guide: StyleGuideAxes;
}

function signatureOf(f: VoiceFileEntry): StyleGuideSampleSignature {
  return { name: f.name, modifiedMs: f.modifiedMs, size: f.size };
}

function sigKey(s: StyleGuideSampleSignature): string {
  return `${s.name}|${s.modifiedMs}|${s.size}`;
}

/** 가드 캐시 절대경로. 첫 호출 시 voice 폴더 생성을 트리거. */
async function guidePath(): Promise<string> {
  const dir = await voiceIO.path();
  return `${dir.replace(/\/+$/, "")}/${STYLE_GUIDE_FILENAME}`;
}

/** 가드 파일이 있으면 읽어서 반환. 없거나 파싱 실패면 null. */
export async function loadStyleGuide(): Promise<StyleGuide | null> {
  const path = await guidePath();
  try {
    const raw = await invoke<string>("vault_read_file", { path });
    const parsed = JSON.parse(raw) as Partial<StyleGuide>;
    if (!parsed || parsed.version !== STYLE_GUIDE_VERSION) return null;
    if (!parsed.guide || !Array.isArray(parsed.sampleSignatures)) return null;
    return parsed as StyleGuide;
  } catch {
    return null;
  }
}

/** 가드를 디스크에 저장. 디렉토리는 voice_path 가 보장. */
export async function saveStyleGuide(guide: StyleGuide): Promise<void> {
  const path = await guidePath();
  const json = JSON.stringify(guide, null, 2) + "\n";
  await invoke("vault_write_file", { path, content: json });
}

/** 가드 파일 삭제 (재분석 강제 등). */
export async function deleteStyleGuide(): Promise<void> {
  const path = await guidePath();
  try {
    await invoke("vault_delete_file", { path });
  } catch {
    /* swallow */
  }
}

export interface FreshnessReport {
  hasGuide: boolean;
  isStale: boolean;
  message: string;
  files: VoiceFileEntry[];
  guide: StyleGuide | null;
}

export async function checkFreshness(): Promise<FreshnessReport> {
  const [files, guide] = await Promise.all([
    voiceIO.listFiles(),
    loadStyleGuide(),
  ]);
  if (!guide) {
    return {
      hasGuide: false,
      isStale: files.length > 0,
      message:
        files.length === 0
          ? "내 문체 폴더가 비어 있습니다. 작가 본인의 글 .md 파일을 넣은 뒤 '재분석' 을 눌러주세요."
          : `${files.length}개 파일이 있지만 분석되지 않았습니다. '재분석' 을 눌러 가드를 만들어주세요.`,
      files,
      guide: null,
    };
  }
  const currentKeys = new Set(files.map((f) => sigKey(signatureOf(f))));
  const cachedKeys = new Set(guide.sampleSignatures.map(sigKey));
  const sameSize = currentKeys.size === cachedKeys.size;
  let allMatch = sameSize;
  if (allMatch) {
    for (const k of currentKeys) {
      if (!cachedKeys.has(k)) {
        allMatch = false;
        break;
      }
    }
  }
  const isStale = !allMatch;
  return {
    hasGuide: true,
    isStale,
    message: isStale
      ? "내 문체 폴더에 변경이 감지되어 가드가 오래되었습니다. '재분석' 을 권장합니다."
      : `가드가 최신입니다 (${new Date(guide.analyzedAt).toLocaleString("ko-KR")} 분석).`,
    files,
    guide,
  };
}

export function buildSignatures(
  files: VoiceFileEntry[],
): StyleGuideSampleSignature[] {
  return files.map(signatureOf);
}
