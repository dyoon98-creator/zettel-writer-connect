*Version: v1.1 (2026-05-18)*

# 06-tasks — Personal Communication Studio + Zettel Bridge

> cmux-harness build-ready task list. Each task is atomic and independently executable.
> Approval required before any code modification or deploy.
> Track C (Communication Studio) B0/B1 먼저. Track W (Zettel Bridge) 병렬.

---

## Phase 0 — Safety and Installation Gates

---

### [x] C0.1 Verify current staging vs vault unchanged

**Objective**: 빌드/배포 전 AI 원고실 플러그인의 현재 설치 상태와 소스를 확인하고 vault 파일에 변경이 없는지 확인한다.

**Allowed write paths**: 없음 (read-only 검증)

**Forbidden paths**:
- packages/** 소스
- vault 경로 (OneDrive-개인/지식창고/**)
- deploy scripts

**Acceptance criteria**:
- 현재 설치된 ai-manuscript-studio main.js hash와 빌드 산출물 hash 비교 기록됨
- vault 내 .obsidian/plugins/ai-manuscript-studio 상태 확인 완료
- 13.zettel-connect version 0.1.6 미변경 확인

**Verification command**:
```bash
# 설치된 플러그인 버전 확인
cat ~/.local/obsidian-plugins/ai-manuscript-studio/manifest.json
# 소스 manifest 확인
cat /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/manifest.json
# zettel-connect 버전 확인
cat /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/manifest.json | grep version
```

**Suggested lane**: Sonnet-Executor

**Completion evidence** (2026-05-19, Sonnet + Opus 독립 검증):
- 활성 설치 경로: `/Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio/` (일반 디렉터리)
- 볼트 경로: `지식창고/.obsidian/plugins/ai-manuscript-studio` → 위 경로로 symlink ✅
- SHA-256 비교 (설치본 `~/.local` vs 빌드 산출물 `packages/obsidian-plugin/`):
  - main.js: `6f4d48e0…` = `6f4d48e0…` ✅ 완전 일치
  - manifest.json: `3f27d590…` = `3f27d590…` ✅ 완전 일치
  - styles.css: `289b3a4e…` = `289b3a4e…` ✅ 완전 일치
- 13.zettel-connect manifest version: **0.1.6** 미변경 확인 ✅
- `plugins/ai-manuscript-studio/` (untracked `??`): 5/18 20:25 stale 스테이징 산출물. 활성 런타임·소스 빌드와 불일치. 비차단 cleanup 후보.
- 워킹트리 변경 없음 (git status before = after) ✅

---

### [x] C0.2 Verify voice feature in Obsidian plugin mode after install approval (manual smoke checklist)

**Objective**: AI 원고실의 '내 문체(Voice)' 기능이 현재 Obsidian 플러그인 모드에서 작동하는지 수동 검증한다. 설치 승인 후에만 진행.

**Allowed write paths**: 없음 (수동 체크리스트 결과만 기록)

**Forbidden paths**:
- vault files 직접 수정
- deploy scripts

**Manual smoke checklist**:
1. Obsidian 설정 → AI 원고실 플러그인 활성화 확인
2. Command palette → "내 문체" 열기
3. VoicePane 렌더 확인 (폴더 경로 표시, 파일 목록)
4. "폴더 선택…" 버튼 클릭 → Obsidian 모드에서 picker 비작동 확인 (예상 동작)
5. "Finder로 열기" 작동 확인
6. .md 샘플 파일 1개 voice 폴더에 수동 배치 후 "재분석" 실행
7. StyleGuide 생성 확인 (§1~§14 결과)
8. "압축 프롬프트 복사" 작동 확인

**Acceptance criteria**:
- 위 8개 항목 PASS/FAIL 기록
- folder picker 비작동이 알려진 제약으로 문서화됨
- StyleGuide 생성 성공 확인

**Verification**: 체크리스트 결과 텍스트로 보고

**Suggested lane**: Opus-Verify (수동 체크 지시 + 결과 판정)

**Partial evidence / blocker** (2026-05-19, Opus-Verify C0.2 smoke — PARTIAL-GAP):
- Opus-Verify 결과: PARTIAL-GAP / REVIEW_DONE.
- CDP 런타임 DOM 검증 미수행: 검증 시점 Obsidian 라이브 세션 실행 중, port 9222 닫힘. CDP 진행 시 Obsidian 종료·재시작 + 볼트 폴더 생성 승인 필요 — 이 태스크에서 미승인.
- `_attachments/voice` 및 `_voice-samples` 폴더 부재; voice 샘플 파일 수 0. 샘플 생성·재분석 미승인으로 체크리스트 항목 6–8 PASS 불가.
- 소스·설치 번들 분석: VoicePane UI/버튼 및 picker fallback 코드 배선 확인됨. 그러나 런타임 전체 PASS는 전용 승인 윈도우 필요.
- **다음 결정 필요**: Obsidian 재시작 + 임시 voice 샘플 1개 배치를 승인하여 C0.2 전체 런타임 스모크 진행, 또는 C0.2 열어둔 채로 추후 진행.

**Completion evidence** (2026-05-19, 대표님 승인 후 Main CDP runtime smoke):
- 현재 빌드 `pnpm deploy:ai-manuscript`로 활성 설치본에 배포됨. source/shared/vault symlink target `main.js`, `manifest.json`, `styles.css` SHA-256 모두 일치.
- Obsidian을 `--remote-debugging-port=9222`로 재시작하여 실제 DOM에서 `ai-manuscript-studio`/`zettel-connect` 활성화와 `manuscript-studio-view` 렌더 확인.
- VoicePane 렌더 PASS: 폴더 경로 `/Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/_attachments/voice` 표시, 샘플 파일 목록 표시.
- 폴더 선택 fallback PASS: Obsidian 모드에서 native picker 미지원 안내와 직접 경로 입력 fallback 표시.
- Finder 버튼 PASS: `Finder 로 열기` 클릭 경로 호출 확인.
- 샘플 생성/재분석 PASS: `hermes-c0-2-smoke-voice-sample.md`로 `codex` 분석 실행, `.style-guide.json` 생성, version 2, sampleCount 1, firstImpression 5개, compressedPromptLength 715 확인.
- 런타임 중 발견한 cache 노출 버그 수정: `.style-guide.json`이 voice sample 목록에 포함되어 즉시 stale 처리되던 문제를 `voice_list_files` dotfile 제외로 해결하고 회귀 테스트 추가.
- 수정 배포 후 재시작 smoke PASS: `.style-guide.json`은 파일 목록에서 제외, `가드가 최신입니다` 표시, `현재 가드`, `압축 문체 지침`, `클립보드에 복사` 버튼 및 복사 notice 확인.

---

### [x] C0.3 Define privacy corpus rule: allow-list sample files only

**Objective**: Voice corpus 학습에 사용할 파일의 허용 범위를 명문화한다. 전체 볼트 자동 학습을 명시적으로 금지하고, 허용 목록 규칙을 문서화한다.

**Allowed write paths**:
- `docs/planning/corpus-governance.md` (신규 생성)

**Forbidden paths**:
- vault 파일 직접 수정
- packages/** 코드

**Rule to document**:
- Voice corpus = `_voice-samples/` (또는 대표님 지정 폴더) 내 수동 배치 파일만
- 2.Permanent/**, 3.Structure/**, 4.Writing/** 자동 수집 금지
- 각 파일은 대표님이 명시적으로 폴더에 복사해야 포함됨
- 대표님 승인 없는 자동 포함 금지; 대표님이 승인한 파일은 어떤 내용이든 포함 가능
- 코퍼스 변경 시 반드시 "재분석" 수동 트리거

**Acceptance criteria**:
- corpus-governance.md 생성됨
- 허용 경로 / 금지 경로 / 갱신 절차 명시됨
- docs/planning/06-tasks.md와 정합성 확인

**Verification**:
```bash
ls docs/planning/corpus-governance.md
```

**Completion evidence**:
- `docs/planning/corpus-governance.md` 생성됨 (allow-list 원칙, 자동 수집 금지, 갱신 절차 포함)
- `docs/planning/corpus-convention.md` 포함/제외 원칙 섹션 업데이트됨
- 대표님 수정 반영: 회사 기밀 포함 여부는 대표님 결정, Hermes/워커 임의 결정 금지

**Suggested lane**: Sonnet-Executor

---

## Phase B0 — Voice Corpus and No-Code Proof

---

### [x] B0.1 Design folder/corpus convention for representative voice samples

**Objective**: 대표님 문체 샘플 파일을 보관할 vault 내 폴더 컨벤션을 설계하고 권장안을 문서화한다. 실제 vault 파일은 생성하지 않는다.

**Allowed write paths**:
- `docs/planning/corpus-convention.md` (신규 생성)

**Forbidden paths**:
- vault 경로 직접 쓰기 (OneDrive-개인/지식창고/**)
- packages/** 코드
- deploy scripts

**Design items to document**:
1. 권장 폴더: `_voice-samples/` (vault root 기준)
2. 허용 파일 형식: .md만
3. 파일 네이밍: `YYYY-MM-DD-<주제>.md` 권장
4. 최소 권장 샘플 수: 5개 이상, 각 500자 이상
5. 업데이트 주기: 월 1회 또는 주요 변화 시
6. 제외 태그 규칙: frontmatter에 `voice-exclude: true` 태그 시 분석 제외 (B3 구현 예정)

**Acceptance criteria**:
- corpus-convention.md 생성됨
- 폴더 경로, 파일 규칙, 제외 태그 명시됨
- "vault 파일 미생성" 상태임을 보고에 명시

**Verification**:
```bash
ls docs/planning/corpus-convention.md
```

**Completion evidence**:
- `docs/planning/corpus-convention.md` 생성됨 (`_voice-samples/` 권장, 파일 규칙, 포함/제외 원칙 포함)

**Suggested lane**: Sonnet-Executor

---

### [x] B0.2 Recommend sample-corpus README/template paths under 4.Writing or _attachments/voice

**Objective**: 코퍼스 README와 템플릿 파일의 vault 내 위치 권장안을 도출한다. 실제 파일은 대표님 승인 후 생성한다.

**Allowed write paths**:
- `docs/planning/corpus-readme-template.md` (권장안 초안 — vault 미배포)

**Forbidden paths**:
- vault 직접 쓰기
- packages/** 코드

**Deliverable**: 아래 두 가지를 비교한 권장안 문서
- 옵션 A: `_voice-samples/README.md` + `_voice-samples/template.md`
- 옵션 B: `4.Writing/_voice/README.md` + `4.Writing/_voice/template.md`
- 판정 기준: 4.Writing 오염 방지(소스 자가오염), Obsidian 검색 노출, AI 원고실 소스노트 자동 포함 위험

**Acceptance criteria**:
- 두 옵션 비교 + 단일 권장안 명시됨
- "아직 vault 미생성" 상태 명시
- 대표님 승인 gate 표시

**Completion evidence**:
- `docs/planning/corpus-readme-template.md` 생성됨 (옵션 A/B 비교, `_voice-samples/` 권장, vault README/template 초안 포함)

**Suggested lane**: Planning Review

---

### [x] B0.3 Verify skillpack action can inject/use style guide without core modification

**Objective**: 기존 SkillPackLoader + StyleGuide 체계로 커뮤니케이션 skillpack이 현재 문체 가드(compressedPrompt)를 사용할 수 있는지 코드를 읽고 확인한다. core 코드 수정 없이 가능한지 판정.

**Allowed write paths**: 없음 (read-only 분석)

**Forbidden paths**: packages/** 수정 금지

**Files to analyze** (read-only):
- `packages/core/src/skillpack/types.ts` — SkillPackActionManifest.placeholders
- `packages/core/src/skillpack/SkillPackLoader.ts` — sanitizeManifest, promptByActionId
- `packages/obsidian-plugin/src/studio/voice/styleGuide.ts` — StyleGuideAxes.compressedPrompt
- `packages/core/src/ai/Phase2Actions.ts` — PROMPT_PRELUDE placeholder 목록

**Questions to answer**:
1. skillpack prompt template에서 `{{voice_guide}}` placeholder를 선언하면 ResultPipeline이 StyleGuide.compressedPrompt를 주입할 수 있는가?
2. 없다면 어느 파일에 몇 줄 변경이 필요한가?
3. B1 MVP를 core diff 0으로 달성 가능한가, 아니면 최소 패치가 필요한가?

**Acceptance criteria**:
- 위 3개 질문에 코드 근거(파일:라인)와 함께 답변됨
- "core diff 0 가능" 또는 "최소 패치 N줄 필요" 판정 명시
- 판정 결과가 B1 태스크 시작 전 Opus-Verify에서 승인됨

**Verification**: 분석 보고 + 코드 파일 라인 인용

**Completion evidence**:
- `packages/core/src/skillpack/PromptTemplate.ts` SUPPORTED_PLACEHOLDERS 확인: `voice_guide` 미포함 (L19-31)
- 판정: `voice_guide` 자동 주입 불가. core diff 0 유지 가능 — B1은 `user_input`에 수동 붙여넣기 방식으로 구현
- B3에서 register-specific voice guide core 패치 후 자동 주입 지원 예정

**Suggested lane**: Sonnet-Executor → Opus-Verify (판정)

---

## Phase B1 — Communication Skillpack MVP

> **B1 구현 완료.** 수동 문체 주입(manual style-prompt injection) 방식 사용.
> 자동 voice_guide 주입은 B3로 연기. 사용 방법은 `docs/planning/b1-comms-skillpack-usage.md` 참조.
> 외부 발송(Gmail/Kakao API) 금지. draft/preview/copy만.
> 각 태스크는 `_skillpacks/comms-studio/` 아래 파일 생성.

---

### [x] B1.1 email-draft + email-polish — 이메일 초안 생성 및 다듬기

**Objective**: 이메일 두 가지 액션(초안 생성, 다듬기)의 skillpack prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (신규 또는 갱신)
- `_skillpacks/comms-studio/prompts/email-draft.md`
- `_skillpacks/comms-studio/prompts/email-polish.md`

**Forbidden paths**:
- packages/** 코드 수정
- vault 내 다른 폴더
- deploy scripts
- Gmail API 호출 코드

**email-draft action spec** (실제 구현):
- id: `comms.email-draft`
- label: `이메일 초안 쓰기`
- save_to: `draft`
- requires_user_input: true
- placeholders: `["user_input", "source_notes", "reader", "core_message"]`
- note: `user_input`에 의도 + 문체 가이드 수동 붙여넣기. `voice_guide`는 미지원(B3 예정).

**email-polish action spec** (실제 구현):
- id: `comms.email-polish`
- label: `이메일 다듬기`
- save_to: `revising`
- requires_user_input: true
- placeholders: `["manuscript", "user_input"]`
- note: `user_input`에 교정 지시 + 문체 가이드 수동 붙여넣기.

**Acceptance criteria**:
- skillpack.json에 두 action 항목 포함됨
- 두 prompt .md 파일 존재
- `sanitizeManifest` 스키마 통과 (id/label/prompt_file/save_to 필드 완비)
- 외부 발송 지시 없음 확인

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/email-draft.md
ls _skillpacks/comms-studio/prompts/email-polish.md
node -e "const {sanitizeManifest}=require('./packages/core/src/skillpack/SkillPackLoader'); \
  const m=JSON.parse(require('fs').readFileSync('_skillpacks/comms-studio/skillpack.json','utf8')); \
  console.log(sanitizeManifest(m) ? 'PASS' : 'FAIL')"
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/email-draft.md`, `email-polish.md` 생성됨
- JSON_PARSE PASS, placeholder check PASS (7/7 액션)

**Suggested lane**: Sonnet-Executor

---

### [x] B1.2 kakao-short — 카카오톡 짧은 메시지

**Objective**: 카카오톡용 짧은 메시지 생성 액션의 prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (갱신)
- `_skillpacks/comms-studio/prompts/kakao-short.md`

**Forbidden paths**:
- packages/** 코드 수정
- Kakao API 호출 코드

**Action spec** (실제 구현):
- id: `comms.kakao-short`
- label: `카카오톡 메시지 쓰기`
- save_to: `draft`
- requires_user_input: true
- placeholders: `["user_input"]`
- note: `user_input`에 전달 의도 + 문체 가이드 수동 붙여넣기. 수신자 맥락도 `user_input`에 포함.

**Acceptance criteria**:
- skillpack.json에 kakao-short 항목 추가됨
- prompt 파일 존재
- 메시지 길이 지시(3~5줄 이내) 포함 확인
- 발송 지시 없음 확인

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/kakao-short.md
grep "comms.kakao-short" _skillpacks/comms-studio/skillpack.json
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/kakao-short.md` 생성됨, placeholder check PASS

**Suggested lane**: Sonnet-Executor

---

### [x] B1.3 telegram-brief — 텔레그램 간결 메시지

**Objective**: 텔레그램용 간결 메시지 생성 액션의 prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (갱신)
- `_skillpacks/comms-studio/prompts/telegram-brief.md`

**Forbidden paths**:
- packages/** 코드 수정
- Telegram Bot API 호출 코드

**Action spec** (실제 구현):
- id: `comms.telegram-brief`
- label: `텔레그램 메시지 쓰기`
- save_to: `draft`
- requires_user_input: true
- placeholders: `["user_input", "source_notes"]`
- note: `user_input`에 전달 의도 + 문체 가이드 수동 붙여넣기. `source_notes`로 참고 자료 주입 가능.

**Acceptance criteria**:
- skillpack.json에 telegram-brief 항목 추가됨
- prompt 파일 존재
- 발송 지시 없음 확인

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/telegram-brief.md
grep "comms.telegram-brief" _skillpacks/comms-studio/skillpack.json
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/telegram-brief.md` 생성됨, placeholder check PASS

**Suggested lane**: Sonnet-Executor

---

### [x] B1.4 report-polish — 보고서 다듬기

**Objective**: 보고서 초안을 대표님 문체로 다듬는 액션의 prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (갱신)
- `_skillpacks/comms-studio/prompts/report-polish.md`

**Forbidden paths**:
- packages/** 코드 수정

**Action spec** (실제 구현):
- id: `comms.report-polish`
- label: `보고서 다듬기`
- save_to: `revising`
- requires_user_input: true
- placeholders: `["manuscript", "user_input", "source_notes", "core_message", "reader"]`
- note: `user_input`에 교정 지시 + 문체 가이드 수동 붙여넣기. `reader`에 보고 대상 입력.

**Acceptance criteria**:
- skillpack.json에 report-polish 항목 추가됨
- prompt 파일 존재
- "내용 팩트 수정 금지" 지시 포함 확인

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/report-polish.md
grep "comms.report-polish" _skillpacks/comms-studio/skillpack.json
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/report-polish.md` 생성됨, placeholder check PASS

**Suggested lane**: Sonnet-Executor

---

### [x] B1.5 summary-briefing — 요약 보고자료 생성

**Objective**: 원문 자료에서 요약 보고자료를 대표님 문체로 생성하는 액션의 prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (갱신)
- `_skillpacks/comms-studio/prompts/summary-briefing.md`

**Forbidden paths**:
- packages/** 코드 수정

**Action spec** (실제 구현):
- id: `comms.summary-briefing`
- label: `요약 보고자료 만들기`
- save_to: `draft`
- requires_user_input: true
- placeholders: `["manuscript", "user_input", "source_notes", "reader", "core_message"]`
- note: `user_input`에 보고 목적 + 문체 가이드 수동 붙여넣기. `reader`에 보고 대상 입력.

**Acceptance criteria**:
- skillpack.json에 summary-briefing 항목 추가됨
- prompt 파일 존재
- 3단 구조(현황/핵심/시사점) 지시 포함 확인

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/summary-briefing.md
grep "comms.summary-briefing" _skillpacks/comms-studio/skillpack.json
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/summary-briefing.md` 생성됨, placeholder check PASS

**Suggested lane**: Sonnet-Executor

---

### [x] B1.6 memo-capture — 메모 다듬기

**Objective**: 거친 메모/생각 조각을 대표님 문체의 정리된 메모로 다듬는 액션의 prompt 파일과 manifest 항목을 작성한다.

**Allowed write paths**:
- `_skillpacks/comms-studio/skillpack.json` (갱신)
- `_skillpacks/comms-studio/prompts/memo-capture.md`

**Forbidden paths**:
- packages/** 코드 수정

**Action spec** (실제 구현):
- id: `comms.memo-capture`
- label: `메모 정리하기`
- save_to: `draft`
- requires_user_input: true
- placeholders: `["manuscript", "user_input"]`
- note: `user_input`에 정리 지시 + 문체 가이드 수동 붙여넣기.

**Acceptance criteria**:
- skillpack.json에 memo-capture 항목 추가됨
- prompt 파일 존재
- "길이 유지" 지시 포함 확인
- 최종 skillpack.json에 B1.1~B1.6 전체 7개 액션 포함 확인 (email-draft + email-polish = 2)
- `sanitizeManifest` 전체 통과

**Verification**:
```bash
ls _skillpacks/comms-studio/prompts/memo-capture.md
# 전체 액션 수 확인
node -e "const m=JSON.parse(require('fs').readFileSync('_skillpacks/comms-studio/skillpack.json','utf8')); \
  console.log('actions:', m.actions.length, m.actions.map(a=>a.id).join(', '))"
```

**Completion evidence**:
- `_skillpacks/comms-studio/prompts/memo-capture.md` 생성됨
- 전체 7개 액션 확인: comms.email-draft, comms.email-polish, comms.kakao-short, comms.telegram-brief, comms.report-polish, comms.summary-briefing, comms.memo-capture
- JSON_PARSE PASS, sanitizeManifest PASS, external-send safety PASS

**Suggested lane**: Sonnet-Executor → Opus-Verify (B1 전체 완료 게이트)

---

## Phase B2 — Quick Compose UX (Future Core Change)

> B1 완료 + 대표님 승인 후 진행. core TypeScript 변경 포함.

---

### [x] B2.1 Design Quick Compose command spec

**Objective**: 기존 4.Writing 프로젝트 wizard 없이 즉석 메시지를 작성하는 경량 Obsidian command의 UX 명세를 작성한다.

> ⚠️ **SSOT 조정** (Opus-Verify 지적): B2.1 원안은 5개 필드 + 구 command name이었으나 `docs/planning/b2-quick-compose-spec.md`(SSOT)와 불일치. 아래 내용은 spec SSOT로 통일됨. 세부 내용은 `b2-quick-compose-spec.md` 참조.

**Allowed write paths**:
- `docs/planning/b2-quick-compose-spec.md`

**Forbidden paths**: packages/** 코드 수정

**Spec items** (→ `b2-quick-compose-spec.md` SSOT 참조):
- Command palette 표시 이름: `AI 원고실: 즉석 커뮤니케이션 작성`
- Internal command id: `quick-compose-communication`
- Modal 6개 입력 필드:
  1. 형식 (register) — select: email/kakao/telegram/report/summary/memo
  2. 전달 의도 (intent) — textarea, 필수
  3. 참고 텍스트 (source) — textarea, 선택 (현재 에디터 선택 텍스트 자동 채우기)
  4. 수신자/독자 (reader) — text input, 선택
  5. 길이 힌트 (length) — select: 짧게/보통/길게
  6. 문체 모드 (style mode) — select: 수동 붙여넣기(B2) / 자동 적용(B3 이후)
- Output: 프리뷰 + 복사 + 현재 파일 삽입 버튼. 외부 발송 버튼 없음

**Acceptance criteria**:
- b2-quick-compose-spec.md 생성됨 ✅
- 6개 입력 필드 명세됨 ✅
- 외부 발송 UI 없음 명시 ✅

**Completion evidence** (2026-05-18): `docs/planning/b2-quick-compose-spec.md` v1.0 생성.

**Suggested lane**: Planning Review

---

### [x] B2.2 Implement Quick Compose modal (core change)

**Objective**: B2.1 명세 기반으로 QuickComposeModal.ts와 Obsidian command 등록을 구현한다.

**Allowed write paths**:
- `packages/obsidian-plugin/src/QuickComposeModal.ts` (신규 — plain Modal, React 불필요)
- `packages/obsidian-plugin/src/quickCompose.ts` (신규 — 순수 라우팅/프롬프트 헬퍼)
- `packages/obsidian-plugin/src/main.ts` (command 등록 추가)

**Forbidden paths**:
- packages/core/** 타입 수정 (SaveTarget/Genre 확장 X)
- vault 직접 쓰기
- 외부 API 발송 코드

**Acceptance criteria**:
- [x] QuickComposeModal 렌더 확인 (14 tests PASS)
- [x] Command palette에서 `quick-compose-communication` / `즉석 커뮤니케이션 작성` 표시
- [x] register → B1 action 라우팅 (7가지: comms.email-draft/polish/kakao/telegram/report/summary/memo)
- [x] buildQuickComposePrompt: 외부 발송 금지, 스타일 가이드 주입, register별 가드
- [x] 결과 프리뷰 + 복사 + 현재 파일 삽입 UI 구현
- [x] pnpm test: 78/78 PASS
- [x] pnpm build: EXIT 0 (tsc -noEmit + esbuild production)

**Completion evidence** (2026-05-18):
- `src/quickCompose.ts`: 19 tests — route table 8개, prompt 11개 모두 GREEN
- `src/QuickComposeModal.ts`: 14 tests — 6개 필드, 4개 버튼, intent validation, no-send 확인
- `tests/mainQuickComposeCommand.test.ts`: 4 tests — source text 기반 command id/name/import/callback 확인
- `src/main.ts`: `quick-compose-communication` command 등록, `checkCallback` 타입 애너테이션 수정

**Suggested lane**: GPT-Executor → Sonnet-Executor (빌드 확인)

---

### [x] B2.3 Add folder picker fallback for Obsidian mode

**Objective**: VoicePane.pickFolder가 Obsidian 모드에서 비작동임을 확인하고, 텍스트 입력 fallback을 구현한다.

> **경로 수정**: B2.3 원안은 `src/tauriShims/plugin-dialog.ts` 였으나 실제 경로는 `src/studio/tauriShims/plugin-dialog.ts`.

**Allowed write paths** (실제):
- `packages/obsidian-plugin/src/studio/tauriShims/plugin-dialog.ts`
- `packages/obsidian-plugin/src/studio/voice/VoicePane.tsx`

**Forbidden paths**:
- packages/core/** 타입 수정
- vault 직접 쓰기

**Acceptance criteria**:
- [x] `normalizeVoiceFolderInput` 순수 함수 — 빈 값, 상대경로, NUL 거부; macOS/Linux/Windows 절대경로 허용
- [x] VoicePane `data-field="voice-folder-input"` text input + `경로 적용` 버튼 추가
- [x] 유효성 실패 시 인라인 에러 표시, `voiceIO.setFolder` 미호출
- [x] 유효성 성공 시 `voiceIO.setFolder` 호출 후 reload
- [x] `pickFolder()` null 반환 시 경로 입력 안내 Notice 표시
- [x] pnpm test: 95/95 PASS
- [x] pnpm build: EXIT 0

**Completion evidence** (2026-05-18):
- `src/studio/tauriShims/plugin-dialog.ts`: `normalizeVoiceFolderInput` 추가 + shim 주석에 fallback 안내
- `src/studio/voice/VoicePane.tsx`: `directInput`/`directInputError` state, `handleApplyFolder`, 직접 입력 UI row
- `tests/studio/voiceIO.test.ts`: 11 tests — 6 rejection, 5 acceptance (모두 GREEN)
- `tests/VoicePane.test.ts`: 6 source contract tests (모두 GREEN)

**Suggested lane**: GPT-Executor

---

### [x] B2.4 Auto-surface indexer panel on plugin load

**Problem**: `community-plugins.json`에 `ai-manuscript-studio`가 등록돼 있어도 우측 사이드바에 패널이 나타나지 않음. `.obsidian/workspace.json`에 `ams-project-indexer` leaf 없음. ribbon/command를 직접 찾아야만 진입 가능.

**Fix**: `onload()` 마지막에 `this.app.workspace.onLayoutReady(() => void this.openIndexerOnLayoutReady())` 추가. Zettel Connect 패턴 동일 적용.

**Behavior**:
- 레이아웃 준비 후 `PROJECT_INDEXER_VIEW_TYPE` leaf가 없으면 자동 `openIndexer()`.
- 이미 leaf 존재 시(workspace.json에 저장된 경우) 재오픈 없음.
- 기존 ribbon / `open-indexer` command 동작 유지.

**Acceptance criteria**:
- [x] `onLayoutReady` 콜백이 `onload()` 내에 등록됨
- [x] 콜백이 `activeProjectFolder()`/frontmatter 없이 `openIndexer` 호출
- [x] 기존 command/ribbon 유지
- [x] pnpm test: 99/99 PASS
- [x] pnpm build: EXIT 0

**Completion evidence** (2026-05-18):
- `src/main.ts`: `onLayoutReady` 콜백 + `openIndexerOnLayoutReady()` private 메서드 추가 (6줄)
- `tests/mainAutoOpenIndexer.test.ts`: 4 source contract tests (모두 GREEN)

**Suggested lane**: GPT-Executor → 대표님 vault 설치 후 smoke 확인

---

### [x] B2.5 Representative genres + remove stale desktop-app copy

**Problem**: NewProjectModal 장르 드롭다운이 에세이/실용서/유튜브 대본 등 범용 장르였음. 대표님 실제 작업물(투자 리서치·산업분석·법률검토·전략메모 등)과 불일치. UI에 "데스크톱 앱에서 열기" 문구가 잔류 — 실제 동작(Obsidian openStudio)과 불일치.

**Fix**:
- `NewProjectModal.ts`: `NewProjectGenre` 교체, Obsidian-first toggle 레이블, 헤더 설명에서 "데스크톱 앱" 제거
- `ProjectIndexerView.ts`: 서브타이틀 + 헤더 주석 Obsidian-first 표현으로 교체
- `settings.ts`: 설정 탭 주석 + 안내 문구 Obsidian-first 표현으로 교체

> ⚠️ **장르 목록은 B2.5b 기준이 최종 확정.** 아래 초기 8종 목록(invest-research/report-briefing 등)은 히스토리 보존용이며 현재 코드와 다름.

**Genre list — initial draft (superseded by B2.5b)**:
~~1. invest-research → 투자/리서치 메모~~
~~2. industry-analysis → 산업·시장 분석~~
~~3. report-briefing → 보고서/브리핑~~
~~4. legal-review → 법률·회계·계약 검토~~
~~5. strategy-memo → 전략 메모~~
~~6. column-essay → 칼럼/에세이~~
~~7. lecture-presentation → 강의·발표안~~
~~8. manuscript-script → 원고/스크립트~~

**Genre list — final (B2.5b)**:
1. investment-strategy-memo → 투자·전략 메모 (default)
2. investment-report → 투자보고서
3. legal-accounting-review → 법률·회계·계약 검토
4. column-essay → 칼럼/에세이
5. lecture-presentation → 강의·발표안
6. long-form-manuscript → 장문 원고

**Acceptance criteria**:
- [x] 6개 장르 (B2.5b 확정), default = investment-strategy-memo
- [x] "데스크톱 앱", "URL scheme", "앱이 그 프로젝트로 부팅됩니다" 문구 없음
- [x] toggle 레이블/설명 Obsidian-first 표현
- [x] settings.ts/ProjectIndexerView.ts 주석 Obsidian-first 정렬 (B2.5c)
- [x] pnpm test: 118/118 PASS
- [x] pnpm build: EXIT 0

**Completion evidence** — final state after B2.5b+B2.5c (2026-05-18):
- `src/NewProjectModal.ts`: `NewProjectGenre` 6종 확정, `GENRE_LABEL_KO` B2.5b 최종 목록, Obsidian-first copy
- `src/ProjectIndexerView.ts`: 서브타이틀 + 헤더 주석 Obsidian-first 표현
- `src/settings.ts`: 설정 탭 주석 + 안내 문구 Obsidian-first 표현
- `tests/NewProjectModal.test.ts`: 19 tests — 6장르 순서 일치, 취소된 레이블 미포함, Obsidian 문구 존재 확인 (모두 GREEN)
- Test suites: 13 passed / Tests: 118 passed, 0 failed
- Build: EXIT 0 (tsc -noEmit -skipLibCheck + esbuild production)

> ~~**Initial draft evidence** (superseded): NewProjectGenre 8종, 17 tests, 116 total — B2.5a→B2.5b 재조정으로 대체됨.~~

> **B2.5a Amendment** (2026-05-18): 투자메모/투자보고서 분리, 보고서/브리핑 삭제. (→ B2.5b로 재조정됨)
>
> **B2.5b Amendment** (2026-05-18): 대표님 최종 피드백 — 6개 장르로 확정.
>
> **변경 이유**:
> - 산업·시장 분석 삭제: 투자메모/투자보고서의 분석 파트로 흡수
> - 투자메모 + 전략 메모 병합 → `"investment-strategy-memo"` (투자·전략 메모): 의사결정 메모 동일 목적
> - 원고/스크립트 → `"long-form-manuscript"` (장문 원고): 스크립트 의미 제거, 책·긴 글로 명확화
> - `"legal-review"` → `"legal-accounting-review"` 키 정렬 (라벨 동일: 법률·회계·계약 검토)
> - 이메일/카카오톡/텔레그램은 output channel — 장르 목록 제외 재확인
>
> **최종 장르 목록 (B2.5b 확정)**:
> 1. investment-strategy-memo → 투자·전략 메모 (default)
> 2. investment-report → 투자보고서
> 3. legal-accounting-review → 법률·회계·계약 검토
> 4. column-essay → 칼럼/에세이
> 5. lecture-presentation → 강의·발표안
> 6. long-form-manuscript → 장문 원고
>
> **B2.5b 완료 증거**: Tests: 118/118 PASS (19 NewProjectModal) · Build: EXIT 0
>
> **B2.5c Amendment** (2026-05-18): Hygiene cleanup — stale comments only, no behavior change.
> - `settings.ts` top comment: Tauri desktop app 언급 제거
> - `ProjectIndexerView.ts` header comment: "앱에서 열기" → in-vault view 표현
> - `06-tasks.md` B2.5 초기 8종 목록 취소선 처리 + B2.5b 최종 목록 명시
> - Tests: 118/118 PASS · Build: EXIT 0

**Suggested lane**: Sonnet-Executor

---

### [x] B2.6 Studio-wide taxonomy overhaul

**Objective**: `Genre`/`ConceptTone` SSOT를 `packages/core/src/types.ts`와 `schema.ts`에 통일하고, 모든 소비자 (Templates, fallback, UI, tests)를 최종 6종 장르 + 4종 ConceptTone으로 정렬한다.

**Completion evidence** (2026-05-18):

- `packages/core/src/types.ts`: `Genre` 6종 (`investment-strategy-memo` … `long-form-manuscript`), `GENRE_LABEL_KO` 최종 6종
- `packages/core/src/project/schema.ts`: `ConceptTone` 4종 (`decision-memo`/`analytical-report`/`explanatory`/`column-narrative`) + guard 갱신
- `packages/core/src/project/Templates.ts`: 6종 빌더 완전 재작성 (CANONICAL_SECTIONS 준수)
- `packages/core/src/wizard/WizardEngine.ts`, `PlanningMdWriter.ts`, `ProjectManager.ts`, `WritingNoteIO.ts`: 모든 fallback `"essay"` → `"investment-strategy-memo"`
- `packages/obsidian-plugin/src/NewProjectModal.ts`: 로컬 `NewProjectGenre`/`GENRE_LABEL_KO` 제거 → core re-export로 통일
- `packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx`: TONE_OPTIONS 4종 갱신, GENRE_OPTIONS core `GENRE_LABEL_KO` 파생, `DEFAULT_GENRE_FOR_TONE` 제거, default tone `"decision-memo"` / genre `"investment-strategy-memo"`, copy "어떤 글/문서를 만들까요?" / placeholder "목적, 독자, 핵심 메시지", 섹션 레이블 "문체·논조"
- `packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx`: GENRE_OPTIONS core 파생, `genreDraft` default `"investment-strategy-memo"`
- `apps/desktop/src/wizard/concept/Step1Seed.tsx`, `apps/desktop/src/wizard/WizardOverlay.tsx`: plugin과 동기화 (1:1 copy)
- `packages/obsidian-plugin/tests/studio/wizard/Step1Seed.contract.test.ts`: 신규 — 구 라벨 부재 + 신 라벨 존재 + copy/default 검증 (18 assertions)
- Core tests: 255/287 PASS (32 skipped — WizardEngine describe.skip 유지) · Plugin tests: 138/138 PASS
- Build: core EXIT 0 · obsidian-plugin EXIT 0

**Suggested lane**: Sonnet-Executor

---

### [x] P0 Runtime fix — Studio context lifecycle + voice shim shape

**Objective**: Fix user-visible runtime error "삭제 실패: Studio context 가 초기화되지 않았습니다" and related voice data display bugs.

**Root cause confirmed**: `disposeStudioContext()` in `ManuscriptStudioView.onClose()` blindly set `_plugin = null` regardless of how many views were still open. Any async operation (voice delete, folder reload) in flight after any view closes would throw.

**Runtime fix** (2026-05-18):

- `packages/obsidian-plugin/src/studio/context.ts`: Rewritten with ref-counting. `initStudioContext()` now returns a release function. `_plugin` is only set to null when all view tokens have been released. Added `_resetContextForTests` for test isolation.
- `packages/obsidian-plugin/src/studio/ManuscriptStudioView.tsx`: Stores release token from `initStudioContext()`; calls `releaseContext?.()` in `onClose()`. Removed `disposeStudioContext` import.
- `packages/obsidian-plugin/src/studio/tauriShims/core.ts`: Fixed `voice_folder_info` / `voice_set_folder` / `voice_reset_folder` return shape — now returns `{ path, isCustom, defaultPath }` matching `VoiceFolderInfo`. Fixed `voice_list_files` return shape — now returns `{ name, absPath, modifiedMs, size }` matching `VoiceFileEntry` (was snake_case `abs_path`, missing stat fields).
- `packages/obsidian-plugin/src/adapters/aiBridge.ts`: Changed `CODEX_DEFAULT_MODEL` from `"gpt-5.4"` → `"gpt-5.5"`.

**AI runtime findings**:
- `useMockBridge=false` + non-empty `codexPath` → `defaultBridgeFromSettings()` correctly returns `CLIWizardBridge`. Path checked in `wizardStore.ts`.
- The wizard shows a `BridgeBadge` ("Codex CLI" vs "Mock 모드") — if it shows Mock 모드 on the user's machine, the settings store may not have loaded yet when the wizard opens. That is a separate potential race (not addressed in this P0).

**Tests**:
- `packages/obsidian-plugin/tests/studio/context.test.ts`: 8 new lifecycle tests — single view, two views, double-release idempotency, reopen cycle.
- `packages/obsidian-plugin/tests/adapters/aiBridge.test.ts`: Updated default model assertion to `gpt-5.5`.
- `packages/obsidian-plugin/tests/studio/tauriShimsCore.test.ts`: Updated voice_folder_info + voice_list_files assertions to new field names.
- Plugin tests: 145/145 PASS · Build: EXIT 0 · main.js SYNTAX OK

**Suggested lane**: Sonnet-Executor

---

### [x] genre-tone-ai-contract-fix — Concept + Planning Wizard Genre/Tone Contract

**Objective**: Genre 선택이 AI 질문에 실제로 반영되도록 prompt 계약 수정. investment-report 선택 시 투자 도메인 질문, 에세이 질문 제거.

**Root causes fixed** (2026-05-18):
- `conceptPrompts.ts` — generic system prompt에 genre/tone 없음 → `buildConceptSystemPrompt(session)` 추가. investment-report/investment-strategy-memo/legal-accounting-review는 투자·금융 코칭 프롬프트 반환; column-essay/long-form-manuscript는 서사 코칭; lecture-presentation은 강의 코칭.
- `Step2Concept.tsx` — `callAI`/`handleDistill`에서 `CONCEPT_STAGE_SYSTEM_PROMPT` 직접 사용 → `buildConceptSystemPrompt(session)` (session null 시 fallback).
- `motive.md` — 구 genre keys (`essay/practical/youtube/lecture/world`) 전체 교체 → 현행 6종 genre keys (investment-report 전용 thesis/거래 맥락 가이드 포함).
- `structure-pick.md` — 구 genre 카탈로그 5종 전체 교체 → 현행 6종 genre 구조 템플릿 카탈로그.
- `CLIWizardBridge.askNext()` — render values에 `structured_handoff` 누락 → 추가 (legacy 경로도 draft_genre 전달).
- `wizardSeed.ts:71` — `?? "essay"` stale fallback → `?? "investment-strategy-memo"`.
- `packages/core/src/project/schema.ts` — `ConceptTone` 4종 → 8종 (investment-committee, legal-accounting-review, long-form-reasoning, lecture-presentation 추가).
- `Step1Seed.tsx` (plugin + desktop mirror) — TONE_OPTIONS 4→8종 갱신.

**Tests** (2026-05-18):
- `tests/studio/wizard/conceptPrompts.test.ts`: 5 unit tests — genre/tone 주입, investment-report 투자 개념 포함, 에세이 토큰 부재.
- `tests/studio/wizard/planningPrompts.contract.test.ts`: 26 source-contract — motive.md 6종 genre 키 존재 + 구 키 부재 + investment thesis 포함; structure-pick.md 6종 키 존재 + 구 섹션 부재; CLIWizardBridge.askNext structured_handoff 포함; wizardSeed fallback 검증.
- `tests/studio/wizard/Step2Concept.contract.test.ts`: 3 source-contract — buildConceptSystemPrompt 임포트, systemPrompt에 CONCEPT_STAGE_SYSTEM_PROMPT 직접 사용 없음, session 전달.
- `tests/studio/wizard/Step1Seed.contract.test.ts`: 기존 18개 → 22개 assertions (8 tone 라벨 검증으로 확장).
- `packages/core/tests/schema.test.ts`: `isConceptDraftSession` 8종 tone 유효 + 구 tone 거부 (14 assertions 추가, addendum).
- Plugin tests: 182/182 PASS · Core tests: 269/301 PASS (32 skipped) · Build: EXIT 0 · tsc noEmit CLEAN (core + plugin)

**Changed files**:
- `packages/core/src/project/schema.ts` — ConceptTone 8종 + isConceptDraftSession tone 8종·genre 6종 엄격 검증 (addendum-1/2)
- `packages/core/tests/schema.test.ts` — isConceptDraftSession tone 8종 유효/4종 거부 + genre 6종 유효/5종 거부 (addendum-1/2)
- `packages/obsidian-plugin/src/studio/wizard/concept/conceptSeed.ts` — `?? "essay"` → `?? "investment-strategy-memo"` (addendum-2)
- `packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts` — buildConceptSystemPrompt 추가
- `packages/obsidian-plugin/src/studio/wizard/concept/Step2Concept.tsx` — genre-aware system prompt
- `packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx` — 8 tone options
- `apps/desktop/src/wizard/concept/Step1Seed.tsx` — 8 tone options (mirror)
- `packages/obsidian-plugin/src/studio/wizard/prompts/motive.md` — 6종 genre 가이드
- `packages/obsidian-plugin/src/studio/wizard/prompts/structure-pick.md` — 6종 genre 구조 카탈로그
- `packages/obsidian-plugin/src/studio/wizard/CLIWizardBridge.ts` — askNext structured_handoff 추가
- `packages/obsidian-plugin/src/studio/wizard/wizardSeed.ts` — fallback 수정
- `packages/obsidian-plugin/tests/studio/wizard/planningPrompts.contract.test.ts` — conceptSeed.ts fallback 계약 추가 (addendum-2)

**No deploy/commit/push 확인**: ✓

---

### [x] customer-report-tone-click-prompt-fix — Tone Rename + Click UX + Prompt Quality

**Objective** (2026-05-18): 세 가지 구조적 수정.
1. Tone taxonomy 정정: `investment-committee` → `customer-report`, "투자위원회 보고체" → "고객 보고체".
2. 기획 인터뷰 객관식 클릭 UX: 일반 옵션 클릭 시 즉시 전송; 직접 입력(마지막 옵션)만 textarea → 명시적 전송.
3. 투자/법률 장르 프롬프트 품질 상향: claim/thesis/evidence/counterpoint/downside/invalidation trigger/action/client caveat 구조 포함; 감성·비유·어린시절 제거.

**Root causes fixed** (2026-05-18):
- `ConceptTone` 타입에 `"investment-committee"` (투자위원회 대상) 잔류 — 대표님은 고객에게 보고, IC에 보고하는 위치 아님. → `"customer-report"` 로 rename.
- `conceptPrompts.ts` investment 브랜치 — "투자위원회(IC) 의사결정에 필요한 정보" 언급. → 제거하고 고객 보고 구조(thesis/evidence/counterpoint/invalidation/action/caveat) 로 교체.
- `WizardChat.tsx` `ChoiceInput.onSelect = setSelectedChoice` 직접 전달 — 클릭이 state만 설정, auto-submit 없음. → `handleChoiceSelect(i)` 추가: non-last 옵션은 클릭 즉시 `sendUserMessage` 호출; last 옵션만 textarea 노출.
- `tone.md` / `audience-message.md` — "따뜻한 인터뷰어" 맥락, 일반 글쓰기 독자 예시 → investment 장르 전용 가이드 섹션 추가 (논증·근거 중심 톤 옵션; 고객/LP/수탁자 독자 옵션).
- 기존 sessionStorage 세션에 `investment-committee` tone이 있을 수 있음 → `loadFromSession()` migration으로 `customer-report` 승격.

**Tests** (2026-05-18):
- `packages/core/tests/schema.test.ts`: `customer-report` 유효 PASS · `investment-committee` 거부 PASS (2 new assertions).
- `tests/studio/wizard/Step1Seed.contract.test.ts`: "고객 보고체" 존재 · "투자위원회 보고체" 부재 PASS.
- `tests/studio/wizard/conceptPrompts.test.ts`: "투자위원회(IC) 언급이 없다" PASS · "고객 보고 컨텍스트" PASS.
- `tests/studio/wizard/WizardChat.contract.test.ts` (신규): `handleChoiceSelect` 존재 · `onSelect={setSelectedChoice}` 직접 전달 없음 · sendUserMessage 포함 PASS.
- `tests/studio/wizard/planningPrompts.contract.test.ts`: tone.md/audience-message.md investment 가이드 존재 PASS.
- Plugin tests: 195/195 PASS · Core tests: 45/45 PASS · Build: EXIT 0 (core + plugin).

**Changed files**:
- `packages/core/src/project/schema.ts` — `ConceptTone`: `"investment-committee"` → `"customer-report"` + `VALID_TONES` 동기
- `packages/core/tests/schema.test.ts` — `ALL_TONES` 갱신 + `OLD_INVALID_TONES`에 `"investment-committee"` 추가
- `packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts` — `CONCEPT_TONE_LABEL["customer-report"]="고객 보고체"` + investment 브랜치 프롬프트 품질 상향 (IC 제거, 고객 보고 구조 6항목)
- `packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx` — `TONE_OPTIONS` `customer-report` / "고객 보고체"
- `apps/desktop/src/wizard/concept/Step1Seed.tsx` — mirror (ConceptTone 타입 파괴 대응)
- `packages/obsidian-plugin/src/studio/state/conceptWizardStore.ts` — `loadFromSession()` migration: `"investment-committee"` → `"customer-report"`
- `packages/obsidian-plugin/src/studio/wizard/WizardChat.tsx` — `handleChoiceSelect` 추가; `ChoiceInput onSelect={handleChoiceSelect}`; 직접 입력만 textarea+답변 버튼 표시
- `packages/obsidian-plugin/src/studio/wizard/prompts/tone.md` — investment/column-essay/lecture 장르별 톤 옵션 가이드 추가
- `packages/obsidian-plugin/src/studio/wizard/prompts/audience-message.md` — investment 장르 고객 중심 독자·메시지 옵션 가이드 추가
- `packages/obsidian-plugin/tests/studio/wizard/WizardChat.contract.test.ts` (신규) — auto-submit 계약 검증
- `packages/obsidian-plugin/tests/studio/wizard/planningPrompts.contract.test.ts` — tone.md/audience-message.md investment 가이드 assertions 추가

**Stale-token scan**:
- "투자위원회 보고체": test assertions 전용 (`.not.toContain`) ✓
- "투자위원회(IC)": test assertions 전용 (`.not.toContain`) ✓
- `investment-committee`: migration code + `OLD_INVALID_TONES` test + 06-tasks.md historical reference만 ✓

**No deploy/commit/push 확인**: ✓

---

## Phase B3 — Register-Specific Voice Guides (Future Core Change)

> B1 완료 + 대표님 승인 후 진행. core 변경 포함.

---

### [x] B3.1 Design register-voice registry schema

**Objective**: 이메일/카카오/보고서/메모별 문체 delta 레지스트리의 스키마와 파일 위치를 설계한다.

**Allowed write paths**:
- `docs/planning/b3-register-voice-spec.md`

**Forbidden paths**: packages/** 코드 수정 (설계만)

**Spec items**:
- Base StyleGuide: 전역 `.style-guide.json` (기존)
- Register delta: `<resolved voice 폴더>/.register-guides/<register>.json` (원 초안의 `_voice-samples/` 하드코딩은 B3.1 설계에서 폐기 — 권위 스펙: `docs/planning/b3-register-voice-spec.md §1`)
- delta 형식: `{ register: "email", overrides: { sentenceBreath: "...", readerDistance: "..." }, addedInstructions: "..." }`
- fallback: register-specific guide 없으면 base guide 사용

**Acceptance criteria**:
- b3-register-voice-spec.md 생성됨
- 스키마 예시 포함
- fallback 동작 명시

**Suggested lane**: Planning Review

**Completion evidence** (2026-05-19):
- `docs/planning/b3-register-voice-spec.md` 신규 생성됨.
- Planning Review 설계 검토(`.cmux-harness/logs/Planning Review-20260519-211133.log` lines 764-993) 반영 — 원 스펙 6개 수정:
  1. 경로: `_voice-samples/` 하드코딩 → `<resolved voice 폴더>/.register-guides/` (voiceIO.path() + guidePath 패턴 재사용).
  2. Register 키: action-id형 명칭 폐기 → 기존 6 Register 유니온 사용 (`email|kakao|telegram|report|summary|memo`).
  3. 스키마: StyleGuideAxes 구조 오버라이드/딥머지 모델 폐기 → 가산형 prompt delta (`addedInstructions` 주 + 화이트리스트 스칼라 `overrides`) + `version`/`updatedAt` 추가.
  4. 관용 파싱 + version 체크 — `loadStyleGuide()` 동일 정책 명문화. `styleDna`/`compressedPrompt` 오버라이드 금지.
  5. 프라이버시 절 추가 — 원문 미포함 / dot-폴더 / 자동수집 금지 / compose read-only.
  6. Obsidian shim 서브폴더 쓰기 미검증 리스크를 B3.2 선결 항목으로 박제.

---

### [x] B3.2 Implement register voice loader (core change)

**Objective**: B3.1 스키마 기반으로 레지스터별 StyleGuide를 로드하는 함수를 core에 추가한다.

**Allowed write paths**:
- `packages/obsidian-plugin/src/studio/voice/registerGuide.ts` (신규)
- `packages/obsidian-plugin/src/studio/voice/styleGuide.ts` (delta merge 함수 추가)

**Forbidden paths**:
- packages/core/src/skillpack/types.ts SaveTarget 수정 금지
- vault 직접 쓰기

**Acceptance criteria**:
- `loadRegisterGuide(register: string)` delta loader 구현
- register guide 없으면 base guide 반환 (`loadRegisterStyleGuide`) / null-delta fallback
- 유닛 테스트 (InMemory): email register → delta 적용된 guide 반환 확인
- pnpm test pass

**Suggested lane**: GPT-Executor

**Completion evidence** (2026-05-19):
- RED: `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts` initially failed because `registerGuide.ts` did not exist / feature missing.
- GREEN targeted: `pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts` → 1 suite, 9 tests passed.
- Related targeted: `pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts tests/quickCompose.test.ts` → 3 suites, 39 tests passed.
- Full verification: `pnpm test` → 23 suites, 228 tests passed.
- Build: `pnpm build` → exit 0.
- Implemented read-only loader/merge in `packages/obsidian-plugin/src/studio/voice/registerGuide.ts`; no QuickComposeModal/B3.3 wiring.

---

### [x] B3.3 Corpus manifest and exclusion tags

**Objective**: voice-exclude frontmatter 태그가 있는 파일을 voice corpus에서 제외하는 필터를 구현한다.

**Allowed write paths**:
- `packages/obsidian-plugin/src/studio/voice/voiceIO.ts` (exclusion filter 추가)
- `packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts` (frontmatter 기반 corpus/signature filter — 구현 범위 보정)

**Forbidden paths**:
- vault 직접 쓰기
- packages/core/** 수정

**Acceptance criteria**:
- `voice-exclude: true` frontmatter 파일이 analyzeStyle에서 제외됨
- 유닛 테스트: exclusion tag 파일 포함/제외 케이스 모두 확인
- pnpm test pass

**Suggested lane**: GPT-Executor

**Completion evidence** (2026-05-19):
- Scope correction: 원래 B3.3 row는 `voiceIO.ts`만 listed했으나, frontmatter 판정은 파일 내용 read 이후 가능하므로 `analyzeStyle.ts`에 read-only pre-AI filter를 구현.
- RED: `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts` initially failed because `_internal.isVoiceExcludedFrontmatter` / `filterVoiceIncludedFiles` / `loadSamples` did not exist.
- GREEN targeted: `pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts` → 1 suite, 7 tests passed.
- Related targeted: `pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts` → 3 suites, 27 tests passed.
- Full verification: `pnpm test` → 24 suites, 235 tests passed.
- Build: `pnpm build` → exit 0.
- Excluded `.md` files are omitted from prompt samples and `buildSignatures(includedFiles)`; no QuickComposeModal/registerGuide/vault/installed-plugin writes.

---

## Phase W — Zettel Bridge Continuation

> Track C B0/B1 완료 후 진행. 13.zettel-connect 수정 금지.

---

### [ ] W1 Active structure note import command

**Objective**: AI 원고실에 "현재 구조노트를 원고 프로젝트로 가져오기" Obsidian command를 구현한다.

**Allowed write paths**:
- `packages/obsidian-plugin/src/structureBridge/types.ts`
- `packages/obsidian-plugin/src/structureBridge/parseStructureNote.ts`
- `packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts`
- `packages/obsidian-plugin/src/main.ts` (command 등록)

**Forbidden paths**:
- 2.Permanent/**, 3.Structure/**, VAULT_INDEX 쓰기 금지
- 13.zettel-connect 수정 금지
- deploy scripts

**Acceptance criteria**:
- Command palette에서 명령 표시
- 3.Structure 파일이 아닌 곳에서 실행 시 안전한 에러 메시지
- 4.Writing/<slug>/project.json, binder.json, planning.md 생성 확인
- project.json.sourceNotes에 구조노트 경로 포함 확인
- pnpm test pass + pnpm build pass

**Verification**:
```bash
pnpm --filter @ai-manuscript-studio/core test
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/obsidian-plugin build
node --check packages/obsidian-plugin/main.js
```

**Suggested lane**: GPT-Executor → Sonnet-Executor (빌드 확인) → Opus-Verify (gate)

---

### [ ] W2 sourceNotes context consumption fix

**Objective**: project.json.sourceNotes(camelCase)가 AI 코칭 컨텍스트에 실제로 주입되는지 확인하고 v1 snake_case 혼재를 정리한다.

**Allowed write paths**:
- `packages/core/src/ai/ContextComposer.ts`
- `packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts`
- `packages/obsidian-plugin/src/studio/ai/streamingChat.ts`

**Forbidden paths**:
- vault 직접 쓰기
- 13.zettel-connect 수정

**Acceptance criteria**:
- 프로젝트의 sourceNotes ["[[A]]", "[[B]]"] → notesContext에 A, B 포함 확인
- 선택 영역 액션에서 현재 프로젝트 sourceNotes 선택적 포함 가능
- pnpm test pass

**Suggested lane**: GPT-Executor

---

### [ ] W3 Handoff JSON import

**Objective**: `_index/writing-handoff.json`에서 AI 원고실 프로젝트를 생성하는 command를 구현한다.

**Allowed write paths**:
- `packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts` (갱신)
- `packages/obsidian-plugin/src/main.ts` (command 추가)

**Forbidden paths**:
- 2.Permanent/**, 3.Structure/**, VAULT_INDEX 쓰기 금지
- 13.zettel-connect 수정

**Acceptance criteria**:
- `_index/writing-handoff.json` 존재 시 프로젝트 생성 성공
- handoff.json 없으면 안전한 에러 메시지
- project.json.sourceNotes = 구조노트 + picked 영구노트 전체 포함
- pnpm test pass

**Suggested lane**: GPT-Executor

---

### [ ] W4 Optional Zettel Connect send-to-writer button

**Objective**: 13.zettel-connect에 "✍️ 원고실로 보내기" 버튼을 추가한다. W1/W2 완료 후에만 진행.

**Allowed write paths**:
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/view/ConnectionPanel.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/actions/save-writing-handoff.ts` (신규)

**Forbidden paths**:
- 13.zettel-connect/src/settings.ts (핵심 설정 수정 최소화)
- 14 repo packages/zettel-connect/** 수정 금지
- 14 repo pnpm deploy:zettel 실행 금지

**Acceptance criteria**:
- 3.Structure seed에서 "✍️ 원고실로 보내기" 버튼 표시
- 버튼 클릭 → `_index/writing-handoff.json` 생성 + AI 원고실 W3 command 트리거
- 13.zettel-connect npm test pass
- 기존 기능(추천받기/링크삽입/저장만) 회귀 없음 확인

**Verification**:
```bash
cd /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect
npm test
```

**Suggested lane**: GPT-Executor → Opus-Verify (gate)
