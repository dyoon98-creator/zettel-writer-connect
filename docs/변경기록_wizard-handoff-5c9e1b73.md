*Version: v1.0 (2026-08-31)*

# 변경기록 — wizard-handoff: 컨셉 마법사가 만든 것을 기획 인터뷰가 «알게» 한다

작업키: `wizard-handoff-5c9e1b73`
레포: `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect`
지시서: `00.NPL_Control_Center/04_HANDOFFS/지시서_20260831_wizard-handoff-5c9e1b73.md`

한 줄 — **값을 잃은 것이 아니라 읽는 쪽이 없었다.** 그 배선을 이었고, 문서 종류가 침묵으로 정해지던 함정을 원천에서 막았고, 이미 볼트에 있는 프로젝트도 이어지게 했다.

---

## 1. 과제 A 판정 — 무엇을 넘기고 어디에 담았나

### A-1. 무엇을 넘기는가 — 「단계가 판단에 쓰는 만큼만」

| 컨셉 산출물 | 넘기나 | 어느 단계가 쓰나 | 판정 근거 |
|---|---|---|---|
| `conceptParagraph` | **넘긴다** (500자 상한) | `audience-message` | 독자·핵심 메시지가 대개 이 단락에 들어 있다 |
| `synopsis` | **넘긴다** (500자 상한) | `tone` | 문체는 «선언» 이 아니라 이미 쓴 글에서 읽어내는 것이다 |
| `memo.analysis.emotionAxis` | **넘긴다** (200자) | `motive` | 「이 글을 왜 쓰는가」의 가장 짧은 답 |
| `memo.analysis.developmentDirections` | **넘긴다** (5개×160자) | `motive` | 확인 선택지 2~4번의 «재료» |
| `memo.analysis.strongSentences` | **넘긴다** (5개×160자) | `audience-message` | 핵심 메시지 후보의 재료 |
| `treatment[]` — **역할 + 제목만** | **넘긴다** (12장 상한) | `structure-pick` | 구조가 «이미 있다» 는 사실을 알리는 데 이것이면 충분 |
| `treatment[].summary` (카드 본문) | **프롬프트에는 안 싣는다** | — | 9장×150자면 1.4KB 가 더 붙어 출력 규칙을 밀어낸다. 본문은 `structureProposal` 로만 간다 |
| `memo.raw` (원본 메모 전문) | **안 넘긴다** | — | 분석 결과가 이미 있는데 원본을 또 실을 이유가 없다 |
| `conversation[]` (컨셉 대화 전사) | **안 넘긴다** | — | 결론이 `conceptParagraph`·`synopsis` 에 이미 응축돼 있다 |
| `attachedNotes` | 넘긴다 (8개) | 전 단계 | 짧고, AI 가 「참고 자료가 있다」를 알아야 한다 |

실측 — 대표의 실제 프로젝트(9장 트리트먼트)로 만든 `{{structured_handoff}}` 는 약 1.4KB. 카드 본문까지 실었으면 약 2.8KB.

### A-2. 어디에 담는가 — `WizardSession.conceptHandoff` (core)

세 안을 다 재고 골랐다.

| 안 | 대가 | 판정 |
|---|---|---|
| (가) `WizardSession` 에 필드 추가 | `packages/core` 공용 타입 변경 | **채택** |
| (나) 별도 타입을 plugin 쪽에만 | `WizardAIBridge.askNextQuestion(session)` 이 **세션만** 받는다. 이 안은 bridge 인터페이스까지 바꿔야 한다 | 기각 |
| (다) 매번 `planning.md` 를 읽는다 | bridge 에 IO 가 들어간다. 컨셉 결과는 마크다운이라 매 질문마다 재파싱 | 부분 채택 — **입력 경로로만** 쓴다 |

**core 타입 변경의 파급을 셌다 — 실측 4곳, 전부 «더하기» 라 깨진 곳 0.**

1. `WizardSession` — `conceptHandoff?` 추가 (optional → 기존 생성자 전부 그대로 통과)
2. `StageOutcome` — `skippedReason?` 추가 (optional)
3. `WizardEngine` 생성자 — `initial?.conceptHandoff` 를 그대로 옮김
4. `browser.ts` — 타입·상수 재수출 3줄

`pnpm --filter @ai-manuscript-studio/core test` → **26 suites / 311 tests 전부 통과, 변동 0.**
`apps/desktop` 도 같은 core 를 쓰지만 optional 필드라 손대지 않고 통과했다.

> **하마터면 깨질 뻔한 것 하나 — 실측으로 잡았다.**
> 처음에는 `StageStatus` 에 `"skipped"` 를 더하려 했다. 실제로 넣고 `pnpm typecheck` 를 돌리니
> `apps/desktop/src/wizard/WizardSidebar.tsx(75,83)`·`(78,32)` 두 곳이 `TS2345` 로 죽었다
> (그 파일이 union 을 `"pending" | "active" | "complete"` 로 좁게 받는다).
> `apps/desktop` 은 **수정 금지** 라 되돌렸다. 그래서 상태는 `complete` 로 두고
> 사실은 `skippedReason` 이 들고 있게 했다 → A-3·과제 C 참고.

### A-3. 이어받은 값과 인터뷰에서 확정한 값을 구별하는가 — **planning.md 에는 남기지 않는다**

- **왜 안 남기나.** 이어받은 값은 사용자가 **확인 화면에서 한 번 더 누른 뒤에야** 결정이 된다. 「맞습니다」를 고르는 순간 그것은 이어받은 값이 아니라 «확인된 값» 이다. planning.md 에 「이건 컨셉에서 왔다」를 남기려면 직렬화 형식 + 파서 + 왕복 테스트가 함께 늘어나는데, 그 대가로 얻는 것이 「사용자가 별 생각 없이 눌렀을 수 있다」는 추측뿐이다.
- **대신 «구별이 필요한 자리» 두 곳에는 남겼다.**
  - 프롬프트 — `concept_source: concept-wizard | planning-md` 로 어디서 왔는지 AI 가 안다.
  - 화면 — 건너뛴 단계는 사이드바에 「완료」가 아니라 **「이어받음(◎)」** 으로 그린다. 사용자가 안 한 일을 했다고 말하지 않는다.

---

## 2. 과제 B 판정 — 확인을 어떻게 «묻는가»

### B-1. 어느 프롬프트를 고쳤나 — 셋 (`motive` · `audience-message` · `tone`)

`structure-pick.md` 는 **안 고쳤다.** 트리트먼트가 있으면 그 단계 자체를 건너뛰고, 없으면 지금 그대로 물어야 하기 때문이다(고치면 C4 회귀).
`stage-summary.md` · `final-summary.md` 도 안 고쳤다 — 이어받기와 무관한 요약 단계다.

**뼈대는 손대지 않았다.** `# 누적 결정사항 (…다시 묻지 말 것)` + `{{structured_handoff}}` 는 그대로 두고, **그 아래에 「확인 모드」 절 하나를 «더했을» 뿐**이다.

#### 바꾸기 전 / 뒤 (motive.md)

**전**
```
# 누적 결정사항 (이미 정해진 정보 — 다시 묻지 말 것)
{{structured_handoff}}

# 현재 단계 진행도
이 단계에서 작성자가 한 답변 수: {{stage_user_turn_count}}
```

**후** (사이에 들어간 절)
```
# 확인 모드 — 위에 `concept_carried: true` 가 **있을 때만** 적용
작성자는 이미 컨셉 마법사에서 컨셉·시놉시스·메모 분석을 만들어 왔다. 여기서 처음부터
다시 묻는 것은 앞에서 한 일을 지우는 것이다. **묻지 말고 확인을 받는다.**

- `intro` — 이어받은 것을 한두 문장으로 되짚는다. `concept_memo_emotion_axis` 와
  `concept_memo_directions` 를 근거로 "이 글의 출발점은 …로 보입니다" 라고 **먼저 말한다.**
- `question` — "이 출발점으로 가도 될까요?" 형태의 **확인 질문** 한 문장.
- `options` 5개 —
  1. **반드시 `맞습니다 — <이어받은 출발점 요약 15자 내>` 로 시작한다.**
  2~4. `concept_memo_directions` 를 근거로 한, 결이 조금씩 다른 대안 세 개.
  5. 항상 **"직접 입력"** — 「고치겠습니다」를 고르는 자리다.
- `prior_interview.motive` 가 있으면 그 값을 1번 선택지의 근거로 우선한다.
- **요약이 틀렸을 수 있다.** 그래서 1번을 고르지 않고도 빠져나갈 길(2~5번)을 반드시 남긴다.

`concept_carried` 가 **없으면** 이 절 전체를 무시하고 아래 「현재 단계 진행도」대로 평소처럼 묻는다.
```

`audience-message.md` · `tone.md` 도 같은 형태(각 단계가 쓰는 근거만 다름).
장르 충실성 규칙도 한 줄씩 더했다 — *「draft_genre 가 있으면 그 장르의 가이드만 쓴다. 다른 장르의 어휘를 섞지 않는다」* (연애 이야기에 「투자 판단」이 다시 나오지 않게).

### B-2. 선택지 «모양» — 새 UI 0개

지금 화면(`WizardChat.tsx`)의 구조는 **객관식 5 + 마지막 항목이 「직접 입력」 → 그 자리에서 textarea 가 펼쳐지고 [답변] 버튼**이다. 확인은 그 구조에 정확히 들어맞는다.

```
1. 맞습니다 — 오래 묵힌 한 장면        ← 누르면 즉시 다음 단계
2. 처음 거절과 다시 다가옴에서 시작
3. 불안이 편안함이 된 변화에서 시작
4. 사소한 장면들로 동반자를 말하기
5. 직접 입력                          ← 「고치겠습니다」. textarea 가 열린다
```

- `handleChoiceSelect` — 마지막이 아닌 항목은 **클릭 즉시 전송**(확인이 1클릭).
- 마지막 항목만 textarea + [답변] — **그 자리에서 고친다.**

**새 컴포넌트 0 / 새 상태관리 0 / 새 dispatcher 0.** `WizardChat.tsx` 는 한 글자도 안 고쳤다.

### B-3. AI 가 이어받은 값을 «잘못 요약하면» 사용자가 할 수 있는 것 — 넷

1. 2~4번의 다른 후보를 고른다.
2. **5번 「직접 입력」** 으로 그 자리에서 직접 쓴다.
3. 마지막 AI 메시지의 **[재생성]** 버튼으로 다시 만들게 한다(기존 기능).
4. 사이드바에서 해당 단계를 눌러 **되돌아간다**(기존 기능. 건너뛴 단계도 눌린다).

---

## 3. 과제 C 판정 — `structure-pick` 건너뛰기의 파급

### C-2 먼저 — 건너뛴 단계의 `StageOutcome` 을 무엇으로 채우나

지시서가 준 두 선택지는 둘 다 거짓말이다. `pending` 은 미완으로 보이고, 그냥 `complete` 는 사용자가 안 한 일을 했다고 기록한다.

**판정 — 상태는 `complete`, 사실은 새 필드 `skippedReason` 이 들고 있는다.**

- `status` 는 상태머신의 값이다. 뜻은 「이 단계가 더 이상 진행을 막지 않는다」이고, 그것은 **참**이다(사용자가 컨셉 마법사에서 이미 구조를 짰다).
- 「사용자가 여기서 답한 적이 없다」는 사실은 `skippedReason` 이 문장으로 들고 있고, **화면과 최종 요약이 그 필드를 읽어** 「완료」가 아니라 「이어받음」으로 그린다.
- `StageStatus` 에 `"skipped"` 를 더하는 안이 더 깔끔했지만 **실측으로 기각**했다 — `apps/desktop/src/wizard/WizardSidebar.tsx` 두 줄이 `TS2345` 로 죽는데 그 파일은 수정 금지다(§1 A-2 참고). 판정 사유는 `packages/core/src/wizard/types.ts` 의 `skippedReason` 주석에 함께 박제했다.

### C-1. 끊어지는 자리 — **15자리를 세고 각각 답했다**

| # | 자리 | 무엇이 끊기나 | 어떻게 닫았나 |
|---|---|---|---|
| 1 | `WizardEngine.advance()` | `WIZARD_STAGES` 를 순서대로 도는데 4번째를 건너뛸 수가 없다 | engine 을 안 건드렸다. `advance()` 가 `structure-pick` 을 내놓은 «뒤» 에 store 가 `skipStage` 를 부른다 |
| 2 | `WizardEngine.canAdvance()` | `status === "complete"` 검사 | `skipStage` 가 `complete` 로 두므로 그대로 통과 |
| 3 | `WizardEngine.getProgress()` | `complete` 수 / 4 | 4/4. **「0/4 인데 3단계만 도는」 어긋남이 생기지 않는다** |
| 4 | `WizardEngine.isFullyComplete()` | 4개 전부 complete 여야 true | true |
| 5 | `WizardEngine.finalize()` 의 미완 검사 | 건너뛴 단계가 pending 이면 throw | throw 안 함 (테스트로 고정) |
| 6 | `WizardEngine.finalize()` 의 `structureProposal` | AI 가 전사만 보고 «지어낸» 구조가 트리트먼트를 덮어쓴다 | **`carriedStructure()` 신설.** 건너뛴 경우 트리트먼트 카드가 1순위, AI 구조 2순위, 4부 안전망 3순위 |
| 7 | `wizardStore.completeCurrentStage()` | `advance()` 결과가 `const` 라 건너뛸 수 없다 | `let` 으로 바꾸고 skip 분기 한 덩이 삽입 |
| 8 | `wizardStore.STAGE_TURN_LIMIT` | `structure-pick: 1` 이 남는다 | **남겨 둔다.** 사용자가 사이드바로 되돌아가면 그때 다시 쓰인다 |
| 9 | `useWizardProgress()` → 사이드바 진행 막대 | 3/4 로 멈춰 미완처럼 보인다 | 4/4 (#3 과 같은 이유) |
| 10 | `WizardSidebar` 단계 목록 | 「완료 ●」로 그려 안 한 일을 했다고 말한다 | `skippedReason` 을 읽어 **「이어받음 ◎」** + 요약 앞에 「이어받음 — 」 |
| 11 | `WizardSidebar` 되돌아가기 | 건너뛴 단계를 못 열면 구조를 못 바꾼다 | 그대로 눌린다. 누르면 `structure-pick` 질문이 정상으로 뜬다 |
| 12 | `PlanningMdWriter.serialize` 의 `## 4단계: 글 구조` | 메시지가 없어 헤더만 남는다 | **어긋남 아님** — `wizardSeed` 는 원래 `stageSummaries` 없이 부르므로 모든 단계가 헤더+전사뿐이다. 구조는 `## 최종 기획 요약` 의 「구조 제안」에 9장이 다 들어간다. 상세는 §8 「보고만 한 것」 |
| 13 | `buildStructuredHandoff` 의 단계 순회 | `structure-pick` 을 안 싣는다 | **원래 안 싣는다**(`["motive","audience-message","tone"]`). 변경 없음 |
| 14 | `WizardOverlay` 의 시드 안내 (`structureProposal.length`) | 「N개의 장이 만들어집니다」가 틀린다 | #6 덕에 트리트먼트 장수가 그대로 표시된다 |
| 15 | `prompts/final-summary.md` — 「structure-pick 에서 고른 템플릿을 transcript 에서 찾아라」 | 건너뛰면 찾을 것이 없다 | **무해.** #6 이 AI 의 `structure` 를 무시한다. 프롬프트는 안 고쳤다(고치면 컨셉 없는 경로가 바뀐다) |

### C-3. 트리트먼트 카드 → `structureProposal` 변환이 필요한가 — **필요하다. 모양이 다르다**

| `TreatmentCard` | `structureProposal` 항목 |
|---|---|
| `id`, `title`, `role`, `summary`, `keySentence?`, `readerEmotion?`, `note?` | `id`, `title`, `synopsis` |

`role`·`keySentence`·`readerEmotion`·`note` 는 받을 자리가 없다. `summary → synopsis` 로 옮기고 나머지는 `concept-summary.md` 에 그대로 보존된다(영구 보관본이라 잃지 않는다). 변환은 `WizardEngine.carriedStructure()` 한 곳에만 있다.

---

## 4. C2 grep — 새 필드를 «읽는 쪽» (출력 그대로)

```
$ grep -rn 'conceptHandoff' packages/obsidian-plugin/src packages/core/src | grep -v 'types.ts'
packages/obsidian-plugin/src/studio/wizard/wizardStore.ts:81:    conceptHandoff?: ConceptHandoff;
packages/obsidian-plugin/src/studio/wizard/wizardStore.ts:182:    if (opts?.conceptHandoff) engine.setConceptHandoff(opts.conceptHandoff);
packages/obsidian-plugin/src/studio/wizard/wizardStore.ts:207:    if (!opts?.conceptHandoff && opts?.targetProjectFolder) {
packages/obsidian-plugin/src/studio/wizard/wizardStore.ts:337:    const carriedCards = engineRef.session.conceptHandoff?.treatment ?? [];
packages/obsidian-plugin/src/studio/wizard/wizardHandoff.ts:70:  lines.push(...conceptHandoffLines(session.conceptHandoff));
packages/obsidian-plugin/src/studio/wizard/wizardHandoff.ts:101:function conceptHandoffLines(handoff?: ConceptHandoff): string[] {
packages/obsidian-plugin/src/studio/wizard/wizardHandoff.ts:175:export function conceptHandoffFromDraft(
packages/obsidian-plugin/src/studio/wizard/concept/Step5Commit.tsx:14:import { conceptHandoffFromDraft } from "../wizardHandoff";
packages/obsidian-plugin/src/studio/wizard/concept/Step5Commit.tsx:166:      // 여기서 `conceptHandoff` 를 함께 넘기는 것이 이 화면의 핵심이다.
packages/obsidian-plugin/src/studio/wizard/concept/Step5Commit.tsx:176:          conceptHandoff: conceptHandoffFromDraft(session),
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:269:                if (engine?.session.conceptHandoff && prev && prev !== g) {
packages/core/src/wizard/WizardEngine.ts:63:      conceptHandoff: initial?.conceptHandoff,
packages/core/src/wizard/WizardEngine.ts:84:    this._session = { ...this._session, conceptHandoff: handoff, updatedAt: nowIso() };
packages/core/src/wizard/WizardEngine.ts:288:    const cards = this._session.conceptHandoff?.treatment;

$ grep -rn 'skippedReason' packages/obsidian-plugin/src packages/core/src | grep -v 'types.ts'
packages/obsidian-plugin/src/studio/wizard/wizardStore.ts:334:    // 「완료」로 위장하지 않는다 — `skipStage` 가 `skippedReason` 을 남겨
packages/obsidian-plugin/src/studio/wizard/WizardSidebar.tsx:7:// 「건너뛴 단계」는 `status` 가 아니라 `skippedReason` 으로 구분한다.
packages/obsidian-plugin/src/studio/wizard/WizardSidebar.tsx:68:            (outcome as { skippedReason?: string }).skippedReason,
packages/core/src/wizard/WizardEngine.ts:90:   * `completeStage` 와 다른 점은 `skippedReason` 하나다. 상태는 `complete` 로
packages/core/src/wizard/WizardEngine.ts:109:      skippedReason: reason,
packages/core/src/wizard/WizardEngine.ts:287:    if (!pick?.skippedReason) return null;

$ grep -rn 'DEFAULT_DRAFT_GENRE' packages/obsidian-plugin/src packages/core/src | grep -v 'wizard/types.ts'
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:18:  DEFAULT_DRAFT_GENRE,
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:155:  // 기본값은 여기서 «정하지» 않는다 — core 의 DEFAULT_DRAFT_GENRE 한 곳이 정본이다.
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:157:  const [genreDraft, setGenreDraft] = useState<Genre>(DEFAULT_DRAFT_GENRE);
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:165:      setGenreDraft(DEFAULT_DRAFT_GENRE);
packages/obsidian-plugin/src/studio/wizard/WizardOverlay.tsx:169:    setGenreDraft(engine.session.draftGenre ?? DEFAULT_DRAFT_GENRE);
packages/core/src/browser.ts:230:  DEFAULT_DRAFT_GENRE,
packages/core/src/wizard/WizardEngine.ts:10:  DEFAULT_DRAFT_GENRE,
packages/core/src/wizard/WizardEngine.ts:250:      genre: this._session.draftGenre ?? DEFAULT_DRAFT_GENRE,
```

**세 필드 모두 «읽는 쪽» 이 있다.** `conceptHandoff` 14곳, `skippedReason` 6곳, `DEFAULT_DRAFT_GENRE` 8곳.

### 빌드 산출물까지 도달했는지 («저장» 이 아니라 «반영» 확인)

`pnpm --filter @ai-manuscript-studio/obsidian-plugin build` (exit 0) 뒤 `main.js` 안에서 실측:

| 문자열 | 번들 안 개수 |
|---|---|
| `concept_carried` | 7 |
| `concept_treatment_cards` | 1 |
| `concept-summary.md` | 3 |
| `skippedReason` | 2 |
| `확인 모드` (esbuild 가 `\uXXXX` 로 이스케이프) | 3 |
| `이어받음` (동) | 3 |
| `맞습니다` (동) | 3 |

esbuild 기본 charset 이 `ascii` 라 한글은 `확인…` 형태로 들어간다 — 원문 grep 이 0 이 나오는 것은 누락이 아니다(이스케이프 형태로 재확인함).

---

## 5. C4 — 컨셉 없는 경로가 안 깨졌음을 무엇으로 증명했나

**증명 셋.**

1. **문자열 동일성 고정** — 컨셉 없는 세션의 `buildStructuredHandoff` 출력을 «수정 전 코드의 출력 그대로» 리터럴로 박았다. 한 줄이라도 달라지면 빨간불이 켜진다.
   ```
   session_id: sess-1
   draft_title: 제목
   draft_genre: column-essay
   current_stage: motive
   stage[motive].status: active
   ```
   (이 테스트가 실제로 내 첫 기대값을 «틀렸다» 고 잡아 줬다 — `stage[motive].status` 줄을 빠뜨렸었다.)
2. **`concept_` 접두 줄이 하나도 없음** 을 별도로 고정 (`not.toMatch(/^concept_/m)`).
3. **프롬프트의 확인 모드에 조건이 걸려 있음** 을 프롬프트 셋 각각에 대해 고정 — 「`concept_carried` 가 **있을 때만** 적용」과 「없으면 무시」가 둘 다 문면에 있어야 통과한다. 조건 없이 확인 모드를 쓰면 이 테스트가 죽는다.

거기에 **기존 회귀 전부** — 수정 전 34 suites / 501 tests 가 하나도 줄지 않고 전부 통과한다(§7).

`structure-pick.md` 프롬프트 · `WizardChat.tsx` · `conceptSeed.ts` · `wizardSeed.ts` 는 **한 글자도 안 고쳤다.**

---

## 6. C7 — 수정 전 구현에서 몇 개가 빨강이었나 (E-026)

**두 번 쟀다.**

| 측정 | 결과 |
|---|---|
| ① 손대지 않은 트리에 그대로 실행 | **suite 자체가 컴파일 실패 — 0 tests 실행.** `Cannot find module '../../../src/studio/wizard/wizardHandoff'`, `Property 'skipStage' does not exist on type 'WizardEngine'` 외 |
| ② «껍데기만» 만든 상태 (API 는 있고 동작은 수정 전 그대로) | **49 중 33 빨강 / 16 초록** |

②가 의미 있는 수다. 껍데기는 이렇게 만들었다 — `buildStructuredHandoff` 는 수정 전 본문 그대로, `conceptHandoffFromDraft` 는 `{source:"concept-wizard"}` 만, `parseConceptHandoffFromMarkdown` 은 항상 `null`, `skipStage` 는 그냥 `completeStage`. 프롬프트·Step1Seed·WizardOverlay·wizardStore·Step5Commit·WizardSidebar 는 손대지 않은 상태.

빨강 33개의 갈래:

| 갈래 | 개수 |
|---|---|
| C1 — 컨셉이 프롬프트에 도달 | 4 |
| C3 — 프롬프트 확인 모드 (3파일 × 4) | 12 |
| C5 — 건너뛰기 파급 | 4 |
| C5-D — 종류 한 줄 | 5 |
| C5-E — 이미 있는 프로젝트 이어받기 | 7 |
| C4 — (내 기대값 오류를 잡음) | 1 |

초록 16개는 «지금도 맞아야 하는 것» 들이다 — 컨셉 없는 경로의 회귀 고정, 기존 4부 안전망, `{{structured_handoff}}` 뼈대 존재, 「직접 입력」 출구 존재 등. 이것들이 처음부터 초록인 것이 정상이다.

구현 후 → **49/49 초록.**

### 살아 있는 실물로 한 번 더 (C5-E 반영 확인)

대표의 실제 볼트 파일을 **읽기 전용** 으로 파서에 통과시켜 확인했다
(`~/Documents/Work/KnowledgeVault/3 Writing/처음에는-…-20260831/planning.md`, 123줄. 쓰기 없음. 확인용 임시 테스트는 실행 후 삭제).

```
cards: 9
roles: 도입|사례|사례|설명|문제 제기|문제 제기|전환|설명|결론
titles: 설렘 곁의 불안 / 잠들 수 있는 곁 / 각자의 딴짓 / 너무 잘 맞는 생활 /
        설렘이 잦은 자리 / (제목 없음) / 불안이 평화가 될 때 / 흔들림보다 단단하게 / 함께 걷는 동반자
emotionAxis: 처음의 설렘과 불안이, 함께 있을수록 편안하고 확신 있는 사랑으로 깊어지는 감정.
directions: 3   strong: 4
concept len: 223   synopsis len: 410
```

그대로 만든 `{{structured_handoff}}` 에 `concept_carried: true` · `concept_treatment_cards: 9` 와 9장 목록이 실린다. **대표가 오늘 만든 그 폴더를 다시 열어 「기획 인터뷰」를 누르면 이 값이 첫 질문부터 실린다.**

> 저장소 안의 테스트 픽스처에는 이 문면을 그대로 넣지 않았다. 대표의 사적인 글이라 **구조만 그대로 옮기고 문장은 중립 문장으로 바꿨다** — 파서가 읽는 것은 구조(`## 컨셉` / `### N. [역할] 제목` / `**핵심 문장** — ` …)다. 실물 검증은 위처럼 별도로 했다.

---

## 7. C6 — 테스트 수 전/후, typecheck

| 항목 | 전 | 후 | 판정 |
|---|---|---|---|
| `obsidian-plugin` suites | 34 | **35** (+1) | 통과 |
| `obsidian-plugin` tests | 501 | **550** (+49) | 전부 초록. 줄어든 것 0 |
| `core` suites | 26 passed (3 skipped) | **26 passed (3 skipped)** | 변동 없음 |
| `core` tests | 311 passed (18 skipped) | **311 passed (18 skipped)** | 변동 없음 |
| `pnpm typecheck` | exit 0 | **exit 0** | 통과 (`apps/desktop` 포함 전 패키지) |
| `core` build | — | exit 0 | |
| `obsidian-plugin` build | — | exit 0 | |

기존 테스트 중 **하나를 뒤집었다** — `Step1Seed.contract.test.ts` 의 `default genre is investment-strategy-memo`. 그 테스트가 «고치라고 지시받은 결함 자체» 를 계약으로 박고 있었기 때문이다(과제 D-1). 테스트 개수는 그대로 두고 단언을 뒤집었으며, 왜 뒤집혔는지를 그 자리에 주석으로 박았다. 다른 테스트는 손대지 않았다.

수정 전 원본 사본: `…/scratchpad/backup-HEAD/` (`git show HEAD:<경로>` 로 떠 둠. `git checkout`·`stash`·`restore` 는 쓰지 않았다). `.env`·키·토큰 비접촉.

---

## 8. skipped[] · 고치지 않고 보고만 한 것 · 도메인 되먹임

### skipped[]

**없음.** 새로 쓴 49개 테스트 중 `skip`·`todo`·`only` 는 0개다. 기존의 core `3 skipped suites / 18 skipped tests` 는 이 발주 전부터 있던 것이고 건드리지 않았다.

### 산출 선언 목록 중 안 고친 파일

| 파일 | 사유 |
|---|---|
| — | 없음. 선언된 11개 항목 전부 고치거나 만들었다 |

### 선언 목록 «밖» 을 고친 것 — 다섯 (전부 사유 있음, 감사받아야 할 항목)

| 파일 | 왜 불가피했나 |
|---|---|
| `packages/core/src/wizard/WizardEngine.ts` (수정) | `skipStage`·`setConceptHandoff`·`carriedStructure()` 가 없으면 과제 C 를 닫을 수 없다. `WizardSession` 타입만 고쳐서는 아무 일도 일어나지 않는다 |
| `packages/core/src/browser.ts` (수정) | `ConceptHandoff`·`DEFAULT_DRAFT_GENRE` 를 재수출하지 않으면 플러그인이 그 타입을 import 할 수 없다. 3줄 추가만 |
| `packages/obsidian-plugin/src/studio/wizard/wizardHandoff.ts` (신규) | **C1 이 「순수 함수 테스트로 고정하라」고 요구한다.** 그런데 `CLIWizardBridge.ts` 는 `./prompts/*.md?raw` 를 import 해 **jest 가 아예 못 읽는다**(실측: `Cannot find module './prompts/motive.md?raw'`). 순수 계산을 이 파일로 옮겨야만 테스트가 닿는다. `jest.config.cjs` 를 고치는 대안은 선행 발주가 방금 고친 공용 설정이라 피했다. 새 «체계» 가 아니라 기존 함수의 이사다 |
| `packages/obsidian-plugin/src/studio/wizard/WizardSidebar.tsx` (수정) | C5 가 「진행도 표시의 어긋남이 남으면 불합격」이라 했다. 건너뛴 단계를 「완료」로 그리면 그게 어긋남이다. 표시 로직 2함수 + 1분기 |
| `packages/obsidian-plugin/tests/studio/wizard/Step1Seed.contract.test.ts` (수정) | 그 파일이 «고치라고 지시받은 기본값» 을 계약으로 박고 있었다(§7) |

### 고치지 않고 보고만 한 것 — 넷

1. **`planning.md` 의 「4단계: 글 구조」 섹션이 건너뛴 티를 안 낸다.** `PlanningMdWriter.serialize(summary, { projectSlug })` 는 `stageSummaries` 없이 불려서 원래 모든 단계 섹션이 헤더+전사뿐이다. 건너뛴 단계에 「이어받음」을 남기려면 `wizardSeed.ts` 가 `stageSummaries` 를 넘겨야 하는데, 그 파일은 선언 목록 밖이고 기존 계약 테스트가 그 문면을 박고 있다. 구조 자체는 `## 최종 기획 요약` 의 「구조 제안」에 9장이 다 들어가므로 정보 손실은 없다.
2. **컨셉 마법사 1단계의 «문체·논조» 기본값(`decision-memo`) 도 같은 함정이다.** 대표 지시는 «문서의 종류»(장르)였으므로 톤은 손대지 않았다. 톤이 잘못 정해져도 인터뷰가 다시 확인받으므로 피해가 훨씬 작다.
3. **`conceptSeed.ts` · `wizardSeed.ts` 의 `?? "investment-strategy-memo"` 하드코딩 둘.** `DEFAULT_DRAFT_GENRE` 로 모을 수 있지만 기존 계약 테스트(`planningPrompts.contract.test.ts:193,211`)가 그 «문자열 리터럴이 있을 것» 을 박고 있어 건드리면 회귀가 난다. 다음 발주에서 테스트와 함께 옮기는 것을 권고한다.
4. **`main.js` 를 다시 빌드했다** (검증 목적). 이 파일은 gitignore 대상이고 볼트의 `.obsidian/plugins/ai-manuscript-studio/main.js` 심볼릭 링크가 이것을 가리킨다 — **옵시디언에서 플러그인을 다시 로드하면 이번 변경이 그대로 적용된다.** 되돌리려면 이전 커밋에서 다시 빌드하면 된다.

### 도메인 되먹임

| 무엇을 봤나 | 어디서 | 무엇이 문제인가 | 무엇이 맞다고 보나 |
|---|---|---|---|
| 지시서가 **자기 안에서 어긋난다** | 지시서 「금지」 표 *「`conceptWizardStore.ts`·`Step1~4`·`Step5Treatment` 수정 → 읽기만」* 대 「산출 선언」 `{"path": "…/concept/Step1Seed.tsx", "mode": "modify"}` 대 과제 D-1 *「두 화면의 기본값이 서로 갈라지지 않게 하라」* | `Step1Seed` 가 금지 표에서는 「읽기만」인데 산출 선언과 과제 D-1 에서는 «고쳐야만» 닫히는 대상이다. 충돌 우선순위(금지선 1위)를 그대로 따르면 과제 D-1 을 수행할 수 없다 | 금지 표를 `Step2~4`(발주 메일의 인라인 보강과 같게)로 좁히는 것이 맞다. 실행자에게 준 인라인 보강은 이미 `Step2~4` 였다 — **정본(지시서)이 낡고 보강이 최신인 상태**다 |
| 완료 기준 C6 의 기준선 수치가 **본문 F10 과 다르다** | C6: *「기준선 31 suites / 445 tests(F10)」* / F10: *「34 suites / 501 tests」* | 같은 문서 안에서 같은 값을 두 번 다르게 적었다. 실측은 F10 이 맞다(34/501) | C6 의 숫자를 지우고 F10 을 가리키게 하거나, 「시작 시점에 다시 세라」만 남기는 것이 맞다. 실행자가 어느 쪽을 믿을지 헷갈린다 |
| 「새 helper 0개」와 「순수 함수 테스트로 고정하라」가 **동시에 만족 불가능** | 금지 표 *「새 UI 컴포넌트·새 상태관리·새 dispatcher 도입 → 새 체계 0개」* + 발주 메일 *「새 dispatcher·gate·schema·helper·문서는 기본 0개」* 대 C1 | 검증 대상 함수가 vite 전용 `?raw` import 를 가진 파일 안에 있으면 «파일을 나누지 않고» 순수 함수 테스트를 쓸 방법이 없다 | 금지 문구를 「새 **추상 계층**·dispatcher·상태관리 0개」로 하고, **「테스트가 닿게 하기 위한 순수 모듈 분리는 허용」** 을 예외로 명시하는 것이 맞다. 지금 문구대로면 실행자가 테스트를 포기하거나 공용 jest 설정을 건드리게 된다 |
| `apps/desktop` 이 **폐기 예정인데 typecheck 게이트에 남아 있다** | `package.json` `"typecheck": "pnpm -r exec tsc -noEmit"` + `pnpm-workspace.yaml` `apps/*` | 「수정 금지」인 패키지가 완료 기준(`typecheck exit 0`)을 막는다. 실측으로 core 타입 확장 하나가 그쪽 2줄 때문에 기각됐다 — **폐기 예정 코드가 살아 있는 코드의 설계를 제약하고 있다** | `apps/desktop` 을 `.archive/` 로 옮기거나 typecheck 대상에서 빼는 것이 맞다(`CLAUDE.md` §7 이 이미 폐기 예정이라 적었다). 그 전까지는 core 타입의 union 확장이 사실상 불가능하다는 것을 발주 시 미리 알려야 한다 |
| 컨셉 마법사의 `planning.md` 에 **frontmatter 가 없다** | `conceptSeed.buildPlanningMd()` 출력 (실물 123줄 확인) 대 `PlanningMdWriter.serialize()` 출력 | 같은 파일 이름에 두 형식이 산다. `PlanningMdWriter.parse` 는 frontmatter 가 없으면 무조건 `null` 을 돌려주므로, 컨셉이 쓴 planning.md 는 기존 파서에게 «없는 파일» 이었다 | 컨셉이 쓰는 planning.md 에도 최소 frontmatter(`type: writing-planning` · `phase: concept`)를 붙이는 것이 맞다. 지금은 내가 별도 파서로 우회했지만, 두 형식이 한 이름을 쓰는 상태 자체가 다음 결함의 씨앗이다 |

---

## 9. 권고

**① `apps/desktop` 을 이번 주 안에 typecheck 게이트에서 빼라.** — 근거는 추측이 아니라 실측이다. `packages/core/src/wizard/types.ts:53` 의 `StageStatus` 에 `"skipped"` 한 낱말을 더하자 `apps/desktop/src/wizard/WizardSidebar.tsx(75,83)` 과 `(78,32)` 가 `TS2345` 로 죽었다. 그 파일은 `packages/obsidian-plugin/src/studio/wizard/WizardSidebar.tsx` 의 **죽은 사본**이고 `CLAUDE.md` §7 이 이미 폐기 예정이라 적었다. 그 결과 이번에 «상태머신에 맞는 값» 대신 «우회 필드» 를 골라야 했다. 실행 방법: `pnpm-workspace.yaml` 의 `- "apps/*"` 를 지우고 `apps/desktop` 을 `.archive/desktop/` 으로 옮긴다. 되돌리려면 두 줄을 되돌리면 된다. **그 다음 발주에서 `StageStatus` 에 `"skipped"` 를 넣고 `skippedReason` 을 지워라** — 그것이 원래 맞는 모양이다.

**② 컨셉 마법사의 `planning.md` 에 frontmatter 를 붙여라.** — `conceptSeed.ts:206-208` 이 같은 본문을 `concept-summary.md` 와 `planning.md` 두 곳에 쓰는데 둘 다 frontmatter 가 없다. 실물 확인: `~/Documents/Work/KnowledgeVault/3 Writing/처음에는-…-20260831/planning.md` 1행이 `## 컨셉` 이다. `PlanningMdWriter.parse` 는 `text.startsWith("---")` 가 아니면 즉시 `null` 이라(`PlanningMdWriter.ts:226`), 이 파일은 기존 파서에게 존재하지 않는 파일이었다. 붙일 것: `type: writing-planning` / `plugin: ai-manuscript-studio` / `project: <slug>` / `phase: concept`. 그러면 「기획 결과 보기」·「이어서 하기」·인덱서가 한 파서로 두 형식을 다 읽는다.

**③ 「직접 입력」 옵션의 이름을 확인 모드에서만 「고치겠습니다」로 바꾸는 것을 다음에 검토하라.** — 지금은 프롬프트가 마지막 옵션을 `"직접 입력"` 으로 «고정» 하게 돼 있어(`WizardChat.handleChoiceSelect` 가 마지막 항목만 textarea 를 여는 구조에 의존한다) 확인 화면에서도 「직접 입력」으로 보인다. 대표가 확정한 설계의 문면은 「고치겠습니다」다. 다만 지금 고치면 마지막 항목 판별을 «문자열» 이 아니라 «위치» 로 하는 현재 구조에 손을 대야 해서 이번 범위 밖으로 뒀다. 실행 방법: `WizardQuestion` 에 `otherLabel?: string` 을 더하고 `ChoiceInput` 이 그것을 렌더한다. 판별 로직(마지막 인덱스)은 그대로 둔다.

**④ 대표께 올릴 확인 하나 — 「고른 종류를 인터뷰에서 바꿀 수 있다」를 유지했다.** 기획 인터뷰 헤더의 종류 드롭다운은 그대로 두고, 컨셉을 이어받은 상태에서 종류를 바꾸면 *「앞서 만든 컨셉·시놉시스·트리트먼트는 <이전 종류> 기준으로 쓰인 것이라 결이 어긋날 수 있습니다」* 를 8초 알림으로 띄운다. **막지 않고 알린다** — 종류를 잘못 골랐다는 것을 컨셉을 다 만든 뒤에 깨닫는 경우가 실제로 있고, 그때 되돌아가서 다시 만들라고 하는 것이 더 나쁘기 때문이다. 이 판단이 대표 뜻과 다르면 한 줄 알려주시면 막는 쪽으로 바꾼다.
