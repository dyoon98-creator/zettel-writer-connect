# TASK_ID: b3-2-register-voice-loader-20260519

ROLE: electron-renderer-specialist
MODEL_OR_LANE: GPT-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/electron-renderer-specialist.md
AGENT_PERSONA_SUMMARY: Electron renderer / TypeScript specialist. Implement small Obsidian plugin renderer-side utilities with tests first, preserve existing UX contracts, avoid unrelated edits.

OBJECTIVE:
Implement B3.2 register-specific voice guide loader using TDD. Add the core loader/merge utility only; do not wire it into QuickComposeModal yet (B3.3). After passing tests, mark B3.2 complete in docs/planning/06-tasks.md with concise evidence. Preserve B3.3 and C0.2 open.

REPO:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

INPUTS:
- Task tracker: docs/planning/06-tasks.md lines 875-891.
- B3.1 spec: docs/planning/b3-register-voice-spec.md.
- Existing style guide loader: packages/obsidian-plugin/src/studio/voice/styleGuide.ts.
- Existing voice path wrapper: packages/obsidian-plugin/src/studio/voice/voiceIO.ts.
- Existing tauri shim behavior: packages/obsidian-plugin/src/studio/tauriShims/core.ts and tests/studio/tauriShimsCore.test.ts.
- Existing Quick Compose prompt tests for style-guide injection: packages/obsidian-plugin/tests/quickCompose.test.ts.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/registerGuide.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/studio/registerGuide.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- docs/planning/b3-register-voice-spec.md
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/tests/studio/tauriShimsCore.test.ts
- packages/obsidian-plugin/package.json
- packages/obsidian-plugin/jest.config.cjs

FORBIDDEN_PATHS:
- packages/core/**
- packages/obsidian-plugin/src/QuickComposeModal.ts
- packages/obsidian-plugin/src/quickCompose.ts
- vault files / installed plugin files / ~/.local/obsidian-plugins/**
- git commit/push/merge/release
- any credentials/tokens/license values

DEPENDENCIES:
- B3.1 is complete and spec exists.
- Current working tree has prior uncommitted docs/planning/06-tasks.md and docs/planning/b3-register-voice-spec.md changes; do not revert or overwrite unrelated prior evidence.

TDD REQUIREMENTS:
1. RED first: create packages/obsidian-plugin/tests/studio/registerGuide.test.ts before production implementation.
2. Run targeted Jest test and show that it fails for the expected reason before implementation.
3. GREEN: implement only enough production code to pass.
4. Run targeted Jest test again and make it pass.
5. Run at least these verification commands:
   - cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts
   - cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts tests/quickCompose.test.ts
   - cd packages/obsidian-plugin && pnpm build
   If full `pnpm test` is feasible within time, run it too; if not, report why and provide targeted evidence.

IMPLEMENTATION REQUIREMENTS:
1. New file `src/studio/voice/registerGuide.ts`.
2. Define canonical register union: `email | kakao | telegram | report | summary | memo`.
3. Read guide from `<voiceIO.path() without trailing slash>/.register-guides/<register>.json` using `invoke("vault_read_file", { path })`; do not use `voiceIO.writeFile`/`voice_write_file` and do not write during compose/load.
4. Parse schema v1:
   - `version: 1` required.
   - `register` must equal requested canonical register.
   - `addedInstructions?: string`.
   - `overrides?: Record<string,string>` with whitelist only: sentenceBreath, readerDistance, emotionAndAttitude, tone, sentenceLength, endings.
   - ignore non-whitelist keys with warn if reasonable; do not throw.
   - ignore/forbid styleDna and compressedPrompt overrides.
5. Missing file, parse error, version mismatch, unknown/mismatched register, or no base style guide must fall back safely.
6. Export a merge helper from styleGuide.ts or registerGuide.ts that returns the base `StyleGuideAxes` plus register-adjusted `compressedPrompt` only. Do not deep-merge styleDna and do not replace base compressedPrompt.
7. Expected public API may be:
   - `loadRegisterGuide(register: string): Promise<RegisterGuideDelta | null>`
   - `mergeRegisterGuide(base: StyleGuideAxes, delta: RegisterGuideDelta | null): StyleGuideAxes`
   - optionally `loadRegisterStyleGuide(register: string): Promise<StyleGuideAxes | null>` that combines `loadStyleGuide()` + delta. If you choose a different small API, tests must document it clearly.
8. Keep QuickComposeModal wiring out of scope for B3.2.

ACCEPTANCE_CRITERIA:
- TDD red-green evidence is present in your report.
- In-memory/Jest test: email register delta applies to base compressedPrompt with `## 형식별 보정(email)` and override lines.
- Test: missing register guide returns base guide / null-delta fallback without throwing.
- Test: invalid version/register/JSON falls back without throwing.
- Test: styleDna/compressedPrompt override attempts are ignored.
- B3.2 is marked `[x]` in docs/planning/06-tasks.md only after tests pass; B3.3 and C0.2 remain `[ ]`.
- No code or vault writes outside ALLOWED_WRITE_PATHS.

REQUIRED_EVIDENCE:
- RED test command + expected failing output summary.
- GREEN targeted test command + pass summary.
- Build command + exit status.
- `git diff -- packages/obsidian-plugin/src/studio/voice/registerGuide.ts packages/obsidian-plugin/src/studio/voice/styleGuide.ts packages/obsidian-plugin/tests/studio/registerGuide.test.ts docs/planning/06-tasks.md` excerpt.
- `git status --short`.

EXPECTED_MARKER:
- BUILD_DONE on success.
- TEST_FAIL on test/build failure.
- REQUEST_CHANGES if requirements cannot be met without editing forbidden paths.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.