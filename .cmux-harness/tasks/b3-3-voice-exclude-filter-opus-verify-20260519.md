# TASK_ID: b3-3-voice-exclude-filter-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Verify B3.3 implementation against task/spec/tests with concrete evidence. Do not write files.

OBJECTIVE:
Read-only verify B3.3 voice corpus exclusion implementation. Return PASS or REQUEST_CHANGES based on evidence.

REPO:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

INPUTS:
- B3.3 task packet: .cmux-harness/tasks/b3-3-voice-exclude-filter-20260519.md
- Worker log: .cmux-harness/logs/GPT-Executor-20260519-221030.log
- Tracker: docs/planning/06-tasks.md
- Source: packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
- Source: packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- Test: packages/obsidian-plugin/tests/studio/voiceExclude.test.ts
- Related tests: registerGuide.test.ts, tauriShimsCore.test.ts

ALLOWED_WRITE_PATHS:
- None. Read-only only.

READ_ONLY_PATHS:
- docs/planning/06-tasks.md
- packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/tests/studio/voiceExclude.test.ts
- .cmux-harness/logs/GPT-Executor-20260519-221030.log

FORBIDDEN_PATHS:
- Any write
- packages/core/** edits
- QuickComposeModal/quickCompose edits
- vault/plugin installed files
- git commit/push/merge/release

MAIN VERIFIED COMMANDS ALREADY RUN FRESH:
- `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts` → PASS, 1 suite, 7 tests.
- `cd packages/obsidian-plugin && pnpm test -- --runTestsByPath tests/studio/voiceExclude.test.ts tests/studio/registerGuide.test.ts tests/studio/tauriShimsCore.test.ts` → PASS, 3 suites, 27 tests.
- `cd packages/obsidian-plugin && pnpm build` → exit 0.
- `cd packages/obsidian-plugin && pnpm test` → PASS, 24 suites, 235 tests.
- `main-write-firewall.sh worker-check b3-3-voice-exclude-filter-20260519` → WORKER_WRITE_SCOPE_PASS changed_paths=3.

VERIFY ACCEPTANCE:
1. TDD red-green evidence exists.
2. Frontmatter `voice-exclude: true`, `"true"`, and `'true'` excluded.
3. `voice-exclude: false`, no frontmatter, malformed frontmatter included.
4. Excluded files are omitted from prompt samples.
5. Excluded files are omitted from `buildSignatures(includedFiles)` / saved StyleGuide sampleSignatures.
6. Filtering happens before AI invocation, read-only except existing post-success `saveStyleGuide`.
7. No vault/installed plugin/Core/QuickCompose edits.
8. B3.3 `[x]`, C0.2 `[ ]`, W1 `[ ]`.
9. Scope correction to use `analyzeStyle.ts` is justified by content/frontmatter requirement; if not, explain blocker.
10. Verifier creates no working tree changes.

REQUIRED_EVIDENCE:
- File/line evidence for helper and analyzeStyle flow.
- Test evidence for true/false/no-frontmatter/malformed and signatures.
- Tracker heading evidence.
- `git status --short` before/after.
- Verdict PASS or REQUEST_CHANGES.

EXPECTED_MARKER:
- REVIEW_DONE if PASS.
- REQUEST_CHANGES if blocker.
- TEST_FAIL if verification commands fail unexpectedly.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.