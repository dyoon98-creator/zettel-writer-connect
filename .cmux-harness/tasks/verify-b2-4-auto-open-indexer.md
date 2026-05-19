# VERIFY TASK: verify-b2-4-auto-open-indexer

ROLE: read-only verifier
MODEL_OR_LANE: Opus-Verify

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Read-only verification for fix: AI 원고실 plugin is enabled but does not surface right-sidebar panel. Confirm that new code auto-opens/reveals `ams-project-indexer` on Obsidian layout ready without requiring active Markdown/frontmatter.

READ_ONLY_PATHS:
- packages/obsidian-plugin/src/main.ts
- packages/obsidian-plugin/tests/mainAutoOpenIndexer.test.ts
- docs/planning/06-tasks.md
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/main.ts for reference only

FORBIDDEN:
- Do not edit files.
- Do not deploy/install.
- Do not commit/push.

MAIN VERIFIED COMMANDS:
- `bash ~/.hermes/skills/0-aliases-claude-codex/cmux/scripts/main-write-firewall.sh worker-check b2-4-auto-open-indexer` → WORKER_WRITE_SCOPE_PASS changed_paths=3
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- mainAutoOpenIndexer` → 1 suite / 4 tests PASS
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin test` → 12 suites / 99 tests PASS
- `pnpm --filter @ai-manuscript-studio/obsidian-plugin build` → exit 0

CHECKLIST:
1. Does main.ts call `this.app.workspace.onLayoutReady(...)` during onload?
2. Does that callback invoke `openIndexer` or wrapper without active note/frontmatter dependency?
3. Does it avoid duplicate indexer leaves if one already exists?
4. Are existing ribbon and `open-indexer` command preserved?
5. Are tests meaningful within the existing tsconfig/test constraints?
6. Any blocker before redeploying installed bundle to vault and asking/performing Obsidian reload?

REQUIRED_OUTPUT:
- REVIEW_DONE
- Verdict PASS or REQUEST_CHANGES
- Blockers
- Non-blocking risks
- Evidence by file/line and command outputs
