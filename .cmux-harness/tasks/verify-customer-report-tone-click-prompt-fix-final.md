# TASK_ID: verify-customer-report-tone-click-prompt-fix-final

ROLE: frontend-specialist
MODEL_OR_LANE: Opus-Verify
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
READ_ONLY: true
DO_NOT_MODIFY_FILES: true

OBJECTIVE:
Final read-only verification after addendum tests.

CHECK:
1. Customer report tone remains correct: active code uses `customer-report` / “고객 보고체”; old “투자위원회 보고체” and “투자위원회(IC)” are absent from active UI/prompt paths except negative tests/docs history/migration.
2. WizardChat click behavior is implemented in production and covered by `WizardChat.behavior.test.ts` without misleading assertions.
3. Commands pass:
   - git diff --check
   - pnpm --filter @ai-manuscript-studio/core test
   - pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand
   - pnpm --filter @ai-manuscript-studio/core build
   - pnpm --filter @ai-manuscript-studio/obsidian-plugin build
4. No commit/push/deploy/vault install.

REPORT:
PASS or REQUEST_CHANGES, evidence, command exits/counts, marker REVIEW_DONE or REQUEST_CHANGES.
