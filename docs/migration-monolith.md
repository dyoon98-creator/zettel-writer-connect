# 통합 마이그레이션 — Tauri 데스크톱 앱 → 옵시디언 플러그인 단독

> Tauri 데스크톱 앱이 하던 모든 일을 옵시디언 플러그인 안의 `WorkspaceLeaf` view 로 옮겨, OS 별 빌드·코드 사이닝·자동 업데이트 인프라를 제거하기 위한 마이그레이션 문서.
>
> 시작: 2026-05-16, 브랜치: `feat/plugin-monolith`, 롤백 태그: `baseline/tauri-only`.

## 왜

- Tauri 산출물이 macOS arm64 한 종류 — Windows / Intel Mac / Linux 사용자가 못 씀.
- OS 4종 빌드 + 코드 사이닝 (macOS $99 + Windows $300/년) + 자동 업데이트 인프라까지 들여야 하는데, 옵시디언 자체가 4종 OS 를 이미 지원하므로 플러그인 단독으로 묶으면 모두 해결.
- `packages/core/` 가 이미 환경 중립 어댑터(VaultAdapter / FrontmatterAdapter / NoticeAdapter) 패턴으로 분리돼 있어 React UI 이식 + Tauri `invoke` 10개 매핑만 하면 됨.

## 베이스라인 (2026-05-16)

| 패키지 | pass | fail | skip |
|---|---|---|---|
| `packages/core` | 251 | 0 | 32 |
| `apps/desktop` | 175 | **17** | 0 |
| `packages/obsidian-plugin` | 8 | 0 | 0 |
| **합계** | **434** | **17** | **32** |

`apps/desktop` 의 사전 실패 17건은 BinderPane / ConceptWizard 가 Tauri `webviewWindow` API 를 직접 호출해서 발생. 마이그레이션 후 옵시디언 API 로 대체되면 자연 해결될 가능성 높음.

마이그레이션 후 목표: **fail ≤ 17 (회귀 없음), 가능하면 0 으로 수렴**.

## Tauri `invoke` 매핑표 (Phase 2 작업)

| Tauri 명령 | 옵시디언 대체 |
|---|---|
| `vault_write_file` | `app.vault.adapter.write(path, data)` |
| `vault_copy_file` | `app.vault.adapter.copy(src, dst)` |
| `vault_delete_file` | `app.vault.adapter.remove(path)` |
| `vault_ensure_dir` | `app.vault.adapter.mkdir(path, { recursive: true })` |
| `vault_watch_stop` | `app.vault.off(...)` (이벤트 구독 해제) |
| `settings_save` | `plugin.saveData(json)` |
| `ai_invoke` | Electron `child_process.spawn(cliPath, args)` |
| `ai_cancel` | spawned process `kill()` |
| `voice_delete_file` | `app.vault.adapter.remove(path)` |
| `voice_open_folder` | Electron `shell.openPath(absPath)` |

## React UI 이식 대상 (Phase 3)

| 컴포넌트 | 위치 | 비고 |
|---|---|---|
| `ScrivenerLayout` | `apps/desktop/src/layout/` | 3-pane 골조 |
| `BinderPane` | `apps/desktop/src/binder/` | 좌측 트리 — webviewWindow 의존 제거 필요 |
| `InspectorPane` | `apps/desktop/src/inspector/` | 우측 — Snapshots / SourceNotes / Action / Continuity |
| 에디터 | `apps/desktop/src/editor/`(추정) | CodeMirror 6 / Tiptap |
| `WizardOverlay` | `apps/desktop/src/wizard/` | 마법사 인터뷰 — webviewWindow 의존 |
| `Corkboard` | `apps/desktop/src/corkboard/` | |
| `ResearchPane` | `apps/desktop/src/research/` | |
| `VoicePane` | `apps/desktop/src/voice/` | |
| `SettingsPanel` | `apps/desktop/src/settings/` | |

## 로드맵

1. **Phase 0 — 안전망** (0.5일) ← 진행 중
2. **Phase 1 — 빌드 파이프라인** (1일)
3. **Phase 2 — 어댑터 매핑** (1일)
4. **Phase 3 — UI 이식** (3-4일)
5. **Phase 4 — 통합 테스트** (1-2일)
6. **Phase 5 — 정리 및 폐기** (0.5-1일)

## 정책

- Tauri 산출물은 **Phase 5 검증 통과 후에만 폐기**. 그 전까진 `apps/desktop/` 그대로 유지.
- React UI 는 가능한 원본 그대로 옮긴다. 디자인 개선·리팩토링은 별도 작업.
- 282 tests 베이스라인 유지가 PR 머지 조건.
