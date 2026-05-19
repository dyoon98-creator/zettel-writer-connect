TASK_ID: B2.6-resume-after-compact-interruption
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 TypeScript/React 전문가입니다.
- 현재 B2.6 taxonomy overhaul 작업이 Claude compacting 직후 멈췄습니다. 이미 일부 파일이 수정되어 있으므로 현 working tree를 이어받아 완성하세요.
- 절대 vault deploy/commit/push 하지 마세요.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

CURRENT STATE:
- Previous dispatch B2.6-resume-complete-taxonomy-overhaul was partially executed.
- Sonnet pane showed edits through core test fixtures and then stopped around compaction.
- Do NOT restart from scratch. Inspect current diff and complete remaining compile/test failures.

FINAL GENRE TAXONOMY:
- investment-strategy-memo → 투자·전략 메모
- investment-report → 투자보고서
- legal-accounting-review → 법률·회계·계약 검토
- column-essay → 칼럼/에세이
- lecture-presentation → 강의·발표안
- long-form-manuscript → 장문 원고
Default genre: investment-strategy-memo.

FINAL TONE TAXONOMY:
- decision-memo → 간결한 의사결정체
- analytical-report → 분석적 보고체
- explanatory → 친절한 설명체
- column-narrative → 칼럼형 서술체
Default tone: decision-memo.
Tone is independent from genre. Do not auto-change genre when tone changes.

MUST COMPLETE NOW:
1. Run `git diff -- packages/core packages/obsidian-plugin apps/desktop docs/planning/06-tasks.md` to understand current partial state.
2. Fix all remaining compile/test errors caused by old Genre/ConceptTone literals.
3. Ensure these old active UI labels are absent from active ConceptWizard/NewProject UI source/tests except where explicitly mentioned in negative tests or historical docs:
   소설, 논픽션, 시나리오, 실용서, 유튜브 대본, 세계관/웹소설
4. Ensure ConceptWizard Step1Seed uses broad 글/문서 wording, not book-only wording like “어떤 책”.
5. Ensure tone option label is 문체·논조 or 문체/톤 and uses the final four tone options.
6. Ensure final six genre options are used in Step1Seed, WizardOverlay, NewProjectModal, core Templates/WizardEngine/PlanningMdWriter and obvious desktop mirror files.
7. Ensure tests cover final taxonomy and old-label absence.
8. Update docs/planning/06-tasks.md with B2.6 evidence if the file exists.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/apps/desktop/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/apps/desktop/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/plugins/**
- commit/push/release/deploy/vault install/external send.

VERIFY COMMANDS:
Run and report exact exit codes:
- pnpm --filter @ai-manuscript-studio/core test
- pnpm --filter @ai-manuscript-studio/obsidian-plugin test
- pnpm --filter @ai-manuscript-studio/core build
- pnpm --filter @ai-manuscript-studio/obsidian-plugin build
- If apps/desktop has scripts and practical: pnpm --filter @ai-manuscript-studio/desktop test/build, otherwise explain.
- Source scan for old active UI labels in packages/core, packages/obsidian-plugin/src, packages/obsidian-plugin/tests, apps/desktop/src, apps/desktop/tests.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
---
BUILD_DONE
Summary:
Changed files:
Final taxonomy:
Verification:
Old-label scan:
Notes/Risks:
