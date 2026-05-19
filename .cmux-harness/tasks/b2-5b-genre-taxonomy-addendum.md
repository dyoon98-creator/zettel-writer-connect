TASK_ID: B2.5b-genre-taxonomy-addendum
ROLE: frontend-specialist
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/frontend-specialist.md
AGENT_PERSONA_SUMMARY:
- 당신은 시니어 프론트엔드 전문가이자 UI/UX 디자인 아키텍트입니다.
- 이 작업은 진행 중인 B2.5a의 최신 사용자 피드백 addendum입니다.
- 현재 Sonnet-Executor가 B2.5a를 처리 중이면, 기존 결과를 버리지 말고 이 addendum을 최종 기준으로 반영하세요.

MODEL_OR_LANE: Sonnet-Executor
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

OBJECTIVE:
대표님 최신 피드백을 최종 장르 taxonomy에 반영한다.

LATEST USER FEEDBACK:
- "산업·시장 분석"은 삭제.
- "투자메모"와 "전략 메모"는 병합.
- "원고/스크립트"는 모호하므로 더 명확한 장르명으로 변경.

FINAL GENRE TAXONOMY TO IMPLEMENT:
1. 투자·전략 메모
2. 투자보고서
3. 법률·회계·계약 검토
4. 칼럼/에세이
5. 강의·발표안
6. 장문 원고

RATIONALE:
- 산업·시장 분석은 별도 산출물이라기보다 투자메모/투자보고서의 분석 파트로 흡수된다.
- 투자메모와 전략 메모는 의사결정 메모라는 목적이 같아 "투자·전략 메모"로 합친다.
- 원고/스크립트는 너무 넓다. 강의/발표 스크립트는 "강의·발표안"에 들어가므로, 남는 장르는 책·긴 글·정리문을 뜻하는 "장문 원고"로 명확히 한다.
- 이메일/카톡/텔레그램은 장르가 아니라 형식/채널이므로 장르 목록에 넣지 않는다.

SUGGESTED KEYS:
- investment-strategy-memo -> 투자·전략 메모
- investment-report -> 투자보고서
- legal-accounting-review -> 법률·회계·계약 검토
- column-essay -> 칼럼/에세이
- lecture-presentation -> 강의·발표안
- long-form-manuscript -> 장문 원고

ALLOWED_WRITE_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/NewProjectModal.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/tests/NewProjectModal.test.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/docs/planning/06-tasks.md

READ_ONLY_PATHS:
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/settings.ts
- /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/packages/obsidian-plugin/src/ProjectIndexerView.ts

FORBIDDEN_PATHS:
- /Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/**
- /Users/dongchanyoon/.local/obsidian-plugins/**
- Any commit, push, deploy, vault install, or external send.

ACCEPTANCE_CRITERIA:
- GENRE_LABEL_KO has exactly the six final labels above, in that order.
- Default/first genre is "투자·전략 메모".
- Remove labels/keys for "산업·시장 분석", "투자메모" as standalone, "전략 메모" as standalone, "투자/리서치 메모", "보고서/브리핑", "원고/스크립트".
- Tests assert no 이메일/카톡/카카오톡/텔레그램/Telegram labels are included as genres.
- Tests updated to expect the six-label final taxonomy.
- docs/planning/06-tasks.md contains B2.5b amendment note with this final list.
- Run targeted NewProjectModal tests, full obsidian-plugin tests if practical, and build. Report exact commands and exit codes.

REQUIRED_EVIDENCE:
- Diff summary for allowed files.
- Test/build command outputs and exit codes.
- Confirmation no vault install/deploy/commit/push performed.

EXPECTED_MARKER: BUILD_DONE
REPORT_FORMAT:
---
BUILD_DONE
Summary:
Changed files:
Verification:
Notes/Risks:
