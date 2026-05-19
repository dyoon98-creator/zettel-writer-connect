# Worker Task: Update plan and create 06-tasks for Personal Communication Studio

TASK_ID: personal-communication-studio-planning
ROLE: docs-specialist / task-planner
MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

OBJECTIVE
Update the existing integration plan so it no longer frames ai-manuscript-studio only as a Zettel bridge. Add a new Track C: 대표님 문체 기반 커뮤니케이션 스튜디오. Then create docs/planning/06-tasks.md with actionable tasks for both Track W (Zettel bridge) and Track C (independent communication studio), prioritizing fast value B0/B1.

ALLOWED_WRITE_PATHS
- docs/plans/2026-05-18-zettel-structure-to-writer-integration.md
- docs/planning/06-tasks.md

READ_ONLY_PATHS
- LOCAL_KW_INSTALL_REVIEW_20260518.md
- packages/obsidian-plugin/src/studio/voice/VoicePane.tsx
- packages/obsidian-plugin/src/studio/voice/analyzeStyle.ts
- packages/obsidian-plugin/src/studio/voice/styleGuide.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/studio/research/voiceRewriter.ts
- packages/obsidian-plugin/src/studio/research/ResearchItemView.tsx
- packages/core/src/coach/templates.ts
- packages/core/src/ai/Phase2Actions.ts
- packages/core/src/actions/ActionRegistry.ts
- packages/core/src/skillpack/types.ts
- packages/core/src/skillpack/SkillPackLoader.ts
- packages/core/src/wizard/*
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/src/tauriShims/plugin-dialog.ts
- .cmux-harness/tasks/plan-review-personal-communication-studio-20260518.md

FORBIDDEN_PATHS
- packages/** source code
- package.json / pnpm-lock.yaml
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- any .obsidian/plugins runtime folder
- deploy scripts

KEY STRATEGIC DECISION TO REFLECT
Representative clarified:
"나의 문체 기반으로, 이메일 카카오톡 텔레그램, 보고서, 요약 보고자료, 메모 다양한 형식을 글을 쓰는 것이 중요하다. 영구노트/구조노트 내 문체 작성은 그중 한 부분이고 zettel과 연결되는 것이다."

Therefore:
- Track W = Zettel/Structure → 4.Writing 원고 프로젝트 bridge.
- Track C = Personal Communication Studio for email/KakaoTalk/Telegram/report/briefing/memo using representative voice.
- Track C is not subordinate to Track W. Zettel is just one input/source among many.

PLANNING REVIEW FINDINGS TO INCORPORATE
- Current plan misses format/register as first-class concept.
- Existing code has no email/kakao/report/memo format union; Genre is essay/practical/youtube/lecture/world. Do NOT recommend expanding Genre first.
- SaveTarget is feedback/revising/materials/draft/plan; no external send target. Keep draft/preview/copy only.
- Voice is currently global single StyleGuide; register-specific voice needs later B3.
- Quick one-off compose flow is missing; current 4.Writing/project + wizard is too heavy for Kakao/Telegram.
- Built-ins and 62 coach actions are mostly revision/coaching; need intent→message generation prompts.
- Privacy/corpus governance is critical: no whole-vault auto-learning; only user-approved allow-list corpus.
- Fast value: B0/B1 skillpack-only first, core code diff 0 if possible.

REQUIRED PLAN UPDATE
Modify docs/plans/2026-05-18-zettel-structure-to-writer-integration.md by adding:
1. A new section near the top: "Expanded Goal: Representative Voice Communication Studio".
2. A Track architecture section:
   - Track W — Zettel/Structure Writing Bridge
   - Track C — Personal Communication Studio
3. A Phase B roadmap:
   - B0 Voice corpus governance + Obsidian voice smoke test
   - B1 Communication skillpack MVP: email, kakao, telegram, report, summary briefing, memo
   - B2 Quick Compose UX: command/modal/preview/copy, no external sending
   - B3 Register-specific voice guides: base + email/kakao/report/memo deltas
   - B4 Zettel-to-comms bridge: structure note → briefing/report/memo format
4. A risk section covering privacy, direct sending, global voice flattening, Obsidian shim/folder picker, upstream drift.
5. A revised one-line recommendation: run Track C B0/B1 first for fast value while keeping Track W bridge as separate workstream.

REQUIRED 06-TASKS.md
Create docs/planning/06-tasks.md. It should be practical for cmux-harness build. Use checkboxes. Include task IDs and write scopes. Split into phases:

Phase 0 — Safety and installation gates
- C0.1 Verify current staging vs vault unchanged
- C0.2 Verify voice feature in Obsidian plugin mode after install approval (manual smoke checklist)
- C0.3 Define privacy corpus rule: allow-list sample files only

Phase B0 — Voice corpus and no-code proof
- B0.1 Design folder/corpus convention for representative voice samples; no secrets by default
- B0.2 Create sample-corpus README/template paths under 4.Writing or _attachments/voice? Make recommendation only; do not write vault files yet
- B0.3 Verify skillpack action can inject/use style guide without core modification

Phase B1 — Communication skillpack MVP
Tasks for six prompt files/actions:
- email-polish / email-draft
- kakao-short
- telegram-brief
- report-polish
- summary-briefing
- memo-capture
Keep external sending forbidden.

Phase B2 — Quick Compose UX (future core change)
- Add Obsidian command
- Modal fields: input intent, register, recipient/context, length, tone, source text
- Preview + copy/insert only

Phase B3 — Register-specific voice guides (future core change)
- registry of style guides per register
- corpus manifest and exclusion tags
- tests

Phase W — Zettel bridge continuation
- W1 active structure note import command
- W2 sourceNotes context consumption
- W3 handoff JSON import
- W4 optional Zettel Connect send-to-writer button, only after W1/W2

Each task must include:
- Objective
- Allowed write paths
- Forbidden paths
- Acceptance criteria
- Verification command/check
- Suggested lane: Sonnet-Executor / GPT-Executor / Planning Review / Opus-Verify

IMPORTANT SCOPE
- Do not actually implement code.
- Do not install to Obsidian vault.
- Do not alter 13.zettel-connect.
- Do not create real voice samples.
- Do not create skillpack files yet; tasks only.
- Do not commit.

REQUIRED EVIDENCE
At end, report:
- Files changed
- Brief diff summary
- Whether only allowed paths changed
- Any unresolved decisions
- End with BUILD_DONE on its own line.
