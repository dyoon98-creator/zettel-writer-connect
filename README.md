# AI Manuscript Studio

이 저장소가 정식 소스 위치입니다:

`/Users/futurewave/Documents/dev/obsidian-plugins`

AI 원고실을 관리하는 pnpm 모노레포입니다. Zettel Connect 정본은 별도 `13.zettel-connect` 프로젝트에 있습니다.

## AI 원고실 (AI Manuscript Studio) — v0.1

> AI가 대신 쓰지 않습니다. 작가가 끝까지 쓰게 만듭니다.

옵시디언 볼트의 raw 노트를 원고로 승격시키는 **옵시디언 통합 플러그인**.

```
┌─ 옵시디언 (Mac / Windows / Linux 공통) ───────────────────────┐
│                                                                │
│  사이드바 인덱서          │   메인 영역 작업실 (탭)            │
│  - 프로젝트 카드          │   - Scrivener 3-pane               │
│  - 상태/글자수            │   - 마법사 인터뷰                   │
│  - "원고실 열기" 버튼     │   - CodeMirror 6 / Tiptap 편집     │
│                          │   - 실시간 AI 스트리밍             │
└────────────────────────────────────────────────────────────────┘
                  ↓
       볼트의 .md / .json 파일 (3 Writing/<slug>/)
       → 옵시디언 내부에서 그대로 보고 편집 가능
```

별도 데스크톱 앱 설치 없음. 옵시디언 자체가 macOS / Windows / Linux 를
모두 지원하므로 작가는 본인 OS 옵시디언만 있으면 됩니다.

## 마이그레이션 히스토리

- **v0.0.x** — 옵시디언 인덱서 + Tauri 데스크톱 앱의 하이브리드 분리 모드
  (macOS arm64 빌드만 존재). 코드는 `apps/desktop/` 에 보존.
- **v0.1.0** — 데스크톱 앱이 하던 모든 일을 옵시디언 플러그인 안의
  WorkspaceLeaf view 로 통합. OS 별 빌드·코드 사이닝·자동 업데이트 인프라
  필요 없음. 자세한 내용은 `docs/migration-monolith.md`.

## 패키지

| 위치 | 역할 | 빌드 산출물 |
|---|---|---|
| `packages/core/` | 순수 TS — 환경 중립 비즈니스 로직 | type-only |
| `packages/obsidian-plugin/` | **통합 플러그인** (인덱서 + 작업실 view) | `main.js` 1.16 MB |
| `apps/desktop/` | (검증 후 폐기 예정) Tauri 데스크톱 앱 | `.dmg` |

## 빌드 / 테스트

```bash
pnpm install                                                # 한 번
pnpm run deploy                                             # AI 원고실 빌드 + 배포
pnpm plugins:deploy                                         # 위와 동일
pnpm deploy:ai-manuscript                                   # AI 원고실 빌드 + 배포
pnpm --filter @ai-manuscript-studio/obsidian-plugin build   # 통합 플러그인
pnpm --filter @ai-manuscript-studio/core test               # 코어 (251 pass)
pnpm --filter @ai-manuscript-studio/obsidian-plugin test    # 플러그인 (40 pass)
pnpm --filter @ai-manuscript-studio/desktop test            # 데스크톱 (175 pass)
```

## 사전 요구

- Node.js ≥ 18, pnpm ≥ 8

(Rust / Xcode CLT / Windows Build Tools 는 **Tauri 빌드를 직접 만들 때만** 필요.
통합 플러그인만 빌드하려면 Node + pnpm 으로 충분.)

## AI 에이전트용 Obsidian 설치 가이드

이 절차는 Codex, Claude Code 같은 AI 에이전트가 사용자의 로컬 머신에서
플러그인을 빌드해 Obsidian 볼트에 설치할 때 따라야 하는 최소 경로입니다.

### 1. 소스 받기

```bash
git clone https://github.com/vibelabs-web/zettel-writer-connect.git obsidian-plugins
cd obsidian-plugins
pnpm install --frozen-lockfile
```

### 2. 볼트 플러그인 폴더 확인

Obsidian 플러그인은 항상 다음 위치에 설치됩니다.

```text
<vault>/.obsidian/plugins/<plugin-id>/
```

AI 에이전트는 사용자의 볼트 경로를 확인한 뒤, 아래 환경 변수에
`<vault>/.obsidian/plugins` 절대 경로를 넣어야 합니다.

```bash
export OBSIDIAN_VAULT_PLUGINS_DIR="/absolute/path/to/vault/.obsidian/plugins"
```

이 저장소의 Futurewave 로컬 개발 환경에서는 이미 다음 경로를 기본값으로
사용합니다.

```text
/Users/futurewave/Library/CloudStorage/GoogleDrive-futurewave@gmail.com/내 드라이브/03 Resources/옵시디언 볼트/futurewave/.obsidian/plugins
```

위 기본값은 더 이상 사용하지 않습니다. 배포 명령은 반드시
`OBSIDIAN_VAULT_PLUGINS_DIR`를 명시해야 합니다.

### 3. 빌드 및 설치

AI 원고실 설치:

```bash
pnpm deploy:ai-manuscript
```

배포 스크립트는 AI 원고실을 빌드한 뒤 Vault의 실제
`.obsidian/plugins/<plugin-id>/` 안에서 `main.js`, `manifest.json`,
`styles.css`를 소스 산출물로 심볼릭 링크합니다. `data.json`과 `cache/`는
Vault에 보존됩니다. 따라서 이후 source build는 링크 대상에 즉시 반영됩니다.

### 4. Obsidian에서 활성화

1. Obsidian을 재시작하거나 커뮤니티 플러그인을 reload합니다.
2. `설정 -> 커뮤니티 플러그인`에서 `AI 원고실`을 켭니다.
3. AI 원고실에서 AI 기능을 쓰려면 플러그인 설정에 로컬 CLI 경로를 입력합니다.

지원하는 AI CLI:

```text
Codex CLI
Claude Code CLI
```

AI 에이전트는 사용자의 CLI가 이미 로그인되어 있는지 확인해야 합니다. 플러그인은
사용자의 로컬 CLI를 실행할 뿐, API 키나 토큰을 저장소에 포함하지 않습니다.

### 5. 설치 검증

```bash
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/core test
```

설치 후 Obsidian에서 확인할 항목:

- 우측 사이드바에 `원고 프로젝트` 패널이 뜨는지
- `+ 첫 원고 만들기` 버튼이 보이는지
- 원고 에디터에서 텍스트 선택 시 AI 버튼이 에디터 근처에 뜨는지

### 보안 주의

AI 에이전트는 다음 파일을 복사하거나 압축하지 말아야 합니다.

```text
.git/
node_modules/
.env*
data.json
cache/
embeddings.json
*.key
*secret*
*token*
```

설치에는 빌드 산출물 3개만 필요합니다: `main.js`, `manifest.json`,
`styles.css`.

## 출시 산출물

```
packages/obsidian-plugin/
├─ main.js       (1.16 MB — 작업실 React 트리 + Tiptap + CM6 + zustand 포함)
├─ manifest.json
└─ styles.css    (인덱서 + 작업실 CSS 통합)
```

이 3 파일은 Vault 플러그인 디렉터리에서 이 저장소 산출물을 가리키는
심볼릭 링크입니다. Vault의 `data.json`·`cache/`는 링크하지 않습니다.

설치 절차: `docs/install-guide.md`
현재 로컬 개발 레이아웃: `docs/plugin-layout.md`
v0.0.x 레거시 절차: `docs/install-guide-legacy.md`
마이그레이션 기록: `docs/migration-monolith.md`

## 테스트 합계

- `packages/core` — 251 tests (+32 skipped)
- `packages/obsidian-plugin` — 40 tests
- `apps/desktop` — 175 tests passing / 17 사전 fail (Tauri webviewWindow
  의존 — 통합 모드에서는 자연 해결)
- **합계 466 pass**

## 원칙

1. AI는 사용자 액션이 있을 때만 호출. 자동 실행/백그라운드 작업/은밀한 전송 없음.
2. 결과는 항상 미리보기 후 사용자 선택. 자동 삽입 없음.
3. 진실의 출처는 볼트의 .md/.json 파일. UI 가 닫혀도 데이터는 그대로 보존.
4. Zettel Connect 등 다른 옵시디언 플러그인과 데이터 절대 비섞임.
5. 무료 코어만으로도 의미 있는 사용 경험.
6. honor-system 라이선스 — 적극 DRM 시도 없음.

## 라이선스

플러그인 소스: **MIT**
유료 스킬팩: 별도 라이선스 (상품 문서 참조)
