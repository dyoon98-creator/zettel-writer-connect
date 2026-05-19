# TASK_ID: scrivener-philosophy-integration

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 시니어 프론트엔드/제품 UX 전문가. Writing tools의 product philosophy를 active UX, prompts, tests, docs에 녹인다.
- 단순 용어 삽입이 아니라 실제 workflow contract를 강화한다.
- Obsidian plugin이 현재 제품이고 desktop app은 legacy라는 제약을 지킨다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Scrivener에서 온 글쓰기 철학이 우리 AI 원고실에 이미 얼마나 들어가 있는지 문서화하고, 부족한 부분을 active Obsidian 원고실의 프롬프트/템플릿/테스트에 녹여라.

대표님 의도:
- 유료 Obsidian writing plugin 쪽에서 일부 철학이 Scrivener에서 왔다고 함.
- 우리 AI 원고실도 그 철학을 이해하고 있어야 한다.
- 하지만 단어만 복사하지 말고, 대표님의 투자보고서/고객보고/법률회계/장문 글쓰기 workflow에 맞게 녹여야 한다.

RESEARCH EVIDENCE FROM MAIN:
Official Scrivener source pages fetched from Literature & Latte:
- https://www.literatureandlatte.com/scrivener/overview
- https://www.literatureandlatte.com/scrivener/features
- https://www.literatureandlatte.com/scrivener
- https://www.literatureandlatte.com/learn-and-support/user-guides

Key Scrivener philosophy/features found:
1. “Typewriter. Ring-binder. Scrapbook.” — drafting, structure, and research in one project, but with distinct roles.
2. Binder/ring-binder metaphor — long documents are broken into sections/documents/folders.
3. Corkboard — each section has an index card/synopsis; moving cards rearranges the manuscript.
4. Outliner — overview with synopsis, word counts, metadata; structure can be rearranged.
5. Scrivenings mode — write small sections separately, but read/edit selected pieces as one continuous document.
6. Research within reach — background material is kept next to the manuscript.
7. Snapshots — before major revisions, freeze a section and compare/restore later.
8. Compile/export — writing format and final output format are separate; export to Word/PDF/etc.
9. Metadata/status/labels/collections/targets — progress and classification are first-class.
10. Scrivener “won’t tell you how to write” — it provides structure/tools; user remains author.

CURRENT REPO FINDINGS:
Already present:
- `packages/core/src/project/schema.ts` line 1: “Scrivener식 다중 파일 프로젝트 구조.”
- `ProjectMeta` + `binder.json` + `SceneFrontmatter`: project/binder/scene structure.
- `BinderNode.synopsis`, `status`, `label`, `customMetadata`: corkboard/outliner data model foundations.
- `BinderIO.ts`: add/remove/move/path/walk for binder tree.
- `SnapshotIO.ts`: explicitly says Scrivener Snapshots role.
- `Templates.ts`: canonical 7 sections 기획/뼈대/자료/초안/피드백/퇴고 메모/최종본.
- `apps/desktop/src/editor/ScrivenerEditor.tsx`: Scrivenings mode exists, but desktop is legacy and not current product.

Gap:
- Active Obsidian plugin wizard/prompts/templates do not sufficiently expose Scrivener-style workflow:
  - section granularity / binder pieces
  - synopsis/index-card thinking
  - outline/corkboard separation from prose
  - research/source separation
  - snapshot-before-revision habit
  - compile/output separation from writing tone/genre
  - user-as-author, AI-as-structure/coach principle

IMPORTANT CONSTRAINTS:
- Current product is Obsidian plugin (`packages/obsidian-plugin`), NOT desktop app. Do not build desktop UI.
- Do not copy Scrivener branding into user-facing UI as if we are Scrivener. It can be described in docs as “Scrivener-inspired philosophy”; product language should be Korean/representative workflow terms.
- Keep delivery channel separate from genre/tone. Word/PPT/Telegram = output/channel, not genre/tone.
- Preserve /structure principles: claim, evidence, counterpoint/downside, invalidation trigger, action, client caveat.
- Do not commit/push/deploy/vault install.

ALLOWED_WRITE_PATHS:
- docs/planning/**
- packages/core/src/project/Templates.ts
- packages/core/tests/Templates.test.ts
- packages/obsidian-plugin/src/studio/wizard/concept/conceptPrompts.ts
- packages/obsidian-plugin/src/studio/wizard/prompts/*.md
- packages/obsidian-plugin/tests/studio/wizard/**
- .cmux-harness/logs/**

FORBIDDEN_PATHS:
- apps/desktop/**
- packages/zettel-connect/**
- vault runtime install folders
- commit/push/deploy
- package.json / lockfiles unless strictly necessary, which should not be needed

TASKS:
1. Add a concise design note, e.g. `docs/planning/scrivener-philosophy-integration.md`, with:
   - external Scrivener principles from the sources above
   - mapping to current code foundations
   - what will be integrated now vs deferred
   - clear warning: desktop legacy has Scrivenings but active Obsidian plugin must receive the philosophy through prompts/templates/workflow.

2. Update active concept/wizard prompts so AI asks and summarizes using Scrivener-style workflow where appropriate:
   - For investment-report / investment-strategy-memo / legal-accounting-review:
     - Ask not only thesis/evidence/risk, but also “section/binder pieces”: 어떤 조각으로 나눌 것인가?
     - Treat each section as a card with a synopsis: 목적, 핵심 주장, 근거, 자료 위치.
     - Separate research/source notes from draft prose.
     - Remind snapshot-before-major-revision as a workflow habit when moving to revision, not as a question every time.
     - Keep compile/output as final channel/format, not genre/tone.
   - For column/long-form/lecture genres:
     - Keep narrative freedom but still use small pieces/cards/outline and research separation.
   - Avoid overloading first question. Keep one-question-at-a-time rule.

3. Update `Templates.ts` only if useful and backward-compatible:
   - Keep the canonical 7 H2 sections unchanged.
   - Add comments/prompts inside relevant sections to reflect binder/card/research/compile thinking.
   - Do not rename H2 sections unless tests/docs require it.

4. Add/update tests:
   - Tests prove investment prompt includes Scrivener-style concepts without using channel as genre/tone.
   - Tests prove Templates still have canonical 7 sections but include “카드/시놉시스/자료/출력” or equivalent workflow guidance.
   - Tests prove no active prompt tells AI to decide authorship for the user; user remains final author/decision-maker.
   - If using the word Scrivener in active user-facing prompts, justify. Prefer not to; docs can mention Scrivener, prompts should use generic Korean workflow terms.

5. Run:
   - `pnpm --filter @ai-manuscript-studio/core test -- Templates`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand tests/studio/wizard/conceptPrompts.test.ts tests/studio/wizard/planningPrompts.contract.test.ts`
   - `pnpm --filter @ai-manuscript-studio/core test`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand`
   - `pnpm --filter @ai-manuscript-studio/core build`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`

ACCEPTANCE_CRITERIA:
- The design note clearly answers: “Scrivener philosophy is already partly in the engine, but not yet sufficiently in active Obsidian UX/prompts.”
- Active prompts now reflect: binder pieces, card/synopsis, outliner view, research separation, snapshot-before-revision, compile/output separation.
- Investment/legal/customer-report prompts remain structure-note-grade and do not regress into fiction/essay coaching.
- Output channels remain separate from genre/tone.
- No desktop legacy edits.
- Full core/plugin test/build pass.

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
1. Research synthesis
2. What was already present
3. What was integrated now
4. Changed files
5. Tests/builds run with exit codes
6. Any risks/deferred items
7. Final marker: BUILD_DONE
