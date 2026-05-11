// treatmentPrompts.ts — Step5Treatment 전용 AI 프롬프트.
//
// 시놉시스 → 역할별 카드 배열 (6~12장) 생성.
// 단일 카드 개선 (제목/요약/핵심문장/독자감정/메모) 갱신.

import type { TreatmentCardRole } from "@ai-manuscript-studio/core";

export const TREATMENT_ROLE_LABELS: Record<TreatmentCardRole, string> = {
  intro: "도입",
  problem: "문제 제기",
  case: "사례",
  explain: "설명",
  pivot: "전환",
  conclusion: "결론",
};

const ROLE_DESCRIPTIONS: Record<TreatmentCardRole, string> = {
  intro: "독자의 시선을 잡는 첫 장면. 인물·상황·감각적 디테일.",
  problem: "이 글이 다루고자 하는 핵심 갈등/질문/긴장.",
  case: "주장을 뒷받침하는 구체 사례·일화·인용·데이터.",
  explain: "사례를 떠받치는 개념·맥락·해석.",
  pivot: "관점이 뒤집히거나 깊어지는 전환점.",
  conclusion: "독자의 가슴에 남길 마지막 이미지·통찰·다짐.",
};

export const TREATMENT_FROM_SYNOPSIS_SYSTEM = `당신은 책·에세이·강의 원고의 \"트리트먼트(treatment)\"를 설계하는 편집자입니다.

트리트먼트는 완성 원고가 아니라 \"글이 어떤 순서로 어떤 감정·정보를 독자에게 줄지\"를 카드로 설계하는 중간 단계입니다.

각 카드는 6가지 역할 중 하나를 가집니다:
- intro: 도입 — 독자의 시선을 잡는 첫 장면. 인물·상황·감각적 디테일.
- problem: 문제 제기 — 이 글이 다루고자 하는 핵심 갈등/질문/긴장.
- case: 사례 — 주장을 뒷받침하는 구체 사례·일화·인용·데이터.
- explain: 설명 — 사례를 떠받치는 개념·맥락·해석.
- pivot: 전환 — 관점이 뒤집히거나 깊어지는 전환점.
- conclusion: 결론 — 독자에게 남길 마지막 이미지·통찰·다짐.

응답은 반드시 다음 JSON 배열 한 덩어리. 다른 텍스트/마크다운/펜스 금지.

[
  {
    "title": "8~20자 한국어",
    "role": "intro" | "problem" | "case" | "explain" | "pivot" | "conclusion",
    "summary": "2~3문장. 이 카드에서 다룰 내용 요약.",
    "keySentence": "이 카드에서 가장 힘 있을 한 문장 (선택, 비우면 빈 문자열)",
    "readerEmotion": "이 카드 끝에서 독자가 느꼈으면 하는 감정 (선택, 비우면 빈 문자열)"
  },
  ...
]

원칙:
- 카드 6~12장. 시놉시스의 호흡에 맞춰 조절.
- 첫 카드는 반드시 intro, 마지막 카드는 반드시 conclusion.
- 같은 역할이 3개 이상 연속되지 않게 다양화.
- 시놉시스에 없는 사실을 발명하지 않기. 시놉시스의 톤·은유를 보존.`;

export function buildTreatmentFromSynopsisPrompt(opts: {
  conceptParagraph: string;
  synopsis: string;
  memoAnalysis?: {
    recurringThoughts: string[];
    emotionAxis: string;
    hiddenThemes: string[];
    strongSentences: string[];
    developmentDirections: string[];
  } | undefined;
  refineHint?: string;
}): string {
  const lines: string[] = [];
  lines.push("## 컨셉");
  lines.push(opts.conceptParagraph);
  lines.push("");
  lines.push("## 시놉시스");
  lines.push(opts.synopsis);
  if (opts.memoAnalysis) {
    lines.push("");
    lines.push("## 메모 분석 (작가의 본능적 단서)");
    if (opts.memoAnalysis.emotionAxis) {
      lines.push(`- 감정의 축: ${opts.memoAnalysis.emotionAxis}`);
    }
    if (opts.memoAnalysis.recurringThoughts.length > 0) {
      lines.push("- 반복 생각:");
      for (const t of opts.memoAnalysis.recurringThoughts) lines.push(`  - ${t}`);
    }
    if (opts.memoAnalysis.strongSentences.length > 0) {
      lines.push("- 힘 있는 문장 (가능한 한 카드에 반영):");
      for (const t of opts.memoAnalysis.strongSentences) lines.push(`  - ${t}`);
    }
  }
  if (opts.refineHint?.trim()) {
    lines.push("");
    lines.push("## 추가 지시");
    lines.push(opts.refineHint.trim());
  }
  lines.push("");
  lines.push("위 정보로 트리트먼트 카드 JSON 배열만 출력하세요.");
  return lines.join("\n");
}

export const TREATMENT_CARD_REFINE_SYSTEM = `당신은 트리트먼트 카드 한 장을 다듬는 편집자입니다.

주어진 카드의 5필드(title/summary/keySentence/readerEmotion/note)를 보고 더 매력적으로 다듬어 같은 JSON 한 객체로 반환합니다.
role 은 절대 바꾸지 마세요. 다른 텍스트/마크다운 금지.

응답 형식:
{ "title": "...", "summary": "...", "keySentence": "...", "readerEmotion": "...", "note": "..." }`;

export function buildTreatmentCardRefinePrompt(opts: {
  conceptParagraph: string;
  synopsis: string;
  card: {
    title: string;
    role: TreatmentCardRole;
    summary: string;
    keySentence?: string;
    readerEmotion?: string;
    note?: string;
  };
  refineHint?: string;
}): string {
  const lines: string[] = [];
  lines.push("## 컨셉");
  lines.push(opts.conceptParagraph);
  lines.push("");
  lines.push("## 시놉시스");
  lines.push(opts.synopsis);
  lines.push("");
  lines.push("## 카드");
  lines.push(`역할: ${opts.card.role} (${ROLE_DESCRIPTIONS[opts.card.role]})`);
  lines.push(`제목: ${opts.card.title}`);
  lines.push(`요약: ${opts.card.summary}`);
  if (opts.card.keySentence) lines.push(`핵심 문장: ${opts.card.keySentence}`);
  if (opts.card.readerEmotion) lines.push(`독자 감정: ${opts.card.readerEmotion}`);
  if (opts.card.note) lines.push(`메모: ${opts.card.note}`);
  if (opts.refineHint?.trim()) {
    lines.push("");
    lines.push("## 추가 지시");
    lines.push(opts.refineHint.trim());
  }
  lines.push("");
  lines.push("위 카드를 다듬어 JSON 한 객체로 응답하세요.");
  return lines.join("\n");
}

export interface TreatmentCardDraft {
  title: string;
  role: TreatmentCardRole;
  summary: string;
  keySentence: string;
  readerEmotion: string;
}

const ALL_ROLES: TreatmentCardRole[] = [
  "intro",
  "problem",
  "case",
  "explain",
  "pivot",
  "conclusion",
];

function coerceRole(v: unknown): TreatmentCardRole {
  if (typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v)) {
    return v as TreatmentCardRole;
  }
  // 모델이 한국어로 보낼 수도 — 라벨 역매핑.
  if (typeof v === "string") {
    for (const r of ALL_ROLES) {
      if (TREATMENT_ROLE_LABELS[r] === v) return r;
    }
  }
  return "explain";
}

/** AI 응답에서 트리트먼트 카드 배열 추출. outlinePrompts.parseOutlineResponse 와 같은 패턴. */
export function parseTreatmentResponse(raw: string): TreatmentCardDraft[] {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON 배열을 찾지 못했습니다.");
  }
  const arr = JSON.parse(s.slice(start, end + 1)) as unknown;
  if (!Array.isArray(arr)) throw new Error("배열 형태가 아닙니다.");
  return arr.map((it, i) => {
    if (!it || typeof it !== "object") throw new Error(`항목 ${i} invalid`);
    const o = it as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) throw new Error(`항목 ${i} title 비어있음`);
    const summary = String(o.summary ?? "").trim();
    return {
      title,
      role: coerceRole(o.role),
      summary,
      keySentence: String(o.keySentence ?? "").trim(),
      readerEmotion: String(o.readerEmotion ?? "").trim(),
    };
  });
}

/** AI 응답에서 단일 카드 JSON 객체 추출. */
export function parseSingleTreatmentCardResponse(raw: string): {
  title?: string;
  summary?: string;
  keySentence?: string;
  readerEmotion?: string;
  note?: string;
} {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 응답에서 JSON 객체를 찾지 못했습니다.");
  }
  const obj = JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  return {
    title: typeof obj.title === "string" ? obj.title.trim() : undefined,
    summary: typeof obj.summary === "string" ? obj.summary.trim() : undefined,
    keySentence:
      typeof obj.keySentence === "string" ? obj.keySentence.trim() : undefined,
    readerEmotion:
      typeof obj.readerEmotion === "string" ? obj.readerEmotion.trim() : undefined,
    note: typeof obj.note === "string" ? obj.note.trim() : undefined,
  };
}
