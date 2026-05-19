# Planning Review — Phase 4+ scope review for zettel-writer-connect

You are Planning Review in the active cmux-harness for /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect.

Context:
- User wants the current zettel -> structure note -> AI manuscript studio integration reviewed through Phase 4, and wants to know whether additional phases are needed.
- Current plan file: docs/plans/2026-05-18-zettel-structure-to-writer-integration.md
- Current rollout in the plan only names Phase 0..3, but Acceptance Criteria include sourceNotes consumption, which previous debate found impossible unless ContextComposer / caller path is changed.
- Critical constraints:
  1. Do not downgrade or deploy packages/zettel-connect from this repo. Existing /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect is the canonical 0.1.6 plugin.
  2. AI manuscript studio only: plugin id ai-manuscript-studio.
  3. Writing root is 4.Writing.
  4. 4.Writing and 9.Archive must be excluded from note search/autocomplete.
  5. File-based contract between plugins; no direct runtime dependency.
  6. Use ProjectMetaIO.create(), BinderIO.empty(), and schema validators; do not hand-author invalid project.json/binder.json.
  7. sourceNotes canonical format: vault-relative .md paths, not wikilinks.
  8. Phase 1 must be a minimal useful bridge and must not pretend that AI actions consume sourceNotes before that code path exists.

Please inspect the current plan and produce a final planning review with:

A. Proposed Phase 0..4 decomposition
- For each phase: objective, included work, excluded work, acceptance criteria, rollback/no-regression check.
- Phase 4 must be explicit, not hidden in Phase 1 AC.

B. Whether additional Phase 5+ is needed
- If yes, list optional future phases and why they should not block Phase 1..4.
- Include integration with /structure skill if appropriate, but do not invent direct plugin coupling unless necessary.

C. Task-generator guidance
- How should the final plan be structured so /tasks-generator can produce safe implementation tasks?
- Identify task boundaries suitable for Sonnet-Executor/GPT-Executor and independent verification.

D. Risk register
- Top 7 risks, severity, mitigation, verification command/evidence.

E. Final recommendation
- One recommended path for the CEO: which phase to implement first, what to defer, and what not to do.

Output Korean, concise but complete. End with marker: PHASE4_REVIEW_DONE