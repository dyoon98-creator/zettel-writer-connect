// templates.ts — 글쓰기 코치 액션 카탈로그.
//
// 출처: 김정운·양혁준 『챗GPT, 글쓰기 코치가 되어 줘』 (밀리의 서재).
// 책의 60+ 프롬프트 패턴을 7 카테고리 × 약 8 액션으로 정규화.
//
// 핵심 인사이트 — Chapter 10 의 "똑똑한 AI 편집자" GPTs 단축키 16개:
//   id/lg/mu/li/hu/sh/ph/sc/ss/em/fl + 1/2/3/4/5/6.
// 이 단축키들이 우리 슬래시 명령(`/`) 의 기반이 된다.

import type { CoachAction } from "./types";

/* eslint-disable max-lines */

// ─────────────────────────────────────────────────────────────────────────
// 어휘 (vocab) — 단어·표현 다듬기. 책 Chapter 3.
// ─────────────────────────────────────────────────────────────────────────

const VOCAB_ACTIONS: CoachAction[] = [
  {
    id: "vocab.noun-concrete",
    category: "vocab",
    label: "추상 명사 → 구체 명사",
    description: "막연한 추상 명사를 구체적인 사물·장면으로 바꿉니다.",
    contextScope: "sentence",
    promptTemplate:
      "이 문장에서 추상 명사를 찾아 더 구체적인 명사·이미지로 바꾼 후보 5개를 제안해 주세요. 각 후보는 한 줄로, 왜 더 구체적인지 짧게 덧붙이세요.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 3, 어휘 — 추상 → 구체",
  },
  {
    id: "vocab.verb-strengthen",
    category: "vocab",
    label: "동사 강화",
    description: "밋밋한 동사를 더 생생한 동사 5개로 추천합니다.",
    contextScope: "word",
    promptTemplate:
      "이 단어가 동사라면, 더 생생하고 한국어다운 동사 5개를 후보로 제안해 주세요. 단어가 동사가 아니라면 가장 가까운 동사형으로 바꾼 후 후보를 제안하세요. 각 후보는 한 단어 또는 짧은 구로.",
    saveTo: "replace-selection",
    shortcut: "동사",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 3, 어휘 — 동사·형용사",
  },
  {
    id: "vocab.adj-trim",
    category: "vocab",
    label: "형용사 줄이기",
    description: "수식어가 너무 많은 문장을 정확한 동사·명사로 압축합니다.",
    contextScope: "sentence",
    promptTemplate:
      "이 문장에서 형용사·부사가 과도합니다. 같은 의미를 유지하되 수식어를 절반 이하로 줄여 다시 써 주세요. 예시 2~3개로 제시.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 3, 어휘 — 동사·형용사",
  },
  {
    id: "vocab.onomatopoeia",
    category: "vocab",
    label: "의성어·의태어 추가",
    description: "한국어다운 의성어/의태어를 적절히 끼워 넣습니다.",
    contextScope: "sentence",
    promptTemplate:
      "이 문장에 어울리는 한국어 의성어·의태어를 한두 개 끼워 더 생생하게 다시 써 주세요. 과하지 않게.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 3, 어휘 — 의성어·의태어",
  },
  {
    id: "vocab.spell-check",
    category: "vocab",
    label: "맞춤법 교정",
    description: "국립국어원 표준에 맞게 맞춤법·띄어쓰기를 교정합니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 맞춤법·띄어쓰기를 국립국어원 표준에 맞게 교정해 주세요. 의미는 절대 바꾸지 말고, 교정한 부분만 [원본 → 수정] 목록으로 보여주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 3, 어휘 — 맞춤법; Chapter 10 편집 기준 18·19",
  },
  {
    id: "vocab.metaphor-suggest",
    category: "vocab",
    label: "비유 후보 5개",
    description: "추상 개념을 살리는 비유 후보를 5개 제안합니다.",
    contextScope: "sentence",
    promptTemplate:
      "이 문장 속 추상 개념을 살리는 비유 후보 5개를 제안해 주세요. 한국 독자에게 흔하지 않으면서 직관적으로 와닿는 비유로. 각 후보는 한 줄.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 3, 어휘 — 비유",
  },
  {
    id: "vocab.metaphor-cliche-check",
    category: "vocab",
    label: "흔한 비유 점검",
    description: "너무 흔한 비유·상투적 표현을 짚고 대안을 제시합니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 너무 흔한 비유·상투적 표현 (예: '하늘의 별 따기') 을 찾아 짚어 주고, 각각 대안 1~2개를 제시해 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 7 — 상투적 표현",
  },
  {
    id: "vocab.repeat-detect",
    category: "vocab",
    label: "반복 단어 탐지",
    description: "같은 단어가 짧은 구간에 반복되는 곳을 찾아 대안을 줍니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 짧은 구간에 같은 단어·표현이 반복되는 곳을 찾아 [위치 - 반복 단어 - 대안 2개] 형식으로 정리해 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 1 — 중언부언",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 구조 (structure) — 문장·문단·글 전체 구성. Chapter 4·5·9.
// ─────────────────────────────────────────────────────────────────────────

const STRUCTURE_ACTIONS: CoachAction[] = [
  {
    id: "structure.sentence-extend",
    category: "structure",
    label: "한 문장 이어주기",
    description: "막힌 자리에서 다음 한 문장을 AI 가 이어줍니다.",
    contextScope: "paragraph",
    promptTemplate:
      "작가가 여기서 한 문장 막혔습니다. 직전 문단의 흐름·문체를 그대로 이어서, 다음에 올 만한 한 문장을 후보 3개 제안해 주세요. 각 후보는 한 문장.",
    saveTo: "preview-only",
    shortcut: "이어",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 4 — 한 문장 주고받기 (확장 게임)",
  },
  {
    id: "structure.short-and-long",
    category: "structure",
    label: "짧고 긴 문장 번갈아",
    description: "긴 문장만 이어진 곳에 짧은 문장을 끼워 리듬을 살립니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단은 비슷한 길이의 문장이 이어져 리듬이 평이합니다. 짧은 문장과 긴 문장을 번갈아 쓰는 형태로 다시 써 주세요. 의미는 그대로.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 프롬프트 3-37 — 리듬감 (재즈처럼)",
  },
  {
    id: "structure.long-sentence-split",
    category: "structure",
    label: "긴 문장 나누기",
    description: "지나치게 긴 문장을 두세 문장으로 나눕니다 (단축키 sh).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 지나치게 긴 문장을 찾아 두세 문장으로 자연스럽게 나눠 주세요. 각각 [원본 → 분할안] 으로 보여주세요.",
    saveTo: "preview-only",
    shortcut: "sh",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 sh + 편집 기준 13",
  },
  {
    id: "structure.connectives",
    category: "structure",
    label: "접속사로 흐름 강화",
    description: "문장 간 논리적 흐름을 위해 접속사(그러나, 따라서, 게다가 등)를 더합니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 문장 간 논리적 흐름을 강화해 주세요. 필요한 곳에 그러나·따라서·게다가·요컨대·특히·그런데·그래도·다만·아니면·어쨌든·아무튼·실로·원래·그러면·대체 같은 접속사·접속 부사를 추가하거나, 다른 단어·표현으로 문장 간 논리 흐름을 강화하세요.",
    saveTo: "preview-only",
    shortcut: "3",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 3",
  },
  {
    id: "structure.headline-first",
    category: "structure",
    label: "두괄식 변환",
    description: "결론을 맨 앞으로 옮겨 두괄식 구조로 재배치합니다 (단축키 4).",
    contextScope: "scene",
    promptTemplate:
      "이 글의 마지막 문단을 처음 문단으로 위치를 바꾸고, 전체적인 글의 구조를 두괄식 형태로 변형해 주세요. 다시 쓴 글 전문을 보여주고, 어떤 부분이 어떻게 바뀌었는지 짧게 요약하세요.",
    saveTo: "feedback-section",
    shortcut: "4",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 4",
  },
  {
    id: "structure.flow-check",
    category: "structure",
    label: "흐름 점검",
    description: "문장과 문단의 연결이 자연스러운지 점검합니다 (단축키 fl).",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 문장과 문장 사이의 흐름이 자연스러운지 체크해 주세요. 또한 문단과 문단 사이의 연결이 자연스러운지 체크해 주세요. 적어도 3문장 이상, 3문단 이상 분석해서 어색하다면 수정안을 제시해 주세요.",
    saveTo: "feedback-section",
    shortcut: "fl",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 fl + 편집 기준 1",
  },
  {
    id: "structure.missing-section",
    category: "structure",
    label: "빠진 꼭지 찾기",
    description: "주제·핵심 메시지에 비춰 빠진 꼭지가 있는지 찾아냅니다.",
    contextScope: "project",
    promptTemplate:
      "이 원고의 핵심 메시지·대상 독자에 비춰, 지금 글에서 빠진 챕터·꼭지가 있다면 무엇인가요? 후보 3~5개를 제안하고, 각각 어떤 자리에 들어가면 좋을지 짧게 설명하세요.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 4 — 흐름 점검 / 빠진 꼭지",
  },
  {
    id: "structure.kishotenketsu",
    category: "structure",
    label: "기-승-전-결 분해",
    description: "글을 기-승-전-결 구조로 분해해 균형을 점검합니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글을 기-승-전-결 4단으로 분해해 각 단의 첫 문장과 핵심 한 줄을 정리해 주세요. 그 다음 어느 단이 너무 짧거나 긴지, 어느 단이 약한지 짚어 주세요.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 4 — 구조 분석",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 묘사 (description) — 장면·감각·이미지. Chapter 4·8.
// ─────────────────────────────────────────────────────────────────────────

const DESCRIPTION_ACTIONS: CoachAction[] = [
  {
    id: "description.from-photo",
    category: "description",
    label: "사진으로 묘사 만들기",
    description: "첨부한 사진을 보고 한국어 묘사 문장을 만듭니다.",
    contextScope: "none",
    promptTemplate:
      "첨부된 사진을 보고, 한 문단 길이(4~6 문장) 의 묘사 문장을 한국어로 써 주세요. 시각·청각·후각 등 다양한 감각을 섞어 주세요. AI 가 자주 쓰는 ~와 같다, 가능성, ~할 수 있다 같은 표현은 피해 주세요.",
    requiresAttachment: "image",
    saveTo: "inline",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 4 — 사진으로 묘사",
  },
  {
    id: "description.lit-passage",
    category: "description",
    label: "문학 속 묘사 찾기",
    description: "이런 장면·감정을 담은 문학 작품 속 묘사를 찾아 보여줍니다.",
    contextScope: "paragraph",
    requiresUserInput: true,
    userInputLabel: "어떤 장면·감정의 묘사를 찾고 싶나요?",
    promptTemplate:
      "작가가 묘사하고 싶은 장면·감정 (작가 추가 입력 참조) 을 잘 보여주는 한국 문학 작품 속 묘사 3개를 찾아 [작품 - 작가 - 인용 1~2 문장 - 무엇이 좋은지] 형식으로 정리해 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 4 — 문학 속 묘사",
  },
  {
    id: "description.show-not-tell",
    category: "description",
    label: "보여 주기로 바꾸기",
    description: "설명조 문장을 행동·디테일로 바꿔 'showing not telling'.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 설명조 (예: '슬프다') 인 부분을 찾아 행동·디테일·신체 반응으로 보여 주는 형태 (예: '고개를 떨구고 눈물 방울을 뚝뚝 떨어뜨렸다') 로 바꿔 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 17 — Showing not telling",
  },
  {
    id: "description.5-senses",
    category: "description",
    label: "5가지 감각 활용",
    description: "오감을 사용하도록 5군데 이상 교정합니다 (단축키 ss).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에 오감 (시각·청각·후각·미각·촉각) 을 사용해서 5군데 이상 교정해 주세요. 각각 [원본 → 수정안] 으로 보여주세요.",
    saveTo: "preview-only",
    shortcut: "ss",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 ss",
  },
  {
    id: "description.scene-paint",
    category: "description",
    label: "그림 그리듯 묘사",
    description: "선택한 부분을 그림 그리듯 묘사해 다시 씁니다 (단축키 sc).",
    contextScope: "sentence",
    promptTemplate:
      "이 부분을 그림 그리듯 묘사하는 방식으로 설명해 주세요. 시각적 디테일·구도·색감을 살려서 다시 써 주세요. 의미는 그대로.",
    saveTo: "preview-only",
    shortcut: "sc",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 sc",
  },
  {
    id: "description.emotion-add",
    category: "description",
    label: "감정 잘 느껴지도록",
    description: "감정 표현을 더해 독자가 더 깊이 느끼게 합니다 (단축키 em).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 감정이 잘 느껴지도록 교정해 주세요. 시적 비유, 감각적 디테일, 내면의 반응 묘사, 시간의 흐름에 대한 사색을 적절히 추가하세요. 단순한 형용사 나열은 피하세요.",
    saveTo: "preview-only",
    shortcut: "em",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 em + Chapter 8 감성 에세이",
  },
  {
    id: "description.tension-build",
    category: "description",
    label: "긴장감·박진감",
    description: "짧고 빠른 문장으로 긴장감을 만듭니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단을 짧고 빠른 문장 위주로 다시 써서 긴장감·박진감을 만드세요. 신체 반응·청각 디테일·점진적 고조를 활용하세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 — 감정의 파동 조절",
  },
  {
    id: "description.literary-quote",
    category: "description",
    label: "문학작품 이야기 가미",
    description: "글에 어울리는 문학작품 이야기를 가미합니다 (단축키 li).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 주제·정서에 어울리는 문학작품 (소설·시·에세이) 의 이야기를 한 줄 인용하거나 짧게 가미할 수 있는 자리를 찾아 제안해 주세요. 인용 시 출처 표기.",
    saveTo: "preview-only",
    shortcut: "li",
    expectedLength: "short",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 li",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 분석/패러디 (analysis) — 작가 분석·문체 모방. Chapter 4·5·8.
// ─────────────────────────────────────────────────────────────────────────

const ANALYSIS_ACTIONS: CoachAction[] = [
  {
    id: "analysis.author-style",
    category: "analysis",
    label: "좋아하는 작가 글 분석",
    description: "사용자가 좋아하는 작가 글을 4분야(문체·어휘·톤·구조) 로 분석합니다.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "분석할 작가의 글을 붙여 넣으세요",
    promptTemplate:
      "아래 글을 문체·어휘·톤의 분위기·구조 4 분야로 구체적으로 분석해 주세요. 각 분야마다 특징과 예시 인용을 들어주세요.",
    saveTo: "preview-only",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 프롬프트 3-41",
  },
  {
    id: "analysis.imitate",
    category: "analysis",
    label: "문체 모방하기",
    description: "좋아하는 작가의 문체로 같은 주제의 글을 짧게 다시 씁니다.",
    contextScope: "scene",
    requiresUserInput: true,
    userInputLabel: "어떤 작가의 문체를 흉내내고 싶나요? (예: 무라카미 하루키)",
    promptTemplate:
      "내 글의 주제는 그대로 두되, 작가가 지정한 작가의 문체로 짧은 글 (3~5 문단) 로 다시 써 주세요. 모방한 핵심 특성 2~3개를 짧게 짚어주세요.",
    saveTo: "preview-only",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 문체 변주",
  },
  {
    id: "analysis.parody",
    category: "analysis",
    label: "패러디",
    description: "유명 작가의 톤·구조로 패러디한 짧은 글을 만듭니다.",
    contextScope: "scene",
    requiresUserInput: true,
    userInputLabel: "어떤 작가/장르의 패러디를 원하나요?",
    promptTemplate:
      "내 글을 작가가 지정한 톤·구조로 패러디해 짧은 글 (3~4 문단) 로 다시 써 주세요. 끝에 어떤 요소를 패러디 했는지 한두 줄로 표시해 주세요.",
    saveTo: "preview-only",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 4 — 패러디",
  },
  {
    id: "analysis.style-extract",
    category: "analysis",
    label: "내 글의 스타일 분석",
    description: "내 글을 4 분야 (문체·어휘·톤·구조) 로 객관적으로 분석합니다.",
    contextScope: "scene",
    promptTemplate:
      "내 글을 다음 4 분야로 분석해 주세요: 문체 (문장 구성 방식), 어휘 (자주 사용하는 단어와 표현), 톤의 분위기 (글에서 느껴지는 감정·진솔함·철학·예술적 요소), 구조 (문단 구성·이야기 흐름·플롯·시간의 활용). 각 분야마다 특징·예시·강점·개선점을 정리하세요.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 프롬프트 3-41 — 내 글의 스타일",
  },
  {
    id: "analysis.serendipity",
    category: "analysis",
    label: "Serendipity 연결",
    description: "이 문장을 다른 분야의 이론과 우연히 연결해 새 아이디어를 도출합니다.",
    contextScope: "sentence",
    promptTemplate:
      "이 문장을 (1) 뇌과학 (2) 경제학·사회학 (3) 예술 (4) 자연과학 중 한 분야의 이론·개념과 'Serendipity (우연한 발견)' 의 관점에서 연결해 새로운 아이디어를 1개 제안해 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 6, 프롬프트 3-11~3-12",
  },
  {
    id: "analysis.book-quote-mission",
    category: "analysis",
    label: "책 속 문장 분석 + 미션",
    description: "책 속 문장을 분석하고 작가 시선·객관적 평을 줍니다.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "분석할 책 속 문장을 붙여 넣으세요",
    promptTemplate:
      "아래 문장을 분석하고 다음 미션을 수행해 주세요. (1) 챗GPT 시선으로 문장을 읽고 견해를 남겨 주세요. (2) 내가 견해를 남기면 그에 대한 객관적인 평을 해 주세요. (3) 핵심 단어 두 개를 [ ] 로 표시한 빈칸 퀴즈 형태로 변형해 주세요.",
    saveTo: "preview-only",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 6, 프롬프트 3-9~3-10",
  },
  {
    id: "analysis.philosopher-thought",
    category: "analysis",
    label: "철학자의 사유 추가",
    description: "글에 어울리는 철학자의 사유를 한 단락 더합니다 (단축키 ph).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 주제와 어울리는 철학자 (한국·동양·서양 모두 가능) 의 사유를 한 단락 (3~4 문장) 으로 가미해 주세요. 출처 (저자·저서) 를 명시하세요.",
    saveTo: "preview-only",
    shortcut: "ph",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 ph",
  },
  {
    id: "analysis.unique-idea",
    category: "analysis",
    label: "독특한 아이디어 가미",
    description: "글에 독특한 아이디어를 가미한 문장을 제안합니다 (단축키 id).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 핵심 메시지에 작가가 미처 생각하지 못한 독특한 관점·아이디어를 가미한 문장 후보 3개를 제안해 주세요. 각 후보는 한두 문장.",
    saveTo: "preview-only",
    shortcut: "id",
    expectedLength: "medium",
    responseFormat: "options",
    sourceBookSection: "Chapter 10, 단축키 id",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 퇴고 (revise) — 7가지 원칙 + 19 편집 기준 + 피드백. Chapter 5·10.
// ─────────────────────────────────────────────────────────────────────────

const REVISE_ACTIONS: CoachAction[] = [
  {
    id: "revise.passive",
    category: "revise",
    label: "수동태 → 능동태",
    description: "수동 표현을 능동으로 바꿉니다 (편집 기준 12).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 수동태 표현을 찾아 능동태로 바꿔 주세요. 예: '회의가 어제 진행되었다 → 우리는 어제 회의를 진행했다'. [원본 → 수정] 목록으로.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 12",
  },
  {
    id: "revise.modifier-trim",
    category: "revise",
    label: "불필요한 수식어 삭제",
    description: "수식어 남발을 정리합니다 (편집 기준 15).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 수식어 남발을 찾아 줄여 주세요. 예: '감동적인 영화를 보니, 뭉클한 마음이 들었고, 눈물이 날 정도로 슬프고 아름다운 감정이 들었다 → 이 영화는 감동적이고 아름다웠다'.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 15",
  },
  {
    id: "revise.repeat-expression",
    category: "revise",
    label: "반복 표현 제거",
    description: "같은 표현이 짧은 구간에서 반복되는 곳을 정리합니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 짧은 구간에 같은 표현이 반복되는 곳을 찾아 [위치 - 반복 - 대안] 형식으로 정리하세요.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 7원칙 중 반복 제거",
  },
  {
    id: "revise.high-register",
    category: "revise",
    label: "거시 화법 지우기",
    description: "거시적 추상 표현을 구체로 바꿉니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 '거시적 화법' (예: '인류는…', '우리 사회는…') 을 찾아 구체적인 인물·사례·일화로 바꿔 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 7원칙 중 거시 화법",
  },
  {
    id: "revise.pronoun-trim",
    category: "revise",
    label: "지칭 대명사 줄이기",
    description: "그/그녀/그것/이것 같은 대명사를 줄여 주어를 또렷이 합니다.",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 '그·그녀·그것·이·저' 같은 지칭 대명사를 줄이고, 가능하면 본래 명사로 바꿔 주세요. 의미가 모호해진 곳을 짚으세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 7원칙 중 지칭 대명사",
  },
  {
    id: "revise.translation-style",
    category: "revise",
    label: "번역체·일본식 조사",
    description: "~할 수 있는 능력 → ~할 수 있다 같은 번역체를 정리합니다 (편집 기준 9).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 번역체·일본식 조사를 찾아 한국어다운 표현으로 바꿔 주세요. 예: '~할 수 있는 능력 → ~할 수 있다', '회의는 팀장에 의해 연기되었다 → 팀장이 회의를 연기했다'. [원본 → 수정] 목록으로.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 9",
  },
  {
    id: "revise.korean-word",
    category: "revise",
    label: "한자어 → 우리말",
    description: "어려운 한자어를 우리말로 바꿉니다 (편집 기준 11).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 어려운 한자어를 우리말로 바꿔 주세요. 예: '귀책사유가 발생했다 → 책임질 일이 발생했다'. [원본 → 수정] 목록으로.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 11",
  },
  {
    id: "revise.subject-predicate",
    category: "revise",
    label: "주어-술어 호응",
    description: "주어와 술어가 안 맞는 곳을 찾아 고칩니다 (편집 기준 8).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에서 주어와 술어가 호응하지 않는 곳 (예: '학생들이 서점에서 책을 읽는다며, 조용한 분위기가 필요하다 → 학생들이 도서관에서 책을 읽기 때문에 조용한 분위기가 필요하다') 을 찾아 [원본 → 수정] 으로 정리하세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 8",
  },
  {
    id: "revise.term-consistency",
    category: "revise",
    label: "용어 일관성",
    description: "같은 의미인데 다른 단어로 부르는 곳을 통일합니다 (편집 기준 4·5).",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 같은 의미를 가진 용어를 다르게 사용한 곳을 찾아 통일안을 제시하세요. 예: '회사는 ↔ 기업은' 같은 흔들림. [용어 - 사용된 변형들 - 통일 추천] 형식.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10 편집 기준 4·5",
  },
  {
    id: "revise.off-topic",
    category: "revise",
    label: "주제 일탈 점검",
    description: "주제와 상관없이 엉뚱한 방향으로 흐른 부분을 짚습니다 (단축키 2).",
    contextScope: "scene",
    promptTemplate:
      "이 글의 주제와 핵심 메시지를 먼저 한 줄로 요약한 뒤, 주제와 상관없이 엉뚱한 방향으로 전개되는 문장·문단이 있는지 점검해 주세요. 있다면 [위치 - 어떻게 일탈했는지 - 수정 제안] 으로.",
    saveTo: "feedback-section",
    shortcut: "2",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 2",
  },
  {
    id: "revise.7-principles",
    category: "revise",
    label: "7가지 원칙 일괄 첨삭",
    description:
      "수동태·수식어·반복·거시화법·지칭·긴문장·번역체 — 7가지 원칙으로 글 전체 첨삭.",
    contextScope: "scene",
    promptTemplate:
      "이 글을 김정운 작가의 7가지 글 수정 원칙에 따라 일괄 첨삭해 주세요. 각 원칙별 섹션으로 나눠서: (1) 수동태 지양, (2) 불필요한 수식어 삭제, (3) 반복 표현 제거, (4) 거시 화법 지우기, (5) 지칭 대명사 줄이기, (6) 긴 문장 짧게, (7) 일본식 조사·번역체 피하기. 각 섹션에 [원본 → 수정] 사례 3~5 개씩.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 7가지 글 수정 원칙",
  },
  {
    id: "revise.review-bundle",
    category: "revise",
    label: "글 검토 (전체 일괄)",
    description: "7원칙 + 독자/편집자/구조 피드백 일괄. 헤더 '글 검토' 와 동일.",
    contextScope: "scene",
    promptTemplate:
      "이 글을 종합 검토해 주세요. 다음 5 영역으로 나눠서: (A) 7가지 글 수정 원칙별 첨삭 사례, (B) 독자 관점 피드백 (어디서 막히고 어디서 공감하는지), (C) 편집자 관점 피드백 (구조·논리·설득력), (D) 두괄식·미괄식 점검, (E) 다음 단계 추천 (어디를 더 다듬을지). 각 영역 5~7 줄.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 종합 검토",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 퇴고 — 피드백 (revise/feedback). Chapter 5·6.
// ─────────────────────────────────────────────────────────────────────────

const FEEDBACK_ACTIONS: CoachAction[] = [
  {
    id: "revise.feedback-reader",
    category: "revise",
    label: "독자 관점 피드백",
    description: "독자가 어디서 막히고 어디서 공감하는지 짚습니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글을 독자 관점에서 읽어 주세요. (1) 어디서 흥미를 느꼈는지, (2) 어디서 지루하거나 막혔는지, (3) 글의 핵심 메시지가 잘 전달됐는지 — 세 항목으로 정리하고 각 항목에 구체적인 인용을 곁들여 주세요.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 독자 피드백",
  },
  {
    id: "revise.feedback-editor",
    category: "revise",
    label: "편집자 관점 피드백",
    description: "구조·논리·설득력 — 편집자 관점으로 점검합니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글을 편집자 관점으로 점검해 주세요. (1) 구조의 균형 (도입·전개·결말), (2) 논리적 일관성, (3) 설득력 (주장과 근거의 연결), (4) 표현력 — 네 항목으로 정리하고 강점·개선점을 모두 짚어 주세요.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 편집자 피드백",
  },
  {
    id: "revise.feedback-logic",
    category: "revise",
    label: "논리적 타당성 점검",
    description: "근거가 타당한지, 주장이 일관되는지 점검합니다 (단축키 lg).",
    contextScope: "scene",
    promptTemplate:
      "이 글의 논리적 근거가 타당한지, 그리고 주제에서 전체적으로 한 가지로 일관성을 유지하고 있는지 점검해 주세요. 약한 부분 3~5 곳을 짚고 보강 방향을 제시하세요.",
    saveTo: "feedback-section",
    shortcut: "lg",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 lg",
  },
  {
    id: "revise.feedback-citation",
    category: "revise",
    label: "인용 제안",
    description: "주장을 뒷받침할 만한 인용·출처 후보를 제안합니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글의 주장을 뒷받침할 만한 인용·출처 (학술 논문·책·신문 기사) 후보 3~5 개를 제안해 주세요. 각 후보는 [출처 - 어느 부분에 인용하면 좋은지 - 핵심 한 줄] 형식으로.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 5 — 인용 제안",
  },
  {
    id: "revise.feedback-no-redundancy",
    category: "revise",
    label: "중언부언 점검",
    description: "한 얘기를 또 하고 반복하지 않는지 점검합니다 (단축키 1).",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 같은 얘기를 또 하고 반복하지 않는지 점검해 주세요. 반복되는 부분은 [위치 - 무엇이 중복인지 - 한 곳으로 합칠 안] 형식으로 정리하세요.",
    saveTo: "feedback-section",
    shortcut: "1",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 1",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 영감 (inspire) — 사고 훈련·브레인스토밍. Chapter 6·9.
// ─────────────────────────────────────────────────────────────────────────

const INSPIRE_ACTIONS: CoachAction[] = [
  {
    id: "inspire.brainstorm-3personas",
    category: "inspire",
    label: "3-페르소나 브레인스토밍",
    description: "글쓰기 코치 + 브레인스토밍 전문가 + 진행자 셋이 토론합니다.",
    contextScope: "project",
    requiresUserInput: true,
    userInputLabel: "어떤 주제로 브레인스토밍할까요?",
    promptTemplate:
      "다음 주제로 세 페르소나가 토론하는 형식으로 브레인스토밍해 주세요: (1) 글쓰기 코치 (작가 입장), (2) 브레인스토밍 전문가 (다양한 관점 발산), (3) 회의 진행자 (논의 정리). 각자 차례로 발언하고 마지막에 진행자가 정리·코치·전문가가 마무리 견해.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 6 — 3-페르소나 브레인스토밍",
  },
  {
    id: "inspire.random-noun",
    category: "inspire",
    label: "랜덤 단어로 영감",
    description: "랜덤 명사 5개를 받아 그중 하나로 한 문장 만듭니다.",
    contextScope: "none",
    promptTemplate:
      "한국어 랜덤 명사 5개를 제시해 주세요 (서로 분야가 다른 단어로). 그중 한 단어를 골라 그 단어로 시작하는 한 문장을 만들고, 그 문장을 한 문단으로 확장하는 방향을 제안해 주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 3 — 명사 연상 / 자유 글쓰기 게임",
  },
  {
    id: "inspire.deductive",
    category: "inspire",
    label: "연역적 사고 연습",
    description: "보편 원리 → 소전제 → 결론 → 증명 순으로 사고 훈련.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "어떤 분야의 보편 원리로 시작할까요? (비워두면 추천)",
    promptTemplate:
      "연역적 사고 훈련을 도와 주세요. 보편 원리를 하나 제안해 주고, 그에 따르는 [소전제 → 결론 → 증명] 형태로 도출해 보세요. 그 다음 작가가 보편 원리를 바꿔 적용해볼 수 있도록 응용 예시 1개 더.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 9, 프롬프트 3-23",
  },
  {
    id: "inspire.inductive",
    category: "inspire",
    label: "귀납적 사고 연습",
    description: "여러 관찰 → 공통 결론 도출.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "관찰 사례 3개를 적어 주세요 (비워두면 추천)",
    promptTemplate:
      "귀납적 사고 훈련을 도와 주세요. 작가가 관찰 사례 3개를 제시했다면 그로부터 공통 결론을 도출하세요. 비어 있다면 흥미로운 관찰 사례 3개를 만들고 결론을 도출해 보이세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 9, 프롬프트 3-24",
  },
  {
    id: "inspire.analogy",
    category: "inspire",
    label: "유추적 사고 — 두 단어 연결",
    description: "두 단어로 새로운 유추를 만들어 창의적 사고 훈련.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "유추할 두 단어 (예: '나침반, 인생')",
    promptTemplate:
      "작가가 제시한 두 단어로 새로운 유추를 만들어 주세요. 예: '나침반은 인생에 비유하면 가치관과 같다. 나침반이 언제나 북극을 가리키며 방향을 제시하듯, 가치관은 우리 삶의 방향을 올바르게 결정하는 역할을 맡는다.' 형식으로 한 문단.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "text",
    sourceBookSection: "Chapter 9, 프롬프트 3-25",
  },
  {
    id: "inspire.short-write-300",
    category: "inspire",
    label: "낯선 주제 300자",
    description: "낯선 주제를 받아 300~500자 짧은 글을 써 신경가소성 자극.",
    contextScope: "none",
    promptTemplate:
      "뇌의 신경가소성을 자극하기 위해 최신 트렌드를 반영한 낯선 주제 5개를 제안해 주세요. 작가가 그중 하나를 고르면 그 주제로 300~500 자 짧은 글의 시작 한 문단을 보여주세요.",
    saveTo: "preview-only",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 9, 프롬프트 3-26~3-29 — 신경가소성",
  },
  {
    id: "inspire.humor",
    category: "inspire",
    label: "익살스러운 표현",
    description: "유쾌하고 익살스러운 표현 후보를 제안합니다 (단축키 hu).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단에 어울리는 유쾌하고 익살스러운 표현 (한국 정서에 맞는 농담·말장난·재치 있는 비유) 후보 3 개를 제안해 주세요.",
    saveTo: "preview-only",
    shortcut: "hu",
    expectedLength: "short",
    responseFormat: "options",
    sourceBookSection: "Chapter 10, 단축키 hu",
  },
  {
    id: "inspire.music-quote",
    category: "inspire",
    label: "음악·가사 인용",
    description: "글에 어울리는 음악·가사를 인용해 분위기를 살립니다 (단축키 mu).",
    contextScope: "paragraph",
    promptTemplate:
      "이 문단의 정서·주제에 어울리는 한국·해외 곡의 가사 또는 음악 (장르) 을 인용하거나 짧게 가미할 만한 자리를 찾아 제안해 주세요. 인용 시 곡명·아티스트 표기.",
    saveTo: "preview-only",
    shortcut: "mu",
    expectedLength: "short",
    responseFormat: "text",
    sourceBookSection: "Chapter 10, 단축키 mu",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 리서치 (research) — 출처·사실 체크. Chapter 7.
// ─────────────────────────────────────────────────────────────────────────

const RESEARCH_ACTIONS: CoachAction[] = [
  {
    id: "research.fact-check",
    category: "research",
    label: "사실 체크",
    description: "글에서 검증이 필요한 주장을 찾아 출처 확인을 제안합니다.",
    contextScope: "scene",
    promptTemplate:
      "이 글에서 사실 확인이 필요한 주장 (수치·인용·역사적 사건·과학적 사실) 을 찾아 [주장 - 어떻게 확인할지 - 후보 출처 1~2개] 형식으로 정리해 주세요. 추측하지 말고 확인 필요 표시만 해 주세요.",
    saveTo: "feedback-section",
    expectedLength: "medium",
    responseFormat: "text",
    sourceBookSection: "Chapter 7 — 사실 체크",
  },
  {
    id: "research.cross-domain",
    category: "research",
    label: "다른 분야 연결",
    description: "주제와 인접한 다른 분야 (인문·기술·예술·역사·과학) 자료를 찾습니다.",
    contextScope: "project",
    requiresUserInput: true,
    userInputLabel: "관련 키워드 (예: 창작, 작가, 글쓰기)",
    promptTemplate:
      "작가가 제시한 키워드를 인문학·기술공학·예술·트렌드·역사·과학 6 분야로 연결해 각 분야별 관점·핵심 이론·대표 인용을 정리해 주세요. 출처 표기.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 7, 프롬프트 3-6~3-7",
  },
  {
    id: "research.summarize-source",
    category: "research",
    label: "자료 3줄 요약",
    description: "긴 자료를 3 줄 개조식으로 요약합니다.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "요약할 자료 (퍼플렉시티 답변·논문 발췌 등) 를 붙여 넣으세요",
    promptTemplate:
      "아래 자료에서 핵심을 찾아 3 줄 개조식으로 요약해 주세요. 추측하지 말고 자료에 있는 내용만.",
    saveTo: "preview-only",
    expectedLength: "short",
    responseFormat: "text",
    sourceBookSection: "Chapter 7, 프롬프트 3-28",
  },
  {
    id: "research.quiz-self",
    category: "research",
    label: "방금 학습한 내용 퀴즈",
    description: "방금 조사한 내용을 4지선다 퀴즈로 만들어 신경가소성 자극.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "퀴즈로 만들 학습 내용을 붙여 넣으세요",
    promptTemplate:
      "아래 내용을 토대로 4지선다 객관식 퀴즈 5 문제를 만들어 주세요. 각 문제 끝에 정답·해설을 붙이세요.",
    saveTo: "preview-only",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 9, 프롬프트 3-30",
  },
  {
    id: "research.outline-from-sources",
    category: "research",
    label: "자료로 글 구조 짜기",
    description: "수집한 자료를 도입-본론-결론 3 단계로 정리합니다.",
    contextScope: "none",
    requiresUserInput: true,
    userInputLabel: "수집한 자료를 모두 붙여 넣으세요",
    promptTemplate:
      "아래 수집한 자료를 분석해서 글의 구조를 만들어 주세요. 도입부 → 본론 → 결론 3 단계로. 각 단계에 (1) 핵심 메시지, (2) 인용할 자료, (3) 주의할 점을 정리하세요.",
    saveTo: "feedback-section",
    expectedLength: "long",
    responseFormat: "text",
    sourceBookSection: "Chapter 7 — 글 구조 짜기",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 카탈로그 export.
// ─────────────────────────────────────────────────────────────────────────

export const COACH_ACTIONS: CoachAction[] = [
  ...VOCAB_ACTIONS,
  ...STRUCTURE_ACTIONS,
  ...DESCRIPTION_ACTIONS,
  ...ANALYSIS_ACTIONS,
  ...REVISE_ACTIONS,
  ...FEEDBACK_ACTIONS,
  ...INSPIRE_ACTIONS,
  ...RESEARCH_ACTIONS,
];

export const COACH_ACTIONS_BY_ID: ReadonlyMap<string, CoachAction> = new Map(
  COACH_ACTIONS.map((a) => [a.id, a]),
);
