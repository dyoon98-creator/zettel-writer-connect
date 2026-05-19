# TASK_ID: b3-1-register-voice-spec-doc-20260519

ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY: Documentation specialist. Convert verified planning review into a clear implementation-ready spec, preserving existing task format and avoiding unrelated edits.

OBJECTIVE:
Create docs/planning/b3-register-voice-spec.md for B3.1 and mark B3.1 complete in docs/planning/06-tasks.md with concise completion evidence.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- B3.1 task spec: docs/planning/06-tasks.md lines 835-863
- Planning Review log: .cmux-harness/logs/Planning Review-20260519-211133.log lines 764-993
- Existing docs:
  - docs/planning/corpus-governance.md
  - docs/planning/corpus-convention.md
  - docs/planning/b1-comms-skillpack-usage.md
- Existing source for cited architecture only:
  - packages/obsidian-plugin/src/studio/voice/styleGuide.ts
  - packages/obsidian-plugin/src/studio/voice/voiceIO.ts
  - packages/obsidian-plugin/src/quickCompose.ts
  - packages/obsidian-plugin/src/QuickComposeModal.ts

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/b3-register-voice-spec.md
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- .cmux-harness/logs/Planning Review-20260519-211133.log
- docs/planning/corpus-governance.md
- docs/planning/corpus-convention.md
- docs/planning/b1-comms-skillpack-usage.md
- packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/quickCompose.ts
- packages/obsidian-plugin/src/QuickComposeModal.ts

FORBIDDEN_PATHS:
- packages/** edits
- vault files
- plugin installed files
- git commit/push/merge/release

DESIGN REQUIREMENTS TO INCLUDE:
1. Correct the original path idea: do not hardcode `_voice-samples`; use `<resolved voice folder>/.register-guides/<register>.json` based on voiceIO.path()/guidePath pattern.
2. Explain why hidden `.register-guides/` avoids corpus pollution.
3. Canonical B3 MVP register names: `email`, `kakao`, `telegram`, `report`, `summary`, `memo` — not action ids such as `kakao-short` or `report-polish`.
4. Schema v1 JSON example with fields: `version`, `register`, `addedInstructions`, `overrides`, `note`, `updatedAt`.
5. `addedInstructions` is primary; `overrides` is a whitelisted scalar hint map, not StyleGuideAxes deep merge. Forbid overriding `styleDna` and `compressedPrompt`.
6. Fallback behavior: missing/parse error/version mismatch/unknown register falls back to base `.style-guide.json`; base missing means no style guide injection, preserving B1 manual behavior.
7. Safety/privacy: no raw corpus text in register JSON, no automatic corpus inclusion, compose path read-only, explicit save/analyze command for writes only, no VAULT_INDEX access.
8. B3.2/B3.3 implementation notes: merge output as `base compressedPrompt + 형식별 보정`, preserve buildQuickComposePrompt signature if possible, validate subfolder write/ensure-dir behavior in Obsidian shim.
9. Include acceptance checklist for B3.2 implementer.

06-TASKS UPDATE:
- Change B3.1 checkbox from [ ] to [x].
- Add concise Completion evidence under B3.1, citing new spec and Planning Review corrections.
- Do not mark B3.2/B3.3 complete.
- Preserve C0.2 open state.

REQUIRED_EVIDENCE:
- `git diff -- docs/planning/b3-register-voice-spec.md docs/planning/06-tasks.md` excerpt.
- `git status --short`.

EXPECTED_MARKER:
- BUILD_DONE on success; TEST_FAIL on failure.

REPORT_FORMAT:
- Korean concise report.
- Last line marker only.