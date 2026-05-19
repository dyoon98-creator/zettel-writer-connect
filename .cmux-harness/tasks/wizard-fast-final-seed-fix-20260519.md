TASK_ID: wizard-fast-final-seed-fix-20260519
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: local urgent UI/React/TypeScript bugfix worker
AGENT_PERSONA_SUMMARY: Fix an Obsidian React wizard UX regression with TDD: inspect current code, add focused tests first where feasible, make minimal changes, run targeted tests/build. Preserve existing uncommitted work and do not commit/push/deploy.
MODEL_OR_LANE: Sonnet-Executor
OBJECTIVE:
  Fix the live Obsidian New Manuscript Wizard problems reported by the user:
  1) Answering a wizard choice must advance immediately, not wait on Codex/Claude CLI for each next question/stage summary/final summary.
  2) The final screen must not make the user click only “나중에 직접 채울게요” and thereby close without creating anything. The primary “create/seed binder” action must be visible, obvious, and first.
  3) Keep scope to ai-manuscript-studio wizard only. Do NOT touch packages/zettel-connect and do NOT deploy.

ROOT_CAUSE EVIDENCE ALREADY OBSERVED BY MAIN:
  - wizardStore.defaultBridgeFromSettings currently returns CLIWizardBridge when settings.aiProvider=codex and codexPath exists. Therefore every runAskAndStream, completeCurrentStage(), and finalize() calls external CLI via CLIWizardBridge.askNextQuestion/summarize. That is why each click waits.
  - WizardChat currently has non-last auto-submit logic, but after sendUserMessage the store still waits for CLI stage summarize/next question.
  - SeedPrompt renders decline before accept. In the user screenshot the only visible/clicked action was “나중에 직접 채울게요”, which invokes declineSeed and closes without files. The primary accept action is not sufficiently visible/safe.

ALLOWED_WRITE_PATHS:
  - packages/obsidian-plugin/src/studio/wizard/wizardStore.ts
  - packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx
  - packages/obsidian-plugin/src/studio/styles/global.css
  - packages/obsidian-plugin/tests/studio/wizard/**
  - packages/core/src/wizard/MockWizardBridge.ts
  - packages/core/tests/wizard/**

FORBIDDEN_PATHS:
  - packages/zettel-connect/**
  - /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
  - scripts/deploy-obsidian-plugins.sh
  - any git commit/push/deploy operation

DEPENDENCIES:
  - Use existing package manager pnpm.
  - Do not rely on browser/E2E unless already available; source-contract/JSDOM/unit tests are acceptable for this urgent fix.

REQUIRED IMPLEMENTATION DIRECTION:
  A. Make wizard interview local/instant by default.
     - The New Manuscript Wizard should not call external CLI for interview questions, stage summaries, or final summary.
     - Prefer returning a fast deterministic local bridge, e.g. MockWizardBridge({ tokenDelayMs: 0 }), from defaultBridgeFromSettings() for wizard interview startup.
     - The UI should communicate that this is a fast local planning interview; external Codex/Claude remains available for drafting/selection/Quick Compose elsewhere.
     - Avoid misleading green “Codex CLI” badge if wizard no longer uses CLI. Adjust BridgeInfo/reason/badge text if needed, but keep changes small.
  B. Make final seed action safe/obvious.
     - Put primary accept button first and make its label explicit: e.g. “지금 binder 만들고 원고실 열기”.
     - Secondary decline should be explicitly destructive/non-creation: e.g. “건너뛰기 — 파일 만들지 않음”.
     - Add/adjust CSS so seed actions are always visible on normal laptop height; cap structure list height if necessary; primary button visually prominent.
     - Add data-testid for decline if useful.
  C. Optional but recommended: tailor MockWizardBridge question bank for investment-strategy-memo enough to preserve the user’s visible use case, but do not overbuild.
     - If minimal, at least tests must prove local bridge is used instantly; full genre taxonomy can be deferred.

ACCEPTANCE_CRITERIA:
  - A focused test proves wizardStore.defaultBridgeFromSettings no longer constructs CLIWizardBridge for the wizard default path, or source-contract equivalent proves it returns MockWizardBridge({tokenDelayMs:0}) / local fast bridge.
  - Existing WizardChat auto-submit tests still pass.
  - A new/focused test or source-contract proves primary seed accept label exists and appears before/with stronger semantics than decline.
  - Running targeted plugin/core wizard tests exits 0.
  - Running plugin build exits 0, or if full build is too slow, at least TypeScript/Jest targeted commands plus note exact build blocker.
  - git diff --check exits 0.

SUGGESTED COMMANDS:
  - pnpm --filter @ai-manuscript-studio/obsidian-plugin test -- --runInBand tests/studio/wizard
  - pnpm --filter @ai-manuscript-studio/core test -- --runInBand tests/wizard
  - pnpm --filter @ai-manuscript-studio/obsidian-plugin build
  - git diff --check

REPORT_FORMAT:
  At completion, print exactly one line marker BUILD_DONE, then concise report:
  - files changed
  - root cause confirmed
  - tests/build commands with exit status
  - whether deploy is still pending for Main

EXPECTED_MARKER: BUILD_DONE
