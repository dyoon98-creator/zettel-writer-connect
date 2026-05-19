# TASK_ID: genre-tone-ai-contract-fix

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY: Fix React/TypeScript Obsidian wizard behavior with TDD. Trace state→prompt→AI contract, write failing tests first, then minimal implementation. Also act as test-focused implementer for source-contract and UI tests. Preserve existing working P0 runtime fixes. No deploy/commit/push.
MODEL_OR_LANE: Sonnet-Executor

OBJECTIVE
Fix the user's confirmed runtime issue:
1. In the Concept Wizard, selecting genre="investment-report" (투자보고서) and any tone must make the AI ask investment-report-appropriate questions, not essay/supil/author-emotion questions.
2. In the connected planning/interview wizard, selected draftGenre/draftTitle/tone context must affect prompts. Old genre concepts (essay/practical/youtube/lecture/world, 수필/실용서/유튜브/세계관/웹소설) must be removed from active prompts.
3. The planning interview choice UI must progress reliably when a choice is clicked/answered. If the AI returns a choice question, radio/label click + 답변 must call sendUserMessage and advance stage per STAGE_TURN_LIMIT. If the AI returns open text due JSON parse failure, user must still have a usable input path and visible error/retry guidance.
4. Do NOT add a generic compatibility shim. This is a prompt-contract/state-contract structural fix.

USER EVIDENCE / COMPLAINT
- User selected investment-report, but Concept Wizard asked essay-like/supil-like questions.
- Connected planning interview also asked unrelated questions for an investment report.
- In that interview, clicking did not progress.
- User expectation: selected genre/tone controls AI behavior.

ROOT-CAUSE FINDINGS FROM MAIN READ-ONLY INSPECTION
- `packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts` is generic: "작가의 책 컨셉 코치", asks about 독자/감정/은유, no genre/tone contract.
- `Step2Concept.tsx` passes `CONCEPT_STAGE_SYSTEM_PROMPT` unchanged and first user message only includes seed/memo. It does not inject session.genre/session.tone into system or user prompt.
- planning interview prompt `prompts/motive.md` still contains old genre keys: essay/practical/youtube/lecture/world and examples 수필/실용서/유튜브/강의/세계관. These are exactly why investment-report can drift to essay.
- `CLIWizardBridge.ts` has `buildStructuredHandoff(session)` but render values in `askNext` do not include structured_handoff; `askNextQuestion` does. Neither has a strong genre policy table for current 6 genres.
- `wizardSeed.ts` has fallback `summary.genre ?? "essay"` which is stale and invalid against current taxonomy.
- `Step1Seed.tsx` currently has only 4 tone options; earlier user wanted 8 tone patterns. If adding 8 requires touching core ConceptTone types/schema, include those paths ONLY if necessary and claim them before modifying.

CURRENT FINAL GENRE TAXONOMY
- investment-strategy-memo → 투자·전략 메모
- investment-report → 투자보고서
- legal-accounting-review → 법률·회계·계약 검토
- column-essay → 칼럼/에세이
- lecture-presentation → 강의·발표안
- long-form-manuscript → 장문 원고

CURRENT/REQUESTED TONE TAXONOMY TARGET
Implement or at minimum enforce prompt behavior for these 8 tones. If type changes are required, update core + tests too:
- decision-memo → 간결한 의사결정체
- analytical-report → 분석적 보고체
- investment-committee → 투자위원회 보고체
- legal-accounting-review → 법률·회계 검토체
- column-narrative → 칼럼형 서술체
- long-form-reasoning → 장문 원고형 사유체
- lecture-presentation → 강의·발표체
- explanatory → 친절한 설명체

INVESTMENT-REPORT BEHAVIOR REQUIREMENT
For genre investment-report, first AI questions must prioritize business/investment substance, e.g.:
- 투자대상/회사/섹터/거래 맥락
- 투자 thesis or why-now
- 시장/산업 구조 and competitive position
- 실적/재무/valuation/key metrics
- 핵심 리스크/downside/protection
- exit/return scenario
- 투자위원회 의사결정에 필요한 missing information
Avoid essay-style prompts such as personal emotion, memory, first scene, hidden metaphor, reader feeling, childhood, etc. unless genre is column-essay or long-form-manuscript.

ALLOWED_WRITE_PATHS
Primary:
- packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
- packages/obsidian-plugin/src/studio/wizard/concept/Step2Concept.tsx
- packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx
- packages/obsidian-plugin/src/studio/wizard/CLIWizardBridge.ts
- packages/obsidian-plugin/src/studio/wizard/prompts/motive.md
- packages/obsidian-plugin/src/studio/wizard/prompts/audience-message.md
- packages/obsidian-plugin/src/studio/wizard/prompts/tone.md
- packages/obsidian-plugin/src/studio/wizard/prompts/structure-pick.md
- packages/obsidian-plugin/src/studio/wizard/prompts/stage-summary.md
- packages/obsidian-plugin/src/studio/wizard/prompts/final-summary.md
- packages/obsidian-plugin/src/studio/wizard/wizardSeed.ts
- packages/obsidian-plugin/src/studio/wizard/wizardStore.ts
- packages/obsidian-plugin/src/studio/wizard/WizardChat.tsx
- packages/obsidian-plugin/tests/**
- docs/planning/06-tasks.md
Conditional, only if 8-tone type/schema requires it; if used, note explicitly in report:
- packages/core/src/types.ts
- packages/core/src/project/schema.ts
- packages/core/tests/**
- apps/desktop/src/wizard/**

FORBIDDEN_PATHS
- Do not deploy to vault.
- Do not commit/push.
- Do not modify unrelated runtime P0 files unless tests show required.
- Do not reintroduce old taxonomy labels or paths.

TDD REQUIREMENTS
Before implementation, add failing tests/source-contract tests that prove current bug:
1. Concept wizard prompt builder or Step2 first AI request includes genre label/key and tone label/key.
2. For investment-report, generated prompt/instructions contain investment-report concepts: thesis, market/industry, valuation or financial metrics, risk/downside, exit/return, IC decision.
3. For investment-report prompt/instructions, essay-like tokens are absent: 감정의 축, 어린 시절, 첫 장면, 숨은 은유, 수필, 세계관/웹소설, 유튜브 대본, 실용서.
4. CLIWizardBridge prompt rendering includes `structured_handoff`, `draft_genre`, and a genre policy derived from current GENRE_LABEL_KO/current taxonomy for BOTH askNextQuestion and legacy askNext/buildMotivePrompt path.
5. Planning prompt markdown files contain current 6 genre keys/labels and do not contain old genre keys/labels.
6. WizardChat choice submit test: choosing a non-last option and clicking 답변 calls sendUserMessage with that option; choosing last/direct input requires otherDraft and sends `직접 입력: ...`; after send, UI should not remain inert.
7. wizardSeed fallback is current taxonomy (investment-strategy-memo), not essay.

IMPLEMENTATION GUIDANCE
- Prefer explicit prompt-contract helpers over ad-hoc string concatenation.
- Good target: create/export helper(s) near conceptPrompts or CLIWizardBridge such as:
  - `buildGenreToneContext({ genre, tone })`
  - `buildConceptSystemPrompt(session)` or `buildConceptFirstUserMessage(session)`
  - `buildWizardGenrePolicy(session)`
  These should be testable without rendering React.
- For Concept Wizard Step2, pass a system prompt that includes selected `session.genre`, Korean genre label, `session.tone`, tone label, and genre-specific interviewing rules.
- For planning interview, update markdown prompt files to current taxonomy and investment-report-specific choices. The motive/audience/tone/structure stages must ask business-document questions when draft_genre is investment-report.
- For click issue, inspect whether currentQuestion gets nulled, parse fallback changes format to open, or ChoiceInput is not submitting. Fix the actual cause and add tests.
- Keep questions concise but domain-specific.

ACCEPTANCE_CRITERIA
- User selecting 투자보고서 should see investment-report-oriented first concept/planning questions, not essay prompts.
- Old taxonomy tokens absent from active wizard prompts/source except tests asserting absence.
- Choice UI can progress via mouse click.
- Tests pass and build passes.
- No deploy/commit/push.

REQUIRED_EVIDENCE
- RED tests that failed before implementation (include command/output summary).
- GREEN test commands and counts.
- Build/typecheck commands.
- Brief root cause summary with file/line references.
- List of changed files.

EXPECTED_MARKER
BUILD_DONE

REPORT_FORMAT
Korean concise report:
1. Root cause
2. What changed
3. Tests/build evidence
4. Remaining risk
5. No deploy/commit/push confirmation
End with BUILD_DONE on its own line.
