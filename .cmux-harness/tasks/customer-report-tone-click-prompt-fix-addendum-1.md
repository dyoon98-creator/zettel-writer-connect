# TASK_ID: customer-report-tone-click-prompt-fix-addendum-1

ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 시니어 프론트엔드 전문가. React/JSDOM behavior tests and accessibility regression tests.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
Opus-Verify passed the implementation but flagged one non-blocking quality gap: `WizardChat.contract.test.ts` only source-scans the click behavior. Strengthen this before deploy by adding a real JSDOM behavior test for the new manuscript planning interview choice UI.

ALLOWED_WRITE_PATHS:
- packages/obsidian-plugin/tests/studio/wizard/**
- packages/obsidian-plugin/src/studio/wizard/WizardChat.tsx only if the behavior test exposes a real bug; otherwise do not change production code.
- .cmux-harness/logs/**

FORBIDDEN_PATHS:
- commit/push/deploy
- vault runtime install folders
- broad refactor

REQUIRED:
1. Add a behavior test, not another source-string contract, proving:
   - Given `currentQuestion.format === "choice"` with options `["신규 딜/상정", "후속투자 근거 정리", "직접 입력"]`, clicking a normal option row/radio invokes the store's `sendUserMessage("신규 딜/상정")` exactly once without needing the submit button.
   - Clicking the last/direct-input option does NOT call `sendUserMessage` immediately, displays the textarea, and then clicking `답변` after typing sends `"직접 입력: <typed>"` or the existing expected content format.
2. Use existing project test stack only. If no React Testing Library exists, use `react-dom/client`, `react-dom/test-utils` `act`, and Zustand store state setup/mocking as appropriate.
3. Keep production code unchanged unless the behavior test fails for a real reason.
4. Run:
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand tests/studio/wizard/<new-or-updated-test-file>`
   - `pnpm --filter @ai-manuscript-studio/obsidian-plugin exec jest --runInBand`

EXPECTED_MARKER:
BUILD_DONE

REPORT_FORMAT:
1. Test file added/updated
2. Whether production code changed
3. Behavior proven
4. Commands + exit codes
5. Final marker: BUILD_DONE
