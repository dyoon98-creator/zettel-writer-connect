# TASK_ID: customer-report-tone-click-prompt-fix-addendum-2

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 시니어 프론트엔드 테스트 전문가. Test intent must match assertions.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Fix the misleading behavior test introduced in addendum-1.

PROBLEM:
`packages/obsidian-plugin/tests/studio/wizard/WizardChat.behavior.test.ts` contains a test named/commented like “직접 입력 옵션에서 textarea 비어 있으면 답변 버튼 클릭해도 전송 안 됨”, but it bypasses the UI disabled state, manually calls the submit handler, and expects `sendUserMessage("직접 입력")`. This contradicts production UI: `canSubmit = selected !== null && (!isOtherSelected || otherDraft.trim().length > 0)` and the button is disabled when direct-input text is empty.

REQUIRED:
1. Update the behavior test so its name, setup, and assertion match production UX:
   - direct-input selected + empty otherDraft => `canSubmit`/button-disabled equivalent is false; no simulated user click should call send.
   - direct-input selected + non-empty otherDraft => enabled equivalent true; click sends `직접 입력: <typed>`.
2. Keep production code unchanged unless a real bug is found.
3. Run:
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand tests/studio/wizard/WizardChat.behavior.test.ts`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand`

ALLOWED_WRITE_PATHS:
- packages/obsidian-plugin/tests/studio/wizard/WizardChat.behavior.test.ts
- .cmux-harness/logs/**

FORBIDDEN:
- commit/push/deploy
- production code edits unless test exposes a real bug, in which case report first

EXPECTED_MARKER:
BUILD_DONE
