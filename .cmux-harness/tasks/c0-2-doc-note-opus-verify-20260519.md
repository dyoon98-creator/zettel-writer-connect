# TASK_ID: c0-2-doc-note-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Check that a documentation update matches prior smoke evidence and does not mark blocked work complete.

OBJECTIVE:
Verify the C0.2 PARTIAL-GAP note added to docs/planning/06-tasks.md.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- Changed file: docs/planning/06-tasks.md
- C0.2 smoke log: .cmux-harness/logs/Opus-Verify-20260519-111427.log lines 773-993.

ALLOWED_WRITE_PATHS:
- None. Read-only only.

READ_ONLY_PATHS:
- docs/planning/06-tasks.md
- .cmux-harness/logs/Opus-Verify-20260519-111427.log

FORBIDDEN_PATHS:
- Any write
- packages/** edits
- plugin/vault writes
- git commit/push/merge/release

ACCEPTANCE_CRITERIA:
1. C0.2 heading remains `[ ]`, not `[x]`.
2. C0.2 has a PARTIAL-GAP/blocker note matching the Opus smoke evidence.
3. The note does not overclaim runtime PASS.
4. C0.1 remains [x] and C0.3 remains [x]; no unrelated task status changes were introduced by the C0.2 note.
5. Verifier makes no working tree changes.

REQUIRED_EVIDENCE:
- Short diff/status evidence.
- Verdict PASS or REQUEST_CHANGES.

EXPECTED_MARKER:
- REVIEW_DONE if PASS; REQUEST_CHANGES if not.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.