// outlinePrompts.ts — Step4Outline 전용 AI 프롬프트 상수 및 빌더.
// @TASK P2-T7 — Step4Outline: 12-30장 목차 streaming + master-detail 편집

export const OUTLINE_SYSTEM_PROMPT = `당신은 책의 목차를 설계하는 편집자입니다.
주어진 컨셉 단락 + 시놉시스 + 옵시디언 참고 노트를 토대로,
12~30장 사이의 책 한 권 분량 목차를 설계합니다.

각 장은 다음 형식의 JSON 항목 하나:
{ "title": "...", "summary": "..." }

- title: 8~25자 한국어, 호기심을 끄는 짧은 문장.
- summary: 한 단락 (2~4문장). 그 장의 핵심 갈등/전개/결말을 함축.
- 전체는 JSON 배열만, 다른 텍스트/마크다운 금지.

원칙:
- 시놉시스의 흐름을 12~30개 비트로 분해.
- 첫 장은 도입(인물/세계/문제), 마지막 장은 결산.
- 같은 종류의 장이 연속되지 않게 다양화.`;

export const SINGLE_CHAPTER_REFINE_SYSTEM = `당신은 책의 한 장을 다듬는 편집자입니다.
주어진 장 제목과 일세를 더 매력적으로 다듬어 같은 JSON 형식 ({title, summary}) 으로 반환합니다.
다른 텍스트 금지.`;

export function buildOutlineUserPrompt(opts: {
  conceptParagraph: string;
  synopsis: string;
  refineHint?: string;
}): string {
  const lines = [
    "## 컨셉",
    opts.conceptParagraph,
    "",
    "## 시놉시스",
    opts.synopsis,
  ];
  if (opts.refineHint?.trim()) {
    lines.push("", "## 추가 지시", opts.refineHint.trim());
  }
  lines.push("", "위 정보로 12~30장 JSON 배열을 출력하세요.");
  return lines.join("\n");
}

/** AI 응답에서 JSON 배열 추출 (코드 펜스, 앞뒤 잡담 제거). */
export function parseOutlineResponse(
  raw: string,
): { title: string; summary: string }[] {
  // ```json ... ``` 펜스 떼기
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 첫 [ ~ 마지막 ] 추출 (앞뒤 잡담 보호)
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON 배열을 찾지 못했습니다.");
  }
  const arr = JSON.parse(s.slice(start, end + 1)) as unknown;
  if (!Array.isArray(arr)) throw new Error("배열 형태가 아닙니다.");
  return arr.map((it, i) => {
    if (!it || typeof it !== "object") throw new Error(`항목 ${i} invalid`);
    const title = String(
      (it as Record<string, unknown>).title ?? "",
    ).trim();
    const summary = String(
      (it as Record<string, unknown>).summary ?? "",
    ).trim();
    if (!title) throw new Error(`항목 ${i} title 비어있음`);
    return { title, summary };
  });
}
