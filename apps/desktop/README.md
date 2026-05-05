# @ai-manuscript-studio/desktop

AI 원고실의 Tauri 2 데스크톱 앱. Phase C는 스켈레톤 단계로, 3-pane 레이아웃 + deep-link 라우팅까지 동작한다.

## 개발 환경

- Node.js 18+ / pnpm 8+
- Rust 1.77+ (`cargo`, `rustc`)
- 플랫폼 의존성:
  - **macOS**: Xcode CLT (`xcode-select --install`)
  - **Linux**: `webkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **Windows**: WebView2 Runtime (Win10 22H2 이상엔 사전 설치됨), MSVC 빌드 도구

## 빠른 시작

```bash
# 모노레포 루트에서:
pnpm install

# 프론트만 빌드 (Tauri 없이 검증용)
pnpm --filter @ai-manuscript-studio/desktop build

# Rust 컴파일 검증
cd apps/desktop/src-tauri && cargo build

# Tauri dev 모드 (브라우저+창)
pnpm --filter @ai-manuscript-studio/desktop tauri:dev

# 패키징
pnpm --filter @ai-manuscript-studio/desktop tauri:build
```

## Deep link 테스트

URL 스킴: `ai-manuscript-studio://open?vault=<absolute-path>&project=<slug>`

1. 첫 빌드 한 번 실행: `pnpm tauri:build` (또는 dev로 한 번 켜두기)
2. 스킴 등록:
   ```bash
   ./register-dev-deep-link.sh
   ```
3. 외부에서 호출:
   ```bash
   # macOS
   open "ai-manuscript-studio://open?vault=/Users/me/Vault&project=hello"
   # Linux
   xdg-open "ai-manuscript-studio://open?vault=/home/me/vault&project=hello"
   ```

앱이 실행 중이면 그 인스턴스에 포커스되고 `loadProject()`가 호출된다. 꺼져 있으면 새로 켜지면서 cold-launch URL을 처리한다.

## 폴더 구조

```
apps/desktop/
├─ index.html
├─ vite.config.ts
├─ src/                       # React + TS 프론트
│  ├─ main.tsx                # 진입점
│  ├─ App.tsx                 # 최상위 (deep-link 리스너 등록)
│  ├─ layout/                 # 3-pane Scrivener 레이아웃 (placeholder)
│  ├─ state/projectStore.ts   # Zustand 프로젝트 상태
│  ├─ vaultAdapter.ts         # Tauri-backed VaultAdapter
│  ├─ noticeAdapter.ts        # 토스트 (Phase D에서 UI 연결)
│  ├─ frontmatterAdapter.ts   # YAML 프론트매터 read/update
│  ├─ deepLink.ts             # `deep-link:open` 이벤트 → 파싱
│  └─ styles/global.css       # 라이트 테마 (Phase D에서 다크 추가)
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json
   ├─ build.rs
   ├─ src/
   │  ├─ main.rs              # Builder + deep-link 셋업
   │  ├─ error.rs             # AppError (Serialize)
   │  ├─ watcher.rs           # notify 기반 watcher 레지스트리
   │  └─ commands/
   │     ├─ vault.rs          # read/write/list/exists/ensureDir/delete + watch
   │     └─ deep_link.rs      # URL → 프론트 emit
   ├─ icons/                  # 임시 placeholder PNG (Phase H에서 `tauri icon`)
   └─ capabilities/default.json # Tauri 2 ACL
```

## 알려진 한계 (Phase C)

- 아이콘은 임시 단색 PNG. `tauri icon <source.png>`로 교체 필요.
- `fs:scope`는 `**/*`로 열려 있음. Phase H에서 vault 경로로 좁힐 예정.
- Binder/Editor/Inspector 모두 placeholder. Phase D에서 실제 UI로 교체.
- 노티 어댑터는 `console.log` 출력만. Phase D에서 토스트 컴포넌트 추가.

## 테스트

- Rust: `cd src-tauri && cargo test` (vault 명령 round-trip 스모크 테스트)
- JS: Phase D부터 추가 (현재 `pnpm test`는 NOOP).
