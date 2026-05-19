# TASK_ID: verify-p0-runtime-mount-ai-voice

ROLE: test-specialist / read-only verifier
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/test-specialist.md
AGENT_PERSONA_SUMMARY: Independently verify TypeScript/Obsidian runtime fixes with evidence. Read-only: inspect code, run tests/build/checks, and report gaps. Do not modify files.
MODEL_OR_LANE: Opus-Verify

OBJECTIVE
Independently verify the P0 runtime fix for AI Manuscript Studio:
1. Studio context lifecycle no longer throws "Studio context 가 초기화되지 않았습니다" when one ManuscriptStudioView closes while another remains open.
2. Voice delete/list/folder commands no longer crash due to stale context or shape mismatch.
3. AI bridge default model is updated to gpt-5.5 and Codex path logic is not broken.
4. No stale old response-shape tokens remain in active plugin source.

WORKDIR
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

READ_ONLY_PATHS
- packages/obsidian-plugin/src/studio/context.ts
- packages/obsidian-plugin/src/studio/ManuscriptStudioView.tsx
- packages/obsidian-plugin/src/studio/tauriShims/core.ts
- packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- packages/obsidian-plugin/src/adapters/aiBridge.ts
- packages/obsidian-plugin/tests/studio/context.test.ts
- packages/obsidian-plugin/tests/studio/tauriShimsCore.test.ts
- packages/obsidian-plugin/tests/adapters/aiBridge.test.ts
- packages/core/**
- docs/planning/06-tasks.md

FORBIDDEN_PATHS
- Do not edit any file.
- Do not deploy to the Obsidian vault.
- Do not commit or push.

DEPENDENCIES
Sonnet-Executor reported BUILD_DONE for p0-real-runtime-fix-mount-ai-voice.
Main independently ran:
- git diff --check => exit 0
- pnpm --filter @ai-manuscript-studio/obsidian-plugin test --passWithNoTests => 145/145 pass
- pnpm --filter @ai-manuscript-studio/obsidian-plugin build => exit 0
- pnpm --filter @ai-manuscript-studio/core test --passWithNoTests => 255 pass, 32 skipped
- pnpm --filter @ai-manuscript-studio/core build => exit 0

ACCEPTANCE_CRITERIA
- Verify context.ts uses ref-counted release semantics and tests cover the multi-view regression.
- Verify ManuscriptStudioView stores and calls its release token on close.
- Verify tauriShims/core return shapes match VoiceFolderInfo and VoiceFileEntry in voiceIO.ts.
- Verify active plugin source has no `disposeStudioContext`, `is_default`, `is_external`, `abs_path`, or `gpt-5.4` references.
- Run at least targeted context/tauri/aiBridge tests and a plugin build or typecheck.
- Confirm no files changed as a result of verification (`git status --short` after your checks).

REQUIRED_EVIDENCE
- Exact commands run with exit codes.
- File/line observations for the key lifecycle fix and interface-shape match.
- Any risk or gap that should block vault deployment.

EXPECTED_MARKER
REVIEW_DONE

REPORT_FORMAT
Brief Korean report with:
1. Verdict: PASS / REQUEST_CHANGES
2. Evidence commands
3. Key code observations
4. Deployment blocker yes/no
5. End with marker REVIEW_DONE on its own line.
