# TASK PACKET — W3 Handoff JSON import

TASK_ID: w3-handoff-json-import-20260519
ROLE: backend-specialist
MODEL_OR_LANE: GPT-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/backend-specialist.md
AGENT_PERSONA_SUMMARY:
- Backend/data-flow specialist for TypeScript Obsidian plugin bridge work.
- Preserve Zettelkasten/writing-plugin boundary; write narrow TDD tests first.
- No vault/runtime/deploy writes; source repo only.

OBJECTIVE:
Implement W3 from `docs/planning/06-tasks.md`: add support for importing `_index/writing-handoff.json` into an AI Manuscript Studio project.

CURRENT STATE:
- W1 command imports active `3.Structure/*.md` note into `4.Writing/<slug>/` via `parseStructureNote` + `createWritingProjectFromHandoff`.
- W2 makes `project.json.sourceNotes` consumed by AI context.
- W3 must import a handoff JSON contract, not edit `13.zettel-connect`.

EXPECTED HANDOFF JSON SHAPE:
Use the bridge contract from `obsidian/references/zettel-structure-writing-bridge.md`. Support at least:
```json
{
  "version": 1,
  "mode": "new-structure-to-writing",
  "structureNote": { "path": "3.Structure/example.md", "title": "Example", "id": "S-1", "claim": "..." },
  "picked": [
    { "path": "2.Permanent/A.md", "id": "A", "claim": "..." },
    { "path": "2.Permanent/B.md", "id": "B", "claim": "..." }
  ],
  "project": { "title": "Project Title", "genre": "essay", "wordGoal": 3000, "status": "planning" },
  "targetWritingFolder": "4.Writing"
}
```
Be tolerant of missing optional fields. Do not store absolute paths.

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/types.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/main.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/structureBridge.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/mainStructureBridgeCommand.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md`

READ_ONLY_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/parseStructureNote.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/schema.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/ProjectMetaIO.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/BinderIO.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md` W3 section

FORBIDDEN_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`
- User Obsidian vault files, `_index/**`, `2.Permanent/**`, `3.Structure/**`, `VAULT_INDEX`, `STRUCTURE_INDEX`
- Runtime plugin install folders, `.obsidian/**`, deploy scripts
- Any file outside allowed paths unless you stop and report REQUEST_CHANGES

DEPENDENCIES:
- W1 and W2 already completed.
- Keep existing active-structure import behavior and tests passing.

REQUIRED BEHAVIOR:
1. Add a command in `main.ts` such as `import-writing-handoff-json` with a Korean name like `원고실 handoff JSON 가져오기`.
2. The command reads exactly the vault-relative path `_index/writing-handoff.json` using the plugin vault adapter.
3. If the file is missing/unreadable, show a safe Korean error/warn message and return without creating a project.
4. Parse/validate the handoff JSON into the internal handoff/project creation path.
5. Create only a schema-valid writing project under target writing folder (`handoff.targetWritingFolder` if valid string, else settings/default `4.Writing`).
6. `project.json.sourceNotes` must include the structure note path plus every picked permanent note path from `picked[].path`, de-duplicated and preserving order.
7. `project.json.customMetadata` should record bridge mode/version and the handoff path `_index/writing-handoff.json`.
8. Do not write to `_index`, `2.Permanent`, `3.Structure`, `13.zettel-connect`, `VAULT_INDEX`, or runtime plugin folders.
9. Existing W1 active structure-note command behavior must remain intact.

TDD REQUIREMENTS:
- RED first. Add tests that fail before implementation:
  - unit test for importing/parsing handoff JSON into `sourceNotes` = structure + picked paths.
  - unit test for missing/unusable handoff JSON safe error/no project behavior if feasible in source-contract/unit style.
  - source-contract test that `main.ts` registers the W3 command and reads `_index/writing-handoff.json`.
- Then implement minimal code.

IMPLEMENTATION HINTS:
- Prefer extending `StructureNoteHandoff` with optional fields such as `sourceNotes`, `bridgeMode`, `handoffPath`, `project` metadata rather than creating incompatible project JSON manually.
- Prefer adding a pure helper in `createWritingProjectFromHandoff.ts`, e.g. `parseWritingHandoffJson(raw, handoffPath)` or `createWritingProjectFromHandoffJson(...)`, if it keeps tests clean.
- `createWritingProjectFromHandoff` can compute sourceNotes from `[handoff.structureNotePath, ...(handoff.sourceNotes ?? [])]` with de-duplication.
- Main command can read `_index/writing-handoff.json`, parse via helper, then call `createWritingProjectFromHandoff`.
- Do not overbuild per-id `_index/writing-handoff/<id>.json` unless the existing W3 section explicitly requires it; W3 currently asks singleton `_index/writing-handoff.json`.

ACCEPTANCE_CRITERIA:
- `_index/writing-handoff.json` present and valid → project created successfully.
- Missing handoff JSON → safe Korean error/warn; no project created.
- Created `project.json.sourceNotes` = `[structureNote.path, ...picked[].path]`, deduped.
- Existing W1 tests still pass.
- `pnpm test` and build pass.
- W3 row in `docs/planning/06-tasks.md` marked `[x]` only after verification with concise evidence.

REQUIRED_EVIDENCE:
- RED failure evidence.
- GREEN targeted:
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/structureBridge.test.ts tests/mainStructureBridgeCommand.test.ts`
- Broader:
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
  - `node --check packages/obsidian-plugin/main.js`
  - `git diff --check`
- Changed files list and forbidden paths unchanged.

EXPECTED_MARKER:
W3_BUILD_DONE

REPORT_FORMAT:
- Root cause / gap.
- RED evidence.
- Implementation summary.
- Verification evidence with exit codes/test counts.
- Changed files.
- Forbidden paths untouched confirmation.
- Last line exactly: W3_BUILD_DONE
