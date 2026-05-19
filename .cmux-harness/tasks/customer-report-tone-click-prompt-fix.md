# TASK_ID: customer-report-tone-click-prompt-fix

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 시니어 프론트엔드 전문가이자 UI/UX 디자인 아키텍트.
- React/TypeScript UI 동작, 접근성, 테스트, 프롬프트 계약을 증거 기반으로 수정.
- 사용자-facing writing workflow에서는 taxonomy와 실제 업무 맥락을 우선한다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
대표님이 지적한 세 가지를 한 번에 구조적으로 수정하라.

1. Tone taxonomy 정정:
   - “투자위원회 보고체”는 대표님 맥락에 맞지 않는다.
   - 대표님은 투자위원회에 보고하는 사람이 아니라 고객에게 보고서/브리핑/텔레그램/워드/PPT를 전달한다.
   - 따라서 active tone label은 “고객 보고체”가 되어야 한다.
   - 가능한 한 내부 stable key도 `investment-committee`가 아니라 `customer-report`로 바꾸고, 기존 저장 세션에 `investment-committee`가 있을 경우는 명시적 migration/normalization으로 `customer-report`로 승격하라. 단, old token이 active prompt/UI/docs에 남으면 실패다.
   - 고객이 쉬운 고객인지 어려운 고객인지까지 tone을 세분하지 않는다. 전달 대상은 “고객”으로 둔다. Word/PPT/Telegram은 tone/genre가 아니라 format/channel이다.

2. 새 원고 마법사 > 기획 인터뷰 객관식 클릭 UX 수정:
   - 사용자 제공 스크린샷: `/Users/dongchanyoon/Desktop/스크린샷 2026-05-18 오후 10.07.05.png`
   - OCR evidence: 화면에 “기획 인터뷰”, “이 보고서를 쓰게 된 가장 직접적인 거래 맥락은 무엇인가요?”, 객관식 `1. 신규 딜/상정`, `2. 후속투자 근거 정리`, `3. 60일 전 최종 점검`, `5. 직접 입력`, 하단 “답을 골라주세요…”가 보인다.
   - 현재 UX는 객관식 행을 클릭해도 사용자가 기대하는 “답변 진행”이 되지 않는다. 일반 객관식은 행 클릭 한 번으로 선택+전송되어 다음 질문으로 넘어가야 한다.
   - “직접 입력/기타”만 예외: 행 클릭 시 textarea를 열고 직접 입력 후 답변 버튼으로 전송한다.
   - 답변 버튼이 화면 오른쪽에 숨어 있거나 좁은 폭에서 보이지 않는 문제도 함께 점검하라. 버튼이 남아 있다면 접근 가능하고 눈에 띄어야 한다.
   - 마우스, 키보드 접근성(Enter/Space) 모두 고려하라.

3. 장르/보고체/프롬프트 지침 수준 검증 및 상향:
   - 현재 새원고마법사/기획 프롬프트가 대표님 업무 핀트에 맞는지 의심된다.
   - `/structure` skill의 원칙과 맞아야 한다: 소설 금지, 근거 기반, 주장/근거/반대/무효화 트리거/실행 항목, 투자·법률·회계·고객 보고 문맥.
   - 기존 GitHub/레포 지침 수준에 맞게 active prompts를 검토하고 낮은 수준의 “책/작가/감정/은유/어린시절” 식 프롬프트가 투자보고서·투자전략·법률회계 장르에 섞이지 않게 수정하라.
   - 단, column-essay/long-form-manuscript 같은 서술형 장르에는 서술/에세이 코칭이 남을 수 있다.
   - `voice_guide` placeholder는 아직 미지원이므로 자동 주입하지 말고 기존 B0/B1 원칙을 유지하라.

INPUTS / INITIAL EVIDENCE:
- Read these files first:
  - packages/obsidian-plugin/src/studio/wizard/WizardChat.tsx
  - packages/obsidian-plugin/src/studio/wizard/wizardStore.ts
  - packages/obsidian-plugin/src/studio/wizard/prompts/*.md
  - packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx
  - packages/obsidian-plugin/src/studio/wizard/concept/Step2Concept.tsx
  - packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
  - packages/obsidian-plugin/src/studio/state/conceptWizardStore.ts
  - packages/core/src/browser.ts / index exports if needed
  - packages/core/src/types.ts and any ConceptTone declaration source
  - packages/core/src/project/schema.ts if validation/migration needed
  - _skillpacks/comms-studio/prompts/*.md for current prompt-quality reference
  - docs/planning/corpus-governance.md for voice_guide constraint
- Existing observations from Main:
  - Step1Seed.tsx currently labels `investment-committee` as “투자위원회 보고체”.
  - conceptPrompts.ts currently maps `investment-committee` to “투자위원회 보고체” and even says “투자위원회(IC) 의사결정에 필요한 정보”. This is wrong for 대표님.
  - WizardChat ChoiceInput currently uses radio row + separate submit. Screenshot suggests user expects clicking an option to proceed. Make the UX explicit and robust.

ALLOWED_WRITE_PATHS:
- packages/core/src/**
- packages/core/tests/**
- packages/obsidian-plugin/src/studio/wizard/**
- packages/obsidian-plugin/src/studio/state/**
- packages/obsidian-plugin/src/studio/styles/**
- packages/obsidian-plugin/tests/studio/wizard/**
- packages/obsidian-plugin/tests/studio/state/**
- packages/obsidian-plugin/tests/**Wizard*.test.ts*
- _skillpacks/comms-studio/**
- docs/planning/**
- .cmux-harness/logs/**

READ_ONLY_PATHS:
- /Users/dongchanyoon/Desktop/스크린샷 2026-05-18 오후 10.07.05.png
- README.md, package.json, pnpm-lock.yaml unless tests/build show a necessary non-lock metadata fix.

FORBIDDEN_PATHS:
- apps/desktop/** unless a TypeScript/shared-core type break strictly requires parallel compatibility; if touched, justify separately.
- commit/push/deploy.
- Obsidian vault runtime install folders.

DEPENDENCIES:
- cmux harness active; Main is orchestrator, not direct editor.
- Do not deploy. Do not commit. Do not push.

PROCESS REQUIREMENTS:
1. Use systematic debugging: root cause note before fixing the click bug.
2. Use TDD where possible:
   - First add/update failing tests for customer-report taxonomy and choice-click behavior.
   - Verify RED or explain if an existing test already fails.
   - Then implement minimal fix.
3. Do not do broad unrelated cleanup.
4. Keep delivery channel separate from genre/tone.

ACCEPTANCE_CRITERIA:
A. Tone taxonomy:
- UI shows “고객 보고체”; “투자위원회 보고체” absent from active UI/tests/prompts/docs.
- Active prompt text does not include `투자위원회(IC)` or imply IC reporting as target for 대표님’s investment-report workflow.
- If stable key renamed to `customer-report`, tests prove old `investment-committee` is normalized/migrated or rejected safely.
- `customer-report` prompt context explains customer-facing reporting: clear thesis, evidence, return/risk, downside, client-readable caveats, next action; not delivery channel-specific.

B. Click UX:
- For non-other choice options in new manuscript planning interview, clicking the row/label once sends the selected answer and advances to the next question / triggers `sendUserMessage`.
- Other/direct-input option still opens input and requires user text.
- A regression test catches the old “clicking row only selects but does not submit” behavior.
- Keyboard Enter/Space on an option is supported or native button/radio semantics are preserved with an accessible submit path.

C. Prompt quality:
- Investment/report/legal prompts include structure-note-grade concepts: claim/thesis, evidence/source, counterpoint/downside, invalidation trigger, action/next step, client-facing caveat where relevant.
- Creative-only concepts like childhood/emotion/metaphor are absent from investment-report / investment-strategy-memo / legal-accounting-review prompt paths.
- Genre taxonomy remains the six active genres.

D. Verification:
Run and report exact commands + exit codes:
- targeted tests for wizard/taxonomy/prompt changes
- `pnpm --filter @ai-manuscript-studio/core test`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runInBand tests relevant to wizard if full test too slow; prefer full plugin test if feasible`
- `pnpm --filter @ai-manuscript-studio/core build`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
- stale token scan for `투자위원회 보고체`, `투자위원회(IC)`, and active `investment-committee` outside migration/test compatibility contexts.

REQUIRED_EVIDENCE:
- Root cause summary for click bug with file/line references.
- List of changed files.
- Test RED/GREEN evidence.
- Stale-token scan result.
- Build/test command outputs summarized.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
1. Root cause
2. Changes made
3. Tests/builds run (command, exit, key pass counts)
4. Stale-token scan
5. Remaining risks / whether Opus-Verify should focus on anything
6. Final marker line: BUILD_DONE
