# Worker Task: Fix corpus sensitivity wording to respect user scope decision

TASK_ID: privacy-scope-user-decision-fix
ROLE: docs-specialist
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

Representative correction:
"회사기밀 포함해도 된다. 내가 포함해서 이야기할 수도 있다. 그건 내가 정하니 니가 걱정하지 마라."

Interpretation:
- Do NOT prohibit company-confidential/sensitive material categorically.
- The correct control is user-approved allow-list inclusion.
- Keep no whole-vault auto-learning and no accidental broad collection.
- Keep external sending disabled unless explicitly approved in a future scope.
- Replace paternalistic/prohibitive wording with: representative decides what samples are included; agent respects that scope and records/contains the allow-list.

Allowed write paths:
- docs/planning/corpus-governance.md
- docs/planning/corpus-convention.md
- docs/planning/corpus-readme-template.md
- docs/planning/06-tasks.md

Forbidden:
- packages/**
- _skillpacks/**
- vault paths
- deploy/commit/push

Required edits:
1. corpus-governance.md
   - Change section title from "금지 규칙" if needed to something like "자동 수집 금지 및 대표님 승인 원칙".
   - Replace line that says legal/fund/counterparty/personal/company-confidential files are prohibited.
   - New meaning: such materials may be included only if representative explicitly chooses/approves the file for the voice corpus; Hermes/worker must not decide inclusion on its own.
2. corpus-convention.md
   - Replace "민감 정보 포함 파일은 폴더에서 제외" with "대표님이 승인한 민감/회사 자료는 포함 가능; 미승인 자동 포함은 금지".
3. corpus-readme-template.md
   - Replace "민감 정보 포함 파일 제외" with the same approval-based wording.
4. 06-tasks.md
   - Replace B0/C0 wording "비밀/민감 정보 포함 금지" with "대표님 승인 없는 자동 포함 금지; 승인 파일은 포함 가능".

Verification:
- grep for remaining over-prohibitive phrases: "민감 정보.*금지", "회사 기밀 포함 금지", "법률 의견.*금지", "펀드.*금지", "포함 파일 제외".
- Confirm allow-list and explicit representative approval wording exists.
- Run worker-check is Main's job, but report exact changed lines.

End with BUILD_DONE.
