# TASK_ID: b2-5-representative-genres

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- Senior frontend/Obsidian plugin specialist.
- Follow TDD: add failing tests first, then minimal implementation.
- Preserve Obsidian-first product direction; remove stale “desktop app” wording from user-facing UI involved in new project creation.

MODEL_OR_LANE: Sonnet-Executor

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

PROBLEM:
User confirms AI 원고실 right sidebar appears and NewProjectModal works. However:
1. Genre dropdown is generic: 에세이, 실용서, 유튜브 대본, 강의안, 세계관/웹소설.
2. UI still says “데스크톱 앱에서 사용/열기”, but current implementation actually opens Obsidian `openStudio(result.folderPath)` when `openInApp` is true. This wording is stale and confusing.

OBJECTIVE:
Tailor the NewProjectModal genre list and adjacent copy to the representative’s actual writing workflow: investment/research/legal-accounting/strategy/report/briefing/column/presentation/script. Also replace desktop-app wording with Obsidian in-vault AI 원고실 wording.

ALLOWED_WRITE_PATHS:
- packages/obsidian-plugin/src/NewProjectModal.ts
- packages/obsidian-plugin/src/ProjectIndexerView.ts
- packages/obsidian-plugin/src/settings.ts
- packages/obsidian-plugin/tests/NewProjectModal.test.ts
- docs/planning/06-tasks.md

READ_ONLY_PATHS:
- packages/obsidian-plugin/src/createProject.ts
- packages/obsidian-plugin/tests/* existing tests
- packages/obsidian-plugin/jest.config.cjs
- packages/obsidian-plugin/tsconfig.test.json

FORBIDDEN_PATHS:
- packages/core/**
- apps/desktop/**
- packages/zettel-connect/**
- Obsidian vault paths under /Users/dongchanyoon/Library/CloudStorage/**
- deploy/install/commit/push/release

ACCEPTANCE_CRITERIA:
1. RED first: add tests for the new genre labels and stale wording removal. Source-contract is acceptable if direct modal import is awkward; but if importing `NewProjectModal.ts` works, prefer real exports tests.
2. Replace genre type/labels with this set, in this order:
   - 투자/리서치 메모
   - 산업·시장 분석
   - 보고서/브리핑
   - 법률·회계·계약 검토
   - 전략 메모
   - 칼럼/에세이
   - 강의·발표안
   - 원고/스크립트
3. Default genre should be `투자/리서치 메모`.
4. Remove stale desktop-app language from NewProjectModal visible copy:
   - Remove/replace “데스크톱 앱”, “URL scheme”, “앱이 그 프로젝트로 부팅됩니다.”
   - Toggle label should be “만든 뒤 Obsidian 원고실에서 열기” or equivalent.
   - Description should say it opens the project in Obsidian AI 원고실.
5. In ProjectIndexerView and settings copy, replace “깊은 작업은 별도 데스크톱 앱…” / “원고 작성·AI 액션·스킬팩은 별도 데스크톱 앱…” with Obsidian-first wording.
6. Preserve the current behavior: `input.openInApp` may remain as internal field for minimal change, but user-facing copy must not claim it opens a desktop app. Creating a project with the toggle ON should still call `this.plugin.openStudio(result.folderPath)`.
7. Update docs/planning/06-tasks.md with a concise B2.5 note/evidence. Do not rewrite the whole file.

REQUIRED_EVIDENCE:
- RED output showing tests failed before implementation.
- GREEN targeted test output.
- Full plugin test output.
- Build output.
- Changed files summary.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
- BUILD_DONE
- Summary
- RED evidence
- GREEN/full/build evidence
- Changed files
- Residual risks
