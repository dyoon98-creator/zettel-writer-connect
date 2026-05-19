# TASK_ID: c0-1-install-state-readonly-verify-20260519

ROLE: test-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/test-specialist.md
AGENT_PERSONA_SUMMARY: Read-only verification specialist. Inspect installed/runtime artifacts, compare source vs deployed bundles, run non-mutating shell/file checks, report exact evidence and gaps. Do not edit project, vault, plugin bundles, or settings.

OBJECTIVE:
Verify C0.1 from docs/planning/06-tasks.md: current ai-manuscript-studio source/build/install state and canonical zettel-connect version, without modifying source, vault files, deploy scripts, or settings.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- Task spec: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md lines 15-43
- Installed plugin symlink/dir: /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio
- Source plugin package: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin
- Canonical Zettel Connect repo: /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect

ALLOWED_WRITE_PATHS:
- None. Read-only task. Do not edit files. Do not create reports. Terminal command history/cache side effects only are acceptable.

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/**
- /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio/**
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/.obsidian/plugins/ai-manuscript-studio/** if symlink resolves there

FORBIDDEN_PATHS:
- Any write to packages/**
- Any write to vault files under OneDrive-개인/지식창고/**
- deploy scripts
- git commit/push/merge/release

DEPENDENCIES:
- None.

ACCEPTANCE_CRITERIA:
1. Identify whether /Users/dongchanyoon/.local/obsidian-plugins/ai-manuscript-studio is a symlink; report resolved target.
2. Compare SHA-256 and size for installed main.js, manifest.json, styles.css against current built bundle in plugins/ai-manuscript-studio/ if present and/or package dist/build output if present. State exact compared paths.
3. Read installed manifest.json and source package manifest.json/package version evidence.
4. Confirm 13.zettel-connect version from manifest.json or package metadata and verify it is not changed by this task.
5. Run git status --short before and after, and explicitly report whether this task modified the working tree.
6. If a referenced file is missing, report as a gap, not as success.

REQUIRED_EVIDENCE:
- Commands run with exit codes or concise outputs.
- Hash table for compared files.
- Before/after git status evidence.
- Clear PASS/FAIL/GAP for each acceptance criterion.

EXPECTED_MARKER:
- Last line must be exactly REVIEW_DONE if all checks completed, or TEST_FAIL if a command/check failed materially.

REPORT_FORMAT:
- Short Korean summary.
- Evidence table.
- C0.1 verdict: PASS / FAIL / GAP.
- Last line marker only.