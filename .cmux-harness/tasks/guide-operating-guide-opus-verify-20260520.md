# READ-ONLY VERIFY — 운영가이드

TASK_ID: guide-operating-guide-opus-verify-20260520
ROLE: docs-specialist / read-only verifier
MODEL_OR_LANE: Opus-Verify

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

READ_ONLY_PATHS:
- `운영가이드.md`
- `README.md`
- `CLAUDE.md`
- `package.json`
- `scripts/deploy-obsidian-plugins.sh`
- `docs/install-guide.md`
- `docs/planning/06-tasks.md`

FORBIDDEN:
- Do not edit files.
- Do not run deploy.
- Do not write vault files.

VERIFY:
1. `운영가이드.md` exists and is non-empty.
2. It includes project path, plugin ids, package map, core commands, W1/W2/W3 workflow, handoff JSON example, verification checklist, fork/PR push workflow, runtime/deploy caution, troubleshooting.
3. Check correctness against referenced docs where possible.
4. Confirm the Git verification command uses `git rev-list --left-right --count HEAD...fork/feat/ai-manuscript-studio-workflow-20260519` and includes `git push fork HEAD:feat/ai-manuscript-studio-workflow-20260519`.
5. Confirm it warns not to modify `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect` except explicit W4/separate task.
6. Run read-only checks only:
   - `git diff --check -- 운영가이드.md`
   - grep required tokens: `ai-manuscript-studio`, `zettel-connect`, `writing-handoff.json`, `PR #2`, `13.zettel-connect`, `--left-right --count`.
   - `git status --short -- 운영가이드.md`

REPORT:
- PASS or REQUEST_CHANGES.
- Any factual issues with line references.
- Evidence commands and outputs.
- Last line exactly: GUIDE_REVIEW_DONE or REQUEST_CHANGES
