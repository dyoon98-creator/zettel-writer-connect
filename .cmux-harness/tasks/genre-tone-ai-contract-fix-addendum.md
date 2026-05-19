# TASK_ID: genre-tone-ai-contract-fix-addendum

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY: Fix the remaining runtime schema validation hole after genre/tone contract patch. Minimal targeted patch + tests. No deploy/commit/push.
MODEL_OR_LANE: Sonnet-Executor

OBJECTIVE
Main verification found one blocker after your BUILD_DONE:
- `packages/core/src/project/schema.ts` expanded `ConceptTone` type to 8 values, but `isConceptDraftSession()` still validates only 4 values (`decision-memo`, `analytical-report`, `explanatory`, `column-narrative`).
- This will reject sessions using the new tones (`investment-committee`, `legal-accounting-review`, `long-form-reasoning`, `lecture-presentation`) when persisted/reloaded.

Fix this structurally and add/adjust tests so all 8 ConceptTone values pass runtime validation and old values fail.

ALLOWED_WRITE_PATHS
- packages/core/src/project/schema.ts
- packages/core/tests/schema.test.ts
- packages/core/tests/types.test.ts
- packages/obsidian-plugin/tests/studio/wizard/Step1Seed.contract.test.ts
- packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts
- docs/planning/06-tasks.md

FORBIDDEN_PATHS
- No deploy to vault.
- No commit/push.
- Do not broaden validation to arbitrary strings.
- Do not reintroduce old tone values novel/essay/nonfiction/screenplay.

ACCEPTANCE_CRITERIA
1. `isConceptDraftSession()` accepts all 8 current ConceptTone values.
2. It rejects old values: `novel`, `essay`, `nonfiction`, `screenplay`.
3. Targeted core tests pass.
4. Obsidian plugin wizard tests pass with the correct command from package dir, e.g. `cd packages/obsidian-plugin && pnpm test --testPathPattern="wizard/"` (not `pnpm --filter ... test -- --testPathPattern`, which passes the pattern incorrectly).
5. Typecheck remains clean.

REQUIRED_EVIDENCE
- Changed files list.
- Exact test/typecheck commands and results.
- Confirm no deploy/commit/push.

EXPECTED_MARKER
BUILD_DONE

REPORT_FORMAT
Korean concise report, end with BUILD_DONE on its own line.
