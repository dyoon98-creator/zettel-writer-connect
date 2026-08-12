# AI 원고실 — 작업 규칙

## 0. 현재 구조 — AI 원고실 모노레포

정식 소스 위치는 `/Users/futurewave/Documents/dev/obsidian-plugins/`.
이 레포에서 AI 원고실을 관리한다.

- `packages/obsidian-plugin/` — AI 원고실 (`ai-manuscript-studio`)
- `packages/core/` — AI 원고실 공유 비즈니스 로직
- `apps/desktop/` — 레거시 Tauri 앱, 검증 후 폐기 예정

Zettel Connect는 `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect`가 정본이며, 이 레포에서 빌드·배포하지 않는다.

v0.1 부터 작업실 UI 가 옵시디언 플러그인 안의 WorkspaceLeaf view 로 통합됐다.
별도 Tauri 데스크톱 앱은 **검증 후 폐기 예정**. 그 전까지는 소스 보존
(`apps/desktop/`) 하되 빌드/배포는 옵시디언 플러그인만.

자세한 마이그레이션 기록: `docs/migration-monolith.md`.

## 1. 빌드 후 옵시디언 볼트에 deploy (HARD)

```bash
pnpm run deploy
```

이 명령은 AI 원고실을 빌드한 뒤, 지정한 Vault의 실제
`.obsidian/plugins/ai-manuscript-studio/` 안에서 `main.js`, `manifest.json`,
`styles.css`를 이 저장소 산출물로 심볼릭 링크한다. Vault별 `data.json`과
`cache/`는 그 자리에 보존한다. `OBSIDIAN_VAULT_PLUGINS_DIR`를 반드시 지정한다.

명시적으로 AI 원고실만 배포할 때:

```bash
pnpm deploy:ai-manuscript
```

옵시디언에서 `Cmd+P → 다시 로드 (개발자용)` 또는 설정에서 플러그인 토글
off/on 해야 새 빌드가 반영된다.

## 2. styles.css 합성

styles.css 는 **빌드 자동 생성** — `styles-indexer.css` (인덱서) +
`src/studio/styles/global.css` (작업실) 두 source 를 esbuild 가 합쳐서 출력.

styles.css 를 직접 편집하지 말 것 — 다음 build 에서 덮어쓴다. 둘 중 source
를 고친다.

## 3. studio/ 안의 코드는 apps/desktop/ 미러본

`packages/obsidian-plugin/src/studio/` 는 apps/desktop/src 의 거의 1:1 사본
이다. Tauri 종속 8 파일만 옵시디언용 shim (`studio/{vault,notice,frontmatter}Adapter.ts`,
`studio/ai/streamingHandle.ts`, `studio/state/settingsStore.ts`, `studio/deepLink.ts`)
+ `studio/tauriShims/` (alias 로 `@tauri-apps/*` 를 가로챔) 으로 대체.

UI 컴포넌트는 양쪽 모두에서 같은 인터페이스로 작동 — 양쪽 동시 유지하면
diff 도 줄어든다. **다만 Phase 5 검증 후 apps/desktop 폐기 예정**이므로
studio 측만 갱신해도 됨.

## 4. 옵시디언 환경 어댑터 매핑

| Tauri 원본 | 옵시디언 어댑터 |
|---|---|
| `vault_*` | `app.vault.adapter.*` |
| `settings_load/save` | `plugin.loadData/saveData` (`app` 키 영역) |
| `ai_invoke/cancel` | Node `child_process.spawn` + codex tempdir |
| `ai_find_binary` | Node fs + PATH/known-prefix stat |
| `voice_*` | `vault.adapter.*` + Electron `shell.openPath` |
| `convertFileSrc` | `file://${encodeURI(path)}` |

`tauriShims/core.ts` 의 invoke dispatcher 가 모두 처리.

## 5. 디버그 진단

옵시디언에서 `Cmd+Opt+I` 로 devtools. 작업실 view 가 안 뜨면:
- console 의 `[Studio]` / `[App]` / `[notice:error]` 로그 확인
- `data.json` (plugin 폴더의) 가 손상됐는지 의심 → 백업 후 삭제

## 6. 모노레포 위치

- 정식 위치: `/Users/futurewave/Documents/dev/obsidian-plugins/`
- 옛 위치 (사용 금지): `/Users/futurewave/Documents/dev/ai-manuscript-studio/`
- 옵시디언 플러그인 패키지: `packages/obsidian-plugin/`
- 데스크톱 앱: `apps/desktop/` (폐기 예정, 검증 통과 후 `.archive/` 로 이동)

옵시디언 볼트의 `.obsidian/plugins/ai-manuscript-studio`는 실제 디렉터리로 유지한다.
그 안의 bundle 3파일만 `packages/obsidian-plugin/`의 빌드 산출물을 가리키는
심볼릭 링크로 유지한다. 이로써 source build 갱신은 즉시 링크 대상에 반영되고,
Vault별 설정·캐시는 소스 저장소와 분리된다.

## 7. 레거시 Tauri 빌드 — 폐기 예정

`apps/desktop/` 의 Tauri 빌드 (`pnpm tauri:build`) 는 v0.0.x 의 메모리.
검증 단계에서 통합 플러그인에 회귀가 발견되면 임시로 다시 빌드해 비교.
검증 완료 후 폐기 (Phase 5 마지막 단계).

레거시 빌드 절차는 `docs/install-guide-legacy.md` 에 박제.
