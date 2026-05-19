TASK_ID: B2.5b-readonly-verify
ROLE: frontend-specialist
MODEL_OR_LANE: Opus-Verify
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Read-only verify B2.5b final genre taxonomy and stale desktop-app wording changes. Do not edit files.

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/NewProjectModal.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/NewProjectModal.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/settings.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/ProjectIndexerView.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

FORBIDDEN:
- Do not write/edit/create/delete files.
- Do not deploy, install to vault, commit, push, or run external sends.

VERIFY AGAINST REQUIREMENTS:
1. GENRE_LABEL_KO in NewProjectModal.ts has exactly six labels, in order:
   - 투자·전략 메모
   - 투자보고서
   - 법률·회계·계약 검토
   - 칼럼/에세이
   - 강의·발표안
   - 장문 원고
2. Default/first key is investment-strategy-memo and default label is 투자·전략 메모.
3. Removed/merged labels are not active genres: 산업·시장 분석, 투자메모 standalone, 전략 메모 standalone, 투자/리서치 메모, 보고서/브리핑, 원고/스크립트.
4. 이메일/카톡/카카오톡/텔레그램/Telegram are not genre labels. They may appear only in tests/docs as negative assertions or channel explanation.
5. NewProjectModal UI copy no longer says stale desktop app open/call text; the modal toggle says Obsidian 원고실.
6. settings.ts and ProjectIndexerView.ts no longer present stale “별도 데스크톱 앱에서 사용/진행” user-facing copy from B2.5 scope.
7. Tests exist for final taxonomy and negative channel assertions.
8. Main fresh verification evidence to consider:
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- NewProjectModal.test.ts`: exit 0, 19/19 pass.
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`: exit 0, 13 suites / 118 tests pass.
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`: exit 0.

OPTIONAL READ-ONLY COMMANDS:
You may run grep/search/read-only shell commands and tests with cache minimized if you choose, but do not modify files. If test commands generate cache files, report it.

EXPECTED_MARKER: REVIEW_DONE
REPORT_FORMAT:
---
REVIEW_DONE
Verdict: PASS or REQUEST_CHANGES
Evidence:
Gaps/Risks:
