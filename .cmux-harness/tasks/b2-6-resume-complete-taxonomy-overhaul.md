TASK_ID: B2.6-resume-complete-taxonomy-overhaul
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 TypeScript/React 전문가입니다.
- 이전 B2.6 attempt는 core/src/types.ts와 core/src/project/schema.ts만 부분 수정한 뒤 멈췄습니다. 현재 working tree가 부분 변경 상태이므로, 이를 이어받아 compile-clean하게 완성하세요.
- 절대 vault deploy/commit/push 하지 마세요.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

CURRENT STATE / ROOT CAUSE:
- User reported live ConceptWizard still shows old desktop-era options: tones 소설/에세이/논픽션/시나리오 and genres 에세이/실용서/유튜브 대본/강의안/세계관/웹소설.
- The previous install was only a partial B2.5 fix: NewProjectModal had final genre keys, but core shared Genre and ConceptWizard still used old taxonomy.
- A previous B2.6 worker started changes and then stalled after editing:
  - packages/core/src/types.ts: Genre changed to final six keys.
  - packages/core/src/project/schema.ts: ConceptTone changed to final four keys and guard updated.
- Because those two files are partially changed, many other old references now need completion.

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

MUST COMPLETE:
1. Fix all compile errors caused by changed Genre/ConceptTone.
2. Update packages/core/src/project/Templates.ts so BUILDERS is a complete Record<Genre, () => string> for final six keys. Generic templates are OK, but labels/sections should fit representative workflow. Remove or stop using old builders as active keys.
3. Update fallbacks in packages/core/src/** from old "essay" where used as Genre default to "investment-strategy-memo". Update old tone defaults to "decision-memo".
4. Update packages/core/src/wizard/WizardEngine.ts, PlanningMdWriter.ts and any other core users of old genre keys.
5. Update packages/obsidian-plugin/src/NewProjectModal.ts to import/use core GENRE_LABEL_KO and Genre if feasible, avoiding drift. If not feasible, keep local type but prove same labels/order in tests.
6. Update packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx:
   - title/prompt: broad “글/문서” not “책” only.
   - tone label: “문체·논조” or “문체/톤”.
   - final tone options; default decision-memo.
   - final genre options from core GENRE_LABEL_KO if feasible; default investment-strategy-memo.
   - remove DEFAULT_GENRE_FOR_TONE auto-coupling.
7. Update packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx legacy genre options/default to final six/default.
8. Update apps/desktop mirror source/tests for the same taxonomy where practical, since user said desktop app 전체. If apps/desktop is not part of build, still update obvious mirrored files: apps/desktop/src/wizard/concept/Step1Seed.tsx, apps/desktop/src/wizard/WizardOverlay.tsx, apps/desktop/src/state/conceptWizardStore.ts or tests with old tone/genre literals if present.
9. Add/update tests:
   - core type/label taxonomy exact six labels/order.
   - Step1Seed source-contract or render test: old labels absent; final tone/genre labels present; text says 글/문서 not “어떤 책”.
   - NewProjectModal still final six.
   - If practical, test tone change does not mutate genre.
10. Update docs/planning/06-tasks.md with B2.6 evidence.

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
- packages/zettel-connect/** unless impossible to compile without it; report first.
- commit/push/release/deploy/vault install/external send.

VERIFY COMMANDS:
Run and report exact exit codes:
- pnpm --filter @ai-manuscript-studio/core test (or explain no test script)
- pnpm --filter @ai-manuscript-studio/obsidian-plugin test
- pnpm --filter @ai-manuscript-studio/core build
- pnpm --filter @ai-manuscript-studio/obsidian-plugin build
- If apps/desktop has scripts and practical: pnpm --filter @ai-manuscript-studio/desktop test/build, otherwise explain.
Also run a source scan showing old active UI labels absent in Step1Seed/WizardOverlay:
소설, 논픽션, 시나리오, 실용서, 유튜브 대본, 세계관/웹소설.

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
