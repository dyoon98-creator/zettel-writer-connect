# READ-ONLY VERIFY TASK — W3/W3A final gate

TASK_ID: w3a-w3b-opus-verify-20260520
ROLE: review-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/review-specialist.md
AGENT_PERSONA_SUMMARY:
- Read-only verifier for TypeScript/Jest and planning-ledger evidence.
- Check final W3/W3A state after path rejection regression tests and evidence count sync.
- Do not edit files.

READ_ONLY: true
DO_NOT_EDIT_FILES: true
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

Objective:
Verify final W3/W3A changes before commit/push.

Check:
1. `packages/obsidian-plugin/tests/structureBridge.test.ts` includes explicit tests that `parseWritingHandoffJson` rejects:
   - absolute `structureNote.path`
   - parent traversal in `picked[].path`
   - parent traversal in `targetWritingFolder`
2. Production source for W3 remains coherent and W1-compatible.
3. `docs/planning/06-tasks.md` W3 evidence says targeted 29/29 and full obsidian-plugin 268/268.
4. Forbidden paths untouched.
5. Run:
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/structureBridge.test.ts tests/mainStructureBridgeCommand.test.ts`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
   - `node --check packages/obsidian-plugin/main.js`
   - `git diff --check`

Do not modify files.
Report PASS or REQUEST_CHANGES.
Last line exactly one of:
W3_FINAL_REVIEW_DONE
REQUEST_CHANGES
