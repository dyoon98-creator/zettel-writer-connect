// synopsisPrompts.ts — Step3Synopsis 전용 AI 프롬프트 상수 및 빌더.
// @TASK P2-T6 — Step3Synopsis: 시놉시스 streaming + 인라인 편집

export const SYNOPSIS_SYSTEM_PROMPT = `당신은 책의 시놉시스를 짓는 편집자입니다.
주어진 컨셉 단락과 옵시디언 참고 노트를 토대로,
독자가 책 전체의 흐름을 한 번에 그릴 수 있는 시놉시스 6~10문장(한 단락)을
작성하세요.

원칙:
- 컨셉 단락의 톤/은유를 우선 보존.
- 노트의 표현을 인용하되 출처 표기는 생략.
- 시작 → 중간 갈등 → 결말의 구조를 함축.
- 헤더/번호/볼드 없이 단락 하나만 출력.`;

export function buildSynopsisUserPrompt(opts: {
  conceptParagraph: string;
  refineHint?: string;
}): string {
  const lines: string[] = [];
  lines.push("## 컨셉 단락");
  lines.push(opts.conceptParagraph);
  if (opts.refineHint && opts.refineHint.trim()) {
    lines.push("");
    lines.push("## 추가 지시");
    lines.push(opts.refineHint.trim());
  }
  lines.push("");
  lines.push("위 컨셉으로 시놉시스를 작성하세요.");
  return lines.join("\n");
}
