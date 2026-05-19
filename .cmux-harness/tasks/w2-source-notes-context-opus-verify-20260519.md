# READ-ONLY VERIFY — W2 sourceNotes context consumption fix

TASK_ID: w2-source-notes-context-opus-verify-20260519
ROLE: backend-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/backend-specialist.md
AGENT_PERSONA_SUMMARY:
- Read-only independent verifier for TypeScript core/plugin data-flow changes.
- Check concrete diff, tests, and acceptance criteria.
- Do not modify files.

OBJECTIVE:
Independently verify W2 changes in `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect`.

READ_ONLY_PATHS:
- `docs/planning/06-tasks.md`
- `packages/core/src/ai/ContextComposer.ts`
- `packages/core/tests/ContextComposer.test.ts`
- `packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts`
- `packages/obsidian-plugin/src/studio/ai/streamingChat.ts`
- `packages/obsidian-plugin/tests/studio/selectionPrompts.test.ts`
- `packages/obsidian-plugin/tests/studio/streamingChat.test.ts`
- `packages/obsidian-plugin/src/studio/inspector/ActionPanel.tsx` (confirm not changed)
- `packages/obsidian-plugin/src/studio/editor/SelectionPopover.tsx` (confirm not changed)

FORBIDDEN:
- Do not edit any file.
- Do not write to the user's Obsidian vault, runtime plugin folders, or `13.zettel-connect`.
- Do not commit/push.

ACCEPTANCE CHECKS:
1. `ContextComposer` consumes sibling `project.json.sourceNotes` for a scene markdown path and treats it as canonical over legacy scene frontmatter `source_notes`.
2. Legacy `source_notes` fallback remains covered.
3. Source note entries support both wikilinks/bare names via resolver and vault-relative `.md` paths directly.
4. `buildSelectionPrompt` default 2-arg behavior remains unchanged, and optional `sourceNotesContext` inserts context before selected text.
5. `streamingChat.buildChatPrompt` notesContext is serialized inside the system block.
6. W2 row in `docs/planning/06-tasks.md` is `[x]` and evidence is not contradictory.
7. No edits to forbidden files/runtimes/vault.

RUN OR INSPECT:
- `git diff -- docs/planning/06-tasks.md packages/core/src/ai/ContextComposer.ts packages/core/tests/ContextComposer.test.ts packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts packages/obsidian-plugin/src/studio/ai/streamingChat.ts packages/obsidian-plugin/tests/studio/selectionPrompts.test.ts packages/obsidian-plugin/tests/studio/streamingChat.test.ts`
- `pnpm --filter @ai-manuscript-studio/core test -- --runTestsByPath tests/ContextComposer.test.ts`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/studio/selectionPrompts.test.ts tests/studio/streamingChat.test.ts`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
- `node --check packages/obsidian-plugin/main.js`
- `git diff --check`
- `git status --short -- packages/obsidian-plugin/src/studio/inspector/ActionPanel.tsx packages/obsidian-plugin/src/studio/editor/SelectionPopover.tsx /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect`

REPORT_FORMAT:
- Verdict: PASS or REQUEST_CHANGES.
- Evidence: cite changed files and test/build outputs.
- Risks/notes.
- Last line exactly: W2_REVIEW_DONE
