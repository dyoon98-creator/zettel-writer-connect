# TASK_ID: w1-active-structure-note-import-opus-verify-20260519

ROLE: read-only-verifier
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/test-specialist.md
AGENT_PERSONA_SUMMARY: Read-only verifier for TypeScript/Obsidian plugin changes. Inspect diff, tests, and acceptance criteria. Do not modify files.

OBJECTIVE:
Read-only verify W1 “Active structure note import command” implementation in /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect.

READ_ONLY_SCOPE:
- Review current git diff and untracked W1 files.
- Inspect:
  - docs/planning/06-tasks.md W1 section
  - packages/obsidian-plugin/src/main.ts
  - packages/obsidian-plugin/src/structureBridge/types.ts
  - packages/obsidian-plugin/src/structureBridge/parseStructureNote.ts
  - packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts
  - packages/obsidian-plugin/tests/structureBridge.test.ts
  - packages/obsidian-plugin/tests/mainStructureBridgeCommand.test.ts
- Run read-only tests if needed; avoid creating/modifying files beyond unavoidable test caches. Prefer existing commands.

FORBIDDEN:
- Do not edit any file.
- Do not commit/push/deploy.
- Do not touch vault runtime files or 13.zettel-connect.

ACCEPTANCE_CRITERIA_TO_VERIFY:
1. Command palette registration exists for id/name: import-active-structure-note / “현재 구조노트를 원고 프로젝트로 가져오기”.
2. Non-3.Structure active file path gives safe warn/error and does not create project.
3. 3.Structure note import reads only the active structure note and creates 4.Writing/<slug>/project.json, binder.json, planning.md through schema factories.
4. project.json.sourceNotes includes the structure note vault-relative path.
5. No implementation writes to 2.Permanent/**, 3.Structure/**, VAULT_INDEX, STRUCTURE_INDEX, 13.zettel-connect, or deploy scripts.
6. Tests cover parser, create project, sourceNotes, slug collision, and command source registration.
7. Main fresh verification already ran:
   - targeted W1 tests: 2 suites, 20 tests passed
   - core tests: 23 suites passed, 286 tests passed, 32 skipped
   - full obsidian-plugin tests: 26 suites, 256 tests passed
   - obsidian-plugin build exit 0
   - node --check packages/obsidian-plugin/main.js exit 0
   - scoped git diff --check exit 0
8. docs/planning/06-tasks.md marks W1 [x] and preserves W2/W3/W4 open.

REQUIRED_OUTPUT:
- Verdict: PASS or REQUEST_CHANGES.
- Evidence bullets with file/function/test references.
- If REQUEST_CHANGES, list exact blocker and suggested file.
- Last line must be REVIEW_DONE.
