# TASK_ID: verify-customer-report-tone-click-prompt-fix

ROLE: frontend-specialist
MODEL_OR_LANE: Opus-Verify
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

READ_ONLY: true
DO_NOT_MODIFY_FILES: true
DO_NOT_COMMIT_PUSH_DEPLOY: true

OBJECTIVE:
Read-only verify Sonnet-Executor's `customer-report-tone-click-prompt-fix` changes.

USER REQUIREMENTS TO VERIFY:
1. “투자위원회 보고체” must be replaced by “고객 보고체” because the representative reports to clients/customers, not an investment committee. Delivery channel (Word/PPT/Telegram) must not become a tone/genre.
2. In New Manuscript Wizard > 기획 인터뷰, clicking a normal multiple-choice row should actually proceed/answer. Direct input/Other should still open a textbox and require typed input.
3. Genre/tone/prompt guidance must match representative investment/legal/customer-report writing quality and `/structure` principles: claim/thesis, evidence/source, counterpoint/downside, invalidation trigger, action/next step, client caveat. Creative-only writing prompts must not leak into investment-report / investment-strategy-memo / legal-accounting-review paths.

FILES TO REVIEW:
- packages/core/src/project/schema.ts
- packages/core/tests/schema.test.ts
- packages/obsidian-plugin/src/studio/wizard/WizardChat.tsx
- packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx
- packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
- packages/obsidian-plugin/src/studio/state/conceptWizardStore.ts
- packages/obsidian-plugin/src/studio/wizard/prompts/tone.md
- packages/obsidian-plugin/src/studio/wizard/prompts/audience-message.md
- packages/obsidian-plugin/tests/studio/wizard/WizardChat.contract.test.ts
- packages/obsidian-plugin/tests/studio/wizard/Step1Seed.contract.test.ts
- packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts
- packages/obsidian-plugin/tests/studio/wizard/planningPrompts.contract.test.ts
- apps/desktop/src/wizard/concept/Step1Seed.tsx only to judge whether the mirror change is necessary/contained
- docs/planning/06-tasks.md only to check no harmful stale active guidance

SPECIFIC CHECKS:
A. Confirm active UI/prompt code uses `customer-report` and “고객 보고체”.
B. Confirm `investment-committee` survives only in safe migration/invalid-token tests/historical notes, not active UI or prompt logic.
C. Confirm `WizardChat` click behavior is not merely visual: a normal option click should invoke send path without requiring the separate submit button; Other/direct input remains two-step.
D. Confirm tests are meaningful enough to catch regression, not just weak token checks where a behavior test is feasible.
E. Confirm prompt content is structurally suitable for customer-facing investment/legal reports and does not mix delivery channel as genre/tone.
F. Confirm no unauthorized side effects: no deploy/commit/push, no vault runtime install edits.

RUN THESE READ-ONLY COMMANDS AND REPORT EXIT CODES:
- git diff --check
- pnpm --filter @ai-manuscript-studio/core test
- pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runInBand
- pnpm --filter @ai-manuscript-studio/core build
- pnpm --filter @ai-manuscript-studio/obsidian-plugin build
- Token scan: active source/prompts excluding tests/migration/docs history for `투자위원회 보고체`, `투자위원회(IC)`, `investment-committee`.

REPORT_FORMAT:
1. PASS or REQUEST_CHANGES
2. Evidence by requirement A-F with file/line references where possible
3. Commands run + exit codes + pass/fail counts
4. Any gaps or risks
5. Marker line: REVIEW_DONE or REQUEST_CHANGES
