*Version: v1.0 (2026-08-31)*

# 변경기록 — aiwait-ui-9b3ce5f0

**기다리는 동안 사용자가 무엇을 보는가**

**베이스**: `b36b9ec`

**만든 파일 둘**

- `packages/obsidian-plugin/src/studio/wizard/AiWaitBar.tsx` (신규 — 공용 부품)
- `packages/obsidian-plugin/tests/studio/wizard/aiWaitBar.test.ts` (신규 — 31 tests)

**고친 파일 다섯**

- `packages/obsidian-plugin/src/studio/wizard/concept/Step2Memo.tsx`
- `packages/obsidian-plugin/src/studio/wizard/concept/Step3Synopsis.tsx`
- `packages/obsidian-plugin/src/studio/wizard/concept/Step4Outline.tsx`
- `packages/obsidian-plugin/src/studio/wizard/concept/Step5Treatment.tsx`
- `packages/obsidian-plugin/jest.config.cjs` (jsx 한 줄 — 아래 5-③ 에 이유)

**원본 백업**: 세션 scratchpad `backup-aiwait/` (sha256)

| 파일 | sha256 |
|---|---|
| `Step2Memo.tsx` | `fca47b8ec3854b76bf516f67781f6f59054822824cf8032de3fd793f9f38d4fd` |
| `Step3Synopsis.tsx` | `059412765420b4c166d7be8f63774a0baef1f64be19775ec73c0a0222c538e6f` |
| `Step4Outline.tsx` | `7aa5739ae052b6f84cb527fbccb9fe5723febe1c54c2f6dc806004f47fdef05f` |
| `Step5Treatment.tsx` | `b46833e90de1a772585b4f6c996bc8a293203b2ade195d6fc447490d1438833a` |
| `jest.config.cjs` | `0a4765c575f50ca0be02938139c2caae90f3595677d95766cdbe4e80cf803380` |

레포 안에는 백업본을 만들지 않았다 — 허용 파일 셋 밖이다.
`git show HEAD:<경로>` 가 같은 원본을 준다. `git checkout`·`stash`·`restore` 는
쓰지 않았다.

---

## 1. 판정 — 물음 넷

### 물음 1. 경과 시간을 보이는 것이 옳은가

**옳다. 단, 5초가 지난 뒤부터 보인다.**

근거 셋.

**(a) 지금 화면에는 「살아 있다」는 증거가 하나도 없다.** F1·F2 대로 codex 는 글자를
흘려보내지 않으므로 화면은 문자 그대로 정지한다. 정지한 화면과 고장난 화면은
사용자 눈에 똑같다. 매초 바뀌는 숫자는 이 화면에서 만들 수 있는 «가장 정직한»
움직임이다. 빙글빙글 도는 표시는 CSS 가 도는 것이라 안이 멈춰도 계속 돌지만,
숫자는 안이 멈추면 함께 멈춘다.

**(b) 그러나 숫자는 «지켜보는 냄비» 를 만든다.** 7~9초짜리 짧은 호출에까지 초를
세어 보이면, 3초면 지나갈 일에 「1, 2, 3…」을 붙여 오히려 길게 느끼게 만든다.
그래서 **처음 5초는 숫자를 아예 띄우지 않는다.** F1 실측의 짧은 호출 상당수가 이
구간에서 조용히 끝난다.

**(c) 5초를 넘긴 기다림은 이미 «길다» 고 인지된 뒤다.** 그때부터는 숫자가 불안을
만드는 게 아니라 판단 재료가 된다 — 「40초째구나, 좀 더 기다리자」 / 「2분째네,
그만두고 다시 하자」. 판단할 수 없는 기다림이 사람을 무력하게 만들지, 숫자가
그러는 게 아니다.

단위는 **1초 갱신 · 사람 말 표기**다. 60초 미만은 `12초째`, 넘으면 `1분 12초째`.
「00:01:12」 같은 시계 표기는 쓰지 않는다 — 이 레포의 사용자는 초시계를 읽으러
온 사람이 아니다.

### 물음 2. 한계 시간을 알려야 하는가

**알려야 한다. 단, 「얼마나 걸린다」가 아니라 「언제 저절로 끝난다」로 말한다.**

- 「최대 3분」은 예보로 읽히고, 예보는 3분을 각오하게 만든다.
- 「3분이 지나면 저절로 멈춥니다」는 **끝의 보장**으로 읽힌다. 끝이 정해진 기다림은
  견딜 만하고, 끝이 없는 기다림은 견딜 수 없다. 지금 화면은 후자다.
- 덤으로 이 문장은 사용자가 «영원히 멈춘 것 아닌가» 를 의심할 이유를 없앤다.
  가만히 둬도 반드시 끝난다는 약속이다.

**숫자의 근거 — F5 재실측.** 발주서는 화면마다 300·240·180 초로 다르다고 했으나,
**이번 범위 네 화면은 전부 180초(3분) 하나다.** 네 화면 모두 `timeoutSecs` 를
넘기지 않고, `src/adapters/aiBridge.ts` 가 `input.timeoutSecs ?? 180` 으로 받는다.
300초는 `QuickComposeModal`·`SelectionPopover`·`ActionPanel`, 240초는
`ContinuityPanel`·`researchRunner` 쪽 값이다 — 이번 범위 밖이다.
그래서 네 화면의 문면은 전부 「3분」으로 같다. 부품은 `limitSecs` 를 받아 240초면
「4분」으로 저절로 바뀐다(다른 화면이 나중에 붙을 때를 위해서만 열어 뒀다).

이 문장도 **5초 뒤에 나타난다.** 5초 안에 끝날 일에 「3분」을 먼저 보여줄 이유가 없다.

### 물음 3. 취소 버튼은 어디에, 어떤 이름으로

**이름은 「그만두기」.** 셋을 놓고 골랐다.

| 후보 | 왜 안 골랐나 / 골랐나 |
|---|---|
| 취소 | 이 레포의 대화상자 어법에서 「취소」는 **없던 일로 되돌린다**는 뜻으로 읽힌다. 여기서 되돌아가는 것은 없다 — 쓰던 메모도 시놉시스도 그대로 남는다. 「내가 쓴 게 날아가나」를 만드는 이름은 쓸 수 없다 |
| 중단 | 뜻은 정확하나 차갑고 문서투다. 최종 사용자가 컴퓨터 용어를 모르는 사람이다 |
| **그만두기** | **골랐다.** 되돌린다는 뜻이 없고, 지금 하던 것을 여기서 멈춘다는 뜻만 있다. 일상 한국어다 |

**자리는 대기 표시 «안», 오른쪽 끝.** 이유 둘.
① 기다리는 동안 화면에서 «움직이는 것»은 대기 표시뿐이라 시선이 거기 있다.
버튼을 화면 구석에 두면 눈이 그것을 찾아야 한다.
② 왼쪽 글자(초가 늘어남)와 붙여 두면 글자 길이가 변할 때마다 버튼이 좌우로
흔들린다. 그래서 좌우 양끝 배치로 **버튼 자리를 고정**했다 — 누르려는 순간
움직이는 버튼을 만들지 않는다.

**「누르면 무엇이 남는가」를 말한다.** 이게 이번에 실제로 고친 결함이다.
`aiBridge` 는 사용자가 그만두면 `"사용자가 취소했습니다."` 를 **오류로** 던지고,
네 화면은 그것을 그대로 **빨간 오류 배너**에 찍고 있었다. 자기가 누른 버튼 때문에
빨간 경고가 뜨면 사람은 자기가 뭔가 망가뜨렸다고 생각한다.
그래서 그만두기로 인한 종료는 오류에서 갈라내고, 회색 안내 한 줄로 바꿨다 —
**「AI를 그만뒀습니다. 쓰시던 내용은 그대로 있습니다 — 언제든 다시 시작할 수
있습니다.」** (사실 확인: 네 화면 모두 `run()` 이 «성공한 뒤에만» store 에 쓴다.
그만두면 store 는 손대지 않는다. 이 문장은 참이다.)

### 물음 4. 일곱 화면이 서로 다르게 생겨도 되는가

**대기 표시는 하나로 맞춘다. 다른 것은 「지금 무엇을 하는 중인가」 한 줄뿐이다.**

기다림은 화면의 «기능»이 아니라 시스템의 «상태»다. 같은 상태를 화면마다 다른
모양·다른 이름·다른 자리로 보여주면, 사용자는 같은 것을 네 번 배워야 하고
Step2 에서 배운 「그만둘 수 있다」를 Step4 에서 다시 의심하게 된다.
그래서 부품은 하나(`AiWaitBar`)이고, 화면이 정하는 것은 `label` 한 줄과
여백뿐이다. 생김새·문면 틀·버튼 이름·5초 규칙·한계 문장은 화면이 못 바꾼다.

**놓는 자리만 화면 성격을 따른다** — 결과가 나타날 곳 바로 위(사용자의 눈이 이미
가 있는 자리)다. Step2 는 오른쪽 결과 칸 위, Step3 은 시놉시스 상자 위,
Step5 는 카드 목록 위, Step4 는 두 칸 레이아웃이라 본문 위 가로 전체.

범위 밖 세 화면(`ContinuityPanel`·`ResultPreviewModal`·`Step2Concept`)은 **고치지
않았다.** 지시서대로 보고만 한다 — 아래 7절.

---

## 2. 화면 문면 실물

사용자가 실제로 보는 글자 그대로다.

**기다리기 시작 ~ 5초 (Step2Memo 예)**

```
┌────────────────────────────────────────────────────────────┐
│ ● 메모를 읽고 있습니다                        [ 그만두기 ] │
│   잠시만 기다려 주세요. 길면 몇 분 걸립니다.               │
└────────────────────────────────────────────────────────────┘
```

**5초가 지난 뒤 (같은 자리에서 아랫줄만 바뀐다)**

```
┌────────────────────────────────────────────────────────────┐
│ ● 메모를 읽고 있습니다                        [ 그만두기 ] │
│   12초째 기다리는 중 · 3분이 지나면 저절로 멈춥니다        │
└────────────────────────────────────────────────────────────┘
```

**1분을 넘기면** — `1분 12초째 기다리는 중 · 3분이 지나면 저절로 멈춥니다`

**「그만두기」를 누른 뒤**

```
┌────────────────────────────────────────────────────────────┐
│ AI를 그만뒀습니다. 쓰시던 내용은 그대로 있습니다 —          │
│ 언제든 다시 시작할 수 있습니다.                             │
└────────────────────────────────────────────────────────────┘
```

**화면별로 다른 것은 첫 줄 한 문장뿐이다.**

| 화면 | 첫 줄 |
|---|---|
| `Step2Memo` | 메모를 읽고 있습니다 |
| `Step3Synopsis` | 시놉시스를 쓰고 있습니다 |
| `Step4Outline` (목차 전체) | 목차를 짜고 있습니다 |
| `Step4Outline` (한 장만 다시) | 이 장을 다시 쓰고 있습니다 |
| `Step5Treatment` | 카드를 만들고 있습니다 |

컴퓨터 용어는 한 글자도 쓰지 않았다(「스트리밍」·「타임아웃」·「프로세스」·「토큰」).
테스트가 이것을 지킨다 — `컴퓨터 용어를 쓰지 않는다`.

**눈이 안 보이는 사용자에게는** — 대기 표시 전체가 `role="status"`
`aria-live="polite"` 라 나타날 때 한 번 읽힌다. **매초 바뀌는 숫자는 낭독에서
제외**했다(1초마다 같은 말을 되풀이하면 방해만 된다). 대신
「3분이 지나면 저절로 멈춥니다」는 낭독 대상으로 남겨 «끝이 있다»는 사실은 반드시
전해지게 했다. 버튼 이름은 `AI 그만두기` (보이는 글자 「그만두기」를 포함한다 —
WCAG 2.5.3).

---

## 3. C2 — grep 출력 그대로

```
$ grep -rln 'AiWaitBar' packages/obsidian-plugin/src/studio/wizard/concept/
packages/obsidian-plugin/src/studio/wizard/concept/Step3Synopsis.tsx
packages/obsidian-plugin/src/studio/wizard/concept/Step2Memo.tsx
packages/obsidian-plugin/src/studio/wizard/concept/Step4Outline.tsx
packages/obsidian-plugin/src/studio/wizard/concept/Step5Treatment.tsx
```

**4건.** 붙는 자리는 다섯 곳이다 — `Step4Outline` 은 목차 전체 생성과 한 장
재제안 두 곳 모두에 붙였다(둘 다 취소 수단이 없던 자리다).

---

## 4. C3 — 취소가 실제로 동작함을 무엇으로 증명했나

E-026 대조: 「버튼이 렌더된다」는 아무것도 잡지 않는다. 그래서 **누르면 진짜로
끊기는지**를 세 겹으로 고정했다.

**겹 1 — 진짜 클릭 → 진짜 abort (`aiWaitBar.test.ts`).**
진짜 `useStreamingChat` 과 진짜 `AiWaitBar` 를 진짜 DOM 에 렌더한다. 가짜로 바꾼
것은 CLI 를 부르는 바깥(`startStreamingChat`) 하나뿐이고, 그것은 codex 처럼
**아무것도 흘리지 않고 매달려 있다가 abort 되면 끝난다.** 그 상태에서 「그만두기」에
진짜 `MouseEvent` 를 보내고 셋을 확인한다.

1. 진행 중이던 호출의 `AbortSignal.aborted` 가 `false` → `true` 가 된다
2. `run()` 이 실제로 끝난다(`사용자가 취소했습니다` 로 reject) — 화면이 영원히
   기다리지 않는다
3. 대기 표시가 사라지고 그만둔 사실이 화면에 남는다

대조군도 뒀다 — **누르지 않으면 abort 되지 않는다.** 버튼이 원인임을 확인한다.

**겹 2 — 네 화면이 그 배선을 실제로 하는가 (소스 계약).**
파일마다 ⑴ 공용 부품을 import 하는가 ⑵ 모든 `<AiWaitBar>` 에 `label` 과
`onCancel` 이 함께 붙었는가 ⑶ 그 `onCancel` 이 **`useStreamingChat()` 이 준
cancel** 인가(`Step4Outline` 은 `streaming.cancel`·`singleStreaming.cancel` 둘 다)
⑷ 빈 함수(`onCancel={() => …}`)로 시늉만 하지 않았는가 를 본다.

**겹 3 — abort 뒤 실제 종료는 이미 덮여 있다.**
`tests/adapters/aiBridgeLifecycle.test.ts` 가 「이미 abort 된 signal 이면 프로세스를
아예 만들지 않는다」·「cancel 후에도 SIGKILL 승급이 살아있다」를 고정한다.
겹1·겹2 가 «버튼 → cancel → abort» 를, 겹3 이 «abort → 프로세스 종료» 를 맡는다.

### 테스트 기계 자체를 검사했다 (E-026)

내가 만든 PASS 가 증거가 되려면, 망가뜨렸을 때 **빨개져야** 한다. 세 번 망가뜨려
직접 확인했다(전부 되돌렸고, 되돌린 뒤 원본과 바이트 동일함을 `diff` 로 확인).

| 일부러 망가뜨린 것 | 결과 |
|---|---|
| `AiWaitBar` 버튼의 `onClick={onCancel}` → 빈 함수 | `1 failed` — 클릭해도 abort 안 됨을 잡았다 |
| `Step2Memo` 의 `onCancel={cancel}` → `onCancel={() => undefined}` | `2 failed` — 시늉 배선을 잡았다 |
| `Step5Treatment` 에서 대기 표시 떼어냄 | `3 failed` — 「네 화면 모두가 붙었다」가 무너졌다 |

셋째 검사에서 **내 테스트의 결함을 하나 찾아 고쳤다.** 처음에는
`src.includes("<AiWaitBar")` 로 봤는데, 이름을 `<AiWaitBarGONE` 으로 바꿔도
substring 이라 **통과해 버렸다**(31 passed). 이름 뒤 경계까지 보도록
`/<AiWaitBar[\s/>]/` 로 고친 뒤 같은 훼손이 3건 실패로 잡혔다.
검사를 안 했으면 헐거운 채로 「증명했다」고 보고할 뻔했다.

---

## 5. C4 — 회귀

### ① 테스트 수 전/후

| 시점 | Test Suites | Tests |
|---|---|---|
| 내 작업 시작 시점 (직접 실행) | 29 passed | **352** passed |
| 내 작업 종료 시점 | 30 passed | **398** passed |

증가분 46건의 내역은 이렇다. **동시에 도는 다른 발주가 같은 레포에서 기존 suite
들에 15건을 늘렸다**(F6 이 예고한 그대로다 — 작업 도중 재측정에서 확인했다).

| 출처 | suites | tests |
|---|---|---|
| 내가 만든 `aiWaitBar.test.ts` | +1 | **+31** |
| 다른 발주가 기존 suite 에 늘린 것 | 0 | +15 |
| 합계 | +1 | +46 |

내 31건이 실제로 «돌았다» 는 실물 출력 (`npx jest tests/studio/wizard/aiWaitBar.test.ts`):

```
PASS tests/studio/wizard/aiWaitBar.test.ts
  AiWaitBar — 사용자가 읽는 문면
    ✓ 무슨 일이 일어나는 중인지 한 줄로 말한다
    ✓ 컴퓨터 용어를 쓰지 않는다
    ✓ 처음 5초 동안은 숫자를 세지 않는다 — 짧은 기다림을 길게 만들지 않는다
    ✓ 5초가 지나면 경과 시간과 «저절로 멈추는 때» 를 함께 보인다
    ✓ 1분이 넘으면 분·초로 읽어 준다
    ✓ 한계 시간은 화면이 정하는 대로 문면에 반영된다
    ✓ 마법사 네 화면의 기본 한계는 aiBridge 기본값(180초)과 같다
    ✓ 초 단위 숫자는 화면 낭독기에 매초 되풀이되지 않는다
    ✓ 그만두기 버튼은 이름과 종류가 분명하다
    ✓ formatDuration — 초·분·분초
  AiStoppedNotice — 그만둔 뒤 무엇이 남는지
    ✓ 쓰던 내용이 그대로임을 말한다
    ✓ 사용자의 그만두기는 «고장» 과 구별된다
  그만두기 — 눌렀을 때 진행 중인 호출이 실제로 멈춘다
    ✓ 클릭 → cancel → 진행 중이던 호출이 abort 되고 대기 표시가 사라진다
    ✓ 누르지 않으면 abort 되지 않는다 (버튼이 원인임을 확인)
  네 화면 소스 계약 — 하나도 빠뜨리지 않는다
    ✓ 네 화면 모두가 붙었다
    Step2Memo.tsx / Step3Synopsis.tsx / Step4Outline.tsx / Step5Treatment.tsx
      ✓ 공용 대기 표시를 가져다 쓴다 (제 것을 따로 만들지 않는다)     (×4)
      ✓ 모든 대기 표시에 취소 함수와 사람 말 label 이 함께 붙어 있다   (×4)
      ✓ 그 취소 함수는 useStreamingChat 이 준 것이다                  (×4)
      ✓ 사용자가 그만둔 것을 빨간 오류로 보여주지 않는다              (×4)

Tests:       31 passed, 31 total
```

전체 (`pnpm --filter @ai-manuscript-studio/obsidian-plugin test`, exit 0):

```
Test Suites: 30 passed, 30 total
Tests:       398 passed, 398 total
```

`packages/core` 도 확인 — 손대지 않았고 그대로다 (exit 0, 311 passed / 18 skipped).

### ② typecheck

```
$ pnpm typecheck
$ pnpm -r exec tsc -noEmit
typecheck-exit=0
```

### ③ `jest.config.cjs` 를 왜 건드렸나 — 갈림길의 실측

지시서의 권장안(테스트를 `.test.ts` 로 쓰고 `React.createElement` 사용)을 그대로
따랐는데도 **막혔다.** 실측:

```
tests/studio/wizard/aiWaitBar.test.ts:1:32 - error TS6142:
  Module '.../src/studio/wizard/AiWaitBar' was resolved to '.../AiWaitBar.tsx',
  but '--jsx' is not set.
```

막힌 곳은 «테스트에 JSX 를 쓰는가» 가 아니라 **«.tsx 파일을 import 하는가»** 였다.
TS6142 는 확장자만 보고 나므로, 부품을 `createElement` 로만 써도(=JSX 를 한 글자도
안 써도) 똑같이 난다. 즉 `--jsx` 없이는 **어떤 방법으로도** `.tsx` 부품을 테스트가
가져올 수 없다. `tsconfig.test.json` 은 쓸 수 있는 여덟 파일에 없으므로,
남은 손잡이는 `jest.config.cjs` 하나뿐이었다.

고친 것은 **한 줄의 효과**다.

```js
const { compilerOptions: testCompilerOptions } = require("./tsconfig.test.json");
...
tsconfig: { ...testCompilerOptions, jsx: "react-jsx" },
```

- `testMatch` 는 **손대지 않았다** — `["**/*.test.ts"]` 그대로다(기존 352개 보호).
- `tsconfig.test.json` 은 여전히 정본이다. ts-jest 의 `tsconfig` 옵션이 «경로»
  아니면 «객체» 중 하나만 받아 «경로 + 한 줄»을 못 하기에, 정본을 읽어 펴고 jsx 만
  얹었다. 정본을 고치면 여기에도 그대로 반영된다.
- ts-jest 가 객체를 받을 때 기준으로 삼는 파일이
  `packages/obsidian-plugin/tsconfig.json` 임을 소스에서 확인했고
  (`_resolveTsConfig` → `ts.findConfigFile`), 그 파일과 `tsconfig.test.json` 은
  **같은 `tsconfig.base.json` 을 상속**한다. 그래서 실질 차이는 `jsx` 뿐이다.
- 그리고 그 판단에 기대지 않고 **전체 suite 로 확인**했다 — 30 suites / 398 tests
  전부 통과.

### ④ 그 밖

- `.env`·키·토큰 비접촉.
- `git checkout`·`stash`·`restore` 미사용. 다른 발주 자리(`src/adapters/**`,
  `src/studio/ai/**`) 는 **읽기만** 했다(F4·F5 확인용).
- 빌드(`pnpm build`)는 **돌리지 않았다** — `main.js`·`styles.css` 산출물이 동시에
  도는 다른 발주의 미완성 코드까지 함께 굽게 된다. 컴파일 타당성은 typecheck 가
  덮는다.

---

## 6. `skipped[]`

1. **범위 밖 세 화면은 손대지 않았다** — `inspector/ContinuityPanel.tsx`,
   `ai/ResultPreviewModal.tsx`, `wizard/concept/Step2Concept.tsx`.
   지시서 금지 항목이다. 대신 7절에 보고한다.
2. **`useStreamingChat.ts` 는 고치지 않았다** — 다른 발주 자리다. F4 대로 이미
   `cancel` 을 주고 있어 고칠 필요도 없었다. 경과 시간은 부품이 스스로 잰다.
3. **빌드·배포를 하지 않았다** — 위 5-④.
4. **`AiStoppedNotice` 의 실제 노출은 자동 테스트로 «화면 단위» 까지 가지 않았다.**
   부품 자체의 렌더와, 네 화면이 `isUserStopped` 로 갈라 놓았다는 소스 계약까지
   고정했다. 네 화면 전체를 렌더하는 테스트는 store·vault 를 통째로 가짜로
   만들어야 해 이번 범위에서 하지 않았다.
5. **`aiBridge` 의 시간 초과 문면은 그대로 뒀다** — 3분이 지나 저절로 멈추면
   화면에는 여전히 `AI 호출 시간 초과 (180s)` 가 뜬다. 사람 말이 아니지만
   `src/adapters/**` 는 다른 발주 자리다. 7절에 보고한다.
6. **hover·focus 시각 효과는 넣지 않았다** — 이 레포는 인라인 스타일이라 `:hover`
   를 쓰려면 전역 CSS 를 건드려야 하고, 그건 금지다.

---

## 7. 고치지 않고 보고만 한 것

**(1) 취소 낱말이 앱 안에서 세 갈래다.**
`ContinuityPanel` 은 「취소」, `Step2Concept` 은 「Esc 로 중단」, 이번 네 화면은
「그만두기」. 지금도 이미 두 갈래였고 내가 세 번째를 들였다. 물음 3 의 판정대로
**「그만두기」로 통일**할 것을 권한다 — 「취소」는 되돌린다는 오해를,
「중단」은 문서투를 남긴다. 세 화면 모두 이번 범위 밖이라 손대지 않았다.

**(2) 범위 밖 세 화면에도 같은 대기 표시가 필요하다.**
- `ContinuityPanel` — 취소는 있으나 경과·한계가 없고, 최대 4분(240초)을
  말없이 기다린다. `AiWaitBar` 에 `limitSecs={240}` 만 주면 그대로 붙는다.
- `ResultPreviewModal` — 취소는 있으나 대기 문구가 없다.
- `Step2Concept` — 「Esc 로 중단」은 **키보드를 아는 사람에게만** 있는 취소다.
  마우스만 쓰는 사용자에게는 취소 수단이 없는 것과 같다. 눌러서 그만둘 수 있는
  버튼이 필요하다.

**(3) 사용자가 그만둔 것을 «오류»로 던지는 구조는 그대로다.**
`aiBridge` 가 `"사용자가 취소했습니다."` 를 Error 로 던지고, 각 화면이 그것을
문자열로 알아보는 방식(`isUserStopped`)으로 갈라내고 있다. 지금 동작하지만
문면이 바뀌면 조용히 깨진다. 근원 해법은 `AiInvocationError` 에 「사용자 취소」
종류 값을 두고 화면이 그 값을 보는 것이다 — `src/studio/ai/**`·`src/adapters/**`
가 다른 발주 자리라 이번엔 문자열 판별로 뒀다. **임시이고, 근원은 오류 종류 값**이다.

**(4) 시간 초과 문면이 사람 말이 아니다.** 위 6-⑤.

**(5) `Step3Synopsis` 의 «대기 중» 상자에 깜빡이는 커서(▍)가 남아 있다.**
글자가 한 자씩 오는 것처럼 보이게 하는 장치인데 F1 대로 글자는 한 자씩 오지
않는다. 빈 상자에 커서만 떠 있는 셈이라 오해를 만든다. 대기 표시가 그 위에
붙어 사실은 말해 주므로 이번엔 남겨 뒀다.

---

## 8. 도메인 되먹임 — 정본·규칙의 결함

**(1) 발주서 F5 의 「화면마다 300·240·180 초」는 이번 네 화면에는 해당하지 않는다.**
네 화면은 전부 180초 하나다(2절·1-물음2 참조). 300·240 은 다른 화면들의 값이다.
「화면마다 다르니 알리기 어렵다」는 전제로 판단했으면 틀린 설계를 냈을 것이다.
**한계 시간은 화면이 아니라 «호출 경로»가 정한다** — 마법사 네 화면은 같은 경로를
쓴다.

**(2) `jest.config.cjs` 의 `testMatch` 는 이 레포가 React 컴포넌트를 테스트하지
못한 원인 «둘 중 하나»일 뿐이다.**
F7 은 `testMatch` 를 지목했지만, 실제로 막고 있던 것은 **`tsconfig.test.json` 에
`jsx` 가 없는 것**이다. 확장자만 바꿔서는 여전히 TS6142 로 죽는다. 실제로
`tests/studio/wizard/WizardChat.behavior.test.ts` 는 이 벽 때문에 **production
로직을 테스트 안에 베껴 놓고** 있다("The inline functions mirror the exact
production logic in WizardChat.tsx"). 그건 E-026 이 경고한 바로 그 모양이다.
이번에 `jsx` 를 켰으므로 **이제는 진짜 컴포넌트를 렌더해 검사할 수 있다.**
그 파일을 진짜 렌더 방식으로 다시 쓰는 것은 이번 범위 밖이라 하지 않았다.

**(3) 이 레포에는 「기다림」에 대한 정본이 없다.**
그래서 일곱 화면이 제각각이 됐다. 이번 판정(5초·한계 문장·「그만두기」·부품 하나)이
그 자리를 대신할 수 있으나, 지금은 `AiWaitBar.tsx` 주석에만 있다. 정본으로
올릴지는 대표 판단 사항이다.

---

## 요청 대조

**요청 5건(C1~C5) / 수행 5건 / 미수행 0건.**

| | 내용 | 결과 |
|---|---|---|
| C1 | 공용 부품 먼저, `src/studio/wizard/AiWaitBar.tsx`, 경과는 부품이 스스로 잼 | 완료 |
| C2 | 네 화면 전부에 붙음 — grep 4건 | 완료 (붙은 자리는 5곳) |
| C3 | 취소가 실제로 동작함을 테스트로 고정 + 기계 자체 검사 | 완료 (3겹 + 훼손 3회 확인) |
| C4 | 회귀 0 — 398 passed, typecheck exit 0, 백업 보관 | 완료 |
| C5 | `skipped[]` 열거 | 완료 (6건) |
