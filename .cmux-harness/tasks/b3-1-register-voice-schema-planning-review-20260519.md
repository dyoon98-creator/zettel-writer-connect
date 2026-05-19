# TASK_ID: b3-1-register-voice-schema-planning-review-20260519

ROLE: requirements-analyst
MODEL_OR_LANE: Planning Review
AGENT_PERSONA_SOURCE: read-only planning reviewer persona
AGENT_PERSONA_SUMMARY: Critical planning reviewer. Produce a practical schema/design recommendation without editing files. Focus on fit with existing Voice/StyleGuide architecture, vault safety, and future implementation tasks.

OBJECTIVE:
Review and draft the design direction for B3.1: register-specific voice guide registry schema for email/Kakao/report/memo deltas.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- Task spec: docs/planning/06-tasks.md lines 835-863
- Existing docs:
  - docs/planning/corpus-governance.md
  - docs/planning/corpus-convention.md
  - docs/planning/b1-comms-skillpack-usage.md
- Existing source for context only:
  - packages/obsidian-plugin/src/studio/voice/styleGuide.ts
  - packages/obsidian-plugin/src/studio/voice/voiceIO.ts
  - packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
  - packages/obsidian-plugin/src/quickCompose.ts
  - packages/obsidian-plugin/src/QuickComposeModal.ts

ALLOWED_WRITE_PATHS:
- None. Read-only planning review only.

READ_ONLY_PATHS:
- docs/planning/**
- packages/obsidian-plugin/src/studio/voice/**
- packages/obsidian-plugin/src/quickCompose.ts
- packages/obsidian-plugin/src/QuickComposeModal.ts

FORBIDDEN_PATHS:
- Any write
- vault files
- git commit/push/merge/release

QUESTIONS TO ANSWER:
1. Recommended file location: `_voice-samples/.register-guides/<register>.json` vs alternatives; explain why.
2. Exact JSON schema fields for a register delta, compatible with StyleGuideAxes v2 and future merge function.
3. Supported register names for B3 MVP: email, kakao-short, telegram-brief, report-polish, summary-briefing, memo-capture? Or narrower? Recommend one canonical set.
4. Fallback behavior when no register-specific guide exists.
5. Safety/privacy rules: no automatic corpus inclusion, no vault writes until explicit analysis command, hidden metadata folder handling.
6. Implementation notes for B3.2/B3.3, especially merge priority and validation errors.
7. Any corrections to B3.1 task spec before docs are written.

REQUIRED_EVIDENCE:
- Cite relevant existing files/lines where possible.
- Provide a concise design outline suitable for docs/planning/b3-register-voice-spec.md.

EXPECTED_MARKER:
- REVIEW_DONE if a complete recommendation is produced.
- REQUEST_CHANGES if B3.1 should be blocked or re-scoped.

REPORT_FORMAT:
- Korean concise planning review.
- Include proposed schema JSON example.
- Last line marker only.