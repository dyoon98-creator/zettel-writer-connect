# TASK_ID: w1-active-structure-note-import-command-20260519

ROLE: test-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/test-specialist.md
AGENT_PERSONA_SUMMARY: TDD-focused TypeScript/Obsidian plugin implementer. Write failing tests first, then minimal implementation, then run targeted and package verification. Use the repo path below directly; do not create a worktree for this narrow harness slice.

OBJECTIVE:
Implement W1 from docs/planning/06-tasks.md: add an Obsidian command in AI 원고실 named “현재 구조노트를 원고 프로젝트로 가져오기” that imports the active 3.Structure markdown note into a schema-valid writing project under 4.Writing/<slug>/.

REPO:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

IMPORTANT OPERATING RULES:
- Use TDD. Add tests first and run them to RED before production implementation.
- Do not commit, push, deploy, or edit the user's vault.
- Do not modify /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect.
- Do not write to 2.Permanent/**, 3.Structure/**, VAULT_INDEX, or STRUCTURE_INDEX.
- The command may read the active 3.Structure note; it must only create a project under the plugin writingFolder, normally 4.Writing.
- Keep the minimal bridge one-shot. No sync/idempotence claims beyond unique slug creation.

INPUTS / REFERENCES:
- W1 spec: docs/planning/06-tasks.md lines around “W1 Active structure note import command”.
- Bridge guidance: obsidian skill reference zettel-structure-writing-bridge.md already reviewed by Main. Key points:
  - writing plugin owns project.json/binder.json/planning.md creation.
  - use ProjectMetaIO.create() and BinderIO.empty()/write(); do not hand-author invalid JSON shapes.
  - project.json.sourceNotes must include the structure note vault-relative path.
  - customMetadata should record bridge version and structure note path.
  - do not touch VAULT_INDEX/STRUCTURE_INDEX.
- Existing project creation helper: packages/obsidian-plugin/src/createProject.ts.
- Existing command registration: packages/obsidian-plugin/src/main.ts.
- Core schemas/factories: packages/core/src/project/ProjectMetaIO.ts, BinderIO.ts, schema.ts.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/types.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/parseStructureNote.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/main.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/structureBridge.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/mainStructureBridgeCommand.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/createProject.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/vaultAdapter.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/ProjectMetaIO.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/BinderIO.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/schema.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/types.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/__mocks__/obsidian.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
- vault runtime files under /Users/dongchanyoon/Library/CloudStorage/**
- 2.Permanent/**
- 3.Structure/**
- _index/VAULT_INDEX.md
- _index/STRUCTURE_INDEX.md
- scripts/deploy-obsidian-plugins.sh or any deploy script
- package manager lockfiles unless a test runner legitimately changes none

IMPLEMENTATION SHAPE:
1. New types.ts:
   - StructureNoteHandoff / ParsedStructureNote or similar.
   - Include structureNote.path/title/id/claim, sourceNotes, targetWritingFolder, project defaults.
2. parseStructureNote.ts:
   - Export parseStructureNote(path: string, markdown: string).
   - Accept only vault-relative markdown paths under 3.Structure/ and throw a friendly Error otherwise.
   - Extract frontmatter fields if present: id, topic, claim, related_notes.
   - Extract title from first H1 or filename fallback.
   - Extract claim from frontmatter claim or the “## 🗂 주장” blockquote fallback.
   - sourceNotes must include the structure path first; include related_notes only if they are usable vault-relative .md paths or leave them as ids only in metadata if path is ambiguous. For W1 acceptance, structure path inclusion is mandatory.
3. createWritingProjectFromHandoff.ts:
   - Export createWritingProjectFromHandoff({ vault, notice, writingFolder, handoff }).
   - Create 4.Writing/<slug>/project.json via ProjectMetaIO.create().
   - Use genre default suitable for representative writing, e.g. "investment-strategy-memo" unless project default says otherwise.
   - Set sourceNotes to include the structure note path.
   - Set coreMessage from claim.
   - Set customMetadata: bridgeVersion="1", bridgeMode="active-structure-note", structureNotePath, structureNoteId if present.
   - Create binder.json with BinderIO.empty() and BinderIO.write().
   - Create planning.md that references the structure note path/title/claim and gives sections for 기획/뼈대/자료/초안 지시. It must not mutate the structure note.
   - Choose a unique slug by checking existing <writingFolder>/<slug>/project.json, like createProject.ts does.
4. main.ts:
   - Register command id like "import-active-structure-note".
   - Name exactly or near-exactly: "현재 구조노트를 원고 프로젝트로 가져오기".
   - It should be visible in command palette. Use callback rather than hiding the command entirely.
   - On run: get active file, parse/read it, create project, refresh indexer, open Studio for the new project if reasonable.
   - If there is no active file or it is not a 3.Structure/*.md file, show safe error/warn notice and do nothing.

TEST REQUIREMENTS:
- First create tests and run targeted tests to demonstrate RED before implementation.
- Add tests for parseStructureNote:
  - rejects non-3.Structure paths with friendly error.
  - extracts title/claim/id from a realistic structure note.
- Add tests for createWritingProjectFromHandoff:
  - writes project.json, binder.json, planning.md under 4.Writing/<slug>/.
  - project.json validates through ProjectMetaIO.read or isProjectMeta and sourceNotes includes "3.Structure/...md".
  - planning.md references the structure note and claim.
  - if slug exists, chooses -2.
- Add a main command source-contract or runtime-light test:
  - main.ts contains command id/name registration.
  - command implementation references parseStructureNote/createWritingProjectFromHandoff and active file safe path handling.
  - Existing tests use source-contract pattern because main.ts imports TSX dependencies; this is acceptable if runtime-light import is too costly.

REQUIRED COMMANDS:
From repo root unless noted:
1. RED targeted test command after writing tests, before implementation. Capture failure summary.
2. GREEN targeted:
   pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/structureBridge.test.ts tests/mainStructureBridgeCommand.test.ts
3. Full package:
   pnpm --filter @ai-manuscript-studio/obsidian-plugin test
4. Build:
   pnpm --filter @ai-manuscript-studio/obsidian-plugin build
5. Syntax:
   node --check packages/obsidian-plugin/main.js
6. Diff check:
   git diff --check -- packages/obsidian-plugin/src/structureBridge packages/obsidian-plugin/src/main.ts packages/obsidian-plugin/tests/structureBridge.test.ts packages/obsidian-plugin/tests/mainStructureBridgeCommand.test.ts docs/planning/06-tasks.md
7. Status:
   git status --short

DOC UPDATE:
- If all acceptance criteria pass, mark W1 as [x] in docs/planning/06-tasks.md and append concise completion evidence with test/build command outcomes.
- Preserve W2/W3/W4 open states.

ACCEPTANCE_CRITERIA:
- Command palette contains the import command name/id.
- Non-3.Structure active file path produces a safe error and no project write.
- 3.Structure active note import creates project.json, binder.json, planning.md in 4.Writing/<slug>/.
- project.json.sourceNotes includes the structure note path.
- No writes to 2.Permanent, 3.Structure, VAULT_INDEX, STRUCTURE_INDEX, 13.zettel-connect, or deploy scripts.
- Targeted tests, full obsidian plugin tests, build, node --check all pass.
- W1 is marked complete in docs/planning/06-tasks.md only after verification.

EXPECTED_MARKER:
- BUILD_DONE on success.
- TEST_FAIL if tests/build fail and cannot be fixed within this slice.

REPORT_FORMAT:
- Korean concise report.
- Include changed files, RED evidence, GREEN/full/build evidence, and any known limitation.
- Last line marker only.
