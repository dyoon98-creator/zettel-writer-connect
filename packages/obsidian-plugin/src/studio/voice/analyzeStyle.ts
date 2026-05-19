// analyzeStyle.ts — 글로벌 voice 폴더의 .md 들을 AI 로 분석해 StyleGuide 를 생성·저장.
//
// v2: 사용자 정의 14단계 심층 프롬프트를 그대로 사용한다.
// 흐름:
//   1) voice_list_files / voice_read_file 로 본문들 수집 (각 6,000자로 clip).
//   2) USER_PROMPT_BODY (14단계 프롬프트) + 샘플 + JSON 출력 스키마 조립.
//   3) startAiInvocation 호출, done.fullText 파싱.
//   4) 첫 `{...}` 블록을 JSON 으로 파싱 → StyleGuideAxes 로 검증.
//   5) sampleSignatures 와 함께 saveStyleGuide.

import { startAiInvocation } from "../ai/streamingHandle";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";

import { voiceIO, type VoiceFileEntry } from "./voiceIO";
import {
  buildSignatures,
  saveStyleGuide,
  STYLE_GUIDE_VERSION,
  type StyleGuide,
  type StyleGuideAxes,
  type StyleGuideDna,
} from "./styleGuide";

const MAX_CHARS_PER_FILE = 6000;
const MAX_FILES = 8;
const TIMEOUT_SECS = 360;

/**
 * 사용자가 지정한 14단계 심층 문체 분석 프롬프트.
 * "분석할 내 글 샘플" 블록 직전까지의 본문을 그대로 보존한다.
 */
const USER_PROMPT_BODY = `당신은 20년 경력의 출판 편집자이자 문체 분석가이며, 동시에 작가의 문체를 일관되게 재현하는 글쓰기 코치입니다.

아래에 제공하는 글은 내가 직접 쓴 문체 샘플입니다.
당신의 목표는 이 글을 단순히 평가하는 것이 아니라, 앞으로 내가 작성한 초안을 "내 문체"로 다시 다듬을 수 있도록 문체의 특징을 정밀하게 추출하고, 재사용 가능한 문체 규칙으로 압축하는 것입니다.

중요한 원칙:
- 특정 유명 작가의 문체를 흉내 내지 마세요.
- 내가 제공한 글에서 드러나는 나만의 문체를 분석하세요.
- 칭찬 위주로 말하지 말고, 실제 문장 습관과 리듬을 근거로 분석하세요.
- 추상적인 표현보다 실전에서 다시 적용 가능한 규칙으로 정리하세요.
- 이후 내가 초안을 제공하면, 이 분석 결과를 기준으로 내 문체에 맞게 고쳐야 합니다.

다음 순서로 작업해 주세요.

1. 문체 첫인상
내 글을 처음 읽었을 때 느껴지는 인상을 5개의 키워드로 정리해 주세요.
예: 사색적, 실용적, 고백적, 단정적, 친근함, 비판적, 철학적, 대화형 등

2. 문장 호흡 분석
- 문장이 짧은 편인지 긴 편인지
- 단문과 복문의 비율이 어떤지
- 문장 리듬이 빠른지 느린지
- 문장이 설명하듯 흐르는지, 생각하듯 흐르는지
- 쉼표, 접속사, 짧은 단정문을 어떻게 사용하는지 분석해 주세요.

3. 문장 구조 분석
내 글에서 반복되는 문장 패턴을 찾아 주세요.
예:
- "A는 B가 아니다. 오히려 C다."
- "문제는 A가 아니라 B다."
- "나는 이것을 A라고 본다."
- "결국 중요한 것은 A다."
- "처음에는 A처럼 보인다. 하지만 실제로는 B다."

반드시 실제 샘플에서 발견되는 패턴을 중심으로 정리해 주세요.

4. 어휘 성향 분석
- 쉬운 일상어와 전문어의 비율
- 추상어와 구체어의 비율
- 자주 쓰는 핵심 단어
- 자주 쓰는 연결어
- 자주 쓰는 감정 표현
- 피하고 있는 표현 또는 잘 쓰지 않는 표현
을 정리해 주세요.

5. 사고 전개 방식 분석
내 글이 어떤 방식으로 전개되는지 분석해 주세요.
다음 중 두드러지는 방식을 찾아 설명해 주세요.
- 경험에서 개념으로 이동
- 개념에서 사례로 이동
- 질문에서 통찰로 이동
- 문제 제기 후 구조화
- 반론을 예상한 뒤 재정의
- 개인적 감정에서 보편적 메시지로 확장
- 기술적 사실에서 삶의 태도로 확장

6. 독자와의 거리 분석
내 글 속 화자는 독자와 어떤 거리에 서 있는지 판단해 주세요.
다음 유형 중 가장 가까운 것을 고르고 이유를 설명해 주세요.
- 강단 위의 강사
- 옆자리의 선배
- 혼자 사유하는 작가
- 독자를 데리고 걷는 안내자
- 문제를 함께 푸는 동료
- 경험을 고백하는 사람

7. 정서와 태도 분석
- 글의 감정 온도는 따뜻한지, 차가운지, 건조한지, 뜨거운지
- 감정을 직접 말하는지, 장면이나 논리 뒤에 숨기는지
- 독자를 안심시키는지, 자극하는지, 설득하는지, 흔드는지
- 냉정함과 인간적인 온도의 비율이 어떤지 분석해 주세요.

8. 비유와 이미지 분석
- 비유를 자주 쓰는지
- 비유가 생활적인지, 기술적인지, 철학적인지, 문학적인지
- 추상 개념을 설명할 때 어떤 이미지로 바꾸는지
- 기억에 남는 상징이나 은유 패턴이 있는지 정리해 주세요.

9. 문체의 강점
내 문체가 독자에게 매력적으로 느껴질 지점을 구체적으로 정리해 주세요.
단, 막연한 칭찬은 하지 말고 실제 문장 습관과 연결해 설명해 주세요.

10. 문체의 약점
내 문체가 반복될 때 생길 수 있는 문제를 냉정하게 지적해 주세요.
예:
- 관념어가 많아질 위험
- 문장이 길어질 위험
- 설명이 앞서 감각이 약해질 위험
- 독자보다 생각이 먼저 달려갈 위험
- 비슷한 문장 리듬이 반복될 위험
- 결론이 추상적으로 닫힐 위험

11. 내 문체 DNA 생성
아래 형식으로 내 문체를 압축해 주세요.

[내 문체 DNA]
- 문체 이름:
- 핵심 인상:
- 문장 호흡:
- 문장 구조:
- 어휘 성향:
- 사고 전개:
- 감정 온도:
- 독자와의 거리:
- 자주 쓰는 문장 패턴:
- 자주 쓰는 사고 패턴:
- 강점:
- 약점:
- 유지해야 할 것:
- 줄여야 할 것:
- 절대 잃으면 안 되는 특징:
- 한 문장 정의:

12. 내 문체 변환 규칙 만들기
앞으로 내가 초안을 제공하면, 당신은 아래 규칙에 따라 글을 고쳐야 합니다.

[변환 규칙]
- 초안의 주제와 메시지는 유지한다.
- 문장을 내 문체의 호흡에 맞게 다시 배열한다.
- 너무 일반적인 문장은 내 식의 문제 제기나 재정의 문장으로 바꾼다.
- 추상적인 문장은 필요할 경우 구체적 사례나 비유를 덧붙인다.
- 설명이 길어지면 문단을 나누고 리듬을 만든다.
- 내 문체의 대표 문장 패턴을 자연스럽게 반영한다.
- 과장된 표현, 광고 문구, AI스러운 문장은 제거한다.
- 지나치게 매끈한 문장보다, 사유의 흔적이 느껴지는 문장으로 다듬는다.
- 독자를 가르치려 들기보다 함께 생각하는 태도를 유지한다.
- 마지막 문장은 가능하면 여운, 통찰, 방향 제시 중 하나로 마무리한다.

13. 변환 출력 형식
앞으로 내가 초안을 주면 다음 형식으로 답해 주세요.

[1] 문체 진단
- 이 초안이 내 문체와 맞는 부분
- 내 문체에서 벗어난 부분

[2] 수정 방향
- 무엇을 살리고
- 무엇을 줄이고
- 어떤 리듬으로 바꿀지

[3] 내 문체로 다듬은 수정안
초안을 내 문체에 맞게 전체 수정합니다.

[4] 핵심 수정 포인트
수정 이유를 5개 이내로 짧게 정리합니다.

14. 최종 압축 프롬프트
마지막에는 앞으로 다른 대화창에서도 바로 사용할 수 있도록,
내 문체를 1,500자 이내의 "문체 지침 프롬프트"로 압축해 주세요.`;

/**
 * AI 가 응답해야 할 JSON 스키마 — 14단계 분석 결과를 단일 객체로 압축.
 * §12 (변환 규칙) 와 §13 (변환 출력 형식) 은 사용자가 정의한 고정 텍스트이므로
 * voiceRewriter 가 상수로 보유한다 — 여기서는 §1~§11 + §14 만 캡처.
 */
const OUTPUT_SCHEMA_INSTRUCTION = `# 출력 형식 (절대)
위 14단계 분석 결과를 다음 단일 JSON 객체로만 출력하세요. **JSON 외에 어떤 텍스트도 붙이지 마세요 — 코드펜스(\`\`\`), 머리말, 꼬리말, 주석 일체 금지.**

문자열 값 안에서는 줄바꿈을 \\n 으로 이스케이프하고, 따옴표는 \\" 로 이스케이프합니다.

스키마:
{
  "firstImpression": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "sentenceBreath": "§2 분석 (한국어 문단)",
  "sentenceStructure": "§3 분석 — 발견된 반복 패턴 위주",
  "vocabularyTendency": "§4 분석",
  "thoughtFlow": "§5 분석 — 두드러지는 전개 방식",
  "readerDistance": "§6 분석 — 화자 유형 + 이유",
  "emotionAndAttitude": "§7 분석",
  "metaphorAndImagery": "§8 분석",
  "strengths": "§9 — 실제 문장 습관과 연결한 구체적 정리",
  "weaknesses": "§10 — 냉정한 위험 지적",
  "styleDna": {
    "name": "§11 - 문체 이름",
    "coreImpression": "§11 - 핵심 인상",
    "sentenceBreath": "§11 - 문장 호흡",
    "sentenceStructure": "§11 - 문장 구조",
    "vocabulary": "§11 - 어휘 성향",
    "thoughtFlow": "§11 - 사고 전개",
    "emotionTemperature": "§11 - 감정 온도",
    "readerDistance": "§11 - 독자와의 거리",
    "frequentSentencePatterns": "§11 - 자주 쓰는 문장 패턴",
    "frequentThoughtPatterns": "§11 - 자주 쓰는 사고 패턴",
    "strengths": "§11 - 강점",
    "weaknesses": "§11 - 약점",
    "keep": "§11 - 유지해야 할 것",
    "reduce": "§11 - 줄여야 할 것",
    "nonNegotiable": "§11 - 절대 잃으면 안 되는 특징",
    "oneLineDefinition": "§11 - 한 문장 정의"
  },
  "compressedPrompt": "§14 — 1,500자 이내의 문체 지침 프롬프트. 다른 대화창에서 그대로 시스템 프롬프트로 쓸 수 있도록 자족적으로.",
  "tone": "레거시 호환: §11.coreImpression 또는 §7 의 어조 한 줄",
  "sentenceLength": "레거시 호환: §11.sentenceBreath 한 줄",
  "endings": "레거시 호환: 어미·종결 패턴 한 줄 (다체/지/야/습니다 등 비율)",
  "vocabulary": "레거시 호환: §11.vocabulary 한 줄",
  "breath": "레거시 호환: 단락 호흡 한 줄",
  "summary": "레거시 호환: §11.oneLineDefinition + §14 발췌 1단락"
}`;

interface ClippedSample {
  name: string;
  body: string;
  truncated: boolean;
}

type VoiceFileReader = (absPath: string) => Promise<string>;

function isVoiceExcludedFrontmatter(raw: string): boolean {
  const text = raw.replace(/^\uFEFF/, "");
  const firstLineEnd = text.indexOf("\n");
  const firstLine = (firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)).trim();
  if (firstLine !== "---") return false;

  const rest = firstLineEnd === -1 ? "" : text.slice(firstLineEnd + 1);
  const closingMatch = rest.match(/^---\s*$/m);
  if (!closingMatch || closingMatch.index === undefined) return false;

  const frontmatter = rest.slice(0, closingMatch.index);
  return frontmatter
    .split(/\r?\n/)
    .some((line) => /^\s*voice-exclude\s*:\s*(?:true|"true"|'true')\s*(?:#.*)?$/i.test(line));
}

async function filterVoiceIncludedFiles(
  files: VoiceFileEntry[],
  readFile: VoiceFileReader = voiceIO.readFile,
): Promise<VoiceFileEntry[]> {
  const included: VoiceFileEntry[] = [];
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".md")) {
      included.push(f);
      continue;
    }
    try {
      const raw = await readFile(f.absPath);
      if (!isVoiceExcludedFrontmatter(raw)) included.push(f);
    } catch {
      included.push(f);
    }
  }
  return included;
}

async function loadSamples(
  files: VoiceFileEntry[],
  readFile: VoiceFileReader = voiceIO.readFile,
): Promise<ClippedSample[]> {
  const out: ClippedSample[] = [];
  for (const f of files.slice(0, MAX_FILES)) {
    try {
      const raw = await readFile(f.absPath);
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      const truncated = trimmed.length > MAX_CHARS_PER_FILE;
      out.push({
        name: f.name,
        body: truncated ? trimmed.slice(0, MAX_CHARS_PER_FILE) : trimmed,
        truncated,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[analyzeStyle] read 실패 (${f.name}):`, err);
    }
  }
  return out;
}

function assemblePrompt(samples: ClippedSample[]): string {
  // 사용자 프롬프트 끝의 "분석할 내 글 샘플:" 블록을 실제 샘플로 채워 넣는다.
  const samplesBlock = samples
    .map(
      (s, i) =>
        `## 글 ${i + 1} — ${s.name}${s.truncated ? " (앞부분만 발췌)" : ""}\n${s.body}`,
    )
    .join("\n\n");
  return `${USER_PROMPT_BODY}

분석할 내 글 샘플:
"""
${samplesBlock}
"""

${OUTPUT_SCHEMA_INSTRUCTION}`;
}

/** AI 응답에서 첫 `{...}` 블록을 추출해 파싱. 균형 잡힌 중괄호 매칭. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseDna(raw: unknown): StyleGuideDna | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const need: (keyof StyleGuideDna)[] = [
    "name",
    "coreImpression",
    "sentenceBreath",
    "sentenceStructure",
    "vocabulary",
    "thoughtFlow",
    "emotionTemperature",
    "readerDistance",
    "frequentSentencePatterns",
    "frequentThoughtPatterns",
    "strengths",
    "weaknesses",
    "keep",
    "reduce",
    "nonNegotiable",
    "oneLineDefinition",
  ];
  const out: Partial<StyleGuideDna> = {};
  for (const k of need) {
    const v = r[k];
    if (typeof v !== "string" || v.trim().length === 0) return null;
    out[k] = v.trim();
  }
  return out as StyleGuideDna;
}

function parseAxes(raw: string): StyleGuideAxes | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;

  // §1 — 5 키워드 배열.
  const fi = r.firstImpression;
  if (!Array.isArray(fi) || fi.length === 0) return null;
  const firstImpression = fi
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
  if (firstImpression.length === 0) return null;

  // §11 DNA — 16 필드 모두 필요.
  const styleDna = parseDna(r.styleDna);
  if (!styleDna) return null;

  // 그 외 필수 문자열 필드.
  const stringFields: (keyof StyleGuideAxes)[] = [
    "sentenceBreath",
    "sentenceStructure",
    "vocabularyTendency",
    "thoughtFlow",
    "readerDistance",
    "emotionAndAttitude",
    "metaphorAndImagery",
    "strengths",
    "weaknesses",
    "compressedPrompt",
    "tone",
    "sentenceLength",
    "endings",
    "vocabulary",
    "breath",
    "summary",
  ];
  const out: Partial<StyleGuideAxes> = {
    firstImpression,
    styleDna,
  };
  for (const k of stringFields) {
    const v = r[k as string];
    if (typeof v !== "string" || v.trim().length === 0) return null;
    (out as Record<string, unknown>)[k] = v.trim();
  }
  return out as StyleGuideAxes;
}

function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export interface AnalyzeStyleResult {
  guide: StyleGuide;
  durationMs: number;
}

export async function analyzeStyle(): Promise<AnalyzeStyleResult | null> {
  const settings = useSettingsStore.getState().settings;
  if (settings.aiProvider === "mock") {
    tauriNoticeAdapter.warn(
      "AI 공급자가 mock 으로 설정되어 있어 보이스 분석을 실행할 수 없습니다.",
    );
    return null;
  }
  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;
  if (!binaryPath.trim()) {
    tauriNoticeAdapter.error(
      "Codex/Claude Code CLI 경로가 비어 있습니다. 설정에서 경로를 입력하세요.",
    );
    return null;
  }

  const files = await voiceIO.listFiles();
  if (files.length === 0) {
    tauriNoticeAdapter.warn(
      "내 문체 폴더에 분석할 .md 파일이 없습니다. 폴더를 열어 글을 넣어주세요.",
    );
    return null;
  }
  const includedFiles = await filterVoiceIncludedFiles(files);
  const samples = await loadSamples(includedFiles);
  if (samples.length === 0) {
    tauriNoticeAdapter.warn("읽을 수 있는 본문이 없습니다.");
    return null;
  }

  const prompt = assemblePrompt(samples);
  const handle = startAiInvocation({
    provider: settings.aiProvider,
    binaryPath,
    extraArgs: splitArgs(settings.codexExtraArgs),
    prompt,
    timeoutSecs: TIMEOUT_SECS,
  });

  // 토큰 소비 — backpressure 회피.
  void (async () => {
    try {
      for await (const _ of handle.tokens()) {
        /* discard */
      }
    } catch {
      /* swallow */
    }
  })();

  try {
    const result = await handle.done;
    const axes = parseAxes(result.fullText);
    if (!axes) {
      tauriNoticeAdapter.error(
        "AI 응답에서 가드 JSON 을 추출하지 못했습니다 (14단계 분석 스키마 누락 가능). 다른 모델로 재시도하거나 설정을 확인하세요.",
      );
      return null;
    }
    const guide: StyleGuide = {
      version: STYLE_GUIDE_VERSION,
      analyzedAt: new Date().toISOString(),
      provider: settings.aiProvider,
      sampleSignatures: buildSignatures(includedFiles),
      guide: axes,
    };
    await saveStyleGuide(guide);
    tauriNoticeAdapter.info(
      `보이스 가드를 갱신했습니다 (${samples.length}개 글, ${(result.durationMs / 1000).toFixed(1)}초).`,
    );
    return { guide, durationMs: result.durationMs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    tauriNoticeAdapter.error(`보이스 분석 실패: ${msg}`);
    return null;
  }
}

// 테스트용 export.
export const _internal = {
  extractJsonObject,
  parseAxes,
  assemblePrompt,
  USER_PROMPT_BODY,
  isVoiceExcludedFrontmatter,
  filterVoiceIncludedFiles,
  loadSamples,
};
