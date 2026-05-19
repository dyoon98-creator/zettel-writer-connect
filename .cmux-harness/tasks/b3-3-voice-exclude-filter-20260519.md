# TASK_ID: b3-3-voice-exclude-filter-20260519

ROLE: electron-renderer-specialist
MODEL_OR_LANE: GPT-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/electron-renderer-specialist.md
AGENT_PERSONA_SUMMARY: Electron renderer / TypeScript specialist. Implement small Obsidian plugin renderer-side behavior with tests first, preserving safety/privacy and avoiding unrelated edits.

OBJECTIVE:
Implement B3.3 voice corpus exclusion: `.md` files with frontmatter `voice-exclude: true` must be excluded from voice analysis corpus and style-guide sample signatures. Use TDD. After tests/build pass, mark B3.3 complete in docs/planning/06-tasks.md with concise evidence. Do not touch vault files or installed plugin files.

REPO:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

INPUTS:
- Task tracker: docs/planning/06-tasks.md lines 905-919.
- B3.1/B3.2 context: docs/planning/b3-register-voice-spec.md and packages/obsidian-plugin/src/studio/voice/registerGuide.ts.
- Current analysis flow: packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts lines 429-478.
- Current file listing/read wrapper: packages/obsidian-plugin/src/studio/voice/voiceIO.ts.
- Existing tests style: packages/obsidian-plugin/tests/studio/registerGuide.test.ts, tests/studio/tauriShimsCore.test.ts.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/studio/voiceExclude.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- docs/planning/06-tasks.md
- docs/planning/b3-register-voice-spec.md
- packages/obsidian-plugin/src/studio/voice/registerGuide.ts
- packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- packages/obsidian-plugin/tests/studio/registerGuide.test.ts
- packages/obsidian-plugin/package.json
- packages/obsidian-plugin/jest.config.cjs

FORBIDDEN_PATHS:
- packages/core/**
- packages/obsidian-plugin/src/QuickComposeModal.ts
- packages/obsidian-plugin/src/quickCompose.ts
- vault files / installed plugin files / ~/.local/obsidian-plugins/**
- git commit/push/merge/release
- credentials/tokens/license values

DEPENDENCIES:
- B3.2 is complete and verified.
- Current working tree includes prior uncommitted B3.1/B3.2 changes. Preserve them.
- Original 06-tasks B3.3 allowed path lists only `voiceIO.ts`, but actual exclusion likely belongs in `analyzeStyle.ts` because frontmatter requires reading file contents before prompt/signature creation. If you edit `analyzeStyle.ts`, document this as a necessary implementation-scope correction in B3.3 completion evidence, not as drift.

TDD REQUIREMENTS:
1. RED first: create `packages/obsidian-plugin/tests/studio/voiceExclude.test.ts` before production changes.
2. Run targeted test and show it fails for expected feature-missing reason.
3. GREEN: implement minimal production code.
4. Run targeted test again and make it pass.
5. Run at least:
   - `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts`
   - `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts`
   - `cd packages/obsidian-plugin && pnpm build`
   If feasible, run full `pnpm test` and report counts.

IMPLEMENTATION REQUIREMENTS:
1. Exclude only `.md` samples whose YAML frontmatter has `voice-exclude: true`.
2. Treat these as excluded:
   - `---\nvoice-exclude: true\n---\nbody`
   - whitespace around key/value.
   - optional quoted boolean `"true"` / `'true'` acceptable if simple.
3. Do NOT exclude if no frontmatter block, malformed frontmatter, or `voice-exclude: false`.
4. Excluded files must not appear in `assemblePrompt(samples)` input and must not be included in `buildSignatures(...)` used in saved StyleGuide.
5. Keep register guide dot-folder JSON out of scope; B3.1 already makes `.register-guides/*.json` non-corpus by extension/path. Do not add VAULT_INDEX access.
6. Prefer a small exported/internal helper in `analyzeStyle.ts`, e.g. `isVoiceExcludedFrontmatter(raw: string)` and/or `filterVoiceIncludedFiles(files)`, so tests do not need to run AI.
7. Keep behavior read-only before AI invocation except existing `saveStyleGuide(guide)` after successful analysis.
8. Do not change QuickComposeModal or registerGuide wiring.

ACCEPTANCE_CRITERIA:
- Test: frontmatter `voice-exclude: true` is excluded.
- Test: `voice-exclude: false` and no frontmatter are included.
- Test: sample signatures use included files only.
- Targeted tests and build pass.
- B3.3 marked `[x]`; C0.2 remains `[ ]`; W1 remains `[ ]`.
- No forbidden paths changed.

REQUIRED_EVIDENCE:
- RED test command + expected failing output summary.
- GREEN test/build command summaries with counts.
- `git diff -- packages/obsidian-plugin/src/studio/voice/voiceIO.ts packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts packages/obsidian-plugin/tests/studio/voiceExclude.test.ts docs/planning/06-tasks.md` excerpt.
- `git status --short`.

EXPECTED_MARKER:
- BUILD_DONE on success.
- TEST_FAIL on test/build failure.
- REQUEST_CHANGES if requirements cannot be met without forbidden edits.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.