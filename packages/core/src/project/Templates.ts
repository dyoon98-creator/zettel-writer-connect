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

<!-- "관련 노트 추가" 액션으로 [[위키링크]]를 여기에 쌓아두세요. 초안과 자료는 분리 보관. -->

## 초안

## 피드백

## 퇴고 메모

<!-- 큰 수정 전에 스냅샷 저장(Cmd+Shift+S). 개정 전 원문을 보존한 뒤 퇴고를 시작한다. -->

## 최종본

<!-- 출력 채널(Word/PDF/PPT 등)과 형식을 여기서 선택한다. 장르·문체는 바뀌지 않는다. -->
`;

function investmentStrategyMemo(): string {
  return `## 기획

### 의사결정 맥락
<!-- 어떤 결정을 내리기 위한 메모인가? 한 문장으로. -->

### 핵심 전제
<!-- 이 판단이 서는 근거 — 데이터, 전제, 가정. -->

### 리스크 / 반론
<!-- 이 판단이 틀릴 수 있는 조건. -->

## 뼈대

<!-- 각 섹션은 독립 카드: 요점(시놉시스) 한 줄 → 본문 순서로 작성. 조각별로 자료를 연결한다. -->

### 현황 요약
<!-- 지금 어떤 상황인가? 수치 포함. -->

### 판단 및 권고
<!-- 무엇을 해야 하는가, 왜 지금인가. -->

### 다음 액션
<!-- 누가, 언제, 무엇을. -->

${COMMON_TAIL}`;
}

function investmentReport(): string {
  return `## 기획

### 보고 목적
<!-- 어떤 의사결정자에게, 무엇을 결정하게 하기 위한 보고인가. -->

### 펀드/대상 개요
<!-- 전략, 자산군, 운용 기간, AUM 등 핵심 수치. -->

### 보고 기간
<!-- 기준일 / 대상 기간. -->

## 뼈대

<!-- 각 섹션은 독립 카드: 요점(시놉시스) 한 줄 → 본문 순서로 작성. 조각별로 자료를 연결한다. -->

### 운용 현황
<!-- 수익률, 벤치마크 대비, 주요 포지션. -->

### 시장 환경 분석
<!-- 거시 환경, 섹터 동향, 주요 이벤트. -->

### 향후 전략 및 리스크
<!-- 포트폴리오 방향, 주요 리스크 요인. -->

${COMMON_TAIL}`;
}

function legalAccountingReview(): string {
  return `## 기획

### 검토 대상
<!-- 계약서명, 조항번호, 법률/회계 이슈 요약. -->

### 검토 목적
<!-- 어떤 판단 또는 의사결정을 지원하는 검토인가. -->

### 의뢰인/수신자
<!-- 누구를 위한 검토인가. -->

## 뼈대

<!-- 각 섹션은 독립 카드: 요점(시놉시스) 한 줄 → 본문 순서로 작성. 조각별로 자료를 연결한다. -->

### 쟁점 분석
<!-- 각 쟁점별 법적/회계적 검토 내용. -->

### 리스크 평가
<!-- 고위험 / 중위험 / 저위험 항목 분류. -->

### 권고사항
<!-- 수정 요청, 보완 필요 사항, 협상 여지. -->

${COMMON_TAIL}`;
}

function columnEssay(): string {
  return `## 기획

### 핵심 메시지
<!-- 한 문장으로 — 이 글이 독자에게 남기는 단 하나의 문장. -->

### 독자
<!-- 누구에게 보내는 글인가? -->

### 왜 지금 이 글인가
<!-- 이 시점에 이 주제를 쓰는 이유. -->

## 뼈대

### 도입
<!-- 강한 첫 문장 또는 사적인 장면 한 컷. -->

### 전개
<!-- 1) 의문 → 2) 긴장 → 3) 발견. -->

### 결말
<!-- 핵심 메시지로 수렴. 여운을 남기는 마지막 한 줄. -->

${COMMON_TAIL}`;
}

function lecturePresentation(): string {
  return `## 기획

### 학습 목표
<!-- 수강/청취 후 청중이 할 수 있어야 하는 것 (행동 동사로). -->

### 청중의 사전 지식
<!-- 어디서 시작하면 되는가. -->

### 한 세션 안에 다룰 핵심 개념
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

function longFormManuscript(): string {
  return `## 기획

### 독자가 풀고 싶은 문제
<!-- 한 문장 — 이 글을 다 읽고 나면 무엇을 얻어야 하는가. -->

### 약속하는 결과
<!-- 측정 가능하게: "읽고 나면 X를 할 수 있다" 식으로. -->

### 차별점
<!-- 기존 자료와 다른 한 가지. -->

## 뼈대

### 챕터 윤곽
- 1장. 문제 정의 —
- 2장. 핵심 모델 —
- 3장. 단계별 실행 —
- 4장. 사례 및 검증 —
- 5장. 회고와 다음 단계 —

### 각 챕터의 도입 훅
<!-- 독자가 "이 챕터를 안 읽으면 손해"라고 느끼게 만드는 한 줄씩. -->

${COMMON_TAIL}`;
}

const BUILDERS: Record<Genre, () => string> = {
  "investment-strategy-memo": investmentStrategyMemo,
  "investment-report":        investmentReport,
  "legal-accounting-review":  legalAccountingReview,
  "column-essay":             columnEssay,
  "lecture-presentation":     lecturePresentation,
  "long-form-manuscript":     longFormManuscript,
};

export const Templates = {
  /** Returns the markdown body (NOT including frontmatter or H1 title). */
  body(genre: Genre): string {
    return BUILDERS[genre]();
  },
};
