# READ-ONLY Planning Review Task: Personal Communication Studio Expansion

WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
ROLE: Planning Review / critical product-strategy reviewer
MODE: READ ONLY. Do not modify files. Do not run deploy. Do not write code.
EXPECTED_MARKER: REVIEW_DONE

Context:
- The current plan file is docs/plans/2026-05-18-zettel-structure-to-writer-integration.md.
- It currently frames ai-manuscript-studio mostly as a downstream bridge from 13.zettel-connect / 3.Structure / 2.Permanent to 4.Writing.
- The representative clarified the actual target:
  "나의 문체 기반으로, 이메일 카카오톡 텔레그램, 보고서, 요약 보고자료, 메모 다양한 형식을 글을 쓰는 것이 중요하다. 영구노트/구조노트 내 문체 작성은 그중 한 부분이고 zettel과 연결되는 것이다."

Known code evidence already inspected:
- packages/obsidian-plugin/src/studio/voice/VoicePane.tsx
- packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
- packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/studio/research/voiceRewriter.ts
- packages/obsidian-plugin/src/studio/research/ResearchItemView.tsx
- packages/core/src/coach/templates.ts
- packages/core/src/ai/Phase2Actions.ts
- packages/core/src/actions/ActionRegistry.ts
- packages/core/src/skillpack/SkillPackLoader.ts
- packages/core/src/wizard/*
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/src/tauriShims/plugin-dialog.ts

Confirmed capabilities:
- Voice/내 문체: 14-stage style analysis and StyleGuide generation from .md samples.
- Research result → select text → "내 문체로 본문에 삽입" via voiceRewriter.
- 62 Coach actions across 7 categories.
- 7 built-in Korean writing actions.
- Skillpack system loads _skillpacks/<id>/skillpack.json + prompt files.
- Wizard flow motive → audience/message → tone → structure-pick.
- Obsidian shim implements voice file operations; native folder picker is not functional in Obsidian mode.

Please review the strategic plan gap and produce:
1. What is missing if we treat this as a representative-style communication studio, not just zettel bridge?
2. What should the product architecture become? Suggest tracks/phases.
3. What should be in Phase B0/B1/B2/B3 etc. for independent use cases?
4. What tasks should go into docs/planning/06-tasks.md later?
5. Identify any risks, especially privacy, sample corpus design, direct sending side effects, Obsidian plugin limitations, and whether skillpack-only is enough or core UI changes are required.
6. Give one recommended execution order with fast value first.

Constraints:
- Do not overwrite 13.zettel-connect.
- Do not repo-wide deploy.
- Writing folder is 4.Writing.
- No direct Gmail/Kakao/Telegram sending in first iteration; drafting/preview/copy only.
- Existing paid/private code license and update path must be respected; keep customizations minimal and isolated.
- Main/Hermes will verify evidence before any final claim.

Report format:
- Executive conclusion
- Missing pieces
- Proposed architecture
- Task breakdown
- Risks and mitigations
- Final recommendation
- End with REVIEW_DONE on its own line.
