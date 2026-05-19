# READ-ONLY VERIFY TASK — W3 Handoff JSON import

TASK_ID: w3-handoff-json-opus-verify-20260519
ROLE: review-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/review-specialist.md
AGENT_PERSONA_SUMMARY:
- Read-only verifier for TypeScript Obsidian plugin bridge changes.
- Check implementation against W3 acceptance criteria and changed-path boundaries.
- Do not edit files.

READ_ONLY: true
DO_NOT_EDIT_FILES: true
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

Objective:
Independently verify W3 `_index/writing-handoff.json` import implementation currently in the worktree.

Required checks:
1. Read `docs/planning/06-tasks.md` W3 section and `.cmux-harness/tasks/w3-handoff-json-import-20260519.md`.
2. Inspect diffs for:
   - `packages/obsidian-plugin/src/main.ts`
   - `packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts`
   - `packages/obsidian-plugin/src/structureBridge/types.ts`
   - `packages/obsidian-plugin/tests/structureBridge.test.ts`
   - `packages/obsidian-plugin/tests/mainStructureBridgeCommand.test.ts`
   - `docs/planning/06-tasks.md`
3. Confirm behavior:
   - command `import-writing-handoff-json` is registered with Korean name.
   - command reads exactly `_index/writing-handoff.json`.
   - missing/unreadable handoff JSON safe no-op with Korean notice/error.
   - parse/validation rejects absolute or parent traversal paths.
   - project sourceNotes is `[structureNote.path, ...picked[].path]`, de-duped preserving order.
   - customMetadata records bridge mode/version/handoff path.
   - W1 active-structure import behavior remains compatible.
   - forbidden paths untouched, especially `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`, vault `_index/**`, `2.Permanent/**`, `3.Structure/**`, `VAULT_INDEX`, `STRUCTURE_INDEX`, `.obsidian/**`.
4. Run read-only verification commands:
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/structureBridge.test.ts tests/mainStructureBridgeCommand.test.ts`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
   - `node --check packages/obsidian-plugin/main.js`
   - `git diff --check`
5. Report PASS or REQUEST_CHANGES with concise evidence.

Do not modify any file. If you find an issue, report REQUEST_CHANGES and details.

Last line exactly one of:
W3_REVIEW_DONE
REQUEST_CHANGES
