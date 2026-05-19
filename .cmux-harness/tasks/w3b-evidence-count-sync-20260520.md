# TASK PACKET — W3B evidence count sync

TASK_ID: w3b-evidence-count-sync-20260520
ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY:
- Documentation specialist for precise planning ledger/evidence updates.
- Make only the requested narrow docs edit.
- Do not edit code or tests.

OBJECTIVE:
Synchronize W3 completion evidence counts in `docs/planning/06-tasks.md` with Main fresh verification after W3A path-rejection tests.

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md`

FORBIDDEN_PATHS:
- Any source/test file.
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`
- User vault files and runtime plugin folders.

REQUIRED EDIT:
In the W3 Handoff JSON import completion evidence, update full obsidian-plugin test count from `265/265 PASS` to `268/268 PASS`.
Keep targeted count as `29/29 PASS`.
Do not change anything else.

VERIFY:
- `git diff --check -- docs/planning/06-tasks.md`
- grep/read the W3 evidence line and report it.

Last line exactly:
W3B_DOC_DONE
