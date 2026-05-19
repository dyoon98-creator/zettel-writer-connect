# CONTINUATION — W2 sourceNotes context consumption fix

TASK_ID: w2-source-notes-context-consumption-20260519
ROLE: backend-specialist
MODEL_OR_LANE: GPT-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/backend-specialist.md
AGENT_PERSONA_SUMMARY:
- Backend/data-flow specialist for TypeScript core/plugin integration.
- Preserve schema compatibility and write narrow, behavior-first tests.
- Continue from existing W2 RED tests/diff; do not restart unrelated tasks.

CURRENT STATE:
- Original W2 task was read.
- You added RED tests in:
  - `packages/core/tests/ContextComposer.test.ts`
  - `packages/obsidian-plugin/tests/studio/selectionPrompts.test.ts`
  - `packages/obsidian-plugin/tests/studio/streamingChat.test.ts`
- You ran at least one RED command:
  - `pnpm --filter @ai-manuscript-studio/core test -- --runTestsByPath tests/ContextComposer.test.ts` failed, as expected before implementation.
- Continue from that state. Do not revert the RED tests unless they are wrong.

OBJECTIVE:
Implement the minimal production changes so the RED tests pass and W2 acceptance is met.

ALLOWED_WRITE_PATHS:
- `packages/core/src/ai/ContextComposer.ts`
- `packages/core/src/ai/index.ts` only if export needed
- `packages/core/src/browser.ts` only if export needed
- `packages/core/tests/ContextComposer.test.ts`
- `packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts`
- `packages/obsidian-plugin/src/studio/ai/streamingChat.ts`
- `packages/obsidian-plugin/tests/studio/selectionPrompts.test.ts`
- `packages/obsidian-plugin/tests/studio/streamingChat.test.ts`
- `docs/planning/06-tasks.md`

FORBIDDEN_PATHS:
- Do not edit `ActionPanel.tsx`, `SelectionPopover.tsx`, vault files, runtime plugin install folders, or `13.zettel-connect`.
- If you believe ActionPanel/SelectionPopover edits are necessary, stop and report REQUEST_CHANGES; do not edit them.

IMPLEMENTATION GUIDANCE:
1. In `ContextComposer.ts`, support v2 sibling `project.json.sourceNotes` when composing a scene markdown path under a project folder. Likely path: for `4.Writing/p/scene.md`, read `4.Writing/p/project.json` if present and parse `sourceNotes` as string[]. If present and non-empty, use it as canonical over scene frontmatter `source_notes`.
2. Preserve legacy frontmatter `source_notes` behavior when sibling project.json is absent or has no usable sourceNotes.
3. Source-note entries may be wikilinks (`[[A]]`) or vault-relative markdown paths (`3.Structure/B.md`). For vault-relative `.md` entries, read directly rather than requiring `resolveWiki`. For wikilinks/bare names, keep using `parseWikiLink` + `resolveWiki`.
4. In `selectionPrompts.ts`, add an optional third parameter/options to `buildSelectionPrompt` so callers can include `sourceNotesContext` before the selected text. Default output must remain unchanged when omitted.
5. `streamingChat.ts` likely already satisfies notesContext behavior; only touch it if the new test reveals a real issue.
6. Mark W2 `[x]` in `docs/planning/06-tasks.md` only after targeted and broader verification passes.

REQUIRED VERIFICATION:
- GREEN targeted:
  - `pnpm --filter @ai-manuscript-studio/core test -- --runTestsByPath tests/ContextComposer.test.ts`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runTestsByPath tests/studio/selectionPrompts.test.ts tests/studio/streamingChat.test.ts`
- Broader:
  - `pnpm --filter @ai-manuscript-studio/core test`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`
  - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
  - `node --check packages/obsidian-plugin/main.js`
  - `git diff --check`
- Report exit codes and test counts if available.

EXPECTED_MARKER:
W2_BUILD_DONE

REPORT_FORMAT:
- Root cause.
- RED evidence.
- Implementation summary.
- Verification evidence.
- Changed files.
- Last line exactly: W2_BUILD_DONE
