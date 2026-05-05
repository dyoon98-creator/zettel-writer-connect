# Changelog

## v2 0.0.1 — 2026-04-28

### Added (v2 — 하이브리드 구조 개편)

옵시디언 단일 플러그인 → **얇은 옵시디언 인덱서 + Tauri 2 데스크톱 앱** 으로 전환.

- **Phase A** — pnpm 모노레포(`packages/core`, `packages/obsidian-plugin`, `apps/desktop`), VaultAdapter/NoticeAdapter/FrontmatterAdapter/ResultSink 추상화, v1 코드 중 ~85%를 `packages/core/`로 이전. 91 tests.
- **Phase B** — Scrivener식 다중 파일 데이터 모델: `3 Writing/<slug>/{project.json, binder.json, planning.md, <장>/<장면>.md}`. Status × Label 분리, 사용자 정의 가능. v1 단일 .md → v2 폴더로 변환하는 마이그레이션 스크립트 포함. core 206 tests.
- **Phase C** — `apps/desktop/` Tauri 2 부트스트랩: Rust 백엔드(vault commands, deep-link, file watcher), React + TS 프론트엔드 셸. URL scheme `ai-manuscript-studio://`.
- **Phase D** — Scrivener UI 본체: 3-pane(BinderPane/EditorPane/InspectorPane) + Corkboard, CodeMirror 6 한글 IME, 드래그-드롭 reorder, Scrivenings 모드(다중 선택 결합 보기), 키보드 단축키, 라이트/다크 + 세리프/고딕 테마. desktop 13 tests.
- **Phase E** — 5단계 마법사 인터뷰(관율/독자/메시지/구조/톤) + 채팅 스트리밍 UI + 단계 사이드바 + binder 자동 시드. `planning.md` 전사 저장. core 231 / desktop 19 tests.
- **Phase F** — Rust `tokio::process::Command` 기반 AI bridge → Tauri 이벤트로 토큰 실시간 스트리밍 → `StreamView` 점진 렌더 → `ResultPreviewModal`(저장/삽입/복사/무시). `ConfirmModal`, 설정 패널, `MockWizardBridge`/`CLIWizardBridge` 스왑. desktop 43 / cargo 5 tests.
- **Phase G** — 옵시디언 플러그인 다이어트: 우측 사이드바 ItemView + 카드 목록 + "원고실 앱에서 열기" 버튼. 22 KB main.js. v1 81 MB → v2 22 KB. obsidian-plugin 8 tests.
- **Phase H** — macOS unsigned `.app` + `.dmg` 빌드 (4.6 MB / 2.2 MB), 1024×1024 아이콘 → 모든 플랫폼 형식 자동 생성, LaunchServices URL scheme 등록 검증, 사용자 가이드/설치 가이드/라이선스 발급 문서.

### Totals
- **282 tests** passing across packages/core (231) + apps/desktop (43) + packages/obsidian-plugin (8) + cargo (5).
- 데스크톱 앱: macOS Apple Silicon `.dmg` 2.2 MB, `.app` 4.6 MB.
- 옵시디언 인덱서: 22 KB main.js (v1의 81 MB → 0.027%).

### Notes
- 데스크톱 한정. iOS/Android 모바일은 v2 범위 외.
- Zettel Connect(`zettel-connect`) 와 데이터 절대 비섞임. frontmatter `type: writing-scene`/`writing-planning` + `plugin: ai-manuscript-studio`로 식별 분리.
- AI 호출은 사용자가 명시 액션을 했을 때만 발생. 결과는 항상 미리보기 후 사용자 선택.
- 라이선스 검증은 honor-system HMAC. 적극 DRM 시도 없음.
- 코드 사이닝 미완 — 첫 실행 시 macOS Gatekeeper 우회 필요(시스템 환경설정에서 허용).
- Apple Notarization, Windows EV 인증서, 자동 업데이트, Lemon Squeezy 결제 연동은 별도 단계(`docs/release-distribution.md` 참조).

---

## v1 0.0.1 — 2026-04-28 (deprecated, archived)

옵시디언 단일 플러그인. Phase 0–5 122 tests. v2 출시와 함께 deprecated. 백업 위치: `<vault>/.obsidian/plugins/ai-manuscript-studio.v1-backup-<timestamp>/`.
