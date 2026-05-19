TASK_ID: wizard-fast-final-seed-fix-20260519-addendum-quality
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: local urgent UI/React/TypeScript bugfix worker
AGENT_PERSONA_SUMMARY: Correct prior task direction. Preserve Codex-quality interview generation while removing per-click blocking latency. Minimal TDD fix; do not deploy/commit/push.
MODEL_OR_LANE: Sonnet-Executor

IMPORTANT — THIS ADDENDUM SUPERSEDES THE PRIOR “local deterministic default” DIRECTION:
The user explicitly objected: they asked to remove delay, NOT to lower question quality. Do NOT replace the wizard’s question-generation quality path with static/deterministic local questions as the default.

REVISED OBJECTIVE:
Fix the New Manuscript Wizard latency without reducing question quality.

CORRECT ARCHITECTURE DIRECTION:
1. Codex/Claude-quality generation must remain involved in high-quality interview question creation.
2. Remove or reduce user-visible per-click blocking by moving AI work away from the click path:
   - Preferred: prefetch/cache the next question before the user clicks an answer, or maintain a high-quality interview plan generated once by Codex at wizard start, then advance instantly through cached/generated questions.
   - Acceptable urgent version: keep Codex path but make UI immediately acknowledge the click, disable duplicate input, show clear “다음 질문 준비 중” state, and avoid misleading “nothing happened” waits. But if you can implement prefetch safely, do it.
   - Local deterministic MockWizardBridge may only be fallback for CLI failure/missing settings, not the normal default when Codex is configured.
3. Stage summary/final summary must not create hidden long blocking at the final screen. If summarization needs AI, either precompute/cache it or use fast structured data from already chosen answers, while keeping question quality from Codex.
4. Final seed action still must be made visible/safe/primary: accept first, explicit label “지금 binder 만들고 원고실 열기”; decline clearly says “건너뛰기 — 파일 만들지 않음”.

DO NOT:
- Do not make defaultBridgeFromSettings always return MockWizardBridge when Codex is configured.
- Do not change the badge to imply Codex is unused if Codex is still the quality source.
- Do not touch packages/zettel-connect or 13.zettel-connect.
- Do not deploy, commit, or push.

ACCEPTANCE CRITERIA UPDATE:
- Tests must prove Codex/CLI bridge remains the default when configured, OR if an interview-plan cache abstraction is introduced, tests prove the plan/question source is AI-generated/cache-backed rather than static default.
- Tests must prove user click is immediately acknowledged and duplicate-click guarded / state changes before long async work.
- Existing WizardChat auto-submit tests still pass.
- New/focused test/source-contract proves final seed primary button appears before decline and decline is clearly non-creation.
- Targeted wizard/plugin tests exit 0, plugin build exits 0 if feasible, git diff --check exits 0.

REPORT_FORMAT:
At completion, print BUILD_DONE and include:
- how Codex quality is preserved
- what latency was removed or made visible/non-blocking
- files changed
- tests/build evidence

EXPECTED_MARKER: BUILD_DONE
