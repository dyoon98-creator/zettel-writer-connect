# Worker Task: B0/B1 doc fix after Opus verification

TASK_ID: b0-b1-doc-fix
ROLE: docs-specialist
WORKDIR: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
EXPECTED_MARKER: BUILD_DONE

Allowed write path:
- docs/planning/corpus-governance.md

Forbidden:
- packages/**
- _skillpacks/**
- vault paths
- deploy/commit/push

Required fixes:
1. Fix typo in corpus-governance.md §2:
   "회사 기밀 파함 금지" -> "회사 기밀 포함 금지".
2. Align wording in §4 so automatic voice guide injection is deferred to B3, not ambiguous B2/B3.
   Current intent: B1 = manual style prompt paste via user_input. Automatic voice_guide injection = B3 register/voice core work.

Verification:
- grep -n "파함\|B2/B3\|B3" docs/planning/corpus-governance.md
- Report exact changed lines.
- End with BUILD_DONE.
