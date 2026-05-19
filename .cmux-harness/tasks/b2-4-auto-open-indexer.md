# TASK_ID: b2-4-auto-open-indexer

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- Senior frontend/Obsidian plugin specialist.
- Follow TDD: add a failing source/behavior contract test first, then minimal implementation.
- Respect active cmux harness: modify only allowed paths, no vault install/deploy/commit.

MODEL_OR_LANE: Sonnet-Executor

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

PROBLEM:
User confirmed AI 원고실 appears enabled in Obsidian Community Plugins, but no AI 원고실 right-sidebar panel appears. Screenshot shows Zettel Connect panel only. Investigation by Main found:
- `community-plugins.json` includes `ai-manuscript-studio`.
- installed bundle has command/ribbon strings.
- `.obsidian/workspace.json` has `zettel-connect-panel` but no `ams-project-indexer`.
- `packages/obsidian-plugin/src/main.ts` registers `PROJECT_INDEXER_VIEW_TYPE`, ribbon icon, command `open-indexer`, but never calls `openIndexer()` on load/layout ready.
- Existing canonical Zettel Connect uses `this.app.workspace.onLayoutReady(() => void this.surfacePanelOnLoad())` to make the panel visible immediately (see `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/main.ts` lines 72-77, 154-160).

OBJECTIVE:
Make AI 원고실 surface its right-sidebar indexer automatically after Obsidian layout is ready, so enabling/reloading the plugin creates/reveals `ams-project-indexer` without requiring the user to find the ribbon icon/command first.

ALLOWED_WRITE_PATHS:
- packages/obsidian-plugin/src/main.ts
- packages/obsidian-plugin/tests/mainAutoOpenIndexer.test.ts
- docs/planning/06-tasks.md

READ_ONLY_PATHS:
- packages/obsidian-plugin/tests/mainQuickComposeCommand.test.ts
- packages/obsidian-plugin/tests/**
- packages/obsidian-plugin/src/ProjectIndexerView.ts
- packages/obsidian-plugin/src/settings.ts
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/main.ts

FORBIDDEN_PATHS:
- packages/core/**
- packages/zettel-connect/**
- Obsidian vault paths under `/Users/dongchanyoon/Library/CloudStorage/**`
- deploy/install commands
- commit/push/release

ACCEPTANCE_CRITERIA:
1. RED first: add a test that fails before implementation, preferably source-contract style consistent with `tests/mainQuickComposeCommand.test.ts` because direct importing main.ts may pull `.tsx` dependencies.
2. `main.ts` must register an `onLayoutReady` callback during `onload()`.
3. The callback must call `openIndexer()` (or a tiny wrapper that does so) and not depend on active Markdown/writing project frontmatter.
4. Existing command/ribbon behavior must remain.
5. No vault install/deploy. Main will install after verification if needed.
6. Update `docs/planning/06-tasks.md` with a small B2.4 note/evidence if there is an appropriate Phase B2 location. Do not rewrite the whole file.

REQUIRED_EVIDENCE:
- RED output showing new test failed before implementation.
- GREEN targeted test output.
- Full plugin test output.
- Build output.
- Changed files summary.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
Return:
- BUILD_DONE
- Summary
- RED evidence
- GREEN/full/build evidence
- Changed files
- Residual risks
