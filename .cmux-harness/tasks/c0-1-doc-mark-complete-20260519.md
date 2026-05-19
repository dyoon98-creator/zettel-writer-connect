# TASK_ID: c0-1-doc-mark-complete-20260519

ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY: Documentation specialist. Make narrowly scoped planning-document updates from verified evidence, preserve existing format, and avoid unrelated edits.

OBJECTIVE:
Update docs/planning/06-tasks.md to mark C0.1 complete and record verified evidence from the Sonnet + Opus verification logs. Do not change any code or plugin/vault files.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- File to edit: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md
- C0.1 section starts at line 15.
- Sonnet verification log: .cmux-harness/logs/Sonnet-Executor-20260519-105404.log
- Opus independent verification log: .cmux-harness/logs/Opus-Verify-20260519-105650.log, especially lines 845-992.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/logs/Sonnet-Executor-20260519-105404.log
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/.cmux-harness/logs/Opus-Verify-20260519-105650.log

FORBIDDEN_PATHS:
- packages/**
- plugins/**
- vault/Obsidian files
- /Users/dongchanyoon/.local/obsidian-plugins/**
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
- git commit/push/merge/release

DEPENDENCIES:
- C0.1 verification completed; Opus verdict PASS and says docs can be marked [x].

ACCEPTANCE_CRITERIA:
1. Change only the C0.1 heading checkbox from [ ] to [x].
2. Add a concise Completion evidence block in the C0.1 section, before the next section separator, including:
   - installed plugin runtime path matches packages/obsidian-plugin build output for main.js, manifest.json, styles.css by SHA-256.
   - active installed plugin path: /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio.
   - 13.zettel-connect manifest version remains 0.1.6.
   - plugins/ai-manuscript-studio/ is stale untracked staging and not the active runtime/source build output; non-blocking cleanup candidate.
3. Do not mark C0.2 or any other task complete.
4. Run a local diff/status check showing only docs/planning/06-tasks.md changed since the baseline claim, plus existing untracked items.

REQUIRED_EVIDENCE:
- git diff -- docs/planning/06-tasks.md excerpt.
- git status --short.

EXPECTED_MARKER:
- BUILD_DONE on success, TEST_FAIL on failure.

REPORT_FORMAT:
- Korean concise report with changed section and evidence.
- Last line marker only.