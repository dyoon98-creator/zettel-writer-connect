// Genre templates. Every template emits the canonical 7 H2 sections in order:
//   기획 / 뼈대 / 자료 / 초안 / 피드백 / 퇴고 메모 / 최종본
// Genre-specific H3 prompts live inside `## 기획` and `## 뼈대`.

import { Genre } from "../types";

export const CANONICAL_SECTIONS = [
  "기획",
  "뼈대",
  "자료",
  "초안",
  "피드백",
  "퇴고 메모",
  "최종본",
] as const;

export type CanonicalSection = (typeof CANONICAL_SECTIONS)[number];

const COMMON_TAIL = `## 자료

<!-- "관련 노트 추가" 액션으로 [[위키링크]]를 여기에 쌓아두세요. -->

## 초안

## 피드백

## 퇴고 메모

## 최종본
`;

function essay(): string {
  return `## 기획

### 핵심 메시지
<!-- 한 문장으로 — 이 글이 독자에게 남기는 단 하나의 문장. -->

### 독자
<!-- 누구에게 보내는 편지인가? -->

### 왜 지금 이 글인가
<!-- 내 안에서 이 이야기가 끓는 이유. -->

## 뼈대

### 도입
<!-- 사적인 장면 한 컷으로 시작. -->

### 전개
<!-- 1) 의문 → 2) 긴장 → 3) 발견. -->

### 결말
<!-- 핵심 메시지로 수렴. 여운을 남기는 마지막 한 줄. -->

${COMMON_TAIL}`;
}

function practical(): string {
  return `## 기획

### 독자가 풀고 싶은 문제
<!-- 한 문장 — 이 책/글을 다 읽고 나면 무엇을 할 수 있어야 하는가. -->

### 약속하는 결과
<!-- 측정 가능하게: "30분 안에 X를 만들 수 있다" 식으로. -->

### 차별점
<!-- 기존 자료와 다른 한 가지. -->

## 뼈대

### 챕터 윤곽
- 1장. 문제 정의 —
- 2장. 핵심 모델 —
- 3장. 단계별 실행 —
- 4장. 실패 케이스 —
- 5장. 회고와 다음 단계 —

### 각 챕터의 도입 훅
<!-- 독자가 "이 챕터를 안 읽으면 손해"라고 느끼게 만드는 한 줄씩. -->

${COMMON_TAIL}`;
}

function youtube(): string {
  return `## 기획

### 한 문장 후크
<!-- 썸네일/타이틀로도 쓸 수 있는 강한 한 문장. -->

### 시청자 페르소나
<!-- 어떤 영상을 보다가 이 영상을 누르게 되는가. -->

### 영상 길이·톤
<!-- 분 수 / 진지함·유머 비율. -->

## 뼈대

### Cold open (0–15s)
<!-- 가장 강한 한 컷. -->

### Hook (15–60s)
<!-- "왜 끝까지 봐야 하는가"의 약속. -->

### Body
<!-- 3-act: setup → conflict → payoff. -->

### CTA
<!-- 구독/다음 영상/링크 중 하나만. -->

${COMMON_TAIL}`;
}

function lecture(): string {
  return `## 기획

### 학습 목표
<!-- 수강 후 학생이 할 수 있어야 하는 것 (행동 동사로). -->

### 청중의 사전 지식
<!-- 어디서 시작하면 되는가. -->

### 한 시간 안에 다룰 핵심 개념
<!-- 3개 이내로 압축. -->

## 뼈대

### Opening (5분)
<!-- 왜 이 강의가 중요한가, 오늘 끝까지 들으면 무엇을 얻는가. -->

### 개념 블록 (각 10–15분)
- 개념 1 — 설명 → 예시 → 미니 실습
- 개념 2 — 설명 → 예시 → 미니 실습
- 개념 3 — 설명 → 예시 → 미니 실습

### 마무리 (10분)
<!-- 핵심 요약 + Q&A 트리거. -->

${COMMON_TAIL}`;
}

function world(): string {
  return `## 기획

### 세계의 한 줄
<!-- 이 세계에서 가장 다른 한 가지. -->

### 주인공의 결핍
<!-- 그/그녀가 이야기 끝에 채우거나 잃을 것. -->

### 중심 갈등
<!-- 인물 vs 세계 / 인물 vs 자기 자신 등. -->

## 뼈대

### 세계관 시트
- 시대·지리:
- 마법·기술 규칙:
- 권력 구조:
- 금기:

### 주요 인물
- 주인공 —
- 적대자 —
- 멘토/조력자 —

### 플롯 윤곽 (3막)
- 1막 (Setup):
- 2막 (Confrontation):
- 3막 (Resolution):

${COMMON_TAIL}`;
}

const BUILDERS: Record<Genre, () => string> = {
  essay,
  practical,
  youtube,
  lecture,
  world,
};

export const Templates = {
  /** Returns the markdown body (NOT including frontmatter or H1 title). */
  body(genre: Genre): string {
    return BUILDERS[genre]();
  },
};
