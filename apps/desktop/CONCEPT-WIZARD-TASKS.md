# Concept Wizard — Implementation Tasks

> 책 한 권의 컨셉/시놉시스/12-30장 목차를 옵시디언 노트 컨텍스트로 함께 짜는 5화면 순차 마법사. 2026-05-06 `/socrates` 토론 결과.

---

## Scope

**JTBD**: 옵시디언 볼트의 노트와 단편적 사고 조각이 흩어진 작가가, AI 와 다턴 대화로 컨셉 → 시놉시스 → 12-30장 목차를 함께 짠다 — 흩어진 사고를 책 한 권 구조로 조립하기 위해.

**Must (이번 버전)**
1. 컨셉 다턴 대화 (1단계)
2. 시놉시스 + 12-30장 목차 일괄 생성 (2-3단계)
3. 옵시디언 노트 컨텍스트 주입 (모든 단계)
4. 모든 결과물 옵시디언 `.md` 영구 저장

**Won't (이번 버전 OUT)**
- 장 세분화 (4단계)
- 장면 본문 자동 생성 (5단계)
- 영문 우선
- 멀티 작가 협업
- 분리된 도구 호출 모드 (한 마법사로 통합)

**UI 형태**: 중앙 모달 5화면 순차 마법사 — `Cmd+.` 로 잠시 닫고 binder 참조 후 재개 가능.

**기술 스택**: 기존 그대로 — Tauri + React + TipTap + Anthropic API.

---

## Phase 1 — 인프라 (T1 ~ T3 병렬 가능)

### T1. ConceptWizard 상태 + 스키마 확장

**위치**: `packages/core/src/project/schema.ts`, `apps/desktop/src/state/wizardStore.ts` (신규)

- `ConceptDraftSession` 타입:
  ```ts
  { id, seed, attachedNotes: string[], conversation: Msg[],
    conceptParagraph, synopsis, outline: OutlineChapter[],
    stage: "seed"|"concept"|"synopsis"|"outline"|"done",
    createdAt, updatedAt }
  ```
- `BinderProject` 에 `pendingWizard?: { sessionId }` (재진입 복구)
- Zustand `wizardStore`: 단계별 상태 + persist
- 단위 테스트: 단계 전이 4가지

### T2. Anthropic streaming 클라이언트

**위치**: `apps/desktop/src-tauri/src/commands/ai.rs` 보강, `apps/desktop/src/ai/streamingChat.ts` 신규

- 기존 AI 클라이언트가 streaming 지원하는지 점검
- 미지원 시 SSE 스트림 endpoint + 프론트 `useStreamingChat` 훅
- 옵시디언 노트 컨텍스트를 system prompt 에 주입할 슬롯 (template literal)

### T3. 옵시디언 노트 컨텍스트 read

**위치**: `apps/desktop/src/vaultAdapter.ts` 보강

- `[[wiki-link]]` 또는 노트 제목 입력 → vault root 기준 `.md` 본문 fetch (`vault_read_file` 재사용)
- `fetchNotesForContext(linkList: string[]): Promise<string>` — 본문 concat + 헤더 (`### [[노트제목]]\n…`)
- 노트 못 찾으면 graceful skip + console.warn

---

## Phase 2 — 5화면 마법사 (T4 ~ T8, T1-T3 끝나야 시작)

### T4. 화면 1: 시드 입력

**위치**: `apps/desktop/src/wizard/Step1Seed.tsx`

- 한 줄 시드 input (`placeholder: "어떤 책을 쓰고 싶나요?"`)
- `[[wiki-link]]` 첨부 영역 (binder 트리에서 드래그 OR 직접 타이핑 자동완성)
- 톤/장르 라디오 (소설 / 에세이 / 논픽션 / 시나리오)
- "다음" → `stage: "concept"`

### T5. 화면 2: 컨셉 다턴 대화 (chat)

**위치**: `apps/desktop/src/wizard/Step2Concept.tsx`

- Chat UI: AI 메시지 + 작가 답 누적 (좌측 70%)
- 사이드(우측 30%): 누적된 컨셉 단락 live preview
- 노트 추가 버튼 (`[[link]]` 인라인 첨부)
- AI 가 "이제 충분히 모였어요" 신호 보내거나 작가가 직접 "다음"
- 종료 시 `conceptParagraph` 확정 → `stage: "synopsis"`

### T6. 화면 3: 시놉시스 streaming + 인라인 편집

**위치**: `apps/desktop/src/wizard/Step3Synopsis.tsx`

- 진입 시 자동 1회 AI 호출: concept + 노트 → 시놉시스 단락 streaming
- streaming 끝나면 contenteditable 로 전환 → 작가 인라인 편집
- 버튼: "다시 다듬기 (재제안)" / "다음" → `stage: "outline"`

### T7. 화면 4: 목차 master-detail (12-30장)

**위치**: `apps/desktop/src/wizard/Step4Outline.tsx`

- 진입 시 자동 1회 AI 호출: concept + synopsis + 노트 → 12-30장 streaming
- **좌측 (40%)**: 장 제목 리스트 (dnd-kit 드래그 reorder, 우클릭 메뉴: 병합/분리/삭제)
- **우측 (60%)**: 선택된 장의 일세 인라인 편집 + "이 장만 재제안" 버튼
- 하단: "전체 재제안" / "다음" → `stage: "done"`

### T8. 화면 5: 완료 + binder 주입

**위치**: `apps/desktop/src/wizard/Step5Commit.tsx`, `apps/desktop/src/state/projectStore.ts` 보강

- 결과 요약 (concept / synopsis / 12-30장 미리보기)
- 옵시디언 저장 위치 미리보기 (`<vault>/3 Writing/<slug>/...`)
- "프로젝트 생성":
  - `project.json` + `binder.json` + `planning.md` 생성
  - 장 폴더 12-30개 + 각 장의 빈 `.md` (frontmatter: `type: writing-scene, label: planned, synopsis: <장 일세>`)
- 모달 닫힘 → 새 프로젝트 binder 화면 진입

---

## Phase 3 — 통합 (T9 ~ T11, T4-T8 끝난 뒤)

### T9. 자동 저장 / 재진입 복구

**위치**: T1 wizardStore + Tauri vault commands

- 모든 단계 변화마다 `<vault>/.ai-manuscript-studio/wizard-sessions/<id>.md` 에 partial commit
- 앱 재시작 시 pending 세션 감지 → "이전 마법사를 이어서 진행하시겠습니까?" 토스트
- 사용자 거부 시 세션 archive

### T10. 마법사 entry point wiring

**위치**: `apps/desktop/src/binder/BinderToolbar.tsx` (또는 메인 헤더)

- 기존 "새 프로젝트" 버튼 → `<ConceptWizard />` 모달 열기 (기존 인터뷰 마법사 교체)
- 모달 백드롭 클릭 막기 (실수로 컨텍스트 잃지 않게)
- `Cmd+.` 핸들러: 모달 임시 닫기 (state 보존), 다시 누르면 같은 단계로 복귀

### T11. Happy-path E2E 테스트

**위치**: `apps/desktop/tests/e2e/concept-wizard.spec.ts` (Playwright)

- 시드 → 다턴 (mock AI 5턴) → 시놉시스 → 목차 12장 → binder 주입 확인
- 도중 모달 닫힘 → 재진입 시 마지막 단계 복구
- 옵시디언 노트 `[[link]]` 첨부 → AI prompt 에 노트 본문 포함되는지 verify (mock 인터셉트)

---

## 빈 / 실패 상태 (모든 화면 공통)

| 상황 | 동작 |
|------|------|
| 옵시디언 노트 0개 첨부 | 시드만으로 진행 (system prompt 노트 슬롯 빈 채로) |
| AI 호출 실패 / 타임아웃 | 단계 `.md` 보존 + "재시도" 버튼 노출, 작가는 그 자리에서 잃는 것 없음 |
| 마법사 도중 강제 종료 | T9 자동 저장으로 복구, 다음 진입 시 토스트 |
| `[[link]]` 못 찾음 | graceful skip + 컨셉 패널에 "X 노트는 찾지 못해 컨텍스트 없이 진행" 표시 |

---

## Build & Deploy (각 Phase 완료 후)

CLAUDE.md §1 참조. 한 세트로 항상 실행:

1. `pnpm tsc --noEmit`
2. `pnpm tauri build`
3. `osascript -e 'tell application "AI 원고실" to quit' 2>/dev/null`
4. `pkill -f "/Applications/AI 원고실.app" 2>/dev/null`
5. `rm -rf "/Applications/AI 원고실.app"`
6. `cp -R "apps/desktop/src-tauri/target/release/bundle/macos/AI 원고실.app" /Applications/`
7. `lsregister -f "/Applications/AI 원고실.app"`
8. devtools 로 wiring 확인

---

## 의존성 그래프

```
T1 ──┬── T4 ──┐
T2 ──┼── T5 ──┤
T3 ──┴── T6 ──┼── T9 ─── T10 ─── T11
         T7 ──┤
         T8 ──┘
```

- **T1 / T2 / T3**: 병렬 (인프라)
- **T4 ~ T8**: T1-T3 끝난 뒤 병렬 가능, 단 T8 은 T4-T7 의 결과 데이터 필요
- **T9 / T10 / T11**: 마지막에 직렬

---

## 결정 추적 (이번 토론에서 정해진 갈래)

| 질문 | 결정 |
|------|------|
| AI 가 끌어내는 방식 | 제안형 + 다턴 분할 |
| MVP 범위 | 1-3단계 (컨셉 → 시놉시스 → 목차) |
| 책 분량 | 처음부터 12-30장 통째 |
| 주 사용자 | 본인 + 옵시디언 헤비유저 작가 동료 |
| 차별화 축 | 옵시디언/제텔카스텐 통합 |
| 흐름 구조 | 순차 마법사 (한 흐름) |
| UI 형태 | 중앙 모달 (Cmd+. 토글) |
| 목차 가지치기 UI | master-detail (좌 리스트 / 우 상세) |
