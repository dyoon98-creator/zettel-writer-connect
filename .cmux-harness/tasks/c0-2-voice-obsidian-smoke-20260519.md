# TASK_ID: c0-2-voice-obsidian-smoke-20260519

ROLE: test-specialist
MODEL_OR_LANE: Opus-Verify
AGENT_PERSONA_SOURCE: read-only runtime verifier persona
AGENT_PERSONA_SUMMARY: Independent Obsidian plugin runtime verifier. Use evidence from process state, CDP/DOM inspection, source behavior, and before/after status. Avoid durable writes unless the UI itself necessarily creates a default folder; if that happens, record it explicitly and do not hide it.

OBJECTIVE:
Execute C0.2 from docs/planning/06-tasks.md: verify the AI Manuscript Studio “내 문체(Voice)” feature in real Obsidian plugin mode as far as safely possible. Use Electron/Chromium remote debugging if normal UI scripting is unavailable. Do not commit/push/deploy.

CRITICAL DISPATCH RULE:
This task was dispatched using background pane-send because previous foreground polling caused repeated false-stuck incidents. Do not ask Main to foreground-poll. End with a standalone marker.

INPUTS:
- Repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
- Task spec: docs/planning/06-tasks.md lines 45-73
- Obsidian vault: /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고
- Target note to open: /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/4.Writing/test/planning.md
- Plugin id: ai-manuscript-studio
- Expected command ids include ai-manuscript-studio:open-studio and ai-manuscript-studio:new-project. There may be no direct voice command; open the studio then click “내 문체 학습”.
- Relevant source files:
  - packages/obsidian-plugin/src/studio/voice/VoicePane.tsx
  - packages/obsidian-plugin/src/studio/tauriShims/core.ts
  - packages/obsidian-plugin/src/studio/voice/styleGuide.ts
  - packages/obsidian-plugin/src/main.ts

ALLOWED_WRITE_PATHS:
- None in repo/source.
- No git commit/push/deploy.
- Prefer no vault writes. However, opening VoicePane may call voice_folder_info/voice_list_files, whose shim may ensure the default voice folder exists. If a vault folder is created by the plugin during runtime smoke, record exact before/after evidence and treat as runtime side effect, not hidden success.

READ_ONLY_PATHS:
- Repo files
- Installed plugin files
- Vault plugin settings/community-plugins/workspace files
- Existing vault voice folder/files if present

FORBIDDEN_PATHS:
- packages/** edits
- docs/planning/06-tasks.md edits in this task
- Creating sample voice .md files unless Main/user gives a separate explicit approval
- Clicking “재분석” if no existing voice sample files are present, because it cannot produce a real guide and may write .style-guide.json
- Deleting voice files/cache
- Changing plugin data.json settings
- git commit/push/merge/release

PROCEDURE:
1. Record before state:
   - git status --short --branch
   - pgrep/lsof for Obsidian and port 9222
   - existence of vault _attachments/voice and files under it, if any
   - plugin data.json app.voiceFolder
2. Start a temporary Obsidian remote-debugging session only if needed:
   - if 9222 is closed, quit Obsidian, reopen with --remote-debugging-port=9222 and target note/path.
   - Query http://127.0.0.1:9222/json/list and connect to webSocketDebuggerUrl.
3. Via CDP Runtime.evaluate:
   - verify app.plugins.plugins['ai-manuscript-studio'] exists and plugin commands are registered.
   - execute app.commands.executeCommandById('ai-manuscript-studio:open-studio') with the target note active, or otherwise open the studio view using available command/view APIs.
   - click the visible “내 문체 학습” button in the studio.
   - inspect document.body.innerText and DOM for VoicePane: heading “내 문체”, folder path, “폴더 선택…”, “Finder 로 열기”, “재분석”, file list/empty message, compressed prompt copy section if guide exists.
4. Safety handling:
   - Do NOT create a sample file.
   - If the voice folder is empty/no guide exists, report C0.2 as GAP/PARTIAL rather than full PASS for checklist items 6-8.
   - Do NOT click “재분석” unless existing .md samples are present and a guide generation can be verified without adding new samples. If clicked because samples exist, record whether .style-guide.json appears and whether §1~§14/compressed prompt are visible.
   - For “폴더 선택…” and “Finder 로 열기”, prefer DOM/button presence and source-supported behavior. Avoid leaving native dialogs open. If clicked, close/cancel any dialog and record exact result.
5. Cleanup:
   - If you started Obsidian with remote debugging, quit and reopen normally, then verify port 9222 is closed.
   - Preserve user’s Obsidian in a normal non-debug state.
6. Record after state:
   - git status --short --branch
   - voice folder before/after existence and file list
   - port 9222 closed if you opened it.

ACCEPTANCE_CRITERIA:
- PASS only if all eight C0.2 checklist items are actually verified.
- PARTIAL/GAP if VoicePane renders but sample/StyleGuide generation cannot be completed without creating sample files or writing cache.
- FAIL if plugin/command/view/VoicePane fails to load.

REQUIRED_EVIDENCE:
- Commands and exit codes or concise outputs.
- CDP evaluated facts: command ids, DOM text/selector counts, button labels, voice status text.
- Before/after side-effect check.
- Cleanup proof for port 9222.

EXPECTED_MARKER:
- REVIEW_DONE for PASS or PARTIAL/GAP with complete evidence.
- TEST_FAIL for runtime failure.

REPORT_FORMAT:
- Korean concise report.
- Checklist 1-8 table: PASS / GAP / FAIL / NOT-RUN with evidence.
- Side effects explicitly listed.
- Verdict: PASS / PARTIAL-GAP / FAIL.
- Last line marker only.