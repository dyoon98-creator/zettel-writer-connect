# Read-only verification: B0/B1 communication skillpack MVP

ROLE: Opus-Verify read-only verifier
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: REVIEW_DONE

Verify B0/B1 deliverables without modifying files.

Files to inspect:
- docs/planning/corpus-governance.md
- docs/planning/corpus-convention.md
- docs/planning/corpus-readme-template.md
- _skillpacks/comms-studio/skillpack.json
- _skillpacks/comms-studio/prompts/*.md
- packages/core/src/skillpack/PromptTemplate.ts (read-only supported placeholder set)
- .cmux-harness/tasks/b0-b1-comms-skillpack.md

Checks:
1. Scope
- Confirm no packages/** code changes were introduced by B0/B1 task; skillpack/docs only.
- Confirm allowed paths match the B0/B1 task.

2. Manifest validity
- JSON parses.
- id/name/version/vendor/tier present.
- action count = 7.
- Action ids exactly:
  comms.email-draft, comms.email-polish, comms.kakao-short, comms.telegram-brief, comms.report-polish, comms.summary-briefing, comms.memo-capture.
- save_to values are valid current SaveTarget values.

3. Placeholder compatibility
- Manifest placeholders and prompt placeholders use only current supported placeholders from PromptTemplate.ts.
- Confirm no unsupported placeholders: voice_guide, recipient_context, report_context.
- Confirm prompts explain manual style prompt injection via user_input.

4. Safety
- Prompts must not instruct external sending, Gmail API, Kakao API, Telegram Bot API, or real delivery.
- It is OK and desired to say "외부 전송은 절대 하지 않습니다".
- Report-polish must prohibit fact invention/alteration.
- Summary-briefing must request 현황/핵심/시사점 structure.
- Kakao prompt must constrain short length unless user asks otherwise.

5. Docs quality
- Corpus governance must clearly state allow-list only, no whole-vault auto-learning, no confidential/privileged samples.
- Corpus convention must recommend _voice-samples and explain relation to current Obsidian `_attachments/voice` default.
- README/template doc must compare _voice-samples vs 4.Writing/_voice and recommend one.
- Flag any typo or ambiguity that should be fixed before representative uses it.

Report:
- PASS/FAIL per section
- Required changes, if any
- Non-blocking improvements, if any
- End with REVIEW_DONE on its own line.
