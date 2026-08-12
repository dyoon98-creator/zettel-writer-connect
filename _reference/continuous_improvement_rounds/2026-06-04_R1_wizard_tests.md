*Version: v1.0 (2026-06-04)*

# Continuous Improvement Round Report — 14.zettel-writer-connect R1

## 1. 프로젝트
- 이름: 14.zettel-writer-connect / 경로: …/14.zettel-writer-connect
- 상태: improved
- 유형: pnpm 모노레포 — AI 원고실(ai-manuscript-studio, 고유 핵심) + zettel-connect(13의 fork, 분기됨) + 레거시 Tauri. remote=fork(zettel-writer-connect)

## 2. 개선 주제
AI 원고실 코어의 wizard 기능(~1158줄)이 활성 테스트 0건이던 사각지대(§7.3.6) 축소 — WizardEngine 순수 상태머신 테스트 복구 + 재활성화.

## 3. 확인한 현재 기능
- 코어 테스트(실측): jest 287 passed / 32 skipped → **302 passed / 22 skipped**.
- wizard 4개 suite 전부 describe.skip + @ts-nocheck("Phase 3 단계 5→3 압축, 재작성까지 일시 비활성"). 실제 WIZARD_STAGES는 **4단계**(motive→audience-message→tone→structure-pick) — 헤더 주석의 '3단계'도 stale.

## 4. 확인한 문제
- (해결) WizardEngine 테스트 stale·비활성 → 현행 구조로 복구.
- (백로그) wizard 나머지 3 suite + WriterStarterPack 여전히 skip.
- (사용자 결정) §8 doc drift + 13/14 분기 + stale 정식경로.

## 5. 조사
- 코어 테스트 baseline 실행 + wizard 소스/타입/구 테스트 read. sub-agent 가드레일(버그면 lock 금지·STOP) 적용 — 버그 미발견.

## 6. 만든 테스트
| 테스트 | 목적 | 기존 | 개선 후 | 판단 |
|---|---|---|---|---|
| WizardEngine.test.ts (15) | 상태머신 불변식·전이·finalize | skip(11, 5단계 stale) | 15 PASS(재활성) | ✓ |
- 불변식 중심(active 항상 0~1, WIZARD_STAGES 파생)이라 단계 재변경에도 견고. Opus 재실행 15/15 + 코어 302 확인.

## 7. 수정한 내용
| 파일 | 변경 | 이유 | 검증 |
|---|---|---|---|
| packages/core/tests/wizard/WizardEngine.test.ts | 5단계 stale → 현행 재작성, describe.skip 제거, @ts-nocheck 제거 | 코어 상태머신 회귀가드 복구 | jest 15/15, 코어 302 |
- 커밋: `2e7a566`. 푸시 X. 소스 무변경.

## 8. 반영하지 않음 + 다음 후보 / ⚠️ 사용자 결정
| 항목 | 내용 | 종류 |
|---|---|---|
| wizard 나머지 3 suite | Conductor/MockBridge/PlanningMdWriter + WriterStarterPack(env-gated) 재작성 | 다음 라운드 후보(통합성↑·위험↑) |
| ⚠️ src 주석 doc drift | types.ts:9 "4단계"는 맞으나 다른 곳 stale: WizardEngine.ts:161 "마지막(tone)"(실제 structure-pick), :237 "구조 단계 없다"(structure-pick 존재) | 사용자 확인 후 주석 정정 |
| ⚠️ 13/14 zettel-connect 분기 | 14의 packages/zettel-connect는 13의 fork인데 코드 분기됨(structural-score.ts 상이). 13 R1 tie-break 수정이 14 사본엔 미적용 | 통합/동기화 = 아키텍처 결정(사용자) |
| ⚠️ stale 정식경로 | README/CLAUDE.md "정식 소스=/Users/futurewave/..." 이 머신에 부재 | 경로 갱신(사용자) |

## 9~11
- 커밋 O(2e7a566)/푸시 X. 남은 리스크: wizard 통합 경로(Conductor 등) 미커버. 다음 후보 §8.
