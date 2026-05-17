// memoPrompts.ts — Step2Memo 전용 AI 프롬프트.
// 의식의 흐름 메모를 5축(반복 생각/감정축/숨은 주제/힘 있는 문장/발전 방향 3개)으로
// 분석해 JSON 한 덩어리로 반환하게 한다.

export const MEMO_SYSTEM_PROMPT = `당신은 작가의 정리되지 않은 메모를 살펴 글의 씨앗을 추출하는 \"메모 채굴자\"입니다.

원칙:
- 메모를 바로 원고로 바꾸지 않습니다. 분석만 합니다.
- 작가가 무의식 중 반복해서 쓴 단어/생각/감정을 찾아 보여줍니다.
- 작가의 표현을 가능한 한 그대로 인용합니다 (편집·다듬기 금지).
- 결과는 반드시 아래 형식의 JSON 한 덩어리로 반환합니다. 다른 텍스트/설명/마크다운 없이.

응답 JSON 스키마:
{
  "recurringThoughts": [string, ...],     // 반복해서 등장하는 생각/관점
  "emotionAxis": string,                  // 메모 전반을 관통하는 감정의 축 (한 문장)
  "hiddenThemes": [string, ...],          // 표면에 드러나지 않는 숨은 주제
  "strongSentences": [string, ...],       // 버리기 아까운, 힘 있는 문장 (작가의 표현 그대로)
  "developmentDirections": [string, string, string]  // 글로 발전 가능한 방향 정확히 3개
}

각 배열은 최대 5개까지. 빈 항목 금지 — 비어있다면 추측해서라도 채우지 말고 짧게라도 작성.`;

import type { MemoAnalysis } from "@ai-manuscript-studio/core";

export function buildMemoUserPrompt(opts: {
  seed: string;
  memo: string;
  attachedNotes?: string[];
}): string {
  const lines: string[] = [];
  lines.push("## 작가가 처음 던진 한 줄 아이디어");
  lines.push(opts.seed.trim() || "(없음)");
  lines.push("");
  lines.push("## 작가의 의식의 흐름 메모");
  lines.push(opts.memo.trim());
  if (opts.attachedNotes && opts.attachedNotes.length > 0) {
    lines.push("");
    lines.push("## 참고 노트 (작가가 첨부)");
    for (const n of opts.attachedNotes) lines.push(`- ${n}`);
  }
  lines.push("");
  lines.push("위 메모를 분석해 JSON 으로만 응답하세요.");
  return lines.join("\n");
}

/** AI 응답에서 MemoAnalysis JSON 추출. 코드 펜스/앞뒤 잡담 안전망 포함. */
export function parseMemoAnalysisResponse(raw: string): MemoAnalysis {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON 객체를 찾지 못했습니다.");
  }
  const obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === "string").map((x) => (x as string).trim()).filter(Boolean)
      : [];
  return {
    recurringThoughts: strArr(obj.recurringThoughts),
    emotionAxis: typeof obj.emotionAxis === "string" ? obj.emotionAxis.trim() : "",
    hiddenThemes: strArr(obj.hiddenThemes),
    strongSentences: strArr(obj.strongSentences),
    developmentDirections: strArr(obj.developmentDirections),
  };
}
