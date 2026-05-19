TASK_ID: B2.5d-doc-evidence-label-fix
ROLE: docs-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 문서 정합성 검토자입니다.
- 이번 작업은 docs/planning/06-tasks.md의 B2.5 문서 안에서 historical evidence와 final evidence가 혼동되지 않도록 문구만 고치는 초소형 cleanup입니다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
docs/planning/06-tasks.md line around B2.5 "Completion evidence" still says `NewProjectGenre 8종` and `17 tests/116 tests` without clearly marking it as superseded historical evidence. Update this section so the active B2.5 completion evidence reflects final B2.5b/B2.5c state: 6 genres, 19 NewProjectModal tests, 118 tests, build exit 0. Preserve historical B2.5a/B2.5b amendment notes if useful, but no active statement should imply 8 genres are current.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/NewProjectModal.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/NewProjectModal.test.ts

FORBIDDEN_PATHS:
- packages/** writes
- vault install/deploy
- commit/push

ACCEPTANCE_CRITERIA:
- In B2.5 active completion evidence, no unqualified "8종" or "17 tests" / "116 passed" remains as current state.
- Final active evidence says six genres / 19 NewProjectModal tests / 118 total tests / build exit 0.
- Historical initial draft can remain only if explicitly marked superseded.
- No code changes.

VERIFY:
- Read the edited section and report line summary.
- No tests required because docs-only; do not run long commands unless you choose.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
---
BUILD_DONE
Summary:
Changed files:
Verification:
Notes/Risks:
