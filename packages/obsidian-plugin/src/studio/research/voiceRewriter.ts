// voiceRewriter.ts — 선택한 리서치 본문을 작가의 문체로 다시 써서 활성 에디터에 삽입.
//
// 데이터 흐름:
//  1. 호출자가 선택한 텍스트 + 활성 docId 를 넘김.
//  2. 활성 장면 + 최근 저장된 장면 본문을 보이스 샘플로 모음 (각 2000자 컷).
//  3. Codex/Claude CLI 호출 — 시스템 프롬프트로 "결과만, 사족 금지" 강제.
//  4. 토큰 스트림 도착 시마다 editorRegistry.insertAtCursor 로 즉시 삽입.
//     (IME 조합 중이면 큐잉, compositionend 후 flush.)

import * as editorRegistry from "../editor/editorRegistry";
import { startAiInvocation } from "../ai/streamingHandle";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";
import { useProjectStore } from "../state/projectStore";
import { loadStyleGuide, type StyleGuide } from "../voice/styleGuide";

export interface RewriteSelectionInput {
  /** 활성 에디터의 docId — editorRegistry 에 등록되어 있어야 함. */
  activeDocId: string;
  /** 사용자가 ResearchItemView 미리보기에서 선택한 텍스트. */
  selectionText: string;
  /** 어떤 리서치에서 가져왔는지 — 토스트/에러용 (선택). */
  researchTitle?: string;
}

const VOICE_MAX_CHARS_PER_SAMPLE = 2000;
const MAX_VOICE_SAMPLES = 3; // 활성 장면 + 최근 2개.
const TIMEOUT_SECS = 180;

/**
 * 사용자 정의 14단계 문체 분석 프롬프트의 §12 (변환 규칙).
 * 분석 결과와 함께 rewriter 의 시스템 프롬프트로 주입한다.
 */
const TRANSFORM_RULES = `[변환 규칙]
- 초안의 주제와 메시지는 유지한다.
- 문장을 내 문체의 호흡에 맞게 다시 배열한다.
- 너무 일반적인 문장은 내 식의 문제 제기나 재정의 문장으로 바꾼다.
- 추상적인 문장은 필요할 경우 구체적 사례나 비유를 덧붙인다.
- 설명이 길어지면 문단을 나누고 리듬을 만든다.
- 내 문체의 대표 문장 패턴을 자연스럽게 반영한다.
- 과장된 표현, 광고 문구, AI스러운 문장은 제거한다.
- 지나치게 매끈한 문장보다, 사유의 흔적이 느껴지는 문장으로 다듬는다.
- 독자를 가르치려 들기보다 함께 생각하는 태도를 유지한다.
- 마지막 문장은 가능하면 여운, 통찰, 방향 제시 중 하나로 마무리한다.`;

const SYSTEM_PROMPT = `당신은 사용자의 글을 사용자의 문체 그대로 다시 쓰는 어시스턴트입니다.

# 절대 규칙
- 출력은 다시 쓴 본문 그 자체뿐. 사족·해설·"다시 썼습니다" 같은 메타 발화 금지.
- 마크다운 펜스(\`\`\`) 금지, 인용 부호 금지, [1] [2] [3] [4] 같은 섹션 라벨 금지.
- 의미는 보존하되 표현은 사용자 글쓰기 스타일로 자연스럽게 녹임.
- 선택 텍스트가 사실 진술을 포함하면 사실은 보존, 표현만 변환.

${TRANSFORM_RULES}`;

function splitArgs(s: string): string[] {
  return s.split(/\s+/).map((x) => x.trim()).filter((x) => x.length > 0);
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

/** 활성 장면 + 최근 저장된 장면 본문에서 보이스 샘플을 추출. */
function collectVoiceSamples(activeDocId: string): string[] {
  const ps = useProjectStore.getState();
  const samples: { id: string; body: string; lastSavedAt: number }[] = [];

  // 활성 장면을 0순위로.
  const active = ps.sceneCache[activeDocId];
  if (active) {
    const body = active.draft ?? active.body;
    if (body.trim().length > 0) {
      samples.push({
        id: activeDocId,
        body,
        lastSavedAt: active.lastSavedAt ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }
  // 그 외 캐시된 장면들 — lastSavedAt 내림차순.
  const others = Object.entries(ps.sceneCache)
    .filter(([id, c]) => id !== activeDocId && (c.body || c.draft))
    .map(([id, c]) => ({
      id,
      body: c.draft ?? c.body,
      lastSavedAt: c.lastSavedAt ?? 0,
    }))
    .sort((a, b) => b.lastSavedAt - a.lastSavedAt);
  for (const s of others) {
    if (samples.length >= MAX_VOICE_SAMPLES) break;
    if (s.body.trim().length === 0) continue;
    samples.push(s);
  }
  return samples
    .slice(0, MAX_VOICE_SAMPLES)
    .map((s) => clip(s.body, VOICE_MAX_CHARS_PER_SAMPLE));
}

function buildGuideBlock(guide: StyleGuide): string {
  // v2: §14 압축 프롬프트 + §11 DNA 핵심 + 레거시 5축 요약을 함께 제공.
  const g = guide.guide;
  const dna = g.styleDna;
  return [
    "다음은 14단계 심층 분석으로 추출된 작가의 문체 지침입니다. 이 지침을 그대로 따르세요.",
    "",
    "## 압축 문체 지침 (§14)",
    g.compressedPrompt,
    "",
    "## 내 문체 DNA (§11) — 핵심 추출",
    `- 문체 이름: ${dna.name}`,
    `- 핵심 인상: ${dna.coreImpression}`,
    `- 문장 호흡: ${dna.sentenceBreath}`,
    `- 문장 구조: ${dna.sentenceStructure}`,
    `- 어휘 성향: ${dna.vocabulary}`,
    `- 사고 전개: ${dna.thoughtFlow}`,
    `- 감정 온도: ${dna.emotionTemperature}`,
    `- 독자와의 거리: ${dna.readerDistance}`,
    `- 자주 쓰는 문장 패턴: ${dna.frequentSentencePatterns}`,
    `- 자주 쓰는 사고 패턴: ${dna.frequentThoughtPatterns}`,
    `- 유지해야 할 것: ${dna.keep}`,
    `- 줄여야 할 것: ${dna.reduce}`,
    `- 절대 잃으면 안 되는 특징: ${dna.nonNegotiable}`,
    `- 한 문장 정의: ${dna.oneLineDefinition}`,
    "",
    "## 문체 첫인상 (§1) 키워드",
    g.firstImpression.map((k) => `#${k}`).join(" "),
  ].join("\n");
}

function assemblePrompt(
  selection: string,
  samples: string[],
  guide: StyleGuide | null,
): string {
  // 가드 우선. 가드 있으면 sample 은 1개만 보조 (없으면 0개), 가드 없으면 sample 만.
  const guideBlock = guide
    ? `\n# 작가 보이스 가드 (글로벌 학습 결과)\n${buildGuideBlock(guide)}\n`
    : "";

  const sampleSlice = guide ? samples.slice(0, 1) : samples;
  const sampleBlock =
    sampleSlice.length > 0
      ? sampleSlice
          .map((s, i) => `## 보이스 샘플 ${i + 1}\n${s}\n`)
          .join("\n")
      : guide
        ? "(샘플 없음 — 가드만으로 충분합니다.)"
        : "(보이스 샘플 없음 — 선택 텍스트의 톤을 자연스러운 한국어 산문체로 다듬으세요.)";

  return `${SYSTEM_PROMPT}
${guideBlock}
# 보조 샘플 (현재 원고의 톤 — 가드보다 우선순위 낮음)
${sampleBlock}

# 다시 써야 할 텍스트
<<<SELECTION>>>
${selection}
<<<END>>>

위 SELECTION 블록의 내용을 ${guide ? "가드와 샘플의 문체로" : "샘플의 문체로"} 다시 쓰세요. 출력은 다시 쓴 결과 본문 그 자체. 다른 어떤 말도 붙이지 마세요.`;
}

/**
 * 한 번의 리라이트 호출 — 토큰을 활성 에디터 커서에 스트리밍 삽입.
 * 성공 시 final 본문을 store 에 setSceneDraft + saveScene 으로 저장 트리거.
 *
 * 활성 view 가 없거나 selection 이 비어 있으면 즉시 반환.
 */
export async function rewriteSelectionInVoice(
  input: RewriteSelectionInput,
): Promise<void> {
  const selection = input.selectionText.trim();
  if (!selection) {
    tauriNoticeAdapter.warn("리라이트할 텍스트를 먼저 선택하세요.");
    return;
  }
  if (!editorRegistry.has(input.activeDocId)) {
    tauriNoticeAdapter.warn(
      "활성 에디터가 없습니다. 먼저 본문을 쓸 장면을 선택하세요.",
    );
    return;
  }

  const settings = useSettingsStore.getState().settings;
  if (settings.aiProvider === "mock") {
    tauriNoticeAdapter.warn(
      "AI 공급자가 mock 으로 설정되어 있어 리라이트를 실행할 수 없습니다.",
    );
    return;
  }
  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;
  if (!binaryPath.trim()) {
    tauriNoticeAdapter.error(
      "Codex/Claude Code CLI 경로가 비어 있습니다. 설정에서 경로를 입력하세요.",
    );
    return;
  }

  const samples = collectVoiceSamples(input.activeDocId);
  // 글로벌 보이스 가드가 있으면 sample 보다 우선시.
  const guide = await loadStyleGuide();
  const prompt = assemblePrompt(selection, samples, guide);

  // 시작 마커: 사용자가 어디에 들어왔는지 알 수 있도록 짧은 분리선 삽입.
  // (옵션) 너무 침습적이면 제거 가능. 일단 보이스 샘플 없을 때만 표기.
  // → 명시 요청이 없었으니 마커는 생략.

  // 백엔드는 codex 의 stdout JSONL 을 그대로 토큰으로 emit 하므로 (라인 단위)
  // 토큰 스트리밍을 그대로 에디터에 박으면 protocol 이벤트가 가비지로 들어간다.
  // → 토큰은 버리고, done.fullText (--output-last-message 파일) 에서 파싱된
  //   깨끗한 본문만 한 번에 삽입한다. 스트리밍 미리보기는 포기, 정합성 우선.
  const handle = startAiInvocation({
    provider: settings.aiProvider,
    binaryPath,
    extraArgs: splitArgs(settings.codexExtraArgs),
    prompt,
    timeoutSecs: TIMEOUT_SECS,
  });

  // 토큰 큐 비우기 — 안 비우면 backpressure 로 process 가 stuck 될 수 있다.
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
    const text = result.fullText.trim();
    if (!editorRegistry.has(input.activeDocId)) {
      tauriNoticeAdapter.warn(
        "리라이트 도중 활성 에디터가 사라졌습니다. 결과를 삽입하지 못했습니다.",
      );
      return;
    }
    if (!text) {
      tauriNoticeAdapter.warn(
        "AI 가 빈 결과를 반환했습니다. 다른 모델이나 더 짧은 선택으로 다시 시도하세요.",
      );
      return;
    }
    const ok = editorRegistry.insertAtCursor(input.activeDocId, text);
    if (!ok) {
      tauriNoticeAdapter.warn("활성 에디터가 사라져 결과를 삽입하지 못했습니다.");
      return;
    }
    tauriNoticeAdapter.info(
      `리라이트 삽입 완료 (${text.length.toLocaleString()}자, ${(
        result.durationMs / 1000
      ).toFixed(1)}초)`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    tauriNoticeAdapter.error(`리라이트 실패: ${msg}`);
  }
}

// 테스트/외부용 — assemblePrompt 노출.
export const _internal = { assemblePrompt, collectVoiceSamples };
