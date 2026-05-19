# TASK_ID: b2-3-voice-folder-fallback

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- Senior frontend/UI specialist for Obsidian plugin React/TypeScript work.
- Follow TDD: write failing tests first, show RED, then minimal GREEN.
- Preserve current Obsidian plugin architecture; do not touch vault installation or external sending.

MODEL_OR_LANE: Sonnet-Executor

OBJECTIVE:
Implement B2.3: VoicePane folder picker fallback for Obsidian mode. The current `@tauri-apps/plugin-dialog` shim returns null in Obsidian, so the "폴더 선택…" flow cannot change the voice folder. Add a direct text input fallback in VoicePane so the user can type/paste a folder path and apply it. Invalid path input must show an inline error and must not call `voiceIO.setFolder`.

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

INPUTS:
- docs/planning/06-tasks.md lines 547-563 define B2.3, but note the listed plugin-dialog path has drifted. Actual path is `packages/obsidian-plugin/src/studio/tauriShims/plugin-dialog.ts`.
- Current VoicePane: `packages/obsidian-plugin/src/studio/voice/VoicePane.tsx`
- Current voice IO wrapper: `packages/obsidian-plugin/src/studio/voice/voiceIO.ts`
- Obsidian dialog shim: `packages/obsidian-plugin/src/studio/tauriShims/plugin-dialog.ts`
- Jest config only includes `tests/**/*.ts`; importing `.tsx` may require config changes, so prefer testing pure helper functions in `.ts` plus a source/UI contract test if necessary.

ALLOWED_WRITE_PATHS:
- docs/planning/06-tasks.md
- packages/obsidian-plugin/src/studio/voice/VoicePane.tsx
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/studio/tauriShims/plugin-dialog.ts
- packages/obsidian-plugin/tests/VoicePane.test.ts
- packages/obsidian-plugin/tests/studio/voiceIO.test.ts
- packages/obsidian-plugin/tests/studio/pluginDialog.test.ts

READ_ONLY_PATHS:
- packages/obsidian-plugin/package.json
- packages/obsidian-plugin/jest.config.cjs
- packages/obsidian-plugin/tsconfig.json
- packages/obsidian-plugin/tsconfig.test.json
- packages/obsidian-plugin/tests/** existing files
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/src/adapters/appSettings.ts

FORBIDDEN_PATHS:
- packages/core/**
- packages/zettel-connect/**
- Any Obsidian vault path under /Users/dongchanyoon/Library/CloudStorage/**
- .obsidian/plugins/**
- package lockfiles unless absolutely required (should not be required)
- commit/push/deploy/install commands

DEPENDENCIES:
- B2.2 Quick Compose is already implemented and tested. Do not refactor it.

ACCEPTANCE_CRITERIA:
1. RED first: add tests that fail before implementation. Minimum recommended:
   - `normalizeVoiceFolderInput` (or equivalent exported pure helper) rejects empty input.
   - rejects relative paths such as `relative/path`.
   - rejects NUL-containing paths.
   - accepts macOS absolute paths such as `/Users/dongchanyoon/Documents/voice`.
   - accepts Windows absolute paths too if easy: `C:\\Users\\Me\\voice` and/or UNC `\\\\server\\share`.
   - a VoicePane UI/source contract test confirms the direct input exists with a stable selector, e.g. `data-field="voice-folder-input"`, and an apply button label like `경로 적용`.
2. VoicePane UI:
   - Shows current folder path as before.
   - Adds a direct text input prefilled/synced with current folder after reload.
   - Adds an apply button.
   - On invalid input, shows inline error text and does not call `voiceIO.setFolder`.
   - On valid input, calls `voiceIO.setFolder(validPath)`, shows success notice, clears error, reloads.
   - If picker returns null (Obsidian dialog shim), the direct input fallback remains available; optionally show an info notice telling user to paste path directly.
3. `plugin-dialog.ts` comment/warning may be updated to mention VoicePane direct input fallback; do not try to implement native OS picker inside Obsidian.
4. Update B2.3 in `docs/planning/06-tasks.md`:
   - Correct actual path from `src/tauriShims/...` to `src/studio/tauriShims/...`.
   - Mark B2.3 complete only after tests pass.
   - Add concise completion evidence.
5. No external sending, no vault copy/install, no deploy.

REQUIRED_EVIDENCE:
- Show failing test output before code change (RED).
- Show passing targeted test output after code change.
- Show full plugin test output.
- Show build output.
- Show git diff summary / changed files.
- Show worker write-scope remains within ALLOWED_WRITE_PATHS.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
When complete, respond with:
- BUILD_DONE
- Summary of changes
- RED evidence
- GREEN evidence
- Full test/build evidence
- Changed files
- Any residual risk

Suggested commands:
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- voiceIO VoicePane pluginDialog`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`
