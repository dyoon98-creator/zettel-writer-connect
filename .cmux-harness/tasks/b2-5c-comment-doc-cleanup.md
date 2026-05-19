TASK_ID: B2.5c-comment-doc-cleanup
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 프론트엔드 전문가입니다.
- 이 작업은 B2.5b 검증자가 지적한 non-blocking hygiene cleanup입니다.
- 사용자-visible behavior는 바꾸지 말고, stale comments/docs만 최종 taxonomy와 Obsidian-first 방향에 맞춥니다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Opus-Verify B2.5b read-only review에서 나온 non-blocking gaps를 정리한다.

GAPS TO FIX:
1. packages/obsidian-plugin/src/settings.ts top comment still says settings moved to the Tauri desktop app. Update to Obsidian-native wording.
2. packages/obsidian-plugin/src/ProjectIndexerView.ts header comment still describes a button as opening an app. Update to Obsidian AI 원고실 작업실/view wording.
3. docs/planning/06-tasks.md B2.5 pre-amendment lines still mention superseded 8-genre/default invest-research state. Annotate or revise so the final B2.5b six-genre taxonomy is unambiguous. Preserve historical B2.5a/B2.5b evidence but avoid conflicting active statements.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/settings.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/ProjectIndexerView.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/NewProjectModal.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/NewProjectModal.test.ts

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- Any commit, push, deploy, vault install, or external send.

ACCEPTANCE_CRITERIA:
- No dev-facing comment in settings.ts or ProjectIndexerView.ts implies deep work is in a separate/Tauri desktop app.
- 06-tasks.md clearly marks earlier 8-genre/invest-research content as superseded by B2.5b or rewrites it to the final six-genre list.
- Active final taxonomy remains exactly:
  투자·전략 메모, 투자보고서, 법률·회계·계약 검토, 칼럼/에세이, 강의·발표안, 장문 원고.
- No runtime behavior changes intended.
- Run at least NewProjectModal tests and build (or full test if quick). Report exit codes.

REQUIRED_EVIDENCE:
- Diff summary.
- Test/build evidence.
- Confirmation no deploy/commit/push.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
---
BUILD_DONE
Summary:
Changed files:
Verification:
Notes/Risks:
