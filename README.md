# AI 원고실 (AI Manuscript Studio) — v2

> AI가 대신 쓰지 않습니다. 작가가 끝까지 쓰게 만듭니다.

옵시디언 볼트의 raw 노트를 원고로 승격시키는 **하이브리드 작가 환경**.

```
┌─ 옵시디언 ──────────────┐    ┌─ Tauri 데스크톱 앱 ─────────┐
│ 인덱서 (얇음, 22 KB)    │←──→│ Scrivener 3-pane            │
│  - 프로젝트 목록        │    │  - 마법사 인터뷰              │
│  - 상태/글자수 카드     │    │  - CodeMirror 6 편집         │
│  - "원고실 앱에서 열기" │    │  - 실시간 AI 스트리밍        │
└─────────────────────────┘    └────────────────────────────┘
              ↘                ↙
       같은 .md/.json 파일 공유
       (3 Writing/<slug>/ 다중 파일 구조)
```

## 패키지

| 위치 | 역할 | 빌드 산출물 |
|---|---|---|
| `packages/core/` | 순수 TS — 두 표면이 공유. VaultAdapter 뒤에서 동작 | type-only |
| `packages/obsidian-plugin/` | 얇은 옵시디언 인덱서 | `main.js` 22 KB |
| `apps/desktop/` | Tauri 2 + React 데스크톱 앱 | `.dmg` / `.msi` / `.AppImage` |

## 빌드 / 테스트

```bash
pnpm install                                          # 한 번
pnpm test                                              # 전체 282 tests
pnpm typecheck                                         # 타입 검사
pnpm --filter @ai-manuscript-studio/core test         # 코어만
pnpm --filter @ai-manuscript-studio/desktop tauri:dev # Tauri 개발 모드
pnpm --filter @ai-manuscript-studio/desktop tauri:build # 프로덕션 빌드
pnpm --filter @ai-manuscript-studio/obsidian-plugin build # 플러그인 .js
```

## 사전 요구

- Node.js ≥ 18, pnpm ≥ 8
- Rust ≥ 1.70 (Tauri 빌드용)
- macOS: Xcode CLT
- Windows: Microsoft C++ Build Tools
- Linux: `webkit2gtk-4.1-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libsoup-3.0-dev`

## 출시 산출물

```
dist/
├─ macos/AI 원고실_0.0.1_aarch64.dmg   (2.2 MB)
└─ obsidian-plugin/                     (22 KB main.js + manifest + styles)
```

설치 절차: `docs/install-guide.md`
배포·서명·결제 가이드: `docs/release-distribution.md`
스킬팩 저작: `docs/skillpack-author-guide.md` (apps/desktop/docs)

## 테스트 합계

- `packages/core` — 231 tests (+7 skipped)
- `apps/desktop` — 43 tests
- `packages/obsidian-plugin` — 8 tests
- `apps/desktop/src-tauri` cargo — 5 tests
- **총 282 tests passing**

## 원칙

1. AI는 사용자 액션이 있을 때만 호출. 자동 실행/백그라운드 작업/은밀한 전송 없음.
2. 결과는 항상 미리보기 후 사용자 선택. 자동 삽입 없음.
3. 진실의 출처는 볼트의 .md/.json 파일. 두 표면은 같은 데이터 공유.
4. Zettel Connect 등 다른 옵시디언 플러그인과 데이터 절대 비섞임.
5. 무료 코어만으로도 의미 있는 사용 경험.
6. honor-system 라이선스 — 적극 DRM 시도 없음.

## 라이선스

플러그인/앱 소스: **MIT**
유료 스킬팩: 별도 라이선스 (상품 문서 참조)
