TASK_ID: B2.5a-genre-refinement
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 프론트엔드 전문가이자 UI/UX 디자인 아키텍트입니다.
- 이번 작업은 Obsidian plugin의 새 원고 만들기 modal 장르 taxonomy를 대표님 실제 업무 흐름에 맞게 조정하는 작은 UI/contract 수정입니다.
- 기존 B2.5 변경을 이어받되, 대표님의 최신 피드백을 최우선으로 반영합니다.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
대표님 최신 피드백을 반영해 NewProjectModal 장르 목록을 재조정한다.
1) "리서치 리포트" 성격은 "투자메모"와 겹치므로 삭제/분리 금지.
2) "투자보고서"를 추가한다. 참고 PDF 성격: /Users/dongchanyoon/Downloads/LX Signature1 3차배분 고객레터.pdf
   - 로컬 pdftotext 확인 결과 제목/성격: "3차 배분 완료 안내 및 펀드 운용 현황 보고", 고객 서한형 투자보고서/운용현황 보고.
   - PDF를 repo에 복사하지 말 것. 장르명 판단 근거로만 사용.
3) 이메일/카톡/텔레그램은 장르가 아니라 output format/channel이므로 장르 dropdown에 넣지 않는다.

INPUTS:
- packages/obsidian-plugin/src/NewProjectModal.ts
- packages/obsidian-plugin/tests/NewProjectModal.test.ts
- docs/planning/06-tasks.md
- User feedback: 리서치 리포트는 투자메모와 겹치니 삭제. 투자보고서 추가. 이메일/카톡/텔레그램은 형식이지 장르가 아니다.

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/NewProjectModal.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/NewProjectModal.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Downloads/LX Signature1 3차배분 고객레터.pdf
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/settings.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/ProjectIndexerView.ts

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- packages/** outside the ALLOWED_WRITE_PATHS above, unless a typecheck proves a tiny import/type fix is absolutely necessary; if so, stop and report instead of editing.
- Any commit, push, deploy, vault install, or external send.

DEPENDENCIES:
- Existing B2.5 changes may already be partially applied. Treat current working tree as baseline; do not revert unrelated B2.3/B2.4/QuickCompose changes.

ACCEPTANCE_CRITERIA:
- NewProjectGenre/GENRE_LABEL_KO has no "research-report", no "report-briefing" if its label would imply generic/research report overlap, and no label containing "리서치 리포트" or "보고서/브리핑".
- First/default genre is investment memo with label exactly "투자메모" (not "투자/리서치 메모"). Prefer key "investment-memo" unless changing it causes avoidable wider churn.
- Add a separate investment report genre with label exactly "투자보고서". Prefer key "investment-report".
- Keep these representative writing genres unless tests/typing reveal a reason to adjust order:
  1. 투자메모
  2. 투자보고서
  3. 산업·시장 분석
  4. 법률·회계·계약 검토
  5. 전략 메모
  6. 칼럼/에세이
  7. 강의·발표안
  8. 원고/스크립트
- Do NOT add 이메일, 카카오톡/카톡, 텔레그램, Telegram to GENRE_LABEL_KO or NewProjectGenre. If mentioning them in tests/docs, call them formats/channels, not genres.
- Update NewProjectModal.test.ts source-contract expectations accordingly: old generic labels absent; "투자/리서치 메모" absent; "투자메모" default/first; "투자보고서" present; email/kakao/telegram absent from genres.
- Update docs/planning/06-tasks.md B2.5 section with an amendment note B2.5a, preserving previous evidence but correcting genre list and explaining channels vs genres.
- Run targeted tests for NewProjectModal and full obsidian-plugin tests if practical. Also run build. Report exact commands and exit codes.

REQUIRED_EVIDENCE:
- Diff summary for the allowed files.
- Targeted test output showing NewProjectModal tests pass.
- Full plugin test or clear reason if skipped.
- Build exit code.
- Confirmation no vault install/deploy/commit/push performed.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
When complete, print:
---
BUILD_DONE
Summary:
Changed files:
Verification:
Notes/Risks:
