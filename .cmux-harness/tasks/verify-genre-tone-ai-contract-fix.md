# TASK_ID: verify-genre-tone-ai-contract-fix

ROLE: architecture-analyst
MODEL_OR_LANE: Opus-Verify
OBJECTIVE
Read-only independent verification of the genre/tone AI contract fix for AI 원고실 Obsidian plugin.

CONTEXT
User reported:
1. Concept Wizard selected genre investment-report but AI asked essay-like questions.
2. Connected planning interview also asked unrelated questions and clicking did not progress.
Expected behavior: selected genre/tone must control AI behavior.

IMPLEMENTATION SUMMARY TO VERIFY
- `packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts`
  - Adds `buildConceptSystemPrompt(session)`.
  - For investment-oriented genres, asks investment-domain questions: thesis, why-now, market/industry, financial/valuation metrics, risk/downside, exit/return, IC decision.
- `Step2Concept.tsx`
  - Uses `buildConceptSystemPrompt(session)` for callAI and distill, with legacy fallback only if session null.
- `CLIWizardBridge.ts`
  - Adds `structured_handoff` to legacy `askNext` render values.
- `prompts/motive.md` and `prompts/structure-pick.md`
  - Current six genre taxonomy instead of old essay/practical/youtube/lecture/world taxonomy.
- `wizardSeed.ts`
  - fallback genre now `investment-strategy-memo`, not `essay`.
- `packages/core/src/project/schema.ts`
  - `ConceptTone` 8 values and `isConceptDraftSession()` validates all 8, rejects old tone values.
- `Step1Seed.tsx` plugin + desktop mirror
  - 8 tone options.
- Tests added under `packages/obsidian-plugin/tests/studio/wizard/` and `packages/core/tests/schema.test.ts`.

MAIN VERIFICATION ALREADY RUN
- `cd packages/core && pnpm test` → 269 passed, 32 skipped, exit 0
- `cd packages/obsidian-plugin && pnpm test --testPathPattern="wizard/"` → 57 passed, exit 0
- `cd packages/core && pnpm exec tsc --noEmit && cd ../obsidian-plugin && pnpm exec tsc --noEmit` → exit 0
- `cd packages/obsidian-plugin && pnpm test` → 182 passed, exit 0
- `cd packages/obsidian-plugin && pnpm build` → exit 0
- `git diff --check` → exit 0
- Targeted scan: old genre keys practical/youtube/world and old Korean labels 실용서/유튜브 대본/세계관/웹소설 absent from active wizard prompt/core schema scan; investment-report prompt concepts present.
- Main write firewall `check pre-completion` → PASS.

READ_ONLY_PATHS
- packages/obsidian-plugin/src/studio/wizard/**
- packages/obsidian-plugin/tests/studio/wizard/**
- packages/core/src/project/schema.ts
- packages/core/src/types.ts
- packages/core/tests/schema.test.ts
- packages/core/tests/types.test.ts
- apps/desktop/src/wizard/concept/Step1Seed.tsx
- docs/planning/06-tasks.md
- git diff

FORBIDDEN
- Do not modify files.
- Do not deploy, commit, push.
- Avoid creating cache artifacts if possible. If running tests, use read-only commands as much as practical.

VERIFICATION QUESTIONS
1. Does the diff actually wire selected ConceptDraftSession genre/tone into Concept Wizard AI prompt generation?
2. Does investment-report get investment-report-appropriate instructions rather than essay/supil style instructions?
3. Are old active prompt taxonomy keys/labels removed sufficiently from motive/structure prompts?
4. Are all 8 ConceptTone values accepted by runtime validation and old tone values rejected?
5. Are tests meaningful enough to guard this regression?
6. Does the reported click issue have a plausible fix path? If not fully proven, identify remaining risk precisely.
7. Any deploy blockers?

REQUIRED_EVIDENCE
- Cite concrete files/lines or grep snippets.
- State commands run and exit codes if any.
- Report PASS / REQUEST_CHANGES.

EXPECTED_MARKER
REVIEW_DONE
