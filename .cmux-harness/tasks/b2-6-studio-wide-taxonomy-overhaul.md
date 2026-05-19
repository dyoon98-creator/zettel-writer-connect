TASK_ID: B2.6-studio-wide-taxonomy-overhaul
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 프론트엔드/TypeScript 전문가입니다.
- 이번 작업은 AI 원고실 작업실 전체에 남아 있는 과거 소설/실용서/유튜브/웹소설 중심 taxonomy를 대표님 실제 업무 체계로 교체하는 구조적 수정입니다.
- 단순 UI 라벨만 바꾸지 말고 core shared type, wizard UI, legacy desktop mirror, tests까지 일관되게 정리합니다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
대표님 지적: Obsidian AI 원고실 작업실/컨셉마법사 안에는 아직 과거 desktop-app UI가 남아 있다. 특히 Step1Seed의 톤(소설/에세이/논픽션/시나리오)과 장르(에세이/실용서/유튜브 대본/강의안/세계관/웹소설)가 대표님 장르와 맞지 않는다.
AI 원고실 작업실 전체를 final taxonomy로 정리한다.

FINAL GENRE TAXONOMY:
- investment-strategy-memo → 투자·전략 메모
- investment-report → 투자보고서
- legal-accounting-review → 법률·회계·계약 검토
- column-essay → 칼럼/에세이
- lecture-presentation → 강의·발표안
- long-form-manuscript → 장문 원고
Default genre: investment-strategy-memo.

FINAL TONE/VOICE TAXONOMY:
Tone must NOT be another genre selector. It answers “어떤 문체/논조로 쓸 것인가?” and should not auto-change genre.
Use this default set:
- decision-memo → 간결한 의사결정체
- analytical-report → 분석적 보고체
- explanatory → 친절한 설명체
- column-narrative → 칼럼형 서술체
Default tone: decision-memo.
Remove user-facing old tones: 소설, 논픽션, 시나리오. Do not use old keys in new UI state.

UX COPY CHANGES:
- ConceptWizard title may remain “컨셉 마법사” if necessary, but prefer “원고 기획 마법사” if low-risk.
- Replace “어떤 책을 쓰고 싶나요?” with wording that covers reports/memos/legal review/lectures/long-form writing, e.g. “어떤 글/문서를 만들까요?”
- Replace placeholder “어떤 책…” with “목적, 독자, 핵심 메시지를 한두 문장으로 알려주세요.”
- Label “톤” should become “문체/톤” or “문체·논조”.

STRUCTURAL REQUIREMENTS:
1. Update shared core `Genre` and `GENRE_LABEL_KO` in packages/core/src/types.ts to final six keys/labels. This should become the canonical source.
2. Prefer reusing core `Genre`/`GENRE_LABEL_KO` in NewProjectModal instead of maintaining a drift-prone local duplicate. If not feasible, ensure tests catch drift.
3. Update default genre fallbacks in core project readers/seeders from "essay" to "investment-strategy-memo" where they create new data or recover missing values.
4. Update project templates to support all six final genre keys. It is acceptable to use a generic template for several keys, but there must be no missing builder for any final Genre key.
5. Update ConceptTone in packages/core/src/project/schema.ts to final four keys and adjust isConceptDraftSession guard accordingly. If preserving legacy sessions is low-risk, add explicit migration/fallback in session load paths; otherwise do not show old options in UI.
6. Update packages/obsidian-plugin/src/studio/wizard/concept/Step1Seed.tsx:
   - final tone options and labels
   - final genre options and labels
   - default tone/genre as above
   - remove DEFAULT_GENRE_FOR_TONE auto-coupling or make it no-op; tone must not auto-change genre.
   - user-facing copy updated from “책” to broader “글/문서”.
7. Update packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx legacy overlay genre options/default from old five to final six.
8. Update apps/desktop mirror code if present for the same files/types, because user said desktop app 전체. At minimum mirror the changed wizard UI/type labels in apps/desktop/src/** and apps/desktop/tests/** if those paths compile or are still used.
9. Update tests or add source-contract tests so old labels do not come back:
   - Step1Seed no longer includes 소설/논픽션/시나리오/실용서/유튜브 대본/세계관/웹소설.
   - Step1Seed includes final tone labels and final genre labels.
   - Core GENRE_LABEL_KO exactly matches final six labels/order.
   - Tone changes do not auto mutate genre.
   - WizardOverlay legacy genre options no longer use old five labels.
10. Update docs/planning/06-tasks.md with B2.6 task/evidence.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/core/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/apps/desktop/src/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/apps/desktop/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/package.json
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/pnpm-workspace.yaml
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/CLAUDE.md

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- commit/push/release/deploy/vault install/external send.
- Do not edit packages/zettel-connect unless a compile error proves unavoidable; report first.

DEPENDENCIES:
- Current B2.5 final NewProjectModal source already has final six genres, but core/studio/wizard still have old taxonomy.
- Do not revert B2.3/B2.4/B2.5 work.

ACCEPTANCE_CRITERIA:
- No active user-facing Step1Seed/ConceptWizard/WizardOverlay labels contain old generic taxonomy: 소설, 논픽션, 시나리오, 실용서, 유튜브 대본, 세계관/웹소설.
- Final genre labels appear in both NewProjectModal and ConceptWizard Step1.
- Final tone labels appear in Step1.
- Tone and genre are independent dimensions; selecting/changing tone does not force-change the selected genre.
- Core types compile with final Genre and final ConceptTone keys.
- Tests cover the source contracts above.
- Run targeted tests for the changed plugin/core test files, then full `pnpm --filter @ai-manuscript-studio/core test` if available, `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`, and builds for core + obsidian-plugin. If apps/desktop tests/build are configured and practical, run them too; otherwise explain why skipped.

REQUIRED_EVIDENCE:
- List changed files.
- Show exact final genre and tone arrays from code.
- Test/build commands with exit codes.
- Old-label scan results for active packages/obsidian-plugin/src/studio/wizard and packages/core/src.
- Confirmation no deploy/commit/push/vault write performed.

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
