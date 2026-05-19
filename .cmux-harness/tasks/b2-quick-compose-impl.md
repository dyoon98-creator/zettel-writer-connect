# B2 Quick Compose implementation — TDD task

TASK_ID: b2-quick-compose-impl
ROLE: frontend-specialist + test-specialist
MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

## Objective
Implement B2 Quick Compose MVP for the Obsidian plugin, with tests first.

The user wants a fast command-palette flow for representative-voice communication drafts, not external sending.

## Inputs / SSOT
Read these first:
- docs/planning/b2-quick-compose-spec.md
- docs/planning/b1-comms-skillpack-usage.md
- docs/planning/06-tasks.md, especially B2.1/B2.2/B2.3
- packages/obsidian-plugin/src/main.ts
- packages/obsidian-plugin/src/NewProjectModal.ts
- packages/obsidian-plugin/src/adapters/appSettings.ts
- packages/obsidian-plugin/src/adapters/aiBridge.ts
- packages/obsidian-plugin/tests/__mocks__/obsidian.ts

Opus-Verify found SSOT drift before coding:
- docs/planning/b2-quick-compose-spec.md says command name: `AI 원고실: 즉석 커뮤니케이션 작성`
- Spec has 6 fields: register, intent, source, reader, length, style mode
- 06-tasks.md B2.1 still has older command/5-field stub. Reconcile B2.1 to point to the spec or match it before implementing.

## Allowed write paths
Only these paths may be edited/created:
- docs/planning/06-tasks.md
- packages/obsidian-plugin/src/main.ts
- packages/obsidian-plugin/src/QuickComposeModal.ts
- packages/obsidian-plugin/src/quickCompose.ts
- packages/obsidian-plugin/src/studio/styles/global.css
- packages/obsidian-plugin/tests/quickCompose.test.ts
- packages/obsidian-plugin/tests/QuickComposeModal.test.ts
- packages/obsidian-plugin/tests/mainQuickComposeCommand.test.ts
- packages/obsidian-plugin/tests/__mocks__/obsidian.ts

## Forbidden paths
Do not modify:
- packages/core/**
- packages/zettel-connect/**
- scripts/deploy-obsidian-plugins.sh
- plugins/** staging output
- any Obsidian vault path under /Users/dongchanyoon/Library/CloudStorage/**
- package.json / pnpm-lock.yaml unless impossible; if impossible, stop and report.
- commit/push/deploy/install/copy to vault.

## Required implementation behavior

### 1. Command
Add an Obsidian command in packages/obsidian-plugin/src/main.ts:
- id: choose stable English id, e.g. `quick-compose-communication`
- name exactly: `즉석 커뮤니케이션 작성`
Obsidian displays plugin prefix itself, so internal command name can omit `AI 원고실:`.
Callback opens QuickComposeModal.

### 2. Modal
Create `QuickComposeModal.ts` using Obsidian `Modal`/DOM APIs, similar style to NewProjectModal.
Fields:
- register select: email / kakao / telegram / report / summary / memo
- intent textarea (required)
- source textarea (optional). Pre-fill with active Markdown editor selected text if safely available; if not, blank is OK.
- reader text input (optional)
- length select: 짧게 / 보통 / 길게
- style mode select: manual only for B2, with disabled/notice text that automatic style application is B3.
- style guide textarea for manual paste. Label should tell user to paste VoicePane compressed prompt.

Output area:
- Preview/result text area or pre block.
Buttons:
- `생성`
- `복사`
- `현재 파일에 삽입`
- `닫기`
No external send buttons. No Gmail/Kakao/Telegram API.

### 3. Prompt/action routing
Create `quickCompose.ts` pure helper(s). Must include:
- Register -> B1 action id route table:
  - email -> `comms.email-draft`
  - kakao -> `comms.kakao-short`
  - telegram -> `comms.telegram-brief`
  - report -> `comms.report-polish`
  - summary -> `comms.summary-briefing`
  - memo -> `comms.memo-capture`
- `buildQuickComposePrompt(input)` that produces a Korean prompt preserving B1 semantics:
  - representative voice draft, no external sending
  - if style guide is provided, apply it
  - if source exists, treat as reference/source text
  - report polish must not invent facts or change numbers/conclusions
  - summary must prefer 현황/핵심/시사점
  - kakao should be short unless length says otherwise
- Keep this helper pure and well-tested.

Dynamic skillpack loading is optional for this MVP. If you implement it, keep it inside allowed paths and do not add package dependencies. If too large, use the route table and prompt semantics above.

### 4. AI invocation
Use existing Obsidian adapter layer, not new external APIs.
Recommended minimal path:
- Load app settings via `new ObsidianAppSettingsStore(plugin).load()` from `src/adapters/appSettings.ts`.
- If provider is mock or binary path missing, do not crash; show clear Notice/error in the modal.
- Otherwise call `startAiInvocation` from `src/adapters/aiBridge.ts` with:
  - provider: settings.aiProvider
  - binaryPath: codexPath or claudeCodePath based on provider
  - extraArgs: split codexExtraArgs by whitespace
  - prompt: buildQuickComposePrompt(...)
  - timeoutSecs: 300
- Await handle.done and display result.fullText.
- During running, disable generate button or show status.

### 5. Copy / insert
- Copy uses `navigator.clipboard.writeText(result)` with Notice fallback/errors.
- Insert should target the active Markdown editor if available using Obsidian editor command API. If no editor/result, show Notice and do nothing.
- Do not create files in B2 MVP.

### 6. Docs task reconciliation
Update docs/planning/06-tasks.md B2.1/B2.2/B2.3 so:
- B2.1 command name and field list match b2-quick-compose-spec.md, or B2.1 explicitly delegates details to that spec.
- Mark B2.1 [x] only if the spec reconciliation is complete; do not mark B2.2/B2.3 complete unless implementation/tests satisfy them.
- Add completion evidence for B2.2 if implemented.

## TDD requirements
Before production code:
1. Write tests for quickCompose route table and prompt behavior.
2. Run the targeted test and capture failure (RED). It should fail because helper/module does not exist or behavior is missing.
3. Implement minimal code.
4. Re-run targeted test and make it pass.
5. Add modal/command tests if feasible using existing Obsidian mock; update mock only within allowed path.

## Suggested tests
- `quickCompose.test.ts`
  - route table maps each register to correct comms.* action id.
  - build prompt includes no external sending.
  - build prompt includes style guide if supplied.
  - report prompt contains fact/no-number-change guard.
  - summary prompt contains 현황/핵심/시사점.
- `QuickComposeModal.test.ts`
  - modal renders required fields and buttons.
  - generate disabled/no-op or notice when intent blank.
  - manual style guide textarea is present.
- `mainQuickComposeCommand.test.ts` if mock can support addCommand recording.
  - plugin onload registers command id/name.

## Verification commands
Run fresh, and include outputs in your report:

1. Targeted tests first, e.g.
   `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- quickCompose`
   and if modal/command tests added:
   `pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- QuickComposeModal mainQuickComposeCommand`

2. Full plugin tests:
   `pnpm --filter @ai-manuscript-studio/obsidian-plugin test`

3. Build/typecheck:
   `pnpm --filter @ai-manuscript-studio/obsidian-plugin build`

4. Scope:
   `git status --short`

## Acceptance criteria
- Command is registered and opens modal.
- Modal contains 6 fields per B2 spec.
- Generated prompt is safe: no external send, no API delivery, no fact invention for reports.
- Result can be copied and inserted into current file, but no external sending exists.
- No Genre/SaveTarget/core changes.
- No vault install/copy/deploy.
- Tests and build pass.
- End your report with `BUILD_DONE` only after verification commands finish.

## Report format
- Summary of files changed
- RED test evidence
- GREEN/build evidence
- Any skipped/limited test and why
- Risks/remaining work
- Final line: BUILD_DONE
