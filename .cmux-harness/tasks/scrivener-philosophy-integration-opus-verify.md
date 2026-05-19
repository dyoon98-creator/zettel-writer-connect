# TASK_ID: scrivener-philosophy-integration-opus-verify

ROLE: read-only-opus-verifier
MODEL_OR_LANE: Opus-Verify
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Read-only verification of Sonnet-Executor's Scrivener philosophy integration. Do not edit files. Determine whether the implementation satisfies the task packet and whether any hidden regression or scope violation exists.

INPUTS:
- Original task packet: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/tasks/scrivener-philosophy-integration.md
- Worker log: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/logs/Sonnet-Executor-20260518-224830.log
- Changed paths claimed by worker/firewall:
  - docs/planning/scrivener-philosophy-integration.md
  - packages/core/src/project/Templates.ts
  - packages/core/tests/Templates.test.ts
  - packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
  - packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/scrivener-philosophy-integration.md
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/Templates.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/tests/Templates.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/tasks/scrivener-philosophy-integration.md

FORBIDDEN:
- Do not edit any file.
- Do not commit, push, deploy, install, or modify vault runtime folders.
- Do not write to desktop legacy paths.

VERIFY CHECKLIST:
1. Scope: no changes outside allowed write paths for this worker, especially no desktop or zettel-connect edits caused by this task.
2. Design note: accurately maps official Scrivener principles to current code foundations and active Obsidian constraints; distinguishes already-present vs newly-integrated vs deferred.
3. Templates: canonical 7 H2 sections remain unchanged and in order; comments add binder/card/synopsis, research separation, snapshot-before-revision, compile/output separation without renaming sections.
4. Concept prompt: investment/legal/customer-report branch reflects section/binder pieces, card/synopsis, source/draft separation, snapshot habit, and user-as-author principle; it must not regress into fiction/essay coaching and must not treat Word/PPT/Telegram as genre/tone.
5. Tests: confirm tests assert the new contracts rather than brittle token-only checks where possible.
6. Run read-only verification commands, preferably with cache creation minimized if possible:
   - git diff --name-only
   - git diff -- packages/core/src/project/Templates.ts packages/core/tests/Templates.test.ts packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts docs/planning/scrivener-philosophy-integration.md
   - pnpm --filter @ai-manuscript-studio/core test -- Templates
   - pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand tests/studio/wizard/conceptPrompts.test.ts tests/studio/wizard/planningPrompts.contract.test.ts
   - git status --short -- docs/planning packages/core/src/project/Templates.ts packages/core/tests/Templates.test.ts packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts packages/obsidian-plugin/tests/studio/wizard/conceptPrompts.test.ts apps/desktop packages/zettel-connect

REPORT_FORMAT:
- Verdict: PASS or REQUEST_CHANGES
- Evidence: cite file paths and line numbers or exact command outputs
- Scope review: any forbidden changes? yes/no
- Contract review: checklist results
- Test results: command + exit code + pass/fail summary
- Risks/deferred items
- Final marker on its own line: REVIEW_DONE
