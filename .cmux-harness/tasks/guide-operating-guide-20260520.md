# TASK PACKET — 운영가이드 작성

TASK_ID: guide-operating-guide-20260520
ROLE: docs-specialist
MODEL_OR_LANE: Sonnet-Executor
AGENT_PERSONA_SOURCE: /Users/dongchanyoon/.claude/agents/docs-specialist.md
AGENT_PERSONA_SUMMARY:
- Documentation Specialist for concise Korean operating guides.
- Read existing repository docs and create a practical operator-facing guide.
- Do not edit code or tests.

OBJECTIVE:
Create a Korean operating guide for this repo at `운영가이드.md`.

WORKDIR:
/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect

ALLOWED_WRITE_PATHS:
- `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect/운영가이드.md`

READ_ONLY_PATHS:
- `README.md`
- `CLAUDE.md`
- `package.json`
- `scripts/deploy-obsidian-plugins.sh`
- `docs/install-guide.md`
- `docs/planning/06-tasks.md`
- `packages/obsidian-plugin/src/main.ts`
- `packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts`
- `packages/core/src/ai/ContextComposer.ts`
- `packages/obsidian-plugin/manifest.json`
- `packages/zettel-connect/manifest.json` if needed

FORBIDDEN_PATHS:
- Any source/test/package file.
- User vault files, `.obsidian/**`, `_index/**`, `2.Permanent/**`, `3.Structure/**`, `VAULT_INDEX`, `STRUCTURE_INDEX`.
- `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/**`.

GUIDE REQUIREMENTS:
Write `운영가이드.md` as a practical SSOT for this current project. It should be concise but complete enough that future Hermes/Claude/Codex agents can operate without re-discovering basics.

Must include:
1. Project identity and current source path:
   - current source root `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect`
   - AI 원고실 plugin id `ai-manuscript-studio`
   - Zettel Connect plugin id `zettel-connect`
2. Scope/boundary:
   - this repo is AI 원고실 source of truth;
   - do not modify `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect` unless a separate W4 task explicitly says so;
   - do not deploy bundled old zettel copies casually.
3. Package map:
   - `packages/core`
   - `packages/obsidian-plugin`
   - `packages/zettel-connect`
   - `apps/desktop` legacy.
4. Core commands:
   - install
   - targeted obsidian plugin tests
   - full obsidian plugin tests
   - core tests
   - obsidian plugin build
   - `node --check packages/obsidian-plugin/main.js`
   - deploy commands and environment overrides.
5. Current writing/Zettelkasten workflow:
   - W1 active structure note import command.
   - W2 `project.json.sourceNotes` AI context consumption.
   - W3 `_index/writing-handoff.json` import command.
   - `project.json.sourceNotes = structure note + picked permanent notes`.
6. Handoff JSON contract example for `_index/writing-handoff.json`.
7. Verification checklist before claiming done.
8. Git/push workflow:
   - upstream origin is read-only for current account;
   - publish through fork branch `feat/ai-manuscript-studio-workflow-20260519` and PR #2;
   - verify `HEAD...fork/<branch> = 0 0` and PR head SHA equals local HEAD.
9. Runtime/deploy caution:
   - build/source changes are not automatically live in Obsidian;
   - deploy/reload only when user explicitly asks;
   - do not write actual vault files during source tasks.
10. Troubleshooting notes:
   - missing handoff JSON safe no-op;
   - path validation rejects absolute/parent traversal;
   - AI CLI settings are local; no API keys in repo.

Style:
- Korean.
- Terminal-readable Markdown.
- Avoid overlong prose.
- Use commands in fenced code blocks.
- Prefer current verified counts where relevant: targeted W3/W3A 29/29, full obsidian-plugin 268/268.
- Do not include secrets or private tokens.

VERIFY:
- `git diff --check -- 운영가이드.md`
- `test -s 운영가이드.md`
- grep/check guide contains: `ai-manuscript-studio`, `writing-handoff.json`, `feat/ai-manuscript-studio-workflow-20260519`, `PR #2`, `13.zettel-connect`.

REPORT:
- Summary of sections created.
- Verification evidence.
- Last line exactly: GUIDE_DONE
