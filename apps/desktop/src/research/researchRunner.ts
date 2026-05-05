// researchRunner.ts — 작가 자유 prompt → Codex CLI → 결과를 새 binder 노드로 추가.
//
// 리서치 대상: 신뢰 있는 뉴스 저널 / 논문 / 문헌 (사용자 선택).
// Codex CLI 는 web 검색을 직접 못 하므로, prompt 에 다음을 강제:
//  - 출처를 모를 때 "확인 필요" 명시
//  - 인용은 (저널명·연도·저자) 형식
//  - 사실 단언 vs 추론을 구분 표시

import { startAiInvocation } from "../ai/streamingHandle";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";

export type ResearchSourceKind = "news" | "paper" | "literature" | "general";

export const RESEARCH_SOURCE_LABEL: Record<ResearchSourceKind, string> = {
  news: "뉴스 저널",
  paper: "학술 논문",
  literature: "문헌·도서",
  general: "일반 (출처 자유)",
};

export interface RunResearchInput {
  /** 작가가 입력한 자유 prompt. */
  userPrompt: string;
  /** 우선 참조할 자료 유형. */
  sourceKind: ResearchSourceKind;
  /** 사용자가 미리 등록한 참고 링크 (있으면 prompt 에 포함). */
  attachedLinks?: string[];
  /** 부모 binder folder id (어느 폴더 아래에 결과 노드를 둘지). null = root. */
  parentFolderId?: string | null;
  signal?: AbortSignal;
}

export interface ResearchResult {
  /** Codex CLI 가 생성한 마크다운 본문. */
  body: string;
  /** 본문에서 추출한 URL 후보 (있으면). */
  extractedLinks: string[];
  /** 작가에게 보여줄 한 줄 요약 (제목 후보). */
  title: string;
  /** Codex CLI 호출 ms. */
  durationMs: number;
}

const RESEARCH_SYSTEM_PROMPT = (kind: ResearchSourceKind, attached: string[]) => `당신은 한국어 작가의 깊이 있는 리서치 어시스턴트입니다. 작가가 던진 질문에 대해 ${RESEARCH_SOURCE_LABEL[kind]} 우선으로 정리합니다.

# 출력 규칙
- 응답은 **한국어 마크다운**. 구조는 다음 권장:
  1. \`# 제목\` (한 줄, 명확하게)
  2. \`## 한 문장 요약\` (핵심을 1~2문장)
  3. \`## 핵심 정리\` (불릿 5~10개)
  4. \`## 출처와 근거\` (각 항목: 저널/논문/도서명 — 저자 — 연도. URL 이 있으면 함께. 없으면 "URL 미상" 으로 표시)
  5. \`## 작가에게 던지는 다음 질문\` (이 리서치가 작가의 원고에 어떻게 들어올지 묻는 후속 질문 2~3개)

# 신뢰성 규칙 (절대)
- 출처를 모를 때는 **반드시 "확인 필요"** 라고 표시. 가짜 인용 금지.
- 사실 단언 vs 추론을 명확히 구분: "보고됐다 / 인용된다 / 추정된다 / 알려져 있지 않다" 등의 동사로 신뢰 수준 표시.
- 통계 수치를 제시할 때는 출처 없이 단언하지 말 것. 모르면 "정확한 수치는 확인 필요" 라고 적기.
${
  kind === "paper"
    ? "- 학술 논문 우선 — 가능하면 peer-reviewed 저널의 논문을 인용. arXiv 같은 preprint 는 그 사실을 명시.\n"
    : ""
}${
  kind === "news"
    ? "- 뉴스 인용 시 발행처와 발행일을 함께 적기. 출처가 모호한 SNS·블로그는 가능하면 피하기.\n"
    : ""
}${
  kind === "literature"
    ? "- 문헌 인용 시 책 제목 · 저자 · 출판년도 · (가능하면) 챕터/페이지 단서.\n"
    : ""
}
${
  attached.length > 0
    ? `# 작가가 미리 첨부한 참고 링크\n${attached.map((u, i) => `${i + 1}. ${u}`).join("\n")}\n위 링크의 내용을 알 수 있으면 우선 활용하세요. 모르면 "이 링크의 내용은 확인 필요" 라고 표시하고 일반 지식으로 보강합니다.`
    : ""
}

# 어조
- 차분하고 정중한 학술적 톤. 과장된 형용사 금지.
- 작가가 자기 글에 가져갈 수 있도록, 인용 가능한 단단한 문장 위주로.`;

const RESEARCH_USER_PROMPT = (userPrompt: string) => `# 작가의 리서치 요청
${userPrompt.trim()}

위 출력 규칙을 모두 지켜 마크다운으로 응답하세요. 첫 줄은 \`# 제목\` 으로 시작.`;

const URL_RE = /(https?:\/\/[^\s)\]]+)/g;

function extractLinks(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    let u = m[1];
    // 끝의 punctuation 제거
    u = u.replace(/[.,;:!?]+$/, "");
    set.add(u);
  }
  return Array.from(set);
}

function extractTitle(markdown: string): string {
  const m = markdown.match(/^\s*#\s+(.+)$/m);
  if (m) return m[1].trim().slice(0, 120);
  // fallback: 첫 줄 80자.
  const first = markdown.trim().split("\n")[0] ?? "리서치";
  return first.slice(0, 80);
}

function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Codex CLI 에 자유 prompt 를 보내고 마크다운 응답을 받는다.
 * 빈 응답 시 1회 자동 재시도. 끝나면 본문 + 링크 + 제목 후보 반환.
 */
export async function runResearch(
  input: RunResearchInput,
): Promise<ResearchResult> {
  const settings = useSettingsStore.getState().settings;
  if (settings.aiProvider === "mock") {
    throw new Error(
      "AI 공급자가 mock 으로 설정되어 있어 리서치를 실행할 수 없습니다. 설정 → AI 공급자에서 codex 또는 claude-code 를 선택하세요.",
    );
  }
  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;
  if (!binaryPath.trim()) {
    throw new Error(
      "Codex/Claude Code CLI 경로가 비어 있어 리서치를 실행할 수 없습니다. 설정에서 경로를 입력하세요.",
    );
  }

  const sys = RESEARCH_SYSTEM_PROMPT(input.sourceKind, input.attachedLinks ?? []);
  const usr = RESEARCH_USER_PROMPT(input.userPrompt);
  const fullPrompt = `${sys}\n\n${usr}`;

  const startedAt = Date.now();
  let resultText = "";
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = startAiInvocation({
        provider: settings.aiProvider,
        binaryPath,
        extraArgs: splitArgs(settings.codexExtraArgs),
        prompt: fullPrompt,
        timeoutSecs: 240,
        signal: input.signal,
      });
      // 토큰 큐 비우기 (fullText 는 done 에서).
      void (async () => {
        try {
          for await (const _ of handle.tokens()) {
            /* discard */
          }
        } catch {
          /* swallow */
        }
      })();
      const done = await handle.done;
      if (done.fullText.trim().length > 0) {
        resultText = done.fullText;
        break;
      }
      if (attempt === 0) {
        tauriNoticeAdapter.warn(
          "Codex 가 빈 응답을 반환했습니다. 재시도합니다…",
          4000,
        );
      }
    } catch (e) {
      lastErr = e;
      if (attempt === 0) {
        tauriNoticeAdapter.warn(
          `Codex 첫 시도 실패: ${e instanceof Error ? e.message : String(e)} — 재시도`,
          4000,
        );
        continue;
      }
      throw new Error(
        `Codex CLI 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (!resultText.trim()) {
    throw new Error(
      `Codex 가 두 번 모두 빈 응답을 반환했습니다 (${
        lastErr instanceof Error ? lastErr.message : "원인 미상"
      }). 다른 모델(예: 설정 → CLI 추가 인자에 \`-m gpt-5-codex\`)을 시도해보세요.`,
    );
  }

  return {
    body: resultText,
    extractedLinks: extractLinks(resultText),
    title: extractTitle(resultText),
    durationMs: Date.now() - startedAt,
  };
}
