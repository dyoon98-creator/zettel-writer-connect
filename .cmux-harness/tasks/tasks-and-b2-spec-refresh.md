# Worker Task: Refresh 06-tasks, add B1 usage guide, add B2 Quick Compose spec

TASK_ID: tasks-and-b2-spec-refresh
ROLE: docs-specialist / product-spec writer
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

OBJECTIVE
Make the planning docs match actual B0/B1 implementation and prepare the next B2 design step. No code changes.

ALLOWED_WRITE_PATHS
- docs/planning/06-tasks.md
- docs/planning/b1-comms-skillpack-usage.md
- docs/planning/b2-quick-compose-spec.md

FORBIDDEN_PATHS
- packages/**
- _skillpacks/**
- vault paths
- deploy/commit/push

CONTEXT
B0/B1 has been implemented and verified:
- docs/planning/corpus-governance.md
- docs/planning/corpus-convention.md
- docs/planning/corpus-readme-template.md
- _skillpacks/comms-studio/skillpack.json
- _skillpacks/comms-studio/prompts/*.md

Important correction:
- Current supported placeholders DO NOT include voice_guide, recipient_context, report_context.
- B1 uses manual style prompt injection through user_input.
- Actual B1 manifest placeholders are:
  comms.email-draft: user_input, source_notes, reader, core_message
  comms.email-polish: manuscript, user_input
  comms.kakao-short: user_input
  comms.telegram-brief: user_input, source_notes
  comms.report-polish: manuscript, user_input, source_notes, core_message, reader
  comms.summary-briefing: manuscript, user_input, source_notes, reader, core_message
  comms.memo-capture: manuscript, user_input

TASK A — Update docs/planning/06-tasks.md
1. Mark completed tasks as checked:
   - C0.3
   - B0.1
   - B0.2
   - B0.3
   - B1.1
   - B1.2
   - B1.3
   - B1.4
   - B1.5
   - B1.6
2. For those completed tasks, add a short "Completion evidence" bullet with paths/verification summary.
3. Correct B1 action specs so unsupported placeholders are removed.
4. Add note at top of B1 section:
   "B1 implemented as manual style-prompt injection via user_input. Automatic voice_guide injection is deferred to B3."
5. Do not mark C0.1 or C0.2 done. C0.2 is install/manual smoke after approval.
6. Do not mark B2/B3/W tasks done.

TASK B — Create docs/planning/b1-comms-skillpack-usage.md
Content should be representative-facing but concise:
- What was built: 7 actions.
- Current limitation: manual style guide injection.
- Exact workflow:
  1. AI 원고실 VoicePane에서 압축 프롬프트 복사
  2. 원하는 action 실행
  3. user_input에 목적/맥락 + 압축 프롬프트 붙여넣기
  4. 결과는 draft/revising 텍스트로 저장; 외부 발송 없음
- Provide copy-paste examples for email, KakaoTalk, Telegram, report, summary briefing, memo.
- State that company-confidential/sensitive materials may be included if representative chooses; Hermes/worker does not decide inclusion.
- State actual vault installation/copy is a separate approval step.

TASK C — Create docs/planning/b2-quick-compose-spec.md
Design only. No code.
Include:
- Problem: B1 is useful but manual/user_input friction too high.
- Goal: One Obsidian command to compose email/kakao/telegram/report/summary/memo without forcing full 4.Writing project flow.
- Command name: AI 원고실: 즉석 커뮤니케이션 작성
- Inputs:
  - register: email/kakao/telegram/report/summary/memo
  - intent/context textarea
  - source text textarea or current selection
  - recipient/reader context
  - length hint
  - style mode: manual pasted guide now; automatic selected guide in B3
- Output:
  - preview
  - copy to clipboard
  - insert into current editor
  - save to draft/revising optional
  - no external send button
- Architecture constraints:
  - Do not extend Genre or SaveTarget in B2.
  - Reuse existing skillpack/action registry if possible.
  - B2 should route to B1 actions where possible.
  - No Gmail/Kakao/Telegram API integration.
- Acceptance criteria for future B2 implementation.
- Test plan.

VERIFICATION
- grep 06-tasks for remaining unsupported B1 placeholder terms: voice_guide, recipient_context, report_context. It is OK if B3/future sections mention voice_guide as future; B1 section should not use it as current placeholder.
- Confirm new docs exist.
- Confirm no packages/** or _skillpacks/** were modified.
- Report exact files changed and summary.

End with BUILD_DONE.
