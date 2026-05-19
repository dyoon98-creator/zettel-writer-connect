# TASK_ID: genre-tone-ai-contract-fix-addendum-2

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY: Minimal targeted cleanup before deploy based on Opus-Verify: remove stale conceptSeed fallback and validate/migrate ConceptDraftSession genre taxonomy. No deploy/commit/push.
MODEL_OR_LANE: Sonnet-Executor

OBJECTIVE
Opus-Verify passed the main genre/tone contract fix but found two pre-deploy cleanup risks:
1. `packages/obsidian-plugin/src/studio/wizard/concept/conceptSeed.ts` still has stale fallback `?? "essay"` around line ~177 in the connected concept-draft seed path. Replace with current default `investment-strategy-memo` and add/adjust source-contract test.
2. `packages/core/src/project/schema.ts` `isConceptDraftSession()` validates ConceptTone strictly but still only checks `typeof v.genre === "string"`. This allows old persisted concept sessions with genre `essay/practical/youtube/lecture/world` to pass and resume into generic/non-investment behavior. Validate genre against the current 6-genre taxonomy. If migration is already elsewhere, do not duplicate; otherwise make runtime validator strict and add tests that all 6 valid genres pass and old 5 genre keys fail.

ALLOWED_WRITE_PATHS
- packages/obsidian-plugin/src/studio/wizard/concept/conceptSeed.ts
- packages/obsidian-plugin/tests/studio/wizard/planningPrompts.contract.test.ts
- packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts
- packages/core/src/project/schema.ts
- packages/core/tests/schema.test.ts
- docs/planning/06-tasks.md

FORBIDDEN
- No deploy/commit/push.
- Do not broaden to arbitrary string.
- Do not reintroduce old genre keys except in tests asserting rejection/absence.
- Keep change minimal.

ACCEPTANCE_CRITERIA
1. No active production source in `packages/obsidian-plugin/src/studio/wizard/concept` contains `?? "essay"`.
2. `isConceptDraftSession()` accepts only current 6 Genre values:
   - investment-strategy-memo
   - investment-report
   - legal-accounting-review
   - column-essay
   - lecture-presentation
   - long-form-manuscript
3. `isConceptDraftSession()` rejects old genre values:
   - essay, practical, youtube, lecture, world
4. Targeted core schema tests pass.
5. Plugin wizard tests pass.
6. Typecheck remains clean.

REQUIRED_EVIDENCE
- Changed files list.
- Exact commands/results.
- Confirm no deploy/commit/push.

EXPECTED_MARKER
BUILD_DONE

REPORT_FORMAT
Korean concise report, end with BUILD_DONE on its own line.
