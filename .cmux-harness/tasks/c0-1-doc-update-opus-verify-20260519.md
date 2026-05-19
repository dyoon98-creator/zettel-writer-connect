# TASK_ID: c0-1-doc-update-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Check that a documentation update matches prior verified evidence and that no unrelated tasks were marked complete.

OBJECTIVE:
Verify the C0.1 docs/planning/06-tasks.md update after Sonnet marked it complete.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- Changed file: docs/planning/06-tasks.md
- Prior Opus install-state verdict: .cmux-harness/logs/Opus-Verify-20260519-105650.log lines 845-992
- Worker log: .cmux-harness/logs/Sonnet-Executor-20260519-105404.log

ALLOWED_WRITE_PATHS:
- None. Read-only only.

READ_ONLY_PATHS:
- docs/planning/06-tasks.md
- .cmux-harness/logs/**

FORBIDDEN_PATHS:
- Any write
- git commit/push/merge/release
- packages/** edits
- plugin/vault writes

DEPENDENCIES:
- Sonnet completed c0-1-doc-mark-complete-20260519 with BUILD_DONE.

ACCEPTANCE_CRITERIA:
1. C0.1 heading is [x].
2. C0.2 heading remains [ ].
3. Completion evidence accurately states installed ~/.local bundle matches packages/obsidian-plugin for main.js, manifest.json, styles.css by SHA-256; zettel-connect remains 0.1.6; plugins/ai-manuscript-studio is stale untracked staging/non-blocking.
4. git diff for docs/planning/06-tasks.md contains only the C0.1 checkbox and evidence block; no unrelated task status changes.
5. Verifier creates no working tree changes.

REQUIRED_EVIDENCE:
- Short diff/status evidence.
- Verdict PASS/REQUEST_CHANGES.

EXPECTED_MARKER:
- REVIEW_DONE if PASS; REQUEST_CHANGES if not.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.