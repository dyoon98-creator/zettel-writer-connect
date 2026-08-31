// synopsisPrompts.ts — Step3Synopsis 전용 AI 프롬프트 상수 및 빌더.
// @TASK P2-T6 — Step3Synopsis: 시놉시스 streaming + 인라인 편집
//
// ── 판정 박제 (2026-08-31 · 대표 실사용 결함: 「다시 다듬기」가 글을 나쁘게 만든다) ──
//
// 무엇이 잘못돼 있었나:
//   「다시 다듬기」가 실제로는 «처음부터 다시 쓰기» 였다. 재제안 경로가 화면에 있는
//   시놉시스를 프롬프트에 «한 글자도» 싣지 않았고, 이 파일에는 기존 글을 실을 자리
//   자체가 없었다. AI 는 앞서 쌓아 올린 글도, 작가가 손으로 고친 대목도 못 본 채
//   컨셉 단락만 보고 밑바닥부터 새로 썼다. 쌓은 것을 버리니 나빠지는 것이 당연하다.
//
// 두 경로를 «다른 일» 로 가른다:
//   1) 첫 생성  — 빈 화면에서 글을 «짓는다». SYNOPSIS_SYSTEM_PROMPT.
//   2) 다듬기   — 이미 있는 글을 «고친다». SYNOPSIS_REFINE_SYSTEM_PROMPT.
//   재료 조립(컨셉 단락·메모 단서·노트)은 같으므로 빌더는 하나로 두고 안에서 가른다.
//   빌더까지 둘로 쪼개면 「어느 쪽을 부를지」를 호출부가 매번 다시 고르게 되는데,
//   이 결함이 정확히 그 종류의 실수(재제안 경로만 인자를 빠뜨림)였다.
//
// 첫 생성 프롬프트는 «일부러 손대지 않았다». 대표가 지금 쓰고 계신 결과물을 내는
// 경로이고, 이번 결함은 그 경로의 문제가 아니다. 검증 없이 함께 바꾸면 지금 멀쩡한
// 것까지 나빠질 수 있다.

export const SYNOPSIS_SYSTEM_PROMPT = `당신은 책의 시놉시스를 짓는 편집자입니다.
주어진 컨셉 단락과 옵시디언 참고 노트를 토대로,
독자가 책 전체의 흐름을 한 번에 그릴 수 있는 시놉시스 6~10문장(한 단락)을
작성하세요.

원칙:
- 컨셉 단락의 톤/은유를 우선 보존.
- 노트의 표현을 인용하되 출처 표기는 생략.
- 시작 → 중간 갈등 → 결말의 구조를 함축.
- 헤더/번호/볼드 없이 단락 하나만 출력.`;

/**
 * «다듬기» 전용 system prompt — 이미 쓰인 글을 고치는 일.
 *
 * 설계 의도 셋.
 *  (1) 역할을 «짓는 사람» 이 아니라 «고쳐 주는 사람» 으로 못박는다. 이 한 줄이
 *      없으면 모델은 기본값인 「새로 쓰기」로 돌아간다 — 그것이 이 결함이었다.
 *  (2) «쓰기 전에 판단하게» 한다. 무엇을 왜 고쳐야 하는지 먼저 정하지 않으면
 *      지시와 무관한 문장까지 휩쓸려 다시 쓰이고, 그때 글이 나빠진다.
 *  (3) 그 판단을 «화면에 토해 내지» 못하게 한다. 작가가 받는 것은 다듬어진 글
 *      한 편이지 사고 과정이 아니다. 출력 계약을 역할 문장과 마지막 줄에 두 번
 *      둔다 — 마지막에 둔 것이 실제로 가장 잘 지켜진다.
 */
export const SYNOPSIS_REFINE_SYSTEM_PROMPT = `당신은 이미 쓰인 시놉시스를 고쳐 주는 편집자입니다.
새로 쓰는 사람이 아닙니다. 작가가 지금 화면에서 보고 있는 글이 있고, 그 글을 손봐 달라고
부탁한 것입니다.

쓰기 전에 먼저 판단하세요. 스스로 정할 것:
- 작가의 지시가 지금 글의 어디를 겨냥하는가. 그 지시로 실제로 바뀌어야 할 문장은 어느 것인가.
- 지금 글에서 반드시 살려야 할 것은 무엇인가 — 톤, 은유, 고유한 표현, 작가가 직접 손댄 대목.
- 한 곳을 고치면 앞뒤가 어긋나지 않는가. 어긋난다면 어디까지 함께 손봐야 하는가.
- 지시와 무관한 문장은 왜 그대로 두어야 하는가.

이 판단은 속으로만 하세요. 판단한 내용을 글에 쓰지 마세요.

원칙:
- 이것은 다듬기입니다. 남길 수 있는 문장은 남기세요. 전체를 새로 쓰는 것은 지시가 그것을
  분명히 요구할 때뿐입니다.
- 작가가 직접 고친 흔적은 «의도» 로 보고 존중하세요. 지시와 정면으로 부딪히지 않는 한
  되돌리지 마세요.
- 컨셉 단락의 톤과 은유는 여전히 기준입니다.
- 추가 지시가 없으면 크게 바꾸지 마세요. 실제로 약한 곳만 손보고, 손볼 곳이 없으면
  거의 그대로 두세요.
- 길이와 형식(6~10문장, 한 단락)은 유지하세요.

출력은 다듬어진 시놉시스 본문 한 단락뿐입니다. 머리말·맺음말·무엇을 왜 바꿨는지에 대한
설명·변경 요약·헤더·번호·볼드를 붙이지 마세요. 작가가 받는 것은 글이지 보고서가 아닙니다.`;

/**
 * 시놉시스 user prompt.
 *
 * `currentSynopsis` 가 있으면 «다듬기», 없으면 «첫 생성» 이다. 두 경로는 서로 다른
 * 프롬프트를 낸다 — 같은 글이 나오면 「다듬기」가 다시 「새로 쓰기」가 된다.
 * 호출부는 `SYNOPSIS_REFINE_SYSTEM_PROMPT` 와 짝지어 써야 한다.
 */
export function buildSynopsisUserPrompt(opts: {
  conceptParagraph: string;
  /**
   * 지금 화면에 있는 시놉시스 — «다듬을 대상».
   * AI 가 만든 마지막 판일 수도, 작가가 손으로 고친 판일 수도 있다. 둘을 구별하지
   * 않는 것은 «의도» 다 — 작가가 다듬어 달라는 것은 «지금 눈에 보이는 글» 이고,
   * 손댄 것을 되돌려 버리면 작업을 빼앗는 셈이 된다.
   */
  currentSynopsis?: string;
  refineHint?: string;
  /** v2 — 의식의 흐름 메모에서 추출된 분석 요약 (선택). 시놉시스의 정서적 무게를 잡는 데 쓰임. */
  memoAnalysis?: {
    emotionAxis: string;
    strongSentences: string[];
    recurringThoughts: string[];
  };
}): string {
  const current = (opts.currentSynopsis ?? "").trim();
  const isRefine = current.length > 0;
  const hint = (opts.refineHint ?? "").trim();

  const lines: string[] = [];
  lines.push("## 컨셉 단락");
  lines.push(opts.conceptParagraph);

  if (isRefine) {
    lines.push("");
    lines.push("## 지금 시놉시스 (다듬을 대상)");
    lines.push(current);
  }
  if (opts.memoAnalysis) {
    const m = opts.memoAnalysis;
    const hasAny =
      m.emotionAxis.trim() ||
      m.strongSentences.length > 0 ||
      m.recurringThoughts.length > 0;
    if (hasAny) {
      lines.push("");
      lines.push("## 작가의 무의식 단서 (메모 분석)");
      if (m.emotionAxis.trim()) lines.push(`- 감정의 축: ${m.emotionAxis.trim()}`);
      for (const s of m.strongSentences.slice(0, 5)) {
        lines.push(`- 힘 있는 문장: "${s}"`);
      }
      for (const t of m.recurringThoughts.slice(0, 3)) {
        lines.push(`- 반복되는 생각: ${t}`);
      }
    }
  }
  if (hint) {
    lines.push("");
    lines.push("## 추가 지시");
    lines.push(hint);
  }

  lines.push("");
  if (!isRefine) {
    // 첫 생성 — 다듬을 것이 없다. 옛 문면 그대로 둔다.
    lines.push("위 컨셉으로 시놉시스를 작성하세요.");
  } else if (hint) {
    lines.push(
      "「지금 시놉시스」를 「추가 지시」대로 다듬어 주세요. 지시가 닿지 않는 문장은 그대로 두세요.",
    );
  } else {
    lines.push(
      "「지금 시놉시스」를 다듬어 주세요. 따로 지시가 없으니 실제로 약한 곳만 손보고, 나머지는 그대로 두세요.",
    );
  }
  return lines.join("\n");
}
