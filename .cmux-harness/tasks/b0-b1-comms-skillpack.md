# Worker Task: B0/B1 Communication Skillpack MVP

TASK_ID: b0-b1-comms-skillpack
ROLE: docs-specialist + skillpack-content-builder
MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

OBJECTIVE
Implement the fast-value Track C B0/B1 deliverables without touching packages/** code and without installing/deploying to the Obsidian vault.

CONTEXT / IMPORTANT CODE FACT
Read-only inspection shows current core supported placeholders do NOT include `voice_guide`. Supported placeholders are in packages/core/src/skillpack/PromptTemplate.ts:
- manuscript, section, source_notes, reader, core_message, user_input, title, genre, word_goal, current_words, status.
Therefore this MVP must be "manual voice prompt injection": the user copies the compressed voice prompt from VoicePane and pastes it into `user_input` along with intent/context. Do NOT use `{{voice_guide}}` in prompt files or manifest placeholders, because it will be unsupported in the current renderer.

ALLOWED_WRITE_PATHS
- docs/planning/corpus-governance.md
- docs/planning/corpus-convention.md
- docs/planning/corpus-readme-template.md
- _skillpacks/comms-studio/skillpack.json
- _skillpacks/comms-studio/prompts/email-draft.md
- _skillpacks/comms-studio/prompts/email-polish.md
- _skillpacks/comms-studio/prompts/kakao-short.md
- _skillpacks/comms-studio/prompts/telegram-brief.md
- _skillpacks/comms-studio/prompts/report-polish.md
- _skillpacks/comms-studio/prompts/summary-briefing.md
- _skillpacks/comms-studio/prompts/memo-capture.md

FORBIDDEN_PATHS
- packages/**
- package.json / pnpm-lock.yaml
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**
- .obsidian/plugins/**
- deploy scripts
- any network/email/Kakao/Telegram sending code
- commits/pushes/deploys

READ_ONLY_REFERENCES
- docs/planning/06-tasks.md
- packages/core/src/skillpack/types.ts
- packages/core/src/skillpack/SkillPackLoader.ts
- packages/core/src/skillpack/PromptTemplate.ts
- packages/core/tests/fixtures/skillpacks/sample-pack/skillpack.json

DELIVERABLE A — B0 docs
Create three docs:
1. docs/planning/corpus-governance.md
   - Voice corpus is allow-list only.
   - No whole-vault auto-learning.
   - Do not put privileged legal, fund, personal, counterparty, or company confidential info in samples.
   - User manually copies approved .md files into voice sample folder.
   - Direct sending forbidden in MVP.
2. docs/planning/corpus-convention.md
   - Recommend vault root `_voice-samples/` as source corpus convention.
   - .md only, naming convention, minimum sample guidance.
   - Explain current Obsidian plugin default voice folder is `_attachments/voice`; samples may be manually copied/symlinked later after approval.
   - Mention register-specific guides are future B3.
3. docs/planning/corpus-readme-template.md
   - Compare `_voice-samples/` vs `4.Writing/_voice/`.
   - Recommend `_voice-samples/` to avoid 4.Writing self-contamination and source-note recursion.
   - Include draft README/template content to be copied to vault only after approval.

DELIVERABLE B — skillpack MVP
Create `_skillpacks/comms-studio/skillpack.json` and seven prompt files:
- email-draft.md
- email-polish.md
- kakao-short.md
- telegram-brief.md
- report-polish.md
- summary-briefing.md
- memo-capture.md

Manifest requirements:
- id: comms-studio
- name: 대표님 커뮤니케이션 스튜디오
- version: 0.1.0
- vendor: kw-local
- tier: free
- actions: 7 actions:
  1. comms.email-draft / 이메일 초안 쓰기 / save_to draft / requires_user_input true / placeholders ["user_input", "source_notes", "reader", "core_message"]
  2. comms.email-polish / 이메일 다듬기 / save_to revising / requires_user_input true / placeholders ["manuscript", "user_input"]
  3. comms.kakao-short / 카카오톡 메시지 쓰기 / save_to draft / requires_user_input true / placeholders ["user_input"]
  4. comms.telegram-brief / 텔레그램 메시지 쓰기 / save_to draft / requires_user_input true / placeholders ["user_input", "source_notes"]
  5. comms.report-polish / 보고서 다듬기 / save_to revising / requires_user_input true / placeholders ["manuscript", "user_input", "source_notes", "core_message", "reader"]
  6. comms.summary-briefing / 요약 보고자료 만들기 / save_to draft / requires_user_input true / placeholders ["manuscript", "user_input", "source_notes", "reader", "core_message"]
  7. comms.memo-capture / 메모 정리하기 / save_to draft / requires_user_input true / placeholders ["manuscript", "user_input"]

Prompt rules:
- Korean output.
- Make the prompt ask the model to treat `{{user_input}}` as containing both task intent/context and, when available, the pasted compressed personal style guide.
- Use no unsupported placeholders like `{{voice_guide}}`, `{{recipient_context}}`, `{{report_context}}`.
- Explicitly say: do not send externally; produce draft text only.
- For report-polish: do not invent or alter facts.
- For summary-briefing: use 현황 / 핵심 / 시사점 structure.
- For kakao: 3-5 short lines unless user asks otherwise.
- For memo: preserve key points and avoid excessive shortening.

VERIFICATION TO RUN
1. JSON parse:
   python3 -m json.tool _skillpacks/comms-studio/skillpack.json >/dev/null
2. Count actions = 7 and ids expected.
3. Check prompt files exist.
4. Check no unsupported placeholders in prompts/manifest. Allowed placeholder set exactly as PromptTemplate.ts supports.
5. Check no external send/API terms in dangerous imperative form. It is okay to mention "do not send externally".
6. Do NOT run npm/pnpm build unless needed; this is content-only.
7. git status --short for allowed paths.

REPORT FORMAT
- Files created
- Manifest action ids
- Placeholder compatibility result
- External-send safety result
- Any limitations: B1 uses manual style prompt injection through user_input; automatic voice_guide injection deferred to B2/B3
- End with BUILD_DONE on its own line.
