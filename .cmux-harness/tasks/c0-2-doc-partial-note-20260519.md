# TASK_ID: c0-2-doc-partial-note-20260519

ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY: Documentation specialist. Make narrowly scoped planning-document updates from verified evidence, preserve existing format, and avoid unrelated edits.

OBJECTIVE:
Update docs/planning/06-tasks.md C0.2 section with a concise partial evidence / blocker note from the Opus-Verify C0.2 smoke. Do NOT mark C0.2 complete.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- File to edit: docs/planning/06-tasks.md
- C0.2 section lines around 56-84 after C0.1 evidence insertion.
- Opus C0.2 smoke log: .cmux-harness/logs/Opus-Verify-20260519-111427.log lines 773-993.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- .cmux-harness/logs/Opus-Verify-20260519-111427.log

FORBIDDEN_PATHS:
- packages/**
- plugin/vault files
- .local Obsidian plugin files
- git commit/push/merge/release

DEPENDENCIES:
- Opus-Verify returned REVIEW_DONE with Verdict PARTIAL-GAP.

ACCEPTANCE_CRITERIA:
1. C0.2 heading remains `### [ ] ...`; do not change to [x].
2. Add a concise `**Partial evidence / blocker**` block inside C0.2 before its next `---` separator.
3. Include these facts only:
   - Opus-Verify C0.2 smoke result: PARTIAL-GAP, REVIEW_DONE.
   - No CDP runtime DOM was run because Obsidian live session was running, port 9222 closed, and CDP would require quit/reopen plus possible vault folder creation.
   - `_attachments/voice` and `_voice-samples` were absent; voice sample count 0; sample creation/reanalysis was not approved in this task, so checklist items 6-8 cannot pass.
   - Source/installed bundle evidence shows VoicePane UI/buttons and picker fallback are wired, but full runtime PASS requires a dedicated approval window.
   - Next decision required: approve a full C0.2 runtime smoke with Obsidian restart + one temporary voice sample, or leave C0.2 open and continue later.
4. Do not edit C0.1, C0.3, or any other task status.
5. Run `git diff -- docs/planning/06-tasks.md` and `git status --short` and report concise evidence.

REQUIRED_EVIDENCE:
- Diff excerpt for C0.2 only.
- Status output.

EXPECTED_MARKER:
- BUILD_DONE on success; TEST_FAIL on failure.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.