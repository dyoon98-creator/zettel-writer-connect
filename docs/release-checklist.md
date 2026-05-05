# 출시 체크리스트 — AI 원고실 v0.0.1

매 릴리스 전 점검할 항목 모음.

## 코드 / 빌드

- [x] manifest.json id/name/version 일치 (apps/desktop, packages/obsidian-plugin)
- [x] CHANGELOG.md 업데이트
- [x] `pnpm typecheck` 통과
- [x] `pnpm -r test` 통과 (282 tests)
- [x] `pnpm --filter @ai-manuscript-studio/desktop build` 통과 (vite + tsc)
- [x] `cd apps/desktop/src-tauri && cargo build && cargo test` 통과
- [x] `pnpm --filter @ai-manuscript-studio/obsidian-plugin build` 통과
- [x] `pnpm --filter @ai-manuscript-studio/desktop tauri:build` 통과 → .dmg + .app

## 옵시디언 인덱서

- [x] `<vault>/.obsidian/plugins/ai-manuscript-studio/` 에 새 빌드 (manifest + main.js + styles.css)
- [x] v1 백업 폴더 보존 (`ai-manuscript-studio.v1-backup-*`)
- [x] community-plugins.json 에 ai-manuscript-studio + zettel-connect 둘 다 존재
- [x] CLAUDE.md 의 폴더 구조 / 플러그인 안내 v2로 갱신
- [ ] 옵시디언 재시작 후 사이드바에 카드 노출 (사용자 직접 확인)

## 데스크톱 앱

- [x] `/Applications/AI 원고실.app` 설치
- [x] LaunchServices에 `ai-manuscript-studio://` URL scheme 등록 검증 완료
- [x] Info.plist 에 CFBundleURLTypes 정상 (ai-manuscript-studio)
- [x] deep-link 테스트 — `open ai-manuscript-studio://...` 로 앱 부팅 확인
- [ ] 첫 마법사 종주 → 새 프로젝트 생성 → binder 시드 (사용자 직접 확인)
- [ ] Codex CLI 또는 Claude Code CLI 연결 후 AI 액션 1개 실제 호출 (사용자 직접 확인)

## 통합

- [x] Zettel Connect 와 ID/명령/뷰 충돌 없음
- [x] frontmatter `type` 필드로 데이터 식별 분리 (writing-scene / writing-planning)
- [x] 모바일 옵시디언에서 안내 배너 (코드 레벨 가드 존재)
- [ ] 옵시디언 사이드바 → "원고실 앱에서 열기" → Tauri 부팅·포커스 (사용자 직접 확인)

## 보안 / 개인정보

- [x] 외부 네트워크 자체 호출 없음 (CLI에 위임)
- [x] AI 호출 전 ConfirmModal (`confirmBeforeRun` 토글, 기본 ON)
- [x] 결과 자동 삽입 없음, 미리보기 → 사용자 선택
- [x] excludedFolders 설정으로 민감 폴더 제외 가능
- [x] 라이선스 키 발급은 honor-system HMAC, 적극 DRM 없음
- [x] 자동 실행 경로 없음 — 모든 호출은 명시적 사용자 액션 발생

## 출시 직전

- [ ] Apple Developer ID 가입 + macOS notarization (별도 단계)
- [ ] Windows 빌드 + 사이닝 (별도 머신/CI)
- [ ] Linux .AppImage 빌드 (별도 머신/CI)
- [ ] Tauri updater 매니페스트 호스팅 (GitHub Releases)
- [ ] 옵시디언 커뮤니티 스토어 PR 제출
- [ ] Lemon Squeezy product 등록 + webhook → 라이선스 발급 자동화
- [ ] 랜딩 페이지 (Astro + Cloudflare Pages)
- [ ] 첫 베타 사용자 5–10명에게 직접 배포 → 피드백 수집

## 산출물 위치

```
~/projects/ai-manuscript-studio/dist/
├─ macos/AI 원고실_0.0.1_aarch64.dmg   (2.2 MB)
│   sha256: e864ad28dac629aff5a1b96bff36bc507f143dd1bbac7245dc462ff502a1d733
└─ obsidian-plugin/
    ├─ manifest.json
    ├─ main.js                          (22 KB)
    │   sha256: f400c422be4eb42c152500c307ae577e1d07ccad7e9aefa3c9efbdd3fd037236
    └─ styles.css
```
