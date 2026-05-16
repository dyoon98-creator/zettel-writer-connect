# 설치 가이드 — AI 원고실 v2

이 가이드는 사용자(작가)가 **이미 빌드된 v0.0.1 산출물**을 자기 컴퓨터에 설치해 첫 원고를 만들기까지의 절차입니다.

---

## 준비물

- 옵시디언 데스크톱 (1.5.0 이상)
- macOS (Apple Silicon) — 현재 v0.0.1 산출물은 arm64 한정. Intel Mac / Windows / Linux 빌드는 별도 발급 (`docs/release-distribution.md`).
- (선택) Codex CLI 또는 Claude Code CLI — 본인 구독으로 미리 설치·로그인되어 있어야 함. 없어도 무료 기능과 마법사 mock 모드는 동작.

---

## 1. 옵시디언 인덱서 플러그인 설치

볼트의 `.obsidian/plugins/ai-manuscript-studio/` 폴더에 다음 3개 파일을 둡니다.

```
.obsidian/plugins/ai-manuscript-studio/
├─ manifest.json
├─ main.js
└─ styles.css
```

배포 패키지: `dist/obsidian-plugin/` 안의 3개 파일을 그대로 복사.

옵시디언을 열고 **설정 → 커뮤니티 플러그인 → 설치된 플러그인** 에서 "AI 원고실"을 활성화. 우측 사이드바에 펜 아이콘이 추가됨.

---

## 2. 데스크톱 앱 설치

### macOS (Apple Silicon)

1. `dist/macos/AI 원고실_0.0.1_aarch64.dmg` 더블 클릭
2. Finder 창이 열리면 **AI 원고실.app** 을 **Applications** 폴더로 드래그
3. **첫 실행 시** 우클릭 → "열기" → "확인되지 않은 개발자" 경고에서 "열기"
   (코드 사이닝 미완 상태 — 시스템 환경설정 → 보안 및 개인정보 보호에서 한 번만 허용)

### URL scheme 자동 등록 확인

`/Applications/AI 원고실.app` 위치에 두면 macOS의 LaunchServices가 자동으로 `ai-manuscript-studio://` URL handler를 등록합니다. 옵시디언에서 "원고실 앱에서 열기" 버튼이 정상 동작.

수동 등록(필요 시):
```bash
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "/Applications/AI 원고실.app"
```

---

## 3. 첫 원고 만들기

### 옵시디언 측 (인덱서)

1. 우측 사이드바 펜 아이콘 클릭 → "원고 인덱서" 패널
2. (`3 Writing/` 폴더가 비어 있다면) 데스크톱 앱에서 마법사로 새 프로젝트를 만든 뒤 카드가 등장

### 데스크톱 앱 측 (작업실)

1. `/Applications/AI 원고실.app` 실행 — 빈 창에 "새 원고 만들기" 버튼
2. 5단계 마법사 (관율 → 독자 → 메시지 → 구조 → 톤). 한 단계당 2–3턴 대화
3. 종료 시 "binder를 자동으로 시드할까요?" 동의 → `<vault>/3 Writing/<slug>/` 폴더에 다음이 생성됨:
   - `project.json` 메타
   - `binder.json` 트리 (장 4개 정도)
   - `planning.md` 인터뷰 전사
   - 각 장 폴더에 빈 장면 .md 1개씩
4. Scrivener 3-pane UI로 자동 전환. 좌(binder) → 중(에디터, CodeMirror 6) → 우(inspector, 시놉시스/상태/AI 액션).

---

## 4. AI 호출 설정 (선택)

기본은 **mock 응답**이라 대화는 되지만 일반적인 답변만 옵니다. 실제 LLM에 연결하려면:

1. 데스크톱 앱 우측 상단 ⚙ → 설정
2. **AI 공급자**: `codex` 또는 `claude-code`
3. **CLI 실행 경로**:
   - Codex: `which codex` 결과 (예: `/opt/homebrew/bin/codex`)
   - Claude Code: `which claude` 결과
4. **추가 인자**: 모델 지정 등 (예: `--model gpt-5`)
5. **실행 전 확인**: ON 권장. 매 호출 전 프롬프트 미리보기.
6. **제외 폴더**: 민감 폴더 (예: `0 raw/private`)

설정은 `~/Library/Application Support/com.futurewave.ai-manuscript-studio/settings.json` 에 저장.

---

## 5. 유료 스킬팩 설치 (선택)

스킬팩 zip 파일을 받았다면:

```
<vault>/_skillpacks/<pack-id>/
├─ skillpack.json
├─ STYLE-GUIDE.md
└─ prompts/
   └─ *.md
```

위 위치에 풀어 넣고, 데스크톱 앱 설정에서 **라이선스 키** 입력 → 명령 팔레트(또는 설정의 "스킬팩 다시 불러오기"). 우측 inspector의 AI 액션 그룹에 새 액션 등장.

라이선스 키 검증: HMAC-SHA256(키, 발급자 ID) ↔ 매니페스트 checksum.

---

## 6. 일상 흐름

```
옵시디언에서 [[wikilink]]로 자료 노트 모으기
   ↓
인덱서 사이드바에서 프로젝트 카드 → "원고실 앱에서 열기"
   ↓
Tauri 앱: binder 클릭 → 장면 편집 → inspector AI 액션
   ↓
저장 (debounced 1.5s 자동 / Cmd+S 강제)
   ↓
같은 .md 파일을 옵시디언에서도 읽을 수 있음 — 진실의 출처는 항상 볼트의 파일
```

---

## 문제 해결

**"앱을 열 수 없습니다 — 확인되지 않은 개발자"**
→ `/Applications`에 둔 .app을 우클릭 → "열기" (한 번만 필요)

**옵시디언 사이드바에 카드가 안 보임**
→ 설정 → 커뮤니티 플러그인에서 "AI 원고실" 활성 상태 확인. `3 Writing/` 폴더가 비어 있으면 카드도 없음.

**deep link가 동작 안 함 ("원고실 앱에서 열기" 클릭 시 무반응)**
→ `lsregister -f "/Applications/AI 원고실.app"` 수동 실행. 또는 앱을 한 번 직접 실행해 macOS가 인식하도록.

**AI 호출 시 "CLI 미설치"**
→ 설정 → 실행 경로가 절대 경로인지 확인 (`/opt/homebrew/bin/codex` 처럼). PATH 검색은 일부 환경에서 실패.

**원고가 깨짐**
→ 백업에서 복원: `~/Library/Application Support/com.futurewave.ai-manuscript-studio/` 에는 설정만, 원고 자체는 볼트의 `3 Writing/`에 있으니 옵시디언 파일 히스토리 또는 Time Machine으로 복구.
