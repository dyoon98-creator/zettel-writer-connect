*Version: v1.0 (2026-05-18)*

# Scrivener 글쓰기 철학 통합 설계 노트

## 1. 외부 출처 — Scrivener 핵심 철학

Literature & Latte 공식 소스 (https://www.literatureandlatte.com/scrivener) 에서 확인된 핵심 원칙:

| Scrivener 원칙 | 설명 |
|---|---|
| Typewriter·Ring-binder·Scrapbook | 초안/구조/자료를 하나의 프로젝트 안에, 각각 다른 역할로 분리 |
| Binder | 긴 문서를 섹션/폴더/문서 조각으로 나눔. 카드 단위 이동으로 구조 재배치 |
| Corkboard | 각 섹션에 인덱스 카드(시놉시스) 부착. 카드 이동 = 원고 이동 |
| Outliner | 시놉시스·단어수·메타데이터 개요 뷰. 구조 재배치 가능 |
| Scrivenings mode | 작은 조각을 따로 쓰되, 선택된 조각들을 하나의 연속 문서로 읽기/편집 |
| Research within reach | 배경 자료를 원고 옆에 보관. 초안과 자료 분리 |
| Snapshots | 큰 수정 전 섹션을 동결·비교·복원 |
| Compile/export | 쓰기 형식과 최종 출력 형식 분리. Word/PDF/ePub 등으로 컴파일 |
| Metadata/status/labels | 진척도·분류가 1등 시민 |
| Won't tell you how to write | 구조·도구 제공; 저자가 결정권을 가짐 |

## 2. 이미 들어가 있는 부분 (코드 기반)

| Scrivener 원칙 | 현재 코드 위치 | 상태 |
|---|---|---|
| Binder 다중 파일 구조 | `packages/core/src/project/schema.ts` line 1 주석, `ProjectMeta` + `binder.json` + `SceneFrontmatter` | ✅ 엔진 레벨 |
| Corkboard/Outliner 데이터 | `BinderNode.synopsis`, `status`, `label`, `customMetadata` | ✅ 데이터 모델 |
| Binder 조작 | `BinderIO.ts`: add/remove/move/path/walk | ✅ I/O 레벨 |
| Snapshots | `SnapshotIO.ts` (Scrivener Snapshots 역할 명시) | ✅ I/O 레벨 |
| 7섹션 캐노니컬 템플릿 | `Templates.ts`: 기획/뼈대/자료/초안/피드백/퇴고 메모/최종본 | ✅ 템플릿 레벨 |
| Scrivenings mode UI | `apps/desktop/src/editor/ScrivenerEditor.tsx` | ⚠️ **레거시 데스크톱 전용 — 활성 제품 아님** |

## 3. 이번에 통합한 부분

### 3.1 Templates.ts — 워크플로우 가이드 주석

`COMMON_TAIL` (모든 장르 공통) 에 추가:
- `## 자료`: 초안과 자료 분리 보관 명시 (Research within reach)
- `## 퇴고 메모`: 큰 수정 전 스냅샷 저장 습관 안내 (Snapshots)
- `## 최종본`: 출력 채널·형식 선택 안내 (Compile/export 분리)

투자·법률 장르(`investmentStrategyMemo`, `investmentReport`, `legalAccountingReview`) `## 뼈대` 에 추가:
- 각 섹션을 독립 카드로, 요점(시놉시스) 한 줄 → 본문 순서로 작성 (Binder/Corkboard)

### 3.2 conceptPrompts.ts — 투자 브랜치 강화

`INVESTMENT_GENRES` 시스템 프롬프트에 추가한 원칙:
- **섹션 조각 단위 쪼개기**: "보고서를 독립된 섹션 조각으로 나눠 각 조각에 시놉시스(요점 한 줄)를 붙입니다"
- **자료 분리**: "자료·출처는 초안과 분리해 자료 섹션에 따로 모읍니다"
- **퇴고 전 스냅샷**: "큰 수정 전에는 퇴고 전 스냅샷을 저장하는 습관을 권장합니다"
- **저자 결정권**: "최종 판단과 서술은 당신이(작성자가) 결정합니다. AI는 구조와 질문을 제공합니다"

## 4. 제약 사항 — 데스크톱 레거시 경고

> **⚠️ 중요**: Scrivenings mode UI는 `apps/desktop/src/editor/ScrivenerEditor.tsx` 에만 존재한다.
> 현재 활성 제품은 `packages/obsidian-plugin/` 이다. 데스크톱 앱은 레거시로 검증 후 폐기 예정.
> Scrivener 철학은 데스크톱 UI가 아니라 **Obsidian 플러그인의 프롬프트/템플릿/워크플로우**를 통해 전달해야 한다.

## 5. 사용자 대면 언어 원칙

- 프롬프트·UI: Scrivener 브랜드명 노출 X. 한국어 워크플로우 용어 사용 (섹션 조각, 시놉시스, 자료 분리, 스냅샷 저장, 출력 채널)
- 문서(docs): "Scrivener에서 영감받은 워크플로우"로 출처 표기 가능
- 출력 채널(Word/PPT/Telegram)은 장르/문체가 아닌 컴파일 형식으로만 취급

## 6. 연기(Deferred) 항목

| 항목 | 이유 |
|---|---|
| Scrivenings mode (연속 편집) Obsidian 포트 | 데스크톱 레거시 UI를 그대로 포팅하면 범위 초과. 별도 Phase에서 검토 |
| Corkboard 뷰 (카드 이동 UI) | Obsidian 플러그인 Leaf view 범위 초과. 데이터 모델만 준비됨 |
| Outliner 뷰 (시놉시스+단어수) | 동일 이유 |
| `structure-pick.md` / `motive.md` 카드 시놉시스 안내 추가 | 이번 범위에서 가장 낮은 우선순위. 현재 구조로도 충분히 작동 |
