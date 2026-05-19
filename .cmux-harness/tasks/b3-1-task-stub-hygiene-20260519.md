# TASK_ID: b3-1-task-stub-hygiene-20260519

ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY: Documentation specialist. Make a tiny consistency patch only, preserving task status and evidence.

OBJECTIVE:
Apply the non-blocking hygiene note from Opus-Verify: clarify the old B3.1 Spec items line in docs/planning/06-tasks.md that still shows `_voice-samples/.register-guides/<register>.json`, so it no longer conflicts with the completed authoritative spec.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- File to edit: docs/planning/06-tasks.md
- Opus verification log: .cmux-harness/logs/Opus-Verify-20260519-212054.log lines 973-991
- Authoritative new spec: docs/planning/b3-register-voice-spec.md §1

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- docs/planning/b3-register-voice-spec.md
- .cmux-harness/logs/Opus-Verify-20260519-212054.log

FORBIDDEN_PATHS:
- packages/**
- vault/plugin files
- git commit/push/merge/release

ACCEPTANCE_CRITERIA:
1. Do not change any task checkbox.
2. Change only the B3.1 Spec items path line to reflect the resolved path correction, e.g. Register delta: `<resolved voice folder>/.register-guides/<register>.json` (original `_voice-samples/...` replaced or annotated as superseded).
3. Preserve the B3.1 completion evidence and B3.2/B3.3 open states.
4. Run diff/status evidence.

EXPECTED_MARKER:
- BUILD_DONE on success; TEST_FAIL on failure.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.