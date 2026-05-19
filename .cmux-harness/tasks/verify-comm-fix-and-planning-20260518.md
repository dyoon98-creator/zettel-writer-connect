# Read-only verification: cmux communication fix + planning artifacts

ROLE: Opus-Verify read-only verifier
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: REVIEW_DONE

Verify the following without modifying any files:

1. cmux communication root-cause fixes
- Runtime script: /Users/dongchanyoon/.hermes/skills/0-aliases-claude-codex/cmux/scripts/pane-send.sh
- Confirm dispatch token is short/no-space: DISPATCH_TOKEN="CMUX_DISPATCH_${TS}_$$".
- Confirm DISPATCH_MESSAGE starts with token directly, not bracket prefix.
- Confirm polling tracks TOKEN_SEEN and scans tail after token scrolls out.
- Confirm marker detection strips Claude UI prefixes ⏺/● before matching marker regex.

2. Claude qmd hook fix
- Read /Users/dongchanyoon/.claude/settings.json.
- Confirm qmd hook command is guarded: command -v qmd ... || true.
- Confirm JSON is valid.

3. Project planning artifacts
- Read docs/plans/2026-05-18-zettel-structure-to-writer-integration.md.
- Confirm it now contains Expanded Goal, Track Architecture, Track C, Track W, Phase B Roadmap, and risk section.
- Read docs/planning/06-tasks.md.
- Confirm it contains actionable tasks for Phase 0, B0, B1, B2, B3, and W; each task includes Objective, Allowed write paths, Forbidden paths, Acceptance criteria, Verification command/check, Suggested lane.

4. Scope
- Run git status --short.
- Confirm source-code changes are only the pre-existing 3 plugin source changes from earlier plus planning docs/staging; no new packages/** code modifications from this planning task.
- Confirm worker-check already passed if ledger is readable, or state that Main provided evidence: WORKER_WRITE_SCOPE_PASS personal-communication-studio-planning changed_paths=2.

Report:
- PASS/FAIL per section
- Any blockers before B0/B1 implementation
- End with REVIEW_DONE on its own line.
