# TASK_ID: c0-1-install-state-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Re-check evidence without modifying files, distinguish stale staging artifacts from active runtime/source build outputs, and return concrete PASS/FAIL/GAP.

OBJECTIVE:
Independently verify C0.1 install-state evidence after Sonnet reported a GAP because installed bundle differed from repo-local plugins/ staging. Main observed that installed bundle matches packages/obsidian-plugin root build outputs. Decide whether C0.1 should be PASS, GAP, or FAIL.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- C0.1 spec: docs/planning/06-tasks.md lines 15-43
- Sonnet log: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/logs/Sonnet-Executor-20260519-105404.log lines ~650-991
- Installed plugin: /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio
- Package build output/source bundle: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/{main.js,manifest.json,styles.css}
- Repo-local staging artifact: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/plugins/ai-manuscript-studio/{main.js,manifest.json,styles.css}
- Zettel Connect canonical: /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/manifest.json

ALLOWED_WRITE_PATHS:
- None. Read-only. Do not edit files. Do not commit/push/deploy.

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/**
- /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio/**
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**

FORBIDDEN_PATHS:
- Any file write
- build/deploy commands that overwrite artifacts
- Obsidian/vault writes
- git commit/push/merge/release

DEPENDENCIES:
- None.

ACCEPTANCE_CRITERIA:
1. Recompute SHA-256/size/mtime for installed vs package root vs plugins staging for main.js, manifest.json, styles.css.
2. Verify installed bundle matches package root build outputs exactly for the three files, or report mismatch.
3. Verify plugins/ staging mismatch is stale/non-active evidence, not a blocker to installed-vs-current-source if package root is the actual build output.
4. Verify 13.zettel-connect manifest version is 0.1.6 and untouched.
5. Check git status before/after to ensure verifier made no changes.
6. Return C0.1 verdict and whether docs/planning/06-tasks.md can be marked [x] with a note that plugins/ is stale/untracked staging.

REQUIRED_EVIDENCE:
- Hash table for the three compared locations.
- Explicit statement on active runtime path and source build path.
- Before/after git status.

EXPECTED_MARKER:
- REVIEW_DONE if verification completed; REQUEST_CHANGES if evidence is insufficient or task should not be marked complete; TEST_FAIL on command failure.

REPORT_FORMAT:
- Korean concise evidence report.
- Verdict: PASS/GAP/FAIL.
- Last line marker only.