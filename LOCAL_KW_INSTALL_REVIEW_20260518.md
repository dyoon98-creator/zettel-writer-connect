# 14.zettel-writer-connect 설치 전 검토 — 지식창고/대표님 워크플로우 기준

작성: 2026-05-18 13:34 KST
대상 repo: https://github.com/vibelabs-web/zettel-writer-connect
로컬 경로: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

## 1. 현재 상태

- repo clone 완료.
- default branch: main.
- HEAD: 02c0732 Add AI agent install guide.
- GitHub CLI 조회 기준 visibility: PUBLIC로 표시됨. 다만 대표님 설명상 결제/구독 접근권 기반 repo로 취급.
- 모노레포 구조:
  - packages/obsidian-plugin: AI 원고실 플러그인, plugin id = ai-manuscript-studio
  - packages/zettel-connect: 별도 Zettel Connect 플러그인, plugin id = zettel-connect
  - packages/core: 원고실 core 로직
  - apps/desktop: legacy Tauri 앱

## 2. 검증 결과

실행한 명령:

```bash
pnpm install --frozen-lockfile
pnpm --filter @ai-manuscript-studio/core test
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/obsidian-plugin build
node --check packages/obsidian-plugin/main.js
```

결과:

- core tests: 251 passed, 32 skipped.
- obsidian-plugin tests: 41 passed.
- AI 원고실 build: 성공.
- built main.js syntax check: 성공.
- build 산출물:
  - packages/obsidian-plugin/main.js — 1,171,150 bytes
  - packages/obsidian-plugin/manifest.json — 334 bytes
  - packages/obsidian-plugin/styles.css — 85,257 bytes

SHA-256:

```text
main.js       4a52e424d1beaa6ca1724f0efaf2831165d85ca2156619ea0d28476f84801370
manifest.json 3f27d590aacac1fa773bb8722779bff117921b88b603e0cb8419a10586055731
styles.css    92cded9df53b0acc3e2202fabc54d86ea665c6254eb5e5c8eaf53bc5189a86e5
```

## 3. 바로 설치하면 안 되는 이유

### 3-1. deploy 스크립트 기본 경로가 대표님 환경이 아님

scripts/deploy-obsidian-plugins.sh의 기본 Vault 경로가 Futurewave 개발자 환경으로 되어 있음.
따라서 환경변수 없이 `pnpm run deploy`를 실행하면 대표님 지식창고에 설치된다고 보장할 수 없다.

### 3-2. `pnpm run deploy`는 두 플러그인을 모두 배포한다

이 repo 안에는 `packages/zettel-connect`도 들어 있다. 그런데 대표님 환경에는 이미 별도 정본인
`/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect`가 있고, 현재 버전은 0.1.6이다.
반면 이 repo의 `packages/zettel-connect/manifest.json`은 0.1.0이다.

따라서 `pnpm run deploy` 또는 `pnpm deploy:zettel`을 실행하면 기존 13.zettel-connect 계열 운영을 덮거나 혼동시킬 수 있다.
대표님 환경에서는 `ai-manuscript-studio`만 설치해야 한다.

### 3-3. 기본 원고 폴더가 `3 Writing`이다

대표님 지식창고의 현재 구조:

```text
0.raw
1.wiki
2.Permanent
3.Structure
9.Archive
_index
...
```

AI 원고실 기본값은 `3 Writing`인데, 대표님 vault에서는 `3.Structure`가 이미 구조노트 영역이다.
기술적으로 충돌은 아니지만 번호/의미 체계가 어긋난다.

권고: 대표님 환경 기본값을 `4.Writing`으로 바꾼 뒤 설치.

## 4. 우리에게 맞는 점

- Obsidian 내부 플러그인 하나로 동작한다. 별도 Tauri 앱은 불필요.
- AI 호출은 Codex CLI 또는 Claude Code CLI를 로컬에서 실행하는 구조다.
- API key를 repo에 넣지 않고, 사용자의 로컬 CLI 로그인 상태를 사용한다.
- 기본 설정상 AI 호출 전 확인(confirmBeforeRun)이 켜져 있다.
- 결과는 미리보기 후 선택하는 흐름이다.
- `ai-manuscript-studio` plugin id가 기존 `zettel-connect`와 달라 직접 ID 충돌은 없다.
- 원고 프로젝트를 vault 파일로 보존한다는 철학은 지식창고 운영과 잘 맞는다.

## 5. 우리에게 맞게 바꾼 점 / 추가로 지켜야 할 점

적용 완료한 최소 커스텀:

1. AI 원고실 기본 원고 폴더를 `3 Writing` → `4.Writing`으로 변경.
2. 원고실 상단의 "다른 원고 열기" ProjectSwitcher가 hard-coded `3 Writing`이 아니라 설정된 `writingFolder`를 읽도록 변경.
3. 노트 컨텍스트/자동완성 검색에서 대표님 vault의 원고/아카이브 폴더(`4.Writing`, `9.Archive`)를 제외하도록 보강.
4. 위 변경 후 obsidian-plugin test/build/node syntax check 통과.

추가로 지켜야 할 점:

1. 설치/배포 명령은 `pnpm deploy:ai-manuscript`만 사용. `pnpm run deploy` 금지.
2. 대표님 지식창고 설치 시 환경변수를 명시:

```bash
OBSIDIAN_VAULT_PLUGINS_DIR="/Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/.obsidian/plugins" \
OBSIDIAN_PLUGIN_INSTALL_ROOT="/Users/dongchanyoon/.local/obsidian-plugins" \
pnpm deploy:ai-manuscript
```

4. 설치 후 Obsidian UI에서 `ai-manuscript-studio`를 수동 활성화.
5. AI 원고실 설정에서 Codex CLI 경로와 모델 인자 확인.
6. `/structure` 산출물을 원고실로 넘기는 연결 방식은 별도 설계 필요.

## 6. /structure와의 연결 권고

현재 AI 원고실은 일반 작가의 습관에 맞춰져 있고, 대표님 지식창고의 `2.Permanent → 3.Structure → 보고서/글` 흐름을 직접 이해하지는 않는다.

권고 흐름:

1. `13.zettel-connect`는 계속 근거/연결 후보 추천 담당.
2. `/structure`는 `3.Structure`에 근거 추적 가능한 구조노트 작성 담당.
3. `14.zettel-writer-connect`의 AI 원고실은 `4.Writing`에서 글 초안/장면/문장화 담당.
4. 다음 단계 커스텀으로 `3.Structure/*.md`를 원고 프로젝트 seed로 가져오는 기능을 붙인다.

최소 MVP:

- 수동: 구조노트 내용을 복사해 `4.Writing/<slug>/planning.md`에 붙여 시작.
- 1차 커스텀: AI 원고실의 `새 원고 만들기`에 “구조노트에서 시작” 버튼 추가.
- 2차 커스텀: Zettel Connect에서 선택한 후보 → `/structure` 승인 초안 → AI 원고실 프로젝트 자동 생성.

## 7. 현재 결론

바로 무작정 설치하지 말고, 다음 순서가 안전하다.

1. `14.zettel-writer-connect`는 이미 클론했고 build/test 통과.
2. 설치 전 `4.Writing` 기본값 커스텀.
3. 기존 `13.zettel-connect`를 건드리지 않도록 `ai-manuscript-studio`만 배포.
4. 지식창고에 설치 후 Obsidian UI에서 수동 활성화.
5. 실제 사용 테스트 후 `/structure` 연동 커스텀 범위를 확정.

대표님 승인 없이 아직 vault 설치/deploy는 실행하지 않았음.
