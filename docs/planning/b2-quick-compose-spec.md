*Version: v1.0 (2026-05-18)*

# B2 Quick Compose — 설계 명세

> 설계 전용 문서. 코드 변경 없음. 구현은 대표님 승인 후 B2 태스크로 진행.

---

## 문제

B1 커뮤니케이션 스킬팩은 작동하지만 진입 마찰이 높습니다:
- 4.Writing 프로젝트를 생성하거나 열어야 액션에 접근 가능
- `user_input` 필드에 의도 + 압축 프롬프트를 매번 수동으로 합성해 붙여넣기
- 수신자·형식·길이 같은 맥락 정보를 별도 필드 없이 텍스트로 설명해야 함
- 카카오톡·이메일 같은 즉석 커뮤니케이션에는 프로젝트 기반 흐름이 과잉

---

## 목표

4.Writing 프로젝트 없이 즉석으로 커뮤니케이션 텍스트를 생성·복사하는 **단일 Obsidian 커맨드** 제공.

---

## 커맨드

```
AI 원고실: 즉석 커뮤니케이션 작성
```

Command palette에서 호출 가능. 단축키 바인딩 선택적.

---

## 입력 필드 (Quick Compose Modal)

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| **형식 (register)** | select | 필수 | email / kakao / telegram / report / summary / memo |
| **전달 의도 (intent)** | textarea | 필수 | 무엇을, 누구에게, 왜 전달할지 자유 입력 |
| **참고 텍스트 (source)** | textarea | 선택 | 현재 에디터 선택 텍스트 자동 채우기; 직접 입력도 가능 |
| **수신자/독자 (reader)** | text input | 선택 | 이메일 수신자, 보고 대상 등 |
| **길이 힌트 (length)** | select | 선택 | 짧게 / 보통 / 길게 |
| **문체 모드 (style mode)** | select | 선택 | 수동 붙여넣기(현재) / 자동 적용(B3 이후) |

**문체 모드 상세**:
- `수동 붙여넣기` (B2 기본): 아래 "문체 가이드" textarea가 표시됨. VoicePane 압축 프롬프트 붙여넣기 안내 포함.
- `자동 적용` (B3 이후): 현재 StyleGuide를 레지스터에 맞게 자동 주입. B2에서는 UI 항목만 표시, 비활성화.

---

## 출력

| 출력 | 동작 |
|---|---|
| **미리보기** | 모달 하단 결과 영역에 렌더링 |
| **클립보드 복사** | "복사" 버튼 클릭 → 결과 텍스트 클립보드 복사 |
| **현재 파일 삽입** | "삽입" 버튼 클릭 → 현재 에디터 커서 위치에 삽입 |
| **저장 (선택)** | "draft로 저장" 토글 → 현재 프로젝트의 draft 섹션에 추가 (프로젝트가 없으면 비활성) |

**외부 발송 버튼 없음.** Gmail API / Kakao API / Telegram API 연동 없음.

---

## 아키텍처 제약

| 항목 | 제약 |
|---|---|
| **Genre 확장** | X. 기존 Genre 타입 수정 없음 |
| **SaveTarget 확장** | X. 기존 draft/revising/feedback/materials/plan 활용 |
| **B1 skillpack 재사용** | O. register 선택 → 해당 B1 액션(comms.*)으로 라우팅 |
| **외부 API** | Gmail/Kakao/Telegram API 연동 없음 |
| **프로젝트 의존** | 빠른 compose는 프로젝트 없이 작동. 저장만 프로젝트 유무 확인 |
| **새 파일 생성** | X. 모달에서 클립보드 복사 또는 현재 파일 삽입만 |

---

## register → B1 action 라우팅 테이블

| register 선택 | 호출 액션 |
|---|---|
| email (초안) | `comms.email-draft` |
| email (다듬기) | `comms.email-polish` |
| kakao | `comms.kakao-short` |
| telegram | `comms.telegram-brief` |
| report | `comms.report-polish` |
| summary | `comms.summary-briefing` |
| memo | `comms.memo-capture` |

email은 "초안/다듬기" 서브 선택 표시. 다른 형식은 단일 액션.

---

## B2에서 변경되는 파일

```
packages/obsidian-plugin/src/studio/comms/QuickComposeModal.tsx  (신규)
packages/obsidian-plugin/src/main.ts  (command 등록 추가)
```

변경하지 않는 파일:
```
packages/core/src/skillpack/types.ts   — SaveTarget/Genre 수정 없음
packages/core/src/skillpack/SkillPackLoader.ts  — 수정 없음
_skillpacks/comms-studio/**  — 수정 없음 (B1 그대로 재사용)
```

---

## B2 수용 기준 (future implementation gate)

- [ ] Command palette에서 "AI 원고실: 즉석 커뮤니케이션 작성" 표시됨
- [ ] 6가지 register 선택 가능 (email-draft/email-polish/kakao/telegram/report/summary/memo)
- [ ] intent textarea 비어있으면 실행 버튼 비활성화
- [ ] source 필드에 현재 선택 텍스트 자동 채우기 작동
- [ ] 문체 모드 "수동 붙여넣기" 선택 시 문체 가이드 textarea 표시
- [ ] 결과 프리뷰 표시됨 (마크다운 렌더링)
- [ ] "복사" 버튼 → 클립보드 복사 확인
- [ ] "삽입" 버튼 → 현재 에디터 커서에 삽입 확인
- [ ] 외부 발송 버튼 없음 확인
- [ ] `pnpm --filter @ai-manuscript-studio/obsidian-plugin test` PASS
- [ ] `pnpm --filter @ai-manuscript-studio/obsidian-plugin build` PASS
- [ ] Genre/SaveTarget 타입 변경 없음 확인

---

## 테스트 계획

**단위 테스트**:
- register → action ID 라우팅 함수: 7개 케이스 모두 검증
- intent 빈 값 → 실행 차단 로직
- source 자동 채우기: 선택 텍스트 있을 때 / 없을 때 각각

**통합 테스트** (수동):
1. Obsidian에서 커맨드 실행 → 모달 열림 확인
2. email-draft 선택 + intent 입력 → 결과 생성 확인
3. kakao 선택 → 3~5줄 이내 결과 확인
4. "복사" 후 외부 앱에 붙여넣기 확인
5. 에디터에서 텍스트 선택 후 커맨드 실행 → source 자동 채우기 확인

**회귀 테스트**:
- 기존 4.Writing 프로젝트 기반 액션 미영향 확인
- B1 skillpack 직접 실행 경로 미영향 확인

---

## 미결 결정 사항

| 항목 | 현재 상태 | 결정 필요 시점 |
|---|---|---|
| email 서브 선택 UI (초안/다듬기 toggle) | 미설계 | B2.2 구현 전 |
| "저장" 기능 — 프로젝트 없을 때 동작 | 스킵 or 신규 파일 생성? | B2.2 구현 전 |
| 단축키 기본값 | 미정 | B2.2 구현 전 |
| 문체 모드 "자동 적용" 활성화 시점 | B3 완료 후 | B3 이후 |
