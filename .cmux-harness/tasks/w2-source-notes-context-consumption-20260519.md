# TASK PACKET — W2 sourceNotes context consumption fix

TASK_ID: w2-source-notes-context-consumption-20260519
ROLE: backend-specialist
MODEL_OR_LANE: GPT-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/backend-specialist.md
AGENT_PERSONA_SUMMARY:
- Backend/data-flow specialist for TypeScript core/plugin integration.
- Preserve schema compatibility and write narrow, behavior-first tests.
- Work only in this repository root; no external/vault writes.

OBJECTIVE:
Fix W2 in `docs/planning/06-tasks.md`: `project.json.sourceNotes` (camelCase, v2 schema) must actually be consumed by AI context composition, while preserving legacy markdown frontmatter `source_notes` fallback. Also make selection-area prompt building able to include current project/source-note context optionally.

CONTEXT / CURRENT BUG:
- W1 creates `4.Writing/<slug>/project.json` with camelCase `sourceNotes`, and scene/planning markdown files live in the same project folder.
- `packages/core/src/ai/ContextComposer.ts` currently reads only markdown frontmatter `source_notes` from `input.projectPath`; if `input.projectPath` is a scene file, it does not read sibling `project.json` and therefore ignores W1 `project.json.sourceNotes`.
- `ActionPanel.tsx` passes a scene markdown path to `ContextComposer.compose`, so fixing `ContextComposer` to detect/read sibling `project.json` is the preferred narrow solution. Do not edit ActionPanel unless you can prove it is strictly necessary and then report REQUEST_CHANGES before doing so.
- `selectionPrompts.ts` currently builds prompts only from selected text. Add an optional source/context parameter so selection actions can include current project source note context when a caller has it. Do not change default behavior when the option is omitted.
- `streamingChat.ts` already supports `notesContext`; preserve it and add/adjust tests if needed so source context is serialized predictably.

INPUTS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md` W2 section.
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/ai/ContextComposer.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/tests/ContextComposer.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/ai/streamingChat.ts`

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/ai/ContextComposer.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/ai/index.ts` (only if new exported helper/type is needed)
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/browser.ts` (only if new exported helper/type is needed)
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/tests/ContextComposer.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/ai/streamingChat.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/studio/selectionPrompts.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/studio/streamingChat.test.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md` (mark W2 complete only after tests/build pass)

READ_ONLY_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/inspector/ActionPanel.tsx`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/editor/SelectionPopover.tsx`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/schema.ts`
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/project/ProjectMetaIO.ts`

FORBIDDEN_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`
- User Obsidian vault files; do not write to vault.
- `.obsidian/**`, runtime plugin install folders, deploy scripts.
- Any file outside ALLOWED_WRITE_PATHS unless you stop and report REQUEST_CHANGES.

DEPENDENCIES:
- W1 completed and stores structure-note path in `project.json.sourceNotes`.
- Existing legacy frontmatter `source_notes` behavior must keep passing.

ACCEPTANCE_CRITERIA:
1. TDD RED first: add/adjust tests that fail before implementation.
2. `ContextComposer.compose({ projectPath: "4.Writing/p/scene.md", ... })` reads sibling `4.Writing/p/project.json` when present and uses camelCase `sourceNotes` to build `{{source_notes}}`/notes context.
3. Legacy markdown frontmatter `source_notes` fallback still works.
4. If both sibling `project.json.sourceNotes` and markdown frontmatter `source_notes` exist, use `project.json.sourceNotes` as canonical v2 source. Preserve predictable behavior and document in test names.
5. Source notes may be wiki links (`[[A]]`) or vault-relative md paths (`2.Permanent/A.md`, `3.Structure/S.md`). Resolver should support both without inventing paths.
6. W2 example: sourceNotes `["[[A]]", "[[B]]"]` resolves and the composed prompt includes A and B note bodies in `source_notes`/notes context.
7. Selection prompt builder can optionally include source-note/current-project context while default output remains unchanged when omitted.
8. `streamingChat.buildChatPrompt` keeps `notesContext` in the system block; add/keep regression coverage if absent.
9. No vault writes, no 13.zettel-connect edits, no deploy.
10. Mark W2 `[x]` in `docs/planning/06-tasks.md` only after verification passes, with concise evidence.

REQUIRED_EVIDENCE:
- Show RED failure command/output summary before implementation.
- Show GREEN targeted tests:
  - `pnpm --filter @ai-manuscript-studio/core test -- --runTestsByPath tests/ContextComposer.test.ts`
  - relevant obsidian-plugin targeted tests for `selectionPrompts`/`streamingChat` if created/changed.
- Show broader verification:
  - `pnpm --filter @ai-manuscript-studio/core test`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
  - `node --check packages/obsidian-plugin/main.js`
  - `git diff --check`
- End with changed file list and exact marker.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
- Summary of root cause and implementation.
- RED evidence.
- GREEN/broader verification evidence with exit codes and test counts if available.
- Changed files.
- Any deviations/risks.
- Last line exactly: BUILD_DONE
