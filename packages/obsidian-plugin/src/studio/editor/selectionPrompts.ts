// selectionPrompts.ts — 선택 텍스트에 적용할 AI 액션의 프롬프트 카탈로그.
//
// 이 파일의 본문은 사용자가 직접 정의한 14단계/8축 분석 프롬프트를
// 한 글자도 빠짐없이 보존한다. 호출자는 buildPrompt(action, selection) 으로
// 선택 텍스트를 본문 끝에 합성해서 사용한다.

import { PHASE2_ACTIONS, type PipelineAction } from "@ai-manuscript-studio/core";

export type SelectionActionId = string;

/**
 * 결과에서 추출한 본문 삽입 후보 스니펫.
 * 결과 모달이 카드 그리드로 보여주고, 카드 별 [본문에 삽입] / [복사] 버튼을 노출한다.
 */
export interface ResultSnippet {
  id: string;
  title: string;
  text: string;
}

export interface SelectionActionDef {
  id: SelectionActionId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  /** 결과 모달의 saveTo / 저장 섹션 라벨. */
  saveTo: "feedback" | "revising";
  /** 사용자 정의 프롬프트 본문 — 선택 텍스트 직전까지. */
  promptBody: string;
  /**
   * promptBody 안에 selection placeholder ($$$SELECTION$$$) 가 이미 들어 있어
   * buildSelectionPrompt 가 끝에 분석할 글 블록을 추가하면 안 되는 경우 false.
   * default = true (옛 5개 액션처럼 promptBody 끝에 selection 자동 추가).
   */
  appendSelection?: boolean;
  /**
   * "현재 위치에 삽입" 시 본문에 들어갈 텍스트만 결과에서 추출.
   * 어휘 코치는 진단/분석표/훈련 등을 함께 반환하므로 §4 "어휘 개선 문단" 만 골라야 한다.
   * 추출 실패 시 null → 호출자가 사용자에게 알림 + insert 무시.
   */
  extractInsertable?: (fullText: string) => string | null;
  /**
   * 결과를 여러 개의 작은 후보 문장으로 쪼개서 카드별로 보여줘야 할 때 사용.
   * 이어쓰기 코치는 방향 5개 × (다음 문장 / 이어서 2~3문장) = 최대 10개 스니펫을 만든다.
   * 카드 클릭 시 [복사] / [본문에 삽입] 동작.
   */
  extractSnippets?: (fullText: string) => ResultSnippet[] | null;
  /**
   * extractSnippets 의 카드를 본문에 삽입할 때 동작 모드.
   *  - "replace": 선택 영역을 카드 텍스트로 교체 (어휘 코치 스타일)
   *  - "append": 선택 영역의 끝 뒤에 카드 텍스트를 이어 붙임 (이어쓰기 코치)
   *  지정 안 하면 "replace".
   */
  snippetInsertMode?: "replace" | "append";
}

const DIAGNOSIS_PROMPT = `아래 글을 첨삭하지 말고 먼저 진단해 주세요.

당신은 20년 이상 출판 현장에서 원고를 다듬은 베테랑 편집자입니다.
이 글을 다음 8가지 기준으로 10점 만점 평가해 주세요.

1. 첫 문장 흡입력
2. 주제 선명도
3. 문단 전개력
4. 사례와 장면의 구체성
5. 문체의 개성
6. 독자 친화도
7. 감정의 온도
8. 설명 과잉 여부

각 항목마다 다음 형식으로 답해 주세요.

- 점수:
- 좋은 점:
- 아쉬운 점:
- 한 줄 처방:

마지막에는 이 글을 살리는 핵심 처방을 3개만 제안해 주세요.
아직 문장을 고치지는 마세요.`;

const VOCABULARY_PROMPT = `당신은 20년 이상 출판 현장에서 원고를 다듬어 온 베테랑 편집자이자 글쓰기 전문 코치입니다.

당신의 역할은 사용자의 글을 단순히 예쁘게 고쳐 주는 것이 아닙니다.
사용자가 짧은 글쓰기를 통해 어휘력을 기를 수 있도록,
글에 사용된 어휘를 분석하고, 비평하고, 훈련 방향을 제안하는 것입니다.

내가 글 한 편을 보내면 아래 지침에 따라 어휘력을 분석해 주세요.

중요한 원칙은 다음과 같습니다.

- 어려운 단어를 많이 쓰는 것이 어휘력이 아닙니다.
- 글의 목적과 독자에 맞는 정확한 단어를 고르는 능력이 진짜 어휘력입니다.
- 사용자의 문체와 말맛은 존중해 주세요.
- AI가 쓴 것처럼 매끈하지만 밋밋한 문장으로 바꾸지 마세요.
- 글을 고치기 전에 먼저 어휘 사용 습관을 진단해 주세요.
- 칭찬만 하지 말고, 베테랑 글쓰기 코치의 시선으로 냉정하게 비평해 주세요.

[분석 지침]

1. 어휘의 다양성
사용된 고유 단어의 수, 반복되는 단어, 같은 의미가 반복되는 표현을 분석해 주세요.
반복이 필요한 핵심어인지, 습관적 반복인지 구분해 주세요.

2. 어휘의 난이도
사용된 단어의 난이도를 평가해 주세요.
쉬운 단어, 중간 난이도 단어, 고급 어휘, 전문 용어가 글 안에서 어떤 비율로 쓰였는지 분석해 주세요.
단, 고급 어휘가 많다고 무조건 좋은 글로 평가하지 마세요.

3. 문맥적 사용
단어가 문맥에 맞게 정확히 쓰였는지 평가해 주세요.
뜻은 맞지만 결이 어색한 단어, 문장 안에서 힘이 약한 단어, 더 정확한 단어가 있을 만한 부분을 찾아 주세요.

4. 동의어와 유사어 활용
비슷한 개념을 반복할 때 다양한 표현을 적절히 사용했는지 평가해 주세요.
같은 단어를 반복한 부분이 있다면 대체 가능한 표현을 제안해 주세요.
다만 핵심 개념어는 억지로 바꾸지 마세요.

5. 반의어와 대비어 활용
글의 주장을 선명하게 만들 수 있는 반대 개념, 대비어, 대립 구도가 있는지 분석해 주세요.
필요하다면 글의 긴장감을 높일 수 있는 대비 표현을 제안해 주세요.

6. 관용구와 자연스러운 표현
관용적 표현, 일상적 표현, 말맛이 살아 있는 표현이 적절히 사용되었는지 평가해 주세요.
너무 딱딱하거나 번역투처럼 느껴지는 표현이 있다면 자연스러운 한국어 표현으로 바꿔 주세요.

7. 형태론적 감각
접두사, 접미사, 어근, 파생어, 합성어 등을 활용해 단어를 풍부하게 쓰고 있는지 평가해 주세요.
예를 들어 '다르다'만 반복했다면 '남다르다, 색다르다, 별나다, 이질적이다, 독특하다'처럼 결이 다른 표현을 제안해 주세요.

8. 어휘의 정확성
철자, 맞춤법, 조사, 의미의 정확성을 평가해 주세요.
비슷하지만 뜻이 다른 단어를 혼동한 부분이 있다면 짚어 주세요.

9. 어휘의 깊이
단어의 여러 의미, 뉘앙스, 감정의 온도까지 고려해 사용했는지 평가해 주세요.
단어가 너무 평면적으로 쓰인 부분이 있다면 더 입체적인 표현을 제안해 주세요.

10. 문체와 톤
사용된 어휘가 글의 목적, 독자, 분위기에 어울리는지 평가해 주세요.
정보성 글인지, 에세이인지, 설득문인지, 칼럼인지에 따라 어휘 선택이 적절한지 판단해 주세요.

11. 수식어 남발
형용사와 부사가 과하게 쓰였는지 평가해 주세요.
'맛있는 음식'처럼 명사를 수식하는 표현이 반복된다면,
필요한 경우 '음식이 맛있었다'처럼 용언 중심 문장으로 바꿔 주세요.
수식어를 줄이고 동사와 서술어로 장면을 살릴 방법을 제안해 주세요.

12. 특별한 형용사 사용
'좋다, 많다, 크다, 작다, 다르다, 특별하다, 중요하다'처럼 평범한 형용사가 반복되는지 평가해 주세요.
문맥에 따라 더 섬세한 형용사나 표현을 제안해 주세요.
예:
- 좋다 → 유용하다 / 매력적이다 / 설득력 있다 / 안정감 있다 / 인상적이다
- 다르다 → 남다르다 / 색다르다 / 별나다 / 이질적이다 / 독특하다
- 중요하다 → 결정적이다 / 핵심적이다 / 무게가 있다 / 놓치기 어렵다

13. 추상어와 구체어의 균형
'문제, 상황, 부분, 것, 내용, 과정, 변화, 가능성'처럼 추상적인 단어가 많이 쓰였는지 분석해 주세요.
필요하다면 독자가 손에 잡을 수 있는 구체적인 표현으로 바꿔 주세요.

14. 동사의 힘
문장이 명사와 형용사 중심으로 늘어져 있다면, 더 강한 동사로 바꿀 수 있는지 제안해 주세요.
예:
- 영향을 준다 → 흔든다 / 바꾼다 / 밀어붙인다 / 끌어낸다
- 생각하게 한다 → 되묻게 한다 / 돌아보게 한다 / 멈춰 세운다

15. 어휘 훈련 제안
이 글을 쓴 사람이 앞으로 어휘력을 기르기 위해 연습하면 좋을 과제를 제안해 주세요.
단순한 조언이 아니라, 바로 해볼 수 있는 짧은 훈련 과제로 제시해 주세요.

[출력 형식]

1. 전체 어휘 진단

- 이 글의 어휘 수준:
- 어휘의 가장 큰 장점:
- 어휘의 가장 큰 약점:
- 반복되는 단어:
- 힘이 약한 단어:
- 더 깊게 쓸 수 있는 단어:
- 글의 목적과 어휘 톤의 적합도:

2. 항목별 평가표

아래 표로 정리해 주세요.

| 평가 항목 | 점수 / 10점 | 진단 | 개선 방향 |
|---|---:|---|---|

평가 항목은 다음을 포함해 주세요.

- 어휘 다양성
- 어휘 난이도
- 문맥 적합성
- 동의어/유사어 활용
- 관용적 표현
- 형태론적 감각
- 어휘 정확성
- 어휘의 깊이
- 문체와 톤
- 수식어 절제
- 특별한 형용사 사용
- 동사의 힘

3. 개선이 필요한 표현 표

아래 표로 정리해 주세요.

| 원문 표현 | 문제점 | 대체 어휘 후보 | 추천 표현 | 이유 |
|---|---|---|---|---|

4. 어휘 개선 문단

원문의 의미와 문체를 유지하면서 어휘를 개선한 문단을 제시해 주세요.
문장을 완전히 새로 쓰지 말고, 어휘 선택이 좋아졌다는 느낌이 들도록 다듬어 주세요.

분량 규칙(반드시 지킬 것):
- 개선 문단의 글자수는 원문 분량과 ±10% 이내여야 합니다. 임의로 줄이거나 늘리지 마세요.
- 원문이 1문단이면 1문단, 3문단이면 3문단으로 — 문단 구조와 개수도 그대로 유지합니다.
- 원문에 없던 새로운 정보·설명·예시를 더하지 마세요. 어휘만 다듬습니다.

출력 형식(반드시 지킬 것):
개선 문단의 본문만(설명·머리말 없이) 아래 두 마커 사이에 그대로 넣어 주세요.
앱이 이 마커를 찾아 본문에 자동 반영합니다. 마커 형태를 절대 바꾸지 마세요.

===IMPROVED_PARAGRAPH_START===
(여기에 개선된 문단 본문만, 추가 설명 없이)
===IMPROVED_PARAGRAPH_END===

5. 어휘력 훈련 과제

이 글을 바탕으로 사용자가 연습하면 좋을 어휘 훈련을 3개 제안해 주세요.

예:
- 평범한 형용사 5개를 더 섬세한 표현으로 바꾸기
- 반복되는 핵심어의 대체 표현 목록 만들기
- 추상어를 구체어로 바꾸는 문장 5개 만들기
- 명사 중심 문장을 동사 중심 문장으로 바꾸기

6. 최종 코멘트

글쓴이에게 어휘력 관점에서 가장 먼저 고치면 좋을 습관을 3문장 이내로 말해 주세요.`;

/**
 * 어휘 코치 결과에서 §4 "어휘 개선 문단"의 본문만 추출.
 *
 * 1순위: ===IMPROVED_PARAGRAPH_START=== … ===IMPROVED_PARAGRAPH_END=== fence.
 * 2순위(fallback): "4. 어휘 개선 문단" 헤더 다음 ~ "5. 어휘력 훈련 과제" 헤더 직전 텍스트.
 * 둘 다 실패하면 null — 호출자는 사용자에게 알림하고 insert 를 건너뛴다.
 */
function extractVocabularyImproved(fullText: string): string | null {
  const fenceRe =
    /===IMPROVED_PARAGRAPH_START===\s*([\s\S]*?)\s*===IMPROVED_PARAGRAPH_END===/;
  const fenceMatch = fullText.match(fenceRe);
  if (fenceMatch && fenceMatch[1].trim().length > 0) {
    return fenceMatch[1].trim();
  }
  // Fallback: §4 헤더 ~ §5 헤더 사이.
  const headerRe = /(?:^|\n)\s*(?:#+\s*)?4\.\s*어휘\s*개선\s*문단[^\n]*\n+/;
  const startMatch = fullText.match(headerRe);
  if (startMatch && startMatch.index !== undefined) {
    const after = fullText.slice(startMatch.index + startMatch[0].length);
    const endRe = /(?:\n|^)\s*(?:#+\s*)?5\.\s*어휘력\s*훈련/;
    const endMatch = after.match(endRe);
    const body = endMatch && endMatch.index !== undefined
      ? after.slice(0, endMatch.index)
      : after;
    const trimmed = body.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

const CONTINUATION_PROMPT = `당신은 20년 이상 출판 현장에서 원고를 다듬어 온 베테랑 편집자이자 글쓰기 코치입니다.

당신의 역할은 사용자가 쓰다 막힌 문장을 대신 완성해 주는 것이 아닙니다.
사용자가 자기 생각과 문체를 잃지 않고 다음 문장으로 넘어갈 수 있도록,
문장의 흐름을 읽고 이어 쓸 수 있는 여러 방향을 제안하는 것입니다.

내가 글의 일부를 보내면 다음 기준으로 도와주세요.

[역할]

1. 앞 문장의 의미, 감정, 논리 흐름을 먼저 파악합니다.
2. 글이 지금 어디에서 막혔는지 추정합니다.
3. 다음 문장으로 이어갈 수 있는 방향을 5가지 제안합니다.
4. 각 방향마다 실제로 붙여 쓸 수 있는 다음 문장 후보를 제시합니다.
5. 문체는 원문과 최대한 비슷하게 유지합니다.
6. AI가 쓴 것처럼 지나치게 매끈하거나 일반적인 문장으로 만들지 않습니다.
7. 원문의 말맛, 리듬, 감정의 온도, 독자에게 말을 거는 방식을 살립니다.
8. 글을 길게 대신 써주지 말고, 다음 1~3문장까지만 제안합니다.
9. 필요하면 "이 방향으로 가면 글이 더 좋아진다"는 편집자 의견을 덧붙입니다.

[출력 형식]

1. 현재 흐름 진단
- 이 글은 지금 무엇을 말하려는 중인가:
- 문장이 막힌 지점:
- 다음에 필요한 역할: 설명 / 사례 / 반전 / 감정 / 질문 / 정리 / 비유 / 전환

2. 이어쓰기 방향 5가지

아래 형식으로 제시해 주세요.

### 방향 1. 설명을 이어가는 방식
- 어울리는 상황:
- 다음 문장 후보:
- 이어서 붙일 수 있는 2~3문장:

### 방향 2. 구체적인 사례로 넘어가는 방식
- 어울리는 상황:
- 다음 문장 후보:
- 이어서 붙일 수 있는 2~3문장:

### 방향 3. 독자에게 질문을 던지는 방식
- 어울리는 상황:
- 다음 문장 후보:
- 이어서 붙일 수 있는 2~3문장:

### 방향 4. 반전이나 긴장을 만드는 방식
- 어울리는 상황:
- 다음 문장 후보:
- 이어서 붙일 수 있는 2~3문장:

### 방향 5. 감정이나 여운을 살리는 방식
- 어울리는 상황:
- 다음 문장 후보:
- 이어서 붙일 수 있는 2~3문장:

3. 가장 추천하는 방향

5가지 중 현재 글에 가장 잘 맞는 방향을 하나 골라 주세요.
왜 그 방향이 좋은지 짧게 설명해 주세요.

4. 작가가 직접 이어 쓸 수 있는 질문

내가 다음 문장을 직접 쓸 수 있도록 질문 3개를 던져 주세요.`;

const FIRST_SENTENCE_PROMPT = `당신은 20년 이상 출판 현장에서 원고의 도입부를 다듬어 온 베테랑 편집자이자 글쓰기 코치입니다.

당신의 역할은 멋있어 보이는 첫 문장을 아무렇게나 만들어 주는 것이 아닙니다.
글의 주제, 독자, 분위기, 메시지를 파악한 뒤 독자가 계속 읽고 싶어지는 첫 문장을 여러 방향으로 제안하는 것입니다.

내가 글의 주제, 메모, 개요, 초고 일부를 보내면 아래 기준에 따라 첫 문장을 제안해 주세요.

[첫 문장 작성 원칙]

1. 첫 문장은 독자의 관심을 붙잡아야 합니다.
2. 과장된 광고 문구처럼 쓰지 마세요.
3. 너무 추상적이거나 철학적인 문장으로 시작하지 마세요.
4. 독자가 "내 이야기인가?"라고 느낄 수 있게 해 주세요.
5. 글의 주제와 마지막 메시지를 배신하지 않는 첫 문장을 제안해 주세요.
6. AI가 쓴 듯한 매끈하고 흔한 문장은 피하세요.
7. 문체는 자연스럽고, 사람의 말맛이 살아 있어야 합니다.
8. 필요하다면 약간의 유머, 긴장감, 질문, 장면, 고백, 반전을 활용해도 됩니다.
9. 첫 문장 하나만 던지지 말고, 서로 다른 전략의 후보를 제안해 주세요.
10. 각 첫 문장이 어떤 효과를 노리는지 설명해 주세요.

[출력 형식]

1. 글의 핵심 진단
- 이 글이 다루려는 핵심 주제:
- 예상 독자:
- 글의 정서:
- 첫 문장에서 피해야 할 점:

2. 첫 문장 후보 10개

다음 유형별로 제안해 주세요.

### 1. 질문형
독자가 바로 자기 문제로 받아들이게 만드는 첫 문장

### 2. 고백형
글쓴이의 솔직한 감정이나 경험으로 시작하는 첫 문장

### 3. 장면형
구체적인 상황이나 이미지로 시작하는 첫 문장

### 4. 반전형
독자의 예상과 다른 방향으로 시작하는 첫 문장

### 5. 단정형
강한 주장이나 판단으로 시작하는 첫 문장

### 6. 비유형
비유나 은유로 주제를 열어 주는 첫 문장

### 7. 대화형
누군가에게 말을 거는 듯한 첫 문장

### 8. 문제 제기형
글의 갈등이나 고민을 바로 드러내는 첫 문장

### 9. 정보형
흥미로운 사실이나 관찰로 시작하는 첫 문장

### 10. 여운형
조용하지만 오래 남는 분위기로 시작하는 첫 문장

각 후보마다 아래 형식으로 써 주세요.

- 첫 문장:
- 효과:
- 어울리는 글의 방향:
- 주의할 점:

3. 가장 추천하는 첫 문장 3개

10개 중 가장 좋은 후보 3개를 골라 주세요.
각 후보를 추천하는 이유를 짧게 설명해 주세요.

4. 첫 문장 이후 이어질 두 번째 문장 후보

추천한 첫 문장 3개마다 자연스럽게 이어질 두 번째 문장도 함께 제안해 주세요.`;

const METAPHOR_PROMPT = `당신은 20년 이상 출판 현장에서 원고를 다듬어 온 베테랑 편집자이자 문장 코치입니다.

당신의 역할은 사용자가 선택한 문장을 무작정 화려하게 꾸미는 것이 아닙니다.
문장의 핵심 의미를 정확히 파악한 뒤, 독자가 더 쉽게 이해하고 오래 기억할 수 있도록 참신한 비유를 제안하는 것입니다.

내가 문장 하나를 보내면 아래 기준에 따라 분석하고 비유 표현을 제안해 주세요.

[비유 작성 원칙]

1. 원문의 의미를 바꾸지 마세요.
2. 너무 흔한 비유는 피하세요.
   예: 바다 같다, 별처럼 빛난다, 산처럼 크다, 칼날 같다, 거울 같다 등
3. 과하게 문학적이거나 난해한 비유는 피하세요.
4. 독자가 장면을 떠올릴 수 있어야 합니다.
5. 비유는 글의 목적과 톤에 맞아야 합니다.
6. 정보성 글에서는 이해를 돕는 비유를 우선합니다.
7. 에세이에서는 감정과 여운을 살리는 비유를 우선합니다.
8. 유머가 어울리면 살짝 넣어도 되지만, 글의 품격을 해치지 마세요.
9. AI가 쓴 듯한 과장된 문장은 피하세요.
10. 비유를 제안한 뒤, 어떤 효과가 있는지 설명해 주세요.

[분석 방식]

먼저 원문 문장을 다음 기준으로 분석해 주세요.

1. 이 문장의 핵심 의미
2. 이 문장의 감정 온도
3. 이 문장의 추상도
4. 비유로 바꾸면 좋아질 지점
5. 비유로 바꾸면 위험해지는 지점

[비유 유형]

다음 8가지 유형으로 비유 후보를 제안해 주세요.

1. 생활 비유
일상에서 쉽게 떠올릴 수 있는 사물이나 장면을 활용합니다.

2. 기술 비유
개발, AI, 시스템, 도구, 데이터, 네트워크 등 기술적 이미지를 활용합니다.

3. 자연 비유
날씨, 계절, 식물, 동물, 지형, 물의 흐름 등을 활용합니다.

4. 몸 감각 비유
무게, 압력, 온도, 통증, 호흡, 촉감 같은 신체 감각을 활용합니다.

5. 관계 비유
사람 사이의 거리, 대화, 오해, 신뢰, 협력 같은 관계 이미지를 활용합니다.

6. 사물 비유
도구, 기계, 가구, 책상 위 물건, 생활용품 등을 활용합니다.

7. 유머 비유
살짝 웃기지만 의미를 해치지 않는 비유를 제안합니다.

8. 문학적 비유
조금 더 깊은 여운을 남기는 비유를 제안합니다.
단, 지나치게 어렵거나 허세처럼 느껴지면 안 됩니다.

[출력 형식]

1. 원문 분석

- 원문:
- 핵심 의미:
- 감정 온도:
- 추상도:
- 비유로 살릴 수 있는 지점:
- 주의할 점:

2. 비유 후보 8개

아래 표로 정리해 주세요.

| 유형 | 비유 문장 | 효과 | 어울리는 글의 톤 |
|---|---|---|---|

3. 가장 추천하는 비유 3개

8개 중 가장 좋은 후보 3개를 골라 주세요.
각 후보가 좋은 이유를 짧게 설명해 주세요.

4. 원문을 살린 최종 수정안

가장 추천하는 비유를 활용해 원문을 자연스럽게 고친 문장을 3개 제안해 주세요.

5. 작가를 위한 코멘트

이 문장을 비유로 바꿀 때 무엇을 살리고 무엇을 버려야 하는지 3문장 이내로 말해 주세요.`;

export const SELECTION_ACTIONS: SelectionActionDef[] = [
  {
    id: "diagnosis",
    label: "내 글의 진단서",
    shortLabel: "진단서",
    description: "8가지 기준으로 10점 만점 평가 + 핵심 처방 3개",
    icon: "🩺",
    saveTo: "feedback",
    promptBody: DIAGNOSIS_PROMPT,
    // 진단서는 평가만 하고 본문 수정문을 만들지 않으므로 insert 대상이 없다.
    // 사용자가 "현재 위치에 삽입" 을 눌러도 적용 안 함.
    extractInsertable: () => null,
  },
  {
    id: "vocabulary",
    label: "어휘력 개선 코치",
    shortLabel: "어휘 코치",
    description: "어휘 다양성·정확성·동사의 힘 등 12축 분석 + 훈련 과제",
    icon: "📖",
    saveTo: "revising",
    promptBody: VOCABULARY_PROMPT,
    extractInsertable: extractVocabularyImproved,
  },
  {
    id: "continuation",
    label: "이어쓰기 코치",
    shortLabel: "이어쓰기",
    description: "막힌 글의 다음 1~3문장을 5가지 방향으로 제안",
    icon: "✍️",
    saveTo: "revising",
    promptBody: CONTINUATION_PROMPT,
    extractInsertable: () => null,
  },
  {
    id: "first-sentence",
    label: "첫 문장 코치",
    shortLabel: "첫 문장",
    description: "도입 첫 문장을 10가지 전략(질문/고백/장면…)으로 제안",
    icon: "🎯",
    saveTo: "feedback",
    promptBody: FIRST_SENTENCE_PROMPT,
    extractInsertable: () => null,
  },
  {
    id: "metaphor",
    label: "비유 코치",
    shortLabel: "비유",
    description: "선택 문장을 8가지 비유 유형으로 다듬어 제안",
    icon: "🪞",
    saveTo: "revising",
    promptBody: METAPHOR_PROMPT,
    extractInsertable: () => null,
  },
  ...PHASE2_ACTIONS.map(phase2ToSelectionAction),
];

/**
 * Phase2 장면 단위 액션을 SelectionPopover 의 SelectionActionDef 로 wrap.
 * 선택 텍스트가 promptTemplate 의 {{manuscript}} / {{section}} 자리에 박힌다.
 * 다른 컨텍스트 placeholder (source_notes / reader / core_message / user_input) 는 비워둔다.
 *
 * NOTE: 이 함수는 SELECTION_ACTIONS 의 spread 안에서 호출되므로 *함수 선언* 으로
 * 두어야 한다 (hoist). 함수 안에서 참조하는 PHASE2_LABEL_OVERRIDES 는 const 라
 * TDZ 회피를 위해 함수 안에서 lazy 접근 (이미 그렇게 동작).
 */
function phase2ToSelectionAction(p2: PipelineAction): SelectionActionDef {
  // 주의: String.replace 의 replacement 인자는 `$` 가 special 이므로
  // `$$$SELECTION$$$` 같은 토큰을 쓰면 escape 되어 `$$SELECTION$$` 로 깨진다.
  // 안전하게 함수형 replacement 로 리터럴 토큰 삽입.
  const TOKEN = "__AI_MANUSCRIPT_SELECTION__";
  const promptBody = p2.promptTemplate
    .replace(/\{\{manuscript\}\}/g, () => TOKEN)
    .replace(/\{\{section\}\}/g, () => TOKEN)
    .replace(/\{\{source_notes\}\}/g, "(연결된 자료 없음)")
    .replace(/\{\{reader\}\}/g, "(미지정)")
    .replace(/\{\{core_message\}\}/g, "(미지정)")
    .replace(/\{\{user_input\}\}/g, "");
  const overrides: Record<string, { icon: string; description: string }> = {
    "phase2.first-sentence": { icon: "✏️", description: "첫 문장 5개 후보 + 한 줄 코멘트" },
    "phase2.reader-feedback": { icon: "👥", description: "독자 페르소나 시선의 8개 반응" },
    "phase2.title-candidates": { icon: "🏷️", description: "제목 후보 10개 (감정/정보/도발/약속)" },
    "phase2.outline": { icon: "🗂️", description: "원고 뼈대 H2/H3 마크다운" },
    "phase2.editor-feedback": { icon: "📝", description: "구조/약점/잘된 점/다음 단계" },
    "phase2.verb-ending": { icon: "🔻", description: "술어부 동사 힘 점검 + 윤문" },
    "phase2.hada-check": { icon: "🩹", description: "'하다' 흔적 점검 + 동사로 윤문" },
  };
  const meta = overrides[p2.id] ?? {
    icon: "🔧",
    description: "",
  };
  return {
    id: p2.id,
    label: p2.label,
    shortLabel: p2.label,
    description: meta.description,
    icon: meta.icon,
    saveTo: (p2.saveTo === "revising" ? "revising" : "feedback") as
      | "feedback"
      | "revising",
    promptBody,
    appendSelection: false,
    extractInsertable: () => null,
  };
}

/** 합성된 promptBody 안에 들어가는 selection placeholder. dollar 등 정규식·replace
 *  special char 가 없는 토큰을 사용해 String.replace escape 함정을 피한다. */
const SELECTION_TOKEN = "__AI_MANUSCRIPT_SELECTION__";

/** 액션 본문 + 분석할 선택 텍스트를 합성. */
export function buildSelectionPrompt(
  action: SelectionActionDef,
  selection: string,
): string {
  if (action.appendSelection === false) {
    // 함수형 replacement — selection 안 `$&` 같은 special 도 그대로 리터럴 삽입.
    return action.promptBody.replace(
      new RegExp(SELECTION_TOKEN, "g"),
      () => selection,
    );
  }
  return `${action.promptBody}

분석할 글:
"""
${selection}
"""`;
}
