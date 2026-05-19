# TASK_ID: b3-2-register-voice-loader-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Verify implementation against B3.1 spec, B3.2 task acceptance, tests, and source behavior. Do not write files.

OBJECTIVE:
Read-only verify B3.2 register-specific voice guide loader implementation. Decide PASS or REQUEST_CHANGES based on concrete evidence.

REPO:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

INPUTS:
- Task packet: .cmux-harness/tasks/b3-2-register-voice-loader-20260519.md
- Worker log: .cmux-harness/logs/GPT-Executor-20260519-215631.log
- Spec: docs/planning/b3-register-voice-spec.md
- Tracker: docs/planning/06-tasks.md
- Source: packages/obsidian-plugin/src/studio/voice/registerGuide.ts
- Existing source: packages/obsidian-plugin/src/studio/voice/styleGuide.ts, voiceIO.ts, tauriShims/core.ts, QuickComposeModal.ts
- Tests: packages/obsidian-plugin/tests/studio/registerGuide.test.ts

ALLOWED_WRITE_PATHS:
- None. Read-only only.

READ_ONLY_PATHS:
- docs/planning/b3-register-voice-spec.md
- docs/planning/06-tasks.md
- packages/obsidian-plugin/src/studio/voice/registerGuide.ts
- packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/src/QuickComposeModal.ts
- packages/obsidian-plugin/tests/studio/registerGuide.test.ts
- .cmux-harness/logs/GPT-Executor-20260519-215631.log

FORBIDDEN_PATHS:
- Any write
- git commit/push/merge/release
- vault/plugin installed files

MAIN VERIFIED COMMANDS ALREADY RUN FRESH:
- `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts` → PASS, 1 suite, 9 tests.
- `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts tests/quickCompose.test.ts` → PASS, 3 suites, 39 tests.
- `cd packages/obsidian-plugin && pnpm build` → exit 0.
- `cd packages/obsidian-plugin && pnpm test` → PASS, 23 suites, 228 tests.
- `main-write-firewall.sh worker-check b3-2-register-voice-loader-20260519` → WORKER_WRITE_SCOPE_PASS changed_paths=3.

VERIFY THESE ACCEPTANCE CRITERIA:
1. TDD red-green evidence exists in worker log and tests are meaningful.
2. Register loader reads `<voiceIO.path() trimmed>/.register-guides/<register>.json` via `vault_read_file`, and does not write during load/compose.
3. Canonical registers exactly: email, kakao, telegram, report, summary, memo. Action-id keys not used.
4. Schema v1 validation: version 1, matching register, addedInstructions, whitelisted scalar overrides only.
5. styleDna and compressedPrompt override attempts are ignored, not deep merged or replaced.
6. merge preserves base axes and only appends register section to compressedPrompt.
7. Missing guide / parse error / version mismatch / register mismatch fallback without throw.
8. Base missing means no style guide injection / null return.
9. B3.2 is [x], B3.3 [ ], C0.2 [ ].
10. No QuickComposeModal/B3.3 wiring and no packages/core/vault/installed plugin edits.
11. Scrutinize the design choice that registerGuide.ts defines local StyleGuideAxes instead of importing from styleGuide.ts. If structurally safe and build proves compatibility, PASS may note it as non-blocking; if it creates a real drift/contract risk that should be fixed before B3.3, return REQUEST_CHANGES with exact minimal change.
12. Scrutinize the design choice that styleGuide.ts was not changed even though B3.2 original allowed path mentioned it. If requirements are still met by new registerGuide.ts API, PASS may note; if not, REQUEST_CHANGES.

REQUIRED_EVIDENCE:
- File/line evidence for loader path/read-only behavior.
- File/line evidence for merge behavior and forbidden override handling.
- Test evidence count/coverage summary from test file or worker log.
- Tracker heading evidence for B3.2/B3.3/C0.2.
- `git status --short` before/after to show verifier made no changes.
- Verdict PASS or REQUEST_CHANGES.

EXPECTED_MARKER:
- REVIEW_DONE if PASS.
- REQUEST_CHANGES if blocker.
- TEST_FAIL if verification command fails unexpectedly.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.