# TASK PACKET — W3A handoff path rejection regression test

TASK_ID: w3a-handoff-path-rejection-test-20260520
ROLE: test-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/test-specialist.md
AGENT_PERSONA_SUMMARY:
- Test specialist for TypeScript/Jest regression coverage.
- Add the narrowest failing/passing regression tests for an already-implemented behavior.
- Preserve existing implementation unless the new test exposes a real defect.

OBJECTIVE:
Opus-Verify passed W3 but recommended explicit regression coverage for absolute path and parent traversal rejection in `parseWritingHandoffJson`. Add that coverage and update W3 evidence counts if needed.

CURRENT STATE:
- W3 implementation is already in the worktree and verified by Main + Opus.
- Do not restart or rewrite W3.
- Add only the recommended regression test coverage and minimal planning evidence count updates.

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/structureBridge.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md`

READ_ONLY_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/main.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/tasks/w3-handoff-json-import-20260519.md`

FORBIDDEN_PATHS:
- Any production source file.
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`
- User vault files, `_index/**`, `2.Permanent/**`, `3.Structure/**`, `VAULT_INDEX`, `STRUCTURE_INDEX`, `.obsidian/**`.

REQUIRED BEHAVIOR:
1. Add explicit Jest coverage that `parseWritingHandoffJson` rejects:
   - absolute paths, e.g. `structureNote.path: "/abs.md"`.
   - parent traversal paths, e.g. `picked: [{ path: "../x.md" }]` or `targetWritingFolder: "../Writing"`.
2. Keep the tests narrow and readable.
3. If test count changes, update the W3 completion evidence in `docs/planning/06-tasks.md` from `26/26` to the actual new targeted count after running the targeted suite.
4. Do not edit production source unless the new test fails because behavior is genuinely broken; if production change is needed, stop and report `REQUEST_CHANGES`.

VERIFICATION REQUIRED:
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/structureBridge.test.ts tests/mainStructureBridgeCommand.test.ts`
- `git diff --check`

REPORT_FORMAT:
- Changed files.
- New test assertions.
- Verification evidence with counts.
- Confirm production source untouched.
- Last line exactly: W3A_TEST_DONE

EXPECTED_MARKER:
W3A_TEST_DONE
