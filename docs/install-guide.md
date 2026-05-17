# 설치 가이드 — AI 원고실 v0.1

이 가이드는 사용자(작가)가 **옵시디언 플러그인 하나** 만 설치하면 끝나는
새 통합 모드의 절차입니다. 별도 데스크톱 앱을 깔지 않습니다.

> v0.0.x (Tauri 데스크톱 앱 + 얇은 인덱서 플러그인 분리 모드) 사용자는
> `docs/install-guide-legacy.md` 를 참조하세요.

---

## 준비물

- 옵시디언 데스크톱 (1.5.0 이상) — macOS / Windows / Linux 어디든 가능
- (선택) Codex CLI 또는 Claude Code CLI — 본인 구독으로 미리 설치·로그인.
  없어도 무료 기능과 마법사 mock 모드는 동작.

---

## 1. 플러그인 설치

볼트의 `.obsidian/plugins/ai-manuscript-studio/` 폴더에 3개 파일을 둡니다:

```
.obsidian/plugins/ai-manuscript-studio/
├─ manifest.json
├─ main.js
└─ styles.css
```

배포 zip 의 `dist/obsidian-plugin/` 안에 그대로 들어 있습니다 — 폴더째로
복사하면 됩니다.

옵시디언을 열고 **설정 → 커뮤니티 플러그인 → 설치된 플러그인** 에서
"AI 원고실"을 활성화. 우측 사이드바에 펜 아이콘이 추가됩니다.

> 데스크톱 앱(`.dmg` / `.msi`) 설치는 더 이상 필요 없습니다.

---

## 2. 첫 원고 만들기

### 인덱서 열기

1. 우측 사이드바 펜 아이콘 클릭 → "원고 인덱서" 패널
2. 빈 상태에서 "+ 첫 원고 만들기" → 5단계 마법사 진입

### 마법사 (관율 → 독자 → 메시지 → 구조 → 톤)

한 단계당 2~3턴 대화. 종료 시 "binder를 자동으로 시드할까요?" 동의 →
`<vault>/3 Writing/<slug>/` 폴더에 다음이 생성됩니다:

- `project.json` 메타
- `binder.json` 트리 (장 4개 정도)
- `planning.md` 인터뷰 전사
- 각 장 폴더에 빈 장면 .md 1개씩

자동으로 작업실 탭이 열립니다. 좌(binder) → 중(에디터) → 우(inspector,
시놉시스/상태/AI 액션) 구조의 Scrivener-style 3-pane.

---

## 3. 평소 흐름

```
옵시디언에서 [[wikilink]] 로 자료 노트 모으기
   ↓
인덱서 사이드바 "원고실 열기" 버튼 (또는 카드 클릭)
   ↓
작업실 탭: binder 클릭 → 장면 편집 → inspector AI 액션
   ↓
저장 (debounced 1.5s 자동 / Cmd+S 강제)
   ↓
진실의 출처는 볼트의 .md/.json 파일 — 옵시디언에서도 그대로 읽힘
```

---

## 4. AI 호출 설정 (선택)

기본은 **mock 응답** — 대화는 되지만 일반적인 답변만. 실제 LLM 연결:

1. 작업실 탭 우측 상단 ⚙ → 설정
2. **AI 공급자**: `codex` 또는 `claude-code`
3. **CLI 실행 경로**:
   - Codex: `which codex` 결과 (예: `/opt/homebrew/bin/codex`)
   - Claude Code: `which claude` 결과
4. **추가 인자**: 모델 지정 등 (예: `--model gpt-5`)
5. **실행 전 확인**: ON 권장. 매 호출 전 프롬프트 미리보기.
6. **제외 폴더**: 민감 폴더 (예: `0 raw/private`)

설정은 옵시디언 plugin 의 `data.json` 안의 `app` 키에 저장됩니다 (vault 내부).

---

## 5. 유료 스킬팩 설치 (선택)

스킬팩 zip 을 받았다면:

```
<vault>/_skillpacks/<pack-id>/
├─ skillpack.json
├─ STYLE-GUIDE.md
└─ prompts/
   └─ *.md
```

위 위치에 풀어 넣고, 작업실 설정에서 **라이선스 키** 입력 → 명령 팔레트
"스킬팩 다시 불러오기". 우측 inspector AI 액션 그룹에 새 액션 등장.

라이선스 키 검증: HMAC-SHA256(키, 발급자 ID) ↔ 매니페스트 checksum.

---

## 문제 해결

**플러그인이 안 보임**
→ 설정 → 커뮤니티 플러그인 → "제3자 플러그인 허용" 켜져 있는지 확인.
   그 후 폴더 새로고침 (Cmd+R).

**"원고실 열기" 클릭해도 빈 화면**
→ 옵시디언 콘솔(Cmd+Opt+I) 에서 에러 확인. 보통 plugin 의 `data.json` 이
   손상된 경우 — 해당 파일 삭제 후 다시 시작.

**AI 호출 시 "CLI 미설치"**
→ 설정 → 실행 경로가 절대 경로인지 확인 (`/opt/homebrew/bin/codex` 처럼).
   PATH 검색은 일부 환경에서 실패. 첫 실행 시 자동 탐지를 시도하지만
   실패하면 수동 입력 필요.

**원고가 깨짐**
→ 원고 자체는 볼트의 `3 Writing/` 에 있습니다. 옵시디언 파일 히스토리
   또는 Time Machine 으로 복구.

---

## 모바일 / Linux

- 모바일 옵시디언 — 보기 / 읽기는 가능. AI 호출은 desktop 전용
  (`isDesktopOnly: true`). 모바일에서는 작업실 view 가 열리지 않음.
- Linux — 작동 (옵시디언 자체가 deb/AppImage 지원). 코드 사이닝 이슈
  없음.
