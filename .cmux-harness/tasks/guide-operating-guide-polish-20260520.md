# TASK PACKET — 운영가이드 보정

TASK_ID: guide-operating-guide-polish-20260520
ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY:
- Documentation Specialist for precise operating-guide corrections.
- Make only the requested narrow guide edits.
- Do not edit code or tests.

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/운영가이드.md`

REQUIRED EDITS:
1. In section 8 Git / Push workflow, replace `git rev-list --count HEAD...fork/feat/ai-manuscript-studio-workflow-20260519` with `git rev-list --left-right --count HEAD...fork/feat/ai-manuscript-studio-workflow-20260519`.
2. Add the actual fork push command in that section:
   `git push fork HEAD:feat/ai-manuscript-studio-workflow-20260519`
3. In troubleshooting, remove or neutralize the line that says `plugins/ai-manuscript-studio/ untracked` because it is not a stable current-state assumption. Replace with a general note: "untracked build/staging artifacts appear → inspect before staging; commit only intentional source/docs/harness evidence".
4. Keep the guide concise and Korean.

VERIFY:
- `git diff --check -- 운영가이드.md`
- grep that `--left-right --count` and the fork push command appear.

Last line exactly:
GUIDE_POLISH_DONE
