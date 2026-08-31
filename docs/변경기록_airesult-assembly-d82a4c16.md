*Version: v1.0 (2026-08-31)*

# 변경기록 — airesult-assembly-d82a4c16

**대상 파일 셋 (허용 넷 중 셋을 썼다)**

- `packages/obsidian-plugin/src/adapters/aiBridge.ts` (수정 — 동작 변경)
- `packages/obsidian-plugin/src/studio/ai/useStreamingChat.ts` (수정 — 판정 박제 주석만, 동작 변경 없음)
- `packages/obsidian-plugin/tests/adapters/aiBridge.test.ts` (수정 — 테스트 15건 추가)
- `docs/변경기록_airesult-assembly-d82a4c16.md` (신규 — 이 문서)

**베이스**: `b36b9ec` + 선행 발주 넷의 미커밋 작업 트리. 되돌리지 않았다.
**원본 백업**: 세 파일 모두 scratchpad `backup-before/` 에 사본 보관 (SHA-256 기록).

---

## 1. 판정 — 물음 1~4

### 물음 1. 한 턴이 `agent_message` 를 여러 개 낼 때 「원고」는 무엇인가

**판정: 마지막 하나. 이어붙이지 않는다.**

근거는 추정이 아니라 codex 자신의 문면이다. `codex exec --help` 원문
(codex-cli 0.151.0, 이 기계에서 직접 조회):

```
-o, --output-last-message <FILE>
        Specifies file where the last message from the agent should be written
```

codex 는 「턴의 답」을 **the last message from the agent** 로 정의한다.
그리고 `aiBridge` 의 **1차 경로가 바로 그 파일**이다(`buildCodexArgs` 가 항상
`--output-last-message` 를 넘긴다). stdout 파서는 그 파일을 못 읽었을 때 쓰는
**대체 경로**다. 대체 경로가 1차 경로와 다른 규칙을 쓰면 — 이어붙이거나 첫 것을
집으면 — **같은 턴이 「파일이 읽혔느냐」에 따라 다른 원고를 낸다.** 원고 내용이
파일시스템 사정으로 갈리는 것은 어떤 사용자도 이해할 수 없는 동작이다.

F1 의 「48자 예고 + 154자 본문」에서 사용자가 주문한 것은 154자 본문이다.
48자 예고(`요청 확인했습니다. 지금부터…`)는 진행 알림이지 원고가 아니다.
이어붙이면 원고 맨 앞에 인사말이 박힌다.

「그 사이 어떤 규칙」은 두지 않았다. 길이·내용으로 「이게 진짜 본문 같다」를
추측하는 heuristic 은, 틀렸을 때 사용자가 **자기 원고의 일부가 조용히 잘린 것을
알 방법이 없다.** 규칙은 하나여야 하고, 그 하나는 codex 가 이미 정해 놓은 것이다.

### 물음 2. `--output-last-message` 파일과 stdout 의 `agent_message` 열이 어긋날 수 있는가

**판정: 어긋날 수 있다. 어긋나면 «파일» 을 믿는다.** (현재 동작 유지)

어긋나는 경우를 코드 경로로 짚으면 넷이다.

| # | 어긋나는 상황 | 어느 쪽이 온전한가 |
|---|---|---|
| A | codex 가 `agent_message` 를 stdout 에 내보낸 뒤 파일을 쓰기 전에 죽는다(타임아웃 SIGTERM·사용자 취소·디스크 오류) | **stdout** — 파일은 비었거나 없다 |
| B | 손자 프로세스가 stdout 파이프를 붙들어 `drainCut` 이 서고 `destroyStream` 으로 파이프를 끊는다(`aiBridge` 수명 계약 3항, 실측 6,010ms 점유) | **파일** — stdout 이 도중에 잘렸다 |
| C | 배수 마감(`DRAIN_GRACE_MS` 5초) 초과로 마지막 청크가 `stdoutAcc` 에 안 들어온다 | **파일** |
| D | 파일이 공백만 담긴다 | **stdout** |

현재 구현은 `if (s.trim()) fullText = s; else extractLastCodexMessage(...)` 로
**파일이 내용을 가지면 파일이 이기고, 비면 stdout 으로 떨어진다.** 이것이 A·D 와
B·C 를 동시에 맞게 처리하는 유일한 순서다. 뒤집으면 B·C 에서 **잘린 stdout 이
온전한 파일을 덮어 원고가 깎인다.**

「낡은 파일을 읽을 위험」은 없다. `buildCodexCtx()` 가 호출마다
`ai-manuscript-codex-${Date.now()*1e6 + rand}` 로 새 tempdir 를 만들고 그 안의
`last-message.txt` 만 읽는다. 앞 호출의 답이 새어 들어올 경로가 없다.

### 물음 3. F2 의 「통째 덮어쓰기」가 틀리는 경우

**판정: 반례를 세우지 못했다. 현재 동작이 옳다. 고치지 않았다.**

반례 후보를 둘 세웠고 둘 다 무너졌다.

**후보 ① — 「본문이 먼저 길게 오고 마지막에 짧은 마무리 멘트가 오는 턴」**
(지시서가 제시한 예). 이 턴에서 `fullText` 는 마무리 멘트가 되고, 화면에 있던
긴 본문이 사라진다. 손해는 실재한다. 그런데 **이것은 덮어쓰기의 결함이 아니다** —
1차 경로인 `--output-last-message` 파일에도 똑같이 마무리 멘트만 들어간다(물음 1).
즉 `result.fullText` 자체가 이미 마무리 멘트다. `useStreamingChat` 에서만 길이
heuristic 으로 buffer 를 살리면 **화면(buffer)과 `run()` 이 돌려주는 값(= 호출부가
원고로 저장하는 값)이 갈라진다.** 사용자는 화면에서 본 글을 저장했다고 믿는데
파일에는 다른 것이 들어간다. **덮어쓰기를 고치는 쪽이 더 나쁘다.**

**후보 ② — 「덮어쓰기가 진행 표식을 지운다」**. 지우는 것이 맞다. 스트리밍 중
buffer 에는 `extractDisplayText` 가 넣은 `[AI 진행]`·`[AI 알림]` 표식 줄이 섞여
있다(`streamingChat.ts` 155~157행). **그 표식을 원고에서 걷어내는 장치가 이 한
줄뿐이다.** 이어붙이기·부분 병합으로 바꾸면 `[AI 진행] 자료를 확인하려고 도구를
실행하는 중입니다` 가 그대로 원고에 박힌다. 이 줄은 결함이 아니라 **부하를 지고
있는 줄**이다.

또한 `if (result.fullText.trim().length > 0)` 관문 때문에 fullText 가 비면
덮어쓰지 않는다 — 「글자가 사라진다」의 최악 형태(빈 화면)는 이미 막혀 있다.

그래서 **동작은 한 글자도 바꾸지 않았고**, 대신 다음 사람이 반대로 고치지 못하도록
판정 근거를 그 자리에 주석으로 박았다(`useStreamingChat.ts` 82~101행).

### 물음 4. 화면에 보이던 것과 최종 결과가 달라도 되는가

**판정: 달라도 된다. 오히려 달라야 한다. 단, 지켜야 할 불변식이 하나 있다.**

두 표면은 목적이 다르다.

- **스트리밍 중 buffer** = 진행 영역. 「멈춘 것」과 「일하는 중」을 구별시키는
  것이 임무다. codex `--json` 은 글자 단위 델타를 주지 않아(본문은 턴이 끝난 뒤
  통째로 한 번 온다) 이 영역이 비면 사용자는 앱이 죽었는지 알 수 없다.
- **정착 후 buffer** = 원고. 진행 표식이 남으면 안 된다.

사용자가 겪는 것: 턴이 끝나는 순간 `[AI 진행]`·`[AI 알림]` 줄과 예고 문면이
사라지고 원고만 남는다. **글자가 사라지는 경험은 맞고, 그것이 의도다.** 사라지는
것은 원고가 아니라 진행 알림이다.

**지켜야 할 불변식: 정착 후 `buffer` === `run()` 반환값.** 화면과 저장본이
어긋나면 사용자는 손쓸 방법이 없다 — 무엇이 저장됐는지 확인할 창구가 없기 때문이다.
현재 구현은 이 불변식을 지킨다(같은 `result.fullText` 를 setBuffer 하고 return).
물음 3 의 「길이 heuristic」이 깨는 것이 바로 이 불변식이다.

---

## 2. C1 — F3 의 구멍을 어떻게 닫았나

**구멍의 정체.** `extractLastCodexMessage` 의 2차(옛 필드명) 역방향 스캔이
`v.message` 를 무조건 본문으로 인정했다. **오류 이벤트도 `message` 필드를 가진다.**
오류는 대개 턴 «맨 뒤» 에 오므로 역방향 스캔이 그것을 **가장 먼저** 만났다.
결과: 사용자가 주문한 글 대신 `stream disconnected before completion` 같은 영어
오류가 원고 칸에 앉는다.

**닫은 방법.** `isErrorEvent()` 를 새로 두고 2차 스캔에서 `continue` 시켰다.
발주자 판정대로 **삭제가 아니라 「본문의 정의」를 좁힌 것**이다.

- 옛 «필드명» 지원 경로(`v.message` · `v.output` · `v.turn.message`)는 **그대로**
  살아 있다. 세 경로 각각에 회귀 테스트를 따로 붙였다.
- `isErrorEvent` 가 인식하는 오류 집합은 `extractCodexFailureReason` 의 1·2차
  인식 범위와 **같은 집합**이다. 한쪽이 「실패 사유」로 읽는 것을 다른 쪽이
  「본문」으로 읽으면 안 되기 때문이다.
- 1차(agent_message) 경로는 손대지 않았다.

부수: 2차 스캔의 인라인 `JSON.parse` 를 이미 있는 `parseJsonLine()` 로 바꿨다.
guard 를 넣으려면 파싱 결과 객체가 필요해서다. 동작은 동일하다 — 원본은 비-객체
JSON(`123`·`"x"`·`null`)에서 `v.message` 가 `undefined` 거나 TypeError 로 잡혀
`continue` 했고, `parseJsonLine` 은 같은 입력에 `null` 을 돌려줘 `continue` 한다.
필드 선택 규칙(`message` → `output` → `turn.message` 순)은 한 글자도 안 바꿨다.

### 요구된 세 경우

| # | 입력 | 요구 | 결과 |
|---|---|---|---|
| 1 | `{"type":"error","message":"…"}` 만 있고 `agent_message` 없음 | 본문이 **아니다** | **PASS** (수정 전 FAIL) |
| 2 | `agent_message` 뒤에 `error` | **`agent_message` 채택** | **PASS** (수정 전에도 PASS) |
| 3 | `item.type === "error"` 인 `item.completed` | 본문이 **아니다** | **PASS** (수정 전에도 PASS) |

### 추가로 막은 것

| 입력 | 요구 | 결과 |
|---|---|---|
| `{"type":"turn.failed","message":"usage limit reached"}` | 본문이 **아니다** | **PASS** (수정 전 FAIL) |
| `item.type === "error"` 가 `text` 필드로 옴 | 본문이 **아니다** | **PASS** |
| 옛 필드명 본문 뒤에 오류가 옴 → **본문이 이긴다** | 옛 경로 보존 + 오류 배제 동시 증명 | **PASS** (수정 전 FAIL) |
| 오류 아닌 이벤트의 옛 필드명 셋(`message`·`output`·`turn.message`) | 그대로 산다 | **PASS** |

---

## 3. C2 — 조립 판정 테스트

`tests/adapters/aiBridge.test.ts` 에 describe 셋 / 테스트 15건 추가. 요구된 넷은
전부 포함했다. 전 건 **PASS**.

| 요구 | 테스트 | 잠근 것 |
|---|---|---|
| `agent_message` 1개인 턴 | `agent_message 가 «하나» 인 턴 — 그 하나가 원고다` | 기본 경로 |
| `agent_message` 2개 이상인 턴 | `agent_message 가 «둘» 인 턴 — 마지막 하나만. 이어붙이지 않는다` | 물음 1 판정. 예고 문면(`작성하겠습니다`)이 원고에 **없음**을 명시 assert |
| — (같은 판정의 뒤집힌 모양) | `본문이 먼저·마무리가 나중인 뒤집힌 턴에서도 «마지막» 을 집는다` | 물음 3 후보 ① 을 그대로 테스트로 박제. 다음 사람이 「앞 것이 진짜 본문 같다」로 뒤집는 것을 막는다 |
| — | `reasoning·command_execution 은 몇 개가 끼어도 원고를 밀어내지 못한다` | 선행 발주의 F4 보장 유지 |
| last-message 가 빈 턴 | `파일이 비면 stdout 의 «마지막» agent_message 가 원고가 된다` | 물음 2 의 A·D. 실제 fake 프로세스로 end-to-end |
| — | `파일이 공백뿐이어도 stdout 경로로 떨어진다` | `s.trim()` 관문 경계 |
| last-message 가 stdout 마지막과 다른 턴 | `파일 내용이 stdout 마지막과 «달라도» 파일이 이긴다` | 물음 2 의 B·C |
| — | `오류만 있는 턴이 종료코드 0 이어도 오류 문면이 원고가 되지 않는다` | C1 을 end-to-end 로 한 번 더 |

`useStreamingChat` 은 테스트를 못 붙였다 — 사유는 `skipped[]` 6항.

---

## 4. C4 — 새 테스트를 수정 전 구현에 돌린 결과

테스트 15건을 **먼저** 쓰고 `aiBridge.ts` 를 손대기 **전에** 돌렸다. 타입은
안 바뀌었으므로 「컴파일되는 최소 되돌림」은 필요 없었다.

```
Test Suites: 1 failed, 1 total
Tests:       4 failed, 56 passed, 60 total
```

**빨강 4건** (전부 새 테스트다 — 기존 45건은 초록 유지):

1. `C1 › ① type=error 만 있고 agent_message 가 없으면 본문이 «아니다»`
2. `C1 › ① turn.failed 의 message 도 본문이 «아니다»`
3. `C1 › 옛 필드명으로 온 본문 뒤에 오류가 와도 «본문» 이 이긴다`
4. `C2 — last-message 파일과 stdout 이 어긋날 때 › 오류만 있는 턴이 종료코드 0 이어도 오류 문면이 원고가 되지 않는다`

**초록으로 시작한 11건**은 「아무것도 안 잡는 테스트」가 아니라 **판정 박제**다.
지시서 C2 가 요구한 「판정이 「현재 동작 유지」여도 테스트는 쓴다」에 해당한다 —
물음 1·2 의 답(마지막 하나 / 파일 우선)은 지금 코드가 이미 맞게 하고 있고,
이 11건은 **다음 사람이 반대로 고치면 그때 빨강이 된다.**

수정 후 같은 파일: `Tests: 60 passed, 60 total`.

---

## 5. C3 — 회귀 0

| 항목 | 시작 시점 (12:58 실측) | 종료 시점 (13:0x 실측) | 판정 |
|---|---|---|---|
| obsidian-plugin | **29 suites / 352 tests** 전부 통과 | **30 suites / 368 tests** 전부 통과, exit 0 | 늘었다 |
| — 내 몫 | `tests/adapters/aiBridge.test.ts` 45건 | 60건 (**+15**) | |
| — 동시 발주 몫 | — | `tests/studio/wizard/aiWaitBar.test.ts` 1 suite / 1 test | 내 범위 밖 |
| core | 26 passed / 3 skipped, 311 passed / 18 skipped | **동일**, exit 0 | 무변화 |
| `pnpm typecheck` | exit 0 | **exit 0** | 무변화 |

지시서 F5 의 기준선(29/352)과 시작 시점 실측이 일치했다. **줄어든 것 없음.**

`.env`·키·토큰 비접촉. git commit·push 안 함. 백업은 scratchpad `backup-before/`
(aiBridge.ts `51da5bac…`, useStreamingChat.ts `40f77d75…`, aiBridge.test.ts
`a8d0a328…`).

**중간에 한 번 빨강이 떴고, 내 것이 아니었다.** 13:00:53~58 사이 동시 발주
(`aiwait-ui-9b3ce5f0`)가 `src/studio/wizard/AiWaitBar.tsx` 와 그 테스트를 새로
넣었는데 `tsconfig.test.json` 에 `jsx` 설정이 없어 suite 가 **컴파일 자체를
실패**했다(TS6142). 내 변경 파일 셋과 접점이 없고, 그 자리는 지시서가 「쓰지 마라」로
못 박은 구역이라 **손대지 않고** `--testPathIgnorePatterns` 로 분리해 내 범위가
29 suites / 367 tests 전부 초록임을 먼저 확인했다. 몇 분 뒤 그쪽이 스스로 고쳐
지금은 30/368 전부 초록이다. **초록을 만들려고 남의 설정을 건드리지 않았다.**

---

## 6. `skipped[]`

1. **`useStreamingChat` 의 단위 테스트를 못 붙였다.** 이 레포에
   `@testing-library/react` 가 없고(`packages/obsidian-plugin/package.json`
   devDependencies 확인), `jest.config.cjs` 의 `testMatch` 가 `**/*.test.ts` 라
   `.tsx` 를 안 잡는다. 훅 테스트를 붙이려면 **의존성 추가 + `jest.config.cjs`
   수정**이 필요한데 후자는 동시 발주 자리라 지시서가 금지했다. 대신 (a) 판정을
   그 자리 주석으로 박제하고 (b) 훅이 의존하는 계약(`result.fullText` 가 곧 원고)을
   `aiBridge.test.ts` 쪽에서 잠갔다.
2. **`packages/core/src/ai/**` 의 두 번째 구현은 읽지도 고치지도 않았다.**
   지시서가 「읽기만·별도 발주」로 지정.
3. **실제 codex 를 호출한 턴은 0건.** 테스트는 전부 이벤트 문자열 직접 주입이다.
   유일한 CLI 접촉은 `codex exec --help` **조회 한 번**(물음 1 의 원천 확인)이며
   모델 호출이 아니다.
4. 위 셋 외에 온전히 다루지 못하고 넘긴 부분 **없음**.

---

## 7. 고치지 않고 보고만 한 것

### (가) `?? stdoutAcc` — 본문 후보가 없을 때 raw JSONL 이 원고로 간다 ★

`aiBridge.ts` 939·941·944행:

```ts
fullText = extractLastCodexMessage(stdoutAcc) ?? stdoutAcc;
```

`extractLastCodexMessage` 가 `null` 이면 **JSONL 전문이 그대로 원고가 된다.**
사용자는 원고 칸에서 `{"type":"thread.started",…}` 를 본다.

**이번 변경이 이 경로에 닿는 지점을 정직하게 적는다.** 종료코드 0 인데 stdout 에
오류 이벤트만 있는 턴에서, 종전에는 오류 문면(영어 한 줄)이 원고가 됐고 이제는
`null` → raw JSONL 이 원고가 된다. **둘 다 원고가 아니지만 모양이 바뀐다.**
다만 (1) 최상위 `type:"error"`·`turn.failed` 는 codex 가 0이 아닌 코드로 죽는
것이 정상 경로라 이 조합은 관측된 적이 없고, (2) `agent_message` 가 없는 턴은
**이번 변경 이전에도 이미** raw JSONL 로 떨어지고 있었다(2차 경로가
`{"type":"item.completed","item":{…}}` 에서 최상위 `message` 를 못 찾으므로).
즉 새로 만든 병이 아니라 **원래 있던 병의 입구가 하나 넓어진 것**이다.

고칠 자리는 이 발주가 아니다 — `?? stdoutAcc` 를 「빈 문자열 + 사람이 읽는 사유」로
바꾸는 것은 실패 문면 설계 전체(`extractCodexFailureReason`·`AiInvocationError`·
UI 표시)에 걸치는 결정이고, 반례 없이 바꾸지 말라는 금지선에도 걸린다.
**별도 발주 대상으로 올린다.**

### (나) `useStreamingChat` — fullText 가 공백뿐일 때 화면과 반환값이 갈린다

`if (result.fullText.trim().length > 0)` 가 거짓이면 buffer 는 스트리밍 내용을
유지하는데 `run()` 은 공백을 돌려준다. 물음 4 의 불변식이 그 한 칸에서 깨진다.
**도달 경로를 못 찾았다** — codex 경로에서 fullText 가 공백이려면 stdoutAcc 도
공백이어야 하고 그러면 buffer 도 비어 둘이 같아진다. 반례가 없어 고치지 않았다.
방어적으로 `else setBuffer("")` 를 넣고 싶은 유혹이 있으나 근거 없는 변경이다.

### (다) `useStreamingChat.ts` 83~84행의 옛 주석

「streaming 중 buffer 가 비었을 수 있으니」는 선행 발주가 `extractDisplayText` 를
넣기 전의 사정을 말한다. 지금은 buffer 가 비지 않는다(진행 표식이 들어간다).
사실과 어긋나 헷갈릴 수 있으나 **주석 정리는 요청 밖**이라 지우지 않고 아래에
현재 판정을 덧붙이는 방식으로만 처리했다.

---

## 8. 도메인 되먹임 — 정본·규칙의 결함

### (가) 「쓰지 마라」 목록이 실제 충돌 지점을 못 짚었다 ★

이 발주와 `aiwait-ui-9b3ce5f0` 두 지시서가 서로의 자리로 지목한 것은
`src/studio/wizard/**` 와 `jest.config.cjs` 였다. 그런데 **레포를 실제로 빨갛게
만든 근원은 `packages/obsidian-plugin/tsconfig.test.json`** 이다 — `.tsx` 테스트를
처음 넣는 순간 이 파일의 `jsx` 누락(TS6142)과 `include` 패턴(`tests/**/*.ts` 만)이
동시에 걸린다. **어느 지시서의 허용 목록에도, 금지 목록에도 없던 파일**이다.

동시 발주 쪽은 자기 허용 파일인 `jest.config.cjs` 안에서 `tsconfig.test.json` 을
읽어 펴고 `jsx: "react-jsx"` 한 줄을 얹는 우회로 풀었다(내가 확인한 그쪽 diff).
결과는 초록이지만, **정본(`tsconfig.test.json`)과 실제 테스트 컴파일 설정이 두
군데로 갈렸다.** 다음 사람이 `tsconfig.test.json` 만 보고 `.tsx` 가 왜 되는지
설명하지 못한다.

**제안**: 같은 레포에 동시 발주를 낼 때 「쓰지 마라」 목록은 *소스 디렉터리* 가
아니라 **빌드·테스트 설정 파일 전체**(`tsconfig*.json`·`jest.config.cjs`·
`esbuild.config.mjs`·`package.json`)를 한 줄로 묶어 「공유 자원 — 건드리려면
발주자에게 먼저」로 지정하는 편이 안전하다. 소스는 디렉터리로 갈리지만 **설정은
갈리지 않는다.** 그리고 이번처럼 우회가 나오면 나중에 정본으로 되돌리는 정리
발주를 하나 예약해 두는 편이 낫다.

### (나) 기준선을 「전/후로 세라」고만 하면 동시 발주 구간에서 해석이 갈린다

C3 는 「시작 시점에 다시 세고 전/후를 적어라. 줄면 불합격」이다. 그런데 이번처럼
남의 발주가 **컴파일 안 되는 suite 를 중간에 넣으면** 총 suite 수는 늘고
`pnpm test` 는 실패한다 — 「줄지 않았는데 빨강」이다. 판정 규칙에 그 칸이 없다.

**제안**: 「내 변경 파일과 접점이 없는 실패는 분리 측정해 보고하고, 남의 자리를
고쳐서 초록을 만들지 않는다」를 완료 기준에 한 줄 넣으면 다음 실행자가 헤매지 않는다.
(이번에는 `common_rules` 의 「CI·테스트 실패는 먼저 분류한다」로 판단했다.)

### (다) F3 판정문의 힘

발주자가 「부딪치지 않는다 — 그 금지선은 옛 «필드명» 호환 경로를 지키라는 뜻이지
오류 이벤트를 본문 후보로 «인정»하라는 뜻이 아니다」라고 **한 문단으로 잘라 준 것**이
이 발주에서 가장 값이 컸다. 선행 실행자가 막힌 지점은 지식이 아니라 **권한의
모호함**이었다. 금지선을 쓸 때 「무엇을 지키려는 금지인가」를 한 줄 덧붙이면
다음 실행자가 보류 대신 실행한다.

---

## 요청/수행 대조

- 요청 **8건** (판정 4물음 · C1 · C2 · C3 · C4 · C5 · 보고 8항 — 묶어서 8)
- 수행 **8건**
- 미수행 **0건**
