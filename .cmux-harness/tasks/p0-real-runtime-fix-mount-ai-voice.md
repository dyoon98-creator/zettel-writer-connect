TASK_ID: P0-real-runtime-fix-mount-ai-voice
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- You are a senior TypeScript/React/Obsidian plugin runtime engineer.
- Priority is not taxonomy polish. Priority is to make the installed Obsidian plugin actually work: no fake/mock behavior unless explicitly configured, no Studio context mount error, voice delete works, AI calls are user-visible and diagnosable.
- Do NOT deploy to vault, commit, push, release, or edit the user's vault directly.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

USER-REPORTED FAILURE:
- Screenshot OCR shows Obsidian Notice: "삭제 실패: Studio context 가 초기화되지 않았습니다. ManuscriptStudioView 가 먼저 마운트되어야 합니다."
- User clicked delete in "내 문체 학습" and it failed.
- User also reports AI does not ask useful questions and nothing AI-like works.
- User is now doubting whether this is a real GitHub plugin install or just a fake shell.

EVIDENCE ALREADY COLLECTED BY MAIN:
- Installed vault plugin exists and is enabled:
  /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/.obsidian/community-plugins.json contains "ai-manuscript-studio".
- Installed bundle node syntax check passed.
- Installed main.js sha256 currently 296aa5c50923a626eff955bffef1fb823f3d14488de4804cb6b547b016c50508.
- Runtime settings data.json has aiProvider codex, codexPath /Users/dongchanyoon/.nvm/versions/node/v22.22.2/bin/codex, useMockBridge false.
- Codex CLI smoke from terminal succeeds with gpt-5.5 and also with gpt-5.4.
- Workspace has at least one manuscript-studio-view and one ams-project-indexer leaf.
- Source of error is packages/obsidian-plugin/src/studio/context.ts getStudioPlugin().
- Likely root cause: global module singleton is disposed by one ManuscriptStudioView onClose while another Studio React tree or async voice operation still needs it, or indexer/right-sidebar actions call Tauri shims without a live Studio context. Current disposeStudioContext() blindly sets _plugin=null.

CURRENT WORKTREE WARNING:
- There are many pre-existing partial B2/B2.6 changes from earlier workers. Do NOT revert broad changes.
- Keep this P0 patch narrow. If you need to touch a partially changed file, preserve existing intended changes unless they break tests.

OBJECTIVE:
Make the Obsidian plugin real/usable for the reported runtime path.

MUST FIX / INVESTIGATE:
1. Fix Studio context lifecycle robustly.
   - Do not let one view close wipe context needed by another open view.
   - Prefer token/ref-counted registration: initStudioContext(plugin) returns token or register mount; dispose only releases that token; _plugin null only when no active tokens remain.
   - ManuscriptStudioView must store the token and release only its own token.
   - If multiple Studio views are open, closing one must not break VoicePane/tauriShims in another.
2. Voice delete must not throw "Studio context ..." when VoicePane is rendered inside a mounted studio view.
   - Add tests around context lifecycle and/or tauriShims voice_delete_file using mocked plugin/vault adapter if practical.
   - Add/extend VoicePane/voiceIO tests to cover delete path source contract if full React test is hard.
3. AI runtime visibility:
   - Confirm useMockBridge=false + codexPath present means CLIWizardBridge/useStreamingChat are used, not MockWizardBridge.
   - If the UI silently falls back to mock or silent errors, make the error visible and actionable.
   - Check whether default codex model/args are coherent. Terminal smoke proved codex works with gpt-5.5 and gpt-5.4, so do not claim binary is missing.
   - If needed, set a safer default in code or settings migration, but do not edit the installed vault data.json.
4. Add a compact runtime doctor/test if feasible:
   - verify community plugin enabled status is not enough; runtime context and AI CLI settings should be diagnosable from source/tests.
5. Do NOT handle broad tone taxonomy expansion in this task except to avoid breaking existing work. That is next after P0.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/context.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/ManuscriptStudioView.tsx
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/tauriShims/core.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/VoicePane.tsx
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/voice/voiceIO.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/adapters/aiBridge.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/ai/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/studio/wizard/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/plugins/**
- commit/push/release/deploy/vault install/external send.

VERIFY COMMANDS:
Run and report exit codes:
- pnpm --filter @ai-manuscript-studio/obsidian-plugin test
- pnpm --filter @ai-manuscript-studio/obsidian-plugin build
- node --check packages/obsidian-plugin/dist/main.js if build emits it
- A targeted source scan for the exact error string and context lifecycle implementation
- If tests fail because of pre-existing broad B2.6 partial taxonomy errors outside this P0 scope, report exact blockers and the narrow test(s) that pass.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
---
BUILD_DONE
Root cause confirmed:
Runtime fix:
AI runtime findings:
Changed files:
Verification:
Remaining blockers:
No deploy/commit/push confirmation:
