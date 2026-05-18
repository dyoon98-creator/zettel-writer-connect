# Zettel Structure → AI 원고실 Integration Plan

작성시각: 2026-05-18 13:55 KST
대상 repo: /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
관련 안정 repo: /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect

> For agentic workers: implement task-by-task only after 대표님 approval. Do not deploy repo-wide. Do not overwrite 13.zettel-connect with the older zettel-connect bundled in this repo.

## Expanded Goal: Representative Voice Communication Studio

대표님 clarification (2026-05-18):
> “나의 문체 기반으로, 이메일 카카오톡 텔레그램, 보고서, 요약 보고자료, 메모 다양한 형식을 글을 쓰는 것이 중요하다. 영구노트/구조노트 내 문체 작성은 그중 한 부분이고 zettel과 연결되는 것이다.”

ai-manuscript-studio는 Zettel 브리지만이 아니라 **대표님 문체 기반 커뮤니케이션 스튜디오**로 확장한다. Zettel은 이 스튜디오의 입력 소스 중 하나일 뿐이다.

## Track Architecture

| Track | 목적 | 우선순위 |
|---|---|---|
| **Track C — Personal Communication Studio** | 이메일/카카오톡/텔레그램/보고서/요약보고자료/메모를 대표님 문체로 작성·다듬기 | B0/B1 먼저 |
| **Track W — Zettel/Structure Writing Bridge** | 구조노트/후보 묶음 → 4.Writing 프로젝트 브리지 | Track C 이후 병렬 |

Track C는 Track W의 하위 개념이 아니다. 두 Track은 독립 workstream으로 관리한다.

## Goal (Track W — 기존 목표)

대표님이 /structure 흐름에서 추천·생성·기존 구조노트 보강을 한 뒤, 그 구조노트와 관련 영구노트를 자연스럽게 AI 원고실의 글쓰기 프로젝트로 넘겨 원고 초안·목차·수정·문체 코칭까지 이어가게 한다.

## One-line Recommendation

Track C B0/B1(문체 코퍼스 거버넌스 + 커뮤니케이션 skillpack MVP)를 먼저 실행해 즉각 가치를 얻고, Track W(Zettel 브리지)는 별도 workstream으로 병렬 진행한다. 두 Track 모두 13.zettel-connect를 직접 수정하지 않는다.

## Evidence Summary

1. 14 repo 안의 packages/zettel-connect는 manifest version 0.1.0이며, 기존 13.zettel-connect는 version 0.1.6이다. 14 repo의 zettel-connect를 배포하면 기능 퇴행 위험이 있다.
2. 14 repo의 zettel-connect에는 AI 글쓰기 버튼 자체는 없다. 현재 버튼은 다음 계열이다.
   - 추천 받기
   - 링크 삽입
   - 저장만
   - raw seed일 때 영구노트로 승격
   - permanent seed일 때 영구노트 생성
   - 내부 호출은 /fleeting scan 또는 /permanent --from-candidates 중심
3. 13.zettel-connect에는 이미 14 repo보다 앞선 기획이 들어 있다.
   - structureFolder: "3.Structure/"
   - CLI 구조노트 명령 템플릿: /structure --from-candidates {path}
   - 3.Structure/ 노트를 seed로 열면 버튼명이 “구조노트 생성”으로 바뀐다.
   - Codex gpt-5.5 high + oMLX 8790 embedding 기본값이 들어 있다.
4. AI 원고실은 다음 입력 지점이 있다.
   - 4.Writing/<project>/project.json
   - 4.Writing/<project>/binder.json
   - 4.Writing/<project>/planning.md
   - ProjectMeta.sourceNotes: 관련 노트 목록
   - BinderNode.customMetadata: 각 장면/폴더별 출처·구조노트 id 보관 가능
   - linkedFile: 외부/볼트 파일 shortcut 가능
5. AI 원고실의 AI 코칭은 원고 본문, 선택 영역, source_notes, reader, core_message를 프롬프트 재료로 쓰도록 설계되어 있다. 다만 v2 프로젝트의 sourceNotes와 일부 v1 frontmatter source_notes 경로가 혼재되어 있어, 브리지 구현 시 이 부분을 정리해야 한다.

## Product Flow

### Flow A — 신규 구조노트에서 글쓰기 프로젝트로

1. 대표님이 /structure를 누른다.
2. Hermes 또는 Zettel Connect가 영구노트 후보를 추천한다.
3. 대표님이 후보를 고른다.
4. /structure --from-candidates가 승인용 구조노트 초안을 만든다.
5. 구조노트가 3.Structure/에 저장된다.
6. 구조노트 화면 또는 Zettel Connect 패널에 “✍️ 원고실로 보내기” 버튼이 보인다.
7. 버튼을 누르면 AI 원고실 프로젝트가 자동 생성된다.
   - 위치: 4.Writing/<구조노트-slug>/
   - project.json.sourceNotes: 구조노트 + 관련 영구노트 링크
   - planning.md: 구조노트 11섹션을 원고 기획/뼈대/자료로 매핑
   - binder.json: 도입/논거1/논거2/반대/결론 같은 장면 트리 생성
8. AI 원고실에서 바로 제목 후보, 뼈대 만들기, 초안 코칭, 편집자 피드백, 문체 수정이 가능해진다.

### Flow B — 기존 구조노트 보강 후 원고 수정

1. 대표님이 기존 3.Structure/<파일>.md를 연다.
2. 13.zettel-connect가 현재 구조노트를 seed로 주변 영구노트 후보를 추천한다.
3. “구조노트 생성” 또는 향후 “구조노트 보강”으로 /structure --from-candidates를 실행한다.
4. 갱신된 구조노트가 있다면, 관련 원고 프로젝트의 sourceNotes와 planning.md에 동기화한다.
5. AI 원고실은 기존 원고 장면을 유지한 채, 갱신된 구조노트/영구노트를 참고 맥락으로 써서 수정 제안을 한다.

### Flow C — Zettel Connect 후보에서 바로 글쓰기

1. 2.Permanent/ 노트를 열고 Zettel Connect 추천 후보를 본다.
2. 후보를 체크한다.
3. 새 버튼 “✍️ 원고 프로젝트 만들기”를 누른다.
4. 구조노트 파일 생성 전이라도 임시 writing handoff JSON을 만들고, AI 원고실 프로젝트를 생성한다.
5. 단, 추천 기본값은 “먼저 구조노트 초안 → 원고실”이다. 영구노트에서 바로 글쓰기는 빠른 메모/칼럼용 보조 루트로 둔다.

## Architecture

### Principle

파일 기반 계약(file contract)을 쓴다. 플러그인 A가 플러그인 B의 내부 React store나 private class를 직접 호출하지 않는다. 법률 계약으로 비유하면, 두 회사가 상대 회사의 내부 회계시스템에 직접 접속하지 않고 표준 양식의 데이터룸 파일을 주고받는 구조다.

### Contract: _index/writing-handoff.json

Path:
_index/writing-handoff.json

Shape:
```json
{
  "version": 1,
  "mode": "new-structure-to-writing",
  "createdAt": "2026-05-18T13:55:00+09:00",
  "vaultRoot": "/Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고",
  "structureNote": {
    "path": "3.Structure/20260518. example.md",
    "title": "example",
    "id": "S-...",
    "claim": "..."
  },
  "seed": {
    "id": "...",
    "claim": "...",
    "cluster": "...",
    "tags": []
  },
  "picked": [
    {
      "id": "...",
      "claim": "...",
      "cluster": "...",
      "tags": [],
      "path": "2.Permanent/...md",
      "score": 0
    }
  ],
  "targetWritingFolder": "4.Writing",
  "project": {
    "title": "...",
    "genre": "essay",
    "wordGoal": 3000,
    "status": "planning"
  }
}
```

### AI 원고실 Project Mapping

project.json:
- title: 구조노트 topic 또는 파일명
- genre: 기본 essay
- status: planning
- sourceNotes:
  - [[3.Structure/<파일명>]]
  - [[영구노트1]]
  - [[영구노트2]]
- coreMessage: 구조노트 frontmatter claim 또는 ## 🗂 주장
- targetReader: 빈 값, 나중에 대표님이 지정
- customMetadata:
  - zettel_bridge_version: "1"
  - structure_note_path: "3.Structure/...md"
  - source_candidates_path: "_index/connect-candidates.json"

planning.md:
- # 기획 — <title>
- ## 구조노트 원문 요약
- ## 핵심 주장
- ## 목차 후보
- ## 자료 맵
- ## 초안 지시

binder.json:
- root folder: “구조노트 기반 원고”
- children:
  - 01-도입.md
  - 02-문제정의.md
  - 03-논거1.md
  - 04-논거2.md
  - 05-반대와 한계.md
  - 06-결론.md

각 scene frontmatter:
- type: writing-scene
- plugin: ai-manuscript-studio
- project: <slug>
- scene_id: <id>
- synopsis: 구조노트 해당 섹션에서 온 설명
- custom source metadata는 binder node customMetadata에 보관

## Implementation Tasks

### Task 1 — Keep 13.zettel-connect as stable engine

Files:
- Read-only reference: /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/view/ConnectionPanel.ts
- Read-only reference: /Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect/src/settings.ts

Steps:
1. Do not copy packages/zettel-connect from 14 repo into the vault.
2. Confirm installed Zettel Connect version remains 0.1.6.
3. Confirm settings include:
   - permanentFolder = 2.Permanent/
   - structureFolder = 3.Structure/
   - cliCommandTemplateStructure contains /structure --from-candidates {path}
4. Later enhancement target: add one explicit permanent-seed button “🧱 구조노트 초안” if 대표님 wants structure creation directly from 2.Permanent candidates.

Verification:
- Build 13.zettel-connect only if we modify it.
- Run npm test in 13.zettel-connect.
- Compare installed main.js/manifest/styles hashes before claiming live.

### Task 2 — Add AI 원고실 import service

Files:
- Create: packages/obsidian-plugin/src/structureBridge/types.ts
- Create: packages/obsidian-plugin/src/structureBridge/parseStructureNote.ts
- Create: packages/obsidian-plugin/src/structureBridge/createWritingProjectFromHandoff.ts
- Modify: packages/obsidian-plugin/src/createProject.ts if shared helpers are needed

Required behavior:
- Read _index/writing-handoff.json or active structure note path.
- Resolve structure note and picked permanent note paths.
- Create 4.Writing/<slug>/project.json.
- Create 4.Writing/<slug>/binder.json.
- Create 4.Writing/<slug>/planning.md.
- Create initial scene markdown files.
- Never write to 2.Permanent, 3.Structure, VAULT_INDEX, or STRUCTURE_INDEX in this import step.

Tests:
- Create InMemoryVault test with sample structure note and candidate payload.
- Assert project.json.sourceNotes contains the structure note and all picked notes.
- Assert binder has expected scene count and no duplicate IDs.
- Assert planning.md includes 구조노트 title, claim, and related notes.

### Task 3 — Add Obsidian command in AI 원고실

Files:
- Modify: packages/obsidian-plugin/src/main.ts
- Create: packages/obsidian-plugin/src/StructureImportModal.ts

Commands:
- AI 원고실: 현재 구조노트를 원고 프로젝트로 가져오기
- AI 원고실: writing-handoff.json에서 원고 프로젝트 만들기

Modal fields:
- 프로젝트 제목
- 장르: essay/practical/youtube/lecture 등 existing Genre 사용
- 목표 글자 수
- 포함할 영구노트 수
- 구조노트 원문을 planning.md에 포함할지 여부

Verification:
- Command palette에서 명령 표시.
- 3.Structure 파일이 아닌 곳에서 실행하면 안전하게 경고.
- 생성 후 AI 원고실 프로젝트 인덱서에 카드 표시.

### Task 4 — Add bridge button to Zettel Connect only if needed

Primary implementation should avoid modifying 13 until AI 원고실 import command works.

Later files in 13.zettel-connect if approved:
- Modify: src/view/ConnectionPanel.ts
- Modify: src/settings.ts if handoff path configurable
- Modify: src/actions/save-candidates.ts or create src/actions/save-writing-handoff.ts

Button proposal:
- On 2.Permanent seed: “🧱 구조노트 초안” and “✍️ 원고 프로젝트” can be separate buttons.
- On 3.Structure seed: existing “📝 구조노트 생성” remains, add “✍️ 원고실로 보내기”.

Safer default:
- Only write _index/writing-handoff.json and open AI 원고실 import command.
- Do not directly create 4.Writing files from Zettel Connect; let AI 원고실 own its project schema.

### Task 5 — Fix sourceNotes context in AI 원고실

Issue:
- v2 ProjectMeta uses sourceNotes camelCase.
- old ContextComposer reads frontmatter source_notes snake_case for v1 markdown project files.
- SelectionPopover wraps phase2 actions and currently blanks source_notes for selection-level actions.

Files to inspect/modify:
- packages/core/src/ai/ContextComposer.ts
- packages/obsidian-plugin/src/studio/editor/selectionPrompts.ts
- packages/obsidian-plugin/src/studio/ai/streamingChat.ts
- packages/obsidian-plugin/src/studio/vaultAdapter.ts
- packages/obsidian-plugin/src/studio/inspector/InspectorPane.tsx

Expected behavior:
- Project-level actions use meta.sourceNotes as context.
- Selection-level actions can optionally include current project sourceNotes.
- Inspector shows sourceNotes and later allows add/remove.

Tests:
- Project with sourceNotes ["[[A]]", "[[B]]"] produces notesContext containing A and B.
- Folders 4.Writing and 9.Archive remain excluded from autocomplete/search context to avoid self-contamination.

### Task 6 — Installation/verification gate

Commands:
```bash
cd /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
pnpm --filter @ai-manuscript-studio/core test
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/obsidian-plugin build
node --check packages/obsidian-plugin/main.js
```

Deploy only after approval:
```bash
cd /Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect
OBSIDIAN_VAULT_PLUGINS_DIR="/Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/.obsidian/plugins" \
OBSIDIAN_PLUGIN_INSTALL_ROOT="/Users/dongchanyoon/.local/obsidian-plugins" \
pnpm deploy:ai-manuscript
```

Do not run:
```bash
pnpm run deploy
pnpm deploy:zettel
```

## Rollout Strategy

Phase 0 — Today, no risky deploy
- Install AI 원고실 only if 대표님 approves.
- Keep 13.zettel-connect untouched.
- Manually test existing /structure and existing AI 원고실 project creation.

Phase 1 — Minimal bridge
- AI 원고실 command imports active 3.Structure note into 4.Writing.
- No changes to 13.zettel-connect.
- This already supports “기존 구조노트 → 글쓰기 프로젝트”.

Phase 2 — Handoff bridge
- AI 원고실 reads _index/connect-candidates.json or _index/writing-handoff.json.
- Supports “후보 묶음 → 구조노트/원고 프로젝트”.

Phase 3 — UI polish
- Add Zettel Connect button “원고실로 보내기”.
- Optional permanent-seed “구조노트 초안” button.
- Add sourceNotes editor in AI 원고실 Inspector.

## Acceptance Criteria

1. 13.zettel-connect 0.1.6 is not downgraded.
2. AI 원고실 plugin installs as ai-manuscript-studio only.
3. 4.Writing is the writing root.
4. A 3.Structure note can produce a valid 4.Writing project.
5. The generated project opens in AI 원고실.
6. project.json.sourceNotes points to the source structure note and permanent notes.
7. AI actions can use those notes as context.
8. No write occurs to VAULT_INDEX from the bridge.
9. Tests and build pass before any deploy claim.

## Open Decisions for 대표님

Decision 1: 첫 구현 범위
- Recommended: Phase 1 first — “현재 구조노트 → AI 원고실 프로젝트 가져오기”.
- Reason: smallest useful bridge, 13.zettel-connect untouched, immediate writing benefit.

Decision 2: structure creation from permanent candidates
- Recommended: after Phase 1, add explicit “🧱 구조노트 초안” button to 13.zettel-connect.
- Reason: current 13 flow supports structure mode best when active seed is already under 3.Structure; 대표님이 원하는 “영구노트 후보 → 신규 구조노트”에는 명시 버튼이 더 자연스럽다.

Decision 3: AI source context
- Recommended: make project.json.sourceNotes the canonical v2 context source.
- Reason: project schema already has sourceNotes; snake_case source_notes is legacy v1 compatibility.

## Phase B Roadmap (Track C — Communication Studio)

| Phase | 이름 | 범위 | core diff | 의존 |
|---|---|---|---|---|
| **B0** | Voice corpus governance + Obsidian smoke test | 코퍼스 allow-list 규칙 정의 + 기존 voice 기능 수동 검증 | 0 | 없음 |
| **B1** | Communication skillpack MVP | email/kakao/telegram/report/summary-briefing/memo 6종 skillpack prompt 파일 + manifest | 0 | B0 |
| **B2** | Quick Compose UX | intent→register→preview→copy Obsidian command + 경량 modal (core 변경 필요) | 중간 | B1 |
| **B3** | Register-specific voice guides | base StyleGuide + 이메일/카카오/보고서 delta 레지스트리 (core 변경 필요) | 중간 | B1 |
| **B4** | Zettel-to-comms bridge | 구조노트 → 보고서/브리핑/메모 포맷 연결 | 낮음 | B2 + B3 |

**Phase B 핵심 제약**:
- B0/B1은 core code diff 0 목표. skillpack 파일만, 내부 TypeScript 코드 수정 X.
- 외부 발송(Gmail API/Kakao/Telegram) 범위 밖. draft/preview/copy만.
- 볼트 전체 자동 학습 금지. 허용 목록(allow-list) corpus 파일만.
- SaveTarget 신규 타입 추가 없음; 기존 draft/feedback/plan 활용.
- Genre union 확장 X; 포맷 분기는 skillpack prompt 안에서 처리.
- Quick one-off compose는 현재 4.Writing 프로젝트 wizard와 분리된 경량 진입점 필요 → B2.

## Risks

| 위험 | 가능성 | 완화책 |
|---|---|---|
| **Privacy — 전체 볼트 자동 학습** | 높음 | allow-list corpus 파일만 voice 폴더 대상; 2.Permanent/3.Structure VAULT_INDEX 접근 X |
| **직접 발송 scope creep** | 중간 | B1~B2는 copy/insert only; Gmail/Kakao API는 별도 approval gate |
| **Global voice 평탄화** | 중간 | B0 단계에서 base StyleGuide 고정; 레지스터별 delta는 B3로 분리 |
| **Obsidian shim folder picker 미작동** | 높음 | VoicePane.pickFolder가 Obsidian 모드에서 비기능 확인됨 → B2 modal은 텍스트 입력 fallback 필수 |
| **Upstream skillpack schema drift** | 낮음 | SaveTarget/Genre 확장 없이 기존 타입 활용; sanitizeManifest 통과 검증 포함 |
| **Track W 퇴행** | 낮음 | 13.zettel-connect 미수정 유지; 14 repo zettel-connect 미배포 |
| **Intent → message generation prompt 부재** | 중간 | 기존 62개 액션은 revision/coaching 중심; B1에서 intent→compose 신규 프롬프트 설계 필요 |
