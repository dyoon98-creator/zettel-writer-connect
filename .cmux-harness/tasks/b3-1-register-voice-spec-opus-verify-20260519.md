# TASK_ID: b3-1-register-voice-spec-opus-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only verifier persona
AGENT_PERSONA_SUMMARY: Independent read-only verifier. Check docs against the planning review, task spec, and existing architecture. Do not write files.

OBJECTIVE:
Verify B3.1 completion: docs/planning/b3-register-voice-spec.md created correctly and docs/planning/06-tasks.md marks only B3.1 complete with accurate evidence.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- New spec: docs/planning/b3-register-voice-spec.md
- Task tracker: docs/planning/06-tasks.md
- Planning Review log: .cmux-harness/logs/Planning Review-20260519-211133.log lines 764-993
- Worker evidence: Sonnet pane showed BUILD_DONE for b3-1-register-voice-spec-doc-20260519

ALLOWED_WRITE_PATHS:
- None. Read-only only.

READ_ONLY_PATHS:
- docs/planning/b3-register-voice-spec.md
- docs/planning/06-tasks.md
- .cmux-harness/logs/Planning Review-20260519-211133.log

FORBIDDEN_PATHS:
- Any write
- packages/** edits
- vault/plugin files
- git commit/push/merge/release

ACCEPTANCE_CRITERIA:
1. New spec exists and covers: resolved voice folder path, hidden `.register-guides`, canonical six registers, schema JSON, fallback, privacy/safety, B3.2 implementation notes, acceptance checklist.
2. Spec incorporates Planning Review corrections: no `_voice-samples` hardcoding as canonical runtime path; no action-id register keys; addedInstructions primary; no deep merge of styleDna/compressedPrompt.
3. docs/planning/06-tasks.md marks B3.1 `[x]` and leaves B3.2/B3.3 `[ ]`; C0.2 remains `[ ]`.
4. No code or vault files changed by this task.
5. Verifier makes no working tree changes.

REQUIRED_EVIDENCE:
- Short grep/read evidence for spec sections.
- git diff/status summary.
- Verdict PASS or REQUEST_CHANGES.

EXPECTED_MARKER:
- REVIEW_DONE if PASS; REQUEST_CHANGES if issues.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.