*Version: v1.0 (2026-08-31)*

# 변경기록 — aifail-kind: 실패를 «문장» 이 아니라 «종류» 로 말하게 한다

작업키: `aifail-kind-3e7b9d24` · 레포: `/Users/dongchanyoon/Documents/Work/Projects/14.zettel-writer-connect`

한 줄 요약 — 브리지가 던지는 실패에 **종류(`failure`)** 를 실었다. 화면과 상위
어댑터는 그 종류를 «먼저» 보고, 종류가 없을 때만 종전의 «문면» 판별로 떨어진다.
같은 자리에서 발견된 **raw JSONL 누출**(본문 후보가 없으면 stdout JSONL 전문이
원고가 되던 것)은 「본문 없는 턴 = 실패」로 못 박아 막았다.

---

## 1. 과제 A 판정 — 실패 종류를 몇으로 정했고 왜 그만큼인가

### 1-1. 실패 «경로» 는 아홉, 실패 «종류» 는 다섯

`aiBridge.ts` 가 실제로 오류 객체를 만드는 자리를 전부 세면 **아홉**이다.
그중 소비처가 «구별해야 하는» 것만 종류로 올렸다 — 구별할 필요 없는 것을 나누면
소비처의 분기만 늘어난다.

| # | 실패 경로 (aiBridge.ts) | 종류 |
|---|---|---|
| 1 | `cancel()` — 사용자가 그만두기를 눌렀다 | `canceled` |
| 2 | 작업 디렉터리 생성 실패 | `process` |
| 3 | `spawn` 동기 throw | `process` |
| 4 | stdin 쓰기 동기 실패 | `process` |
| 5 | `via === "error"` — ENOENT 등 spawn 비동기 실패 | `process` |
| 6 | 한계 시간 초과 | `timeout` |
| 7 | 종료를 확인하지 못함(`!exitObserved`) | `process` |
| 8 | 0이 아닌 종료 코드 | `exit` |
| 9 | 마지막 catch-all 내부 오류 | `process` |
| **신설** | 종료 코드 0인데 «본문» 이 없다 (과제 B) | `no-output` |

**다섯인 근거는 「누가 이 둘을 갈라야 하는가」 하나다.**

- `canceled` — 화면이 이것만은 «고장» 과 갈라야 한다. 그만두기는 오류가 아니므로
  빨간 배너 대신 「그만뒀습니다」 안내가 떠야 한다. 이 구별이 이 발주의 발단이다.
- `timeout` — 사용자에게 「다시, 더 짧게」를 권해야 하는 유일한 칸.
  core `AIBridgeError.kind === "timeout"` 이 이미 이 칸을 갖고 있다.
- `exit` — 종료 코드·stderr 를 함께 실어 보내야 하는 칸. core 의 `"exit"` 과 1:1.
- `no-output` — CLI 는 **성공(코드 0)** 했고 원고만 없다. `exit` 과 사유가 달라
  같은 칸에 넣으면 「종료 코드 0으로 실패」라는 모순된 말을 하게 된다.
- `process` — 나머지 다섯 경로 전부. 상위(core)에 이들을 가르는 자리가 없고
  (`"spawn"` 한 칸뿐), 사용자에게도 같은 말을 한다. 나눠도 쓸 데가 없다.

**「종료를 확인하지 못함」을 따로 두지 않은 이유** — 그 사실은 이 파일이 이미
가진 `AiOutcomeKind`(`no-exit`)와 `verdict` 문면이 보유한다. 여기 또 두면 같은
사실이 두 곳에 산다. 실패 종류에서는 `process` 로 접고, 「왜 그렇게 끝났나」는
`verdict` 가 계속 말한다.

### 1-2. 종류를 어디에 두었나 — 새 체계 0개

지시서 F6 대로 **이 파일이 이미 쓰던 방식** 을 그대로 두 번째로 적용했다.

```
기존:  export type AiOutcomeKind = "ok-empty" | "ok" | "partial" | "zero" | "no-exit";
       interface AiOutcome { kind: AiOutcomeKind; verdict: string /* 사람이 읽는 문면 */ }

신규:  export type AiFailureKind = "canceled" | "timeout" | "exit" | "no-output" | "process";
       interface AiInvocationError { kind: "ai-error"; failure: AiFailureKind; message: string; stderr: string }
```

- 문자열 리터럴 합집합 + 사람이 읽는 문면을 «나란히» 두는 같은 모양이다.
- 오류 객체의 **필드**로 넣었다(`failure`). 기존 `kind: "ai-error"` 는 «오류
  종류» 가 아니라 «오류 객체의 표지» 라 그대로 두고, 그 옆에 더했다.
- `AiInvocationErrorImpl` 생성자는 `failure` 를 **필수 인자**로 받는다. 새 실패
  경로를 만들면서 종류를 빠뜨리면 컴파일이 막힌다.
- 새 dispatcher·새 gate·새 schema·새 파일 **0개**. 더한 것은 타입 하나, 필드 하나,
  읽기 함수 하나(`readAiFailureKind`)뿐이다.

### 1-3. 문면은 그대로 두었나 — 그대로다. 그리고 기존 문면을 읽는 코드는 «셋» 이었다

**살아 있는 플러그인에서 실패 문면을 읽어 종류를 되짚던 자리 — 3곳.**

| 자리 | 무엇을 읽었나 | 지금 |
|---|---|---|
| `AiWaitBar.tsx:isUserStopped` | `"사용자가 취소했습니다"` 포함 검사 | **2차로 남음** |
| `tauriAIBridge.ts` | `/시간 초과/` | **2차로 남음** |
| `tauriAIBridge.ts` | `/CLI 종료 코드/` | **2차로 남음** |

세 자리 모두 **한 줄도 지우지 않았다.** 그 앞에 종류 판별을 «더했을» 뿐이다.
사람이 읽는 문장(`"사용자가 취소했습니다."`, `"AI 호출 시간 초과 (…)"`,
`"AI 호출 실패 (CLI 종료 코드 N)"`)도 한 글자도 바꾸지 않았다.

**그 문면에 의존하는 «다른 파일의» 테스트 단언 — 7건** (전부 지금 통과한다).

- `tests/adapters/aiBridgeLifecycle.test.ts` 4건 — `/프로세스 시작 실패/`,
  `/시간 초과/`×2, 그리고 `tauriAIBridge.ts` 소스에서 정규식을 «긁어내» 도달
  가능성을 보는 묶음.
- `tests/studio/wizard/aiWaitMouse.test.ts` 3건 — 동시 진행 중인 다른 발주가
  이번 주에 추가한 것. 그 파일은 「«사용자가 취소했습니다» 는 낱말이 아니라
  표식이므로 건드리지 않는다」를 명시적으로 지킨다.

> **이 7건이 이번 설계를 한 번 바로잡았다.** 처음에는 문면 판별을
> `readAiFailureKind` 안으로 «옮겨» 두 층을 한 곳에 모았는데, 그러자
> `aiBridgeLifecycle.test.ts` 의 소스 계약 둘이 빨개졌다 — 옮기는 것도 그 자리에서
> 「지우는 것」이었다. 되돌려 문면 판별을 원래 자리에 그대로 두고, 종류 판별만
> 그 «위» 에 얹었다.

**범위 밖(읽기만 함)** — `packages/core/src/ai/CodexCLIAdapter.ts` 는 같은 문면을
«만드는» 쪽이고 이미 자기 kind 체계를 갖고 있다. `apps/desktop/` 의 미러 3파일은
폐기 예정이라 손대지 않았다(8항 참조).

---

## 2. 과제 B 판정 — 본문 후보 0개 + 정상 종료 턴을 무엇으로 정했나

### 2-1. 판정: **실패다** (`no-output`)

물음은 「raw JSONL 을 안 내면 그럼 무엇을 내는가」였다. 후보는 셋이었다.

| 후보 | 왜 아닌가 |
|---|---|
| 성공 + raw JSONL (**현행**) | 사용자가 원고 칸에서 `{"type":"thread.started",…}` 를 본다 |
| 성공 + 빈 글자 | **더 나쁘다.** `useStreamingChat` 은 `fullText` 가 비면 buffer 를 덮어쓰지 «않는다». 그 buffer 에 남는 것은 `extractDisplayText` 기준으로 `reasoning` 의 «생각 요약» 텍스트와 `[AI 오류]`·`[AI 알림]` 줄이다(소스 직접 확인). 원고 칸에 JSONL 대신 «남의 생각» 이 박히고, 동시에 `run()` 은 공백을 돌려줘 «화면에 보이는 것» 과 «저장되는 것» 이 갈린다 |
| **실패 (`no-output`)** ← 채택 | 화면은 오류 한 줄을 보이고 쓰던 내용을 그대로 둔다. 같은 저장소의 `voiceRewriter` 도 빈 결과를 삽입하지 않고 안내만 띄운다 — 이미 있는 판례를 따랐다 |

「성공 + 빈 글자」가 왜 함정인지는 선행 발주가 이미 적어 둔 것과 맞물린다 —
`docs/변경기록_airesult-assembly-d82a4c16.md` §7-(나)가 그 불변식 깨짐을
「도달 경로를 못 찾았다」고 남겨 뒀다. 빈 글자를 성공으로 내면 그 «못 찾은 경로»
를 우리 손으로 만들어 주는 셈이다.

사용자에게 보이는 문면은 **「AI가 답을 주지 않았습니다」** 다. 오류 이벤트가 있으면
그 사유를 괄호로 덧붙인다(`extractCodexFailureReason` 재사용 — 새로 만들지 않았다).

### 2-2. 재현 조건 — 만들었다. 다만 «실물 관측» 은 여전히 아니다

누출이 일어나려면 **세 조건이 동시에** 성립해야 한다.

1. stdout JSONL 에 `agent_message` 가 하나도 없다 (`reasoning`·오류만 있는 턴)
2. `--output-last-message` 파일이 없거나 공백뿐이다
3. **종료 코드가 0이다**

1·2는 테스트 하네스(진짜 `PassThrough` 스트림 + 가짜 fs)로 그대로 만들었고,
수정 전 구현에서 **실제로 raw JSONL 이 `fullText` 로 나오는 것을 확인**했다
(C4의 빨간 테스트 넷이 그 증거다). 3은 실물에서 확인하지 못했다 — codex 를
실제로 부르는 것은 금지선이고, 「본문 없는 턴이 0으로 끝나는가」는 codex 쪽 동작이라
로컬 코드로는 증명할 수 없다.

**따라서 판정은 「이론상」이다(미관측).** 그래도 방어는 두었다 — 원고가 걸린 일이고,
방어 비용은 분기 하나다. 선행 발주 판정(F5, 「원래 있던 병의 입구가 한 뼘 넓어졌다」)과
어긋나지 않는다.

### 2-3. 원본 JSONL 은 어디에 남겼나

**버리지 않았다.** 화면이 아닌 곳 — 옵시디언 개발자 도구 콘솔(`Cmd+Opt+I`)에
남긴다. 이 저장소가 이미 쓰는 진단 경로다(`CLAUDE.md` §5).

- 함수: `logEmptyTurnStdout(invocationId, stdoutAcc)` — 기존 `logLifecycle` 과 같은
  모양·같은 접두사(`[aiBridge] <id>`)를 쓴다. 새 로깅 체계가 아니다.
- 상한: **마지막 2KB**(`STDERR_TAIL_BYTES` 재사용). 한 턴의 stdout 은 수백 KB 가
  될 수 있고, 본문 없는 턴은 대개 «끝» 이 사유를 쥐고 있다.
- 사용자가 읽는 오류 문면에는 JSONL 이 **한 글자도** 들어가지 않는다(테스트로 고정).

대안으로 codex 작업 디렉터리(`workDir`)에 파일로 남기는 길이 있었으나 택하지
않았다 — 그 디렉터리는 지금 아무도 지우지 않아 쓰레기가 쌓이고, 파일 쓰기는 새 실패
모드를 만든다.

---

## 3. C1 — 문면을 바꿔도 판별이 안 깨짐을 어떻게 증명했나

### 3-1. `isUserStopped` — 행동으로 증명 (`tests/studio/wizard/aiWaitBar.test.ts`)

| 무엇을 넣었나 | 기대 | 무엇을 증명하나 |
|---|---|---|
| `failure:"canceled"` + `"AI를 그만뒀습니다 (사용자 요청)"` | `true` | 문면을 **아예 다른 문장**으로 갈아도 판별이 산다 |
| `failure:"canceled"` + `"중단됨"` | `true` | 〃 |
| `failure:"canceled"` + `""` (문면 없음) | `true` | 〃 |
| `failure:"timeout"` + `"사용자가 취소했습니다."` | `false` | **종류가 문면을 이긴다** — 반대 방향 확인 |
| 종류 없음 + `"사용자가 취소했습니다."` | `true` | 옛 오류 객체는 종전대로 문면으로 떨어진다 |
| 문자열 `"AI 호출 실패: 사용자가 취소했습니다."` | `true` | 네 화면이 지금 넘기는 «문자열» 모양 그대로 산다 |
| `failure:"cancelled"`(오타) | `false` | 모르는 값이 종류인 척 지나가지 못한다 |

**겉모양은 그대로다.** `isUserStopped` 는 인자를 «넓히기만» 했다(`string` →
`unknown`). export 이름·개수·`AiWaitBar` 의 props 는 한 글자도 안 바뀌었고,
`Step2Memo`·`Step3Synopsis`·`Step4Outline`·`Step5Treatment` 네 화면은 **한 줄도
고치지 않았다**(금지 표 준수). 그 사실은 typecheck 통과와, 네 화면 소스 계약
테스트 16건이 그대로 초록인 것이 증명한다.

### 3-2. `tauriAIBridge` — 소스 계약으로 증명 (`tests/adapters/aiBridge.test.ts`)

- `readAiFailureKind(e)` 를 부른다
- 네 종류가 각자의 칸으로 간다: `canceled→aborted`, `timeout→timeout`,
  `exit→exit`, `no-output→exit(exitCode 0)`
- **종류 판별의 첫 자리 < 문면 판별의 첫 자리** (문자열 인덱스 비교 — 「먼저 본다」를
  순서로 못 박는다)
- `if (/시간 초과/.test(msg))` 와 `if (/CLI 종료 코드/.test(msg))` 가 **여전히
  거기 있다** (더하되 빼지 않았음을 고정)

**왜 행동 테스트가 아니라 소스 계약인가** — `tauriAIBridge.ts` 는
`@tauri-apps/api/core` 를 import 하는데 `tsconfig.test.json` / jest
`moduleNameMapper` 에 그 경로 매핑이 없다. 직접 확인한 오류는
`TS2307: Cannot find module '@tauri-apps/api/core'` 이고, ts-jest 가 컴파일 자체를
거부해 «가상 mock 을 걸어도» import 가 안 된다. 매핑을 더하려면 이 발주가 손대지
말라고 못 박은 두 설정 파일을 고쳐야 한다. 그래서 옆 묶음
(`aiBridgeLifecycle.test.ts` 의 「분기 도달 가능성」)이 **이미 쓰는 방식** 을 따랐다.
종류 이름과 순서를 손으로 베끼지 않고 소스에서 찾는다.

시간 초과·비정상 종료가 **브리지 쪽에서** 종류를 달고 나오는 것은 별도로 행동
테스트가 지킨다(아래 4항의 `timeout`·`exit` 줄).

---

## 4. C2 — 세 경우 각각 PASS/FAIL

| 경우 | 결과 |
|---|---|
| ① 본문 후보 0개 + 종료코드 0 + last-message 파일 **없음**(ENOENT) → 원고에 JSONL 이 없다 | **PASS** |
| ② 같은 조건 + last-message 파일이 **공백뿐** → 같은 판정 | **PASS** |
| ③ 본문 후보가 **있으면** 평소대로 본문이 나온다 (회귀 방지) | **PASS** |

덧붙여 고정한 것 셋.

| 추가 검사 | 결과 |
|---|---|
| 원본 JSONL 은 진단 로그에만 남고 사용자 문면에는 없다 | **PASS** |
| 오류 이벤트가 있으면 그 사유를 사람 말 옆에 붙인다 | **PASS** |
| **codex 가 아닌 provider 는 종전대로 stdout 이 결과다** (규칙 범위 고정) | **PASS** |

마지막 줄이 중요하다. `claude-code` 는 stdout 자체가 답이라 「본문 후보」라는
개념이 없다. 여기까지 넓혔으면 멀쩡한 경로가 깨진다.

---

## 5. C4 (E-026) — 수정 전 구현에서 몇 개가 빨강이었나

**24건 중 16건 빨강.**

타입이 바뀌어 원본이 그대로는 컴파일되지 않으므로, 지시서가 허용한
「컴파일되는 최소 되돌림」으로 쟀다 — 타입 표면(`AiFailureKind`,
`readAiFailureKind`, `isUserStopped` 의 넓힌 인자)만 남기고 **판단 로직 전부**를
원본으로 되돌린 판(`scratchpad/prefix-revert/`)에 새 테스트를 그대로 돌렸다.

```
Tests: 16 failed, 99 passed, 115 total
```

빨강 16건:

```
✕ 취소 문면을 아예 다른 문장으로 바꿔도 여전히 취소로 판별한다
✕ 종류가 문면을 «이긴다» — 문면이 취소처럼 보여도 종류가 아니면 고장이다
✕ 모르는 값이 취소인 척 지나가지 못한다
✕ 오류만 있는 턴이 종료코드 0 이어도 오류 문면이 원고가 되지 않는다   ← 기존 테스트 강화분
✕ 사용자 취소 → canceled (문면은 그대로 남는다)
✕ 0 아닌 종료 코드 → exit
✕ 프로세스가 아예 안 뜸(ENOENT) → process
✕ 한계 시간 초과 → timeout
✕ 본문 없이 정상 종료 → no-output (exit 와 «다른» 칸이다)
✕ ① 본문 후보 0 + 종료코드 0 + last-message 파일 없음 → 원고에 JSONL 이 없다
✕ ② 같은 조건 + last-message 파일이 공백뿐 → 같은 판정
✕ 원본 JSONL 은 화면이 아니라 진단 로그에 남는다
✕ 오류 이벤트가 있으면 그 사유를 사람 말 옆에 붙인다
✕ 오류에서 종류를 읽는다
✕ 네 종류가 각자의 칸으로 간다
✕ 종류 판별이 문면 판별보다 «먼저» 온다
```

**초록으로 남은 8건은 무엇이고, 왜 그래도 두었나** — 정직하게 적는다.

| 초록 8건 | 성격 |
|---|---|
| `readAiFailureKind` 단위 3건 (다섯 칸 읽기 / 없으면 null / 오타 거부) | **구조상 빨강일 수 없다** — 되돌림 판에도 이 함수는 남겨야 컴파일이 되므로. 이 셋은 「종류 인정 범위」를 고정하는 값이 있다 |
| C2 ③ 본문 후보가 있으면 평소대로 | 지시서가 명시로 요구한 **회귀 방지**. 빨강이면 오히려 이번 변경이 멀쩡한 경로를 깬 것이다 |
| codex 아닌 provider 는 종전대로 | **범위 고정** — 위와 같음 |
| 성공한 턴은 실패 종류를 만들지 않는다 | 반대 방향 확인 |
| 종류 없는 옛 오류 객체는 문면으로 떨어진다 | **「빼지 마라」 감시** — 2차 층을 지우면 빨개진다 |
| 화면들이 넘기는 문자열도 그대로 받는다 | **겉모양 유지 감시** — 인자 모양을 좁히면 빨개진다 |
| 문면 판별을 지우지 않았다 (tauriAIBridge) | 〃 |

즉 초록 8건 중 5건은 「무엇이 **깨지면 안 되는가**」를 지키는 감시자다. 그 다섯이
실제로 일한 적도 있다 — 1-3의 상자에 적은 대로, 문면 판별을 옮기려던 첫 설계를
되돌린 것이 그 부류의 테스트였다.

---

## 6. C3 — 테스트 수 전/후, typecheck 결과

| 항목 | 전 | 후 |
|---|---|---|
| obsidian-plugin suites | 30 | **31** |
| obsidian-plugin tests | 398 (F7 과 일치) | **445 전부 통과** |
| core suites / tests | 26 of 29 (3 skipped) / 311 passed, 329 total | **동일 — 변동 없음** |
| `pnpm typecheck` | exit 0 | **exit 0** |
| `pnpm build:plugins` | exit 0 | **exit 0**, `styles.css` 해시 불변 |

**증가분 47의 내역 (딱 맞아떨어진다).**

- 이 발주 **+24** (aiBridge.test.ts +19, aiWaitBar.test.ts +5. 그 밖에 기존 테스트
  1건은 «수정»이라 수에 안 잡힌다)
- 동시 진행 중인 다른 발주(`aiwait-mouse-7f4c1a08`) **+23**, 새 suite 1개
  (`tests/studio/wizard/aiWaitMouse.test.ts` — 단독 실행 23 tests 확인)
- 398 + 24 + 23 = **445** ✔ / 30 + 1 = **31** ✔

**접점 없는 실패 — 0건.** 남의 자리를 고쳐 초록을 만든 일 없다. 도중에
`aiBridgeLifecycle.test.ts` 2건이 빨개진 적이 있으나 그것은 «내 변경이 만든»
회귀였고(1-3 상자), 그 테스트가 아니라 **내 코드**를 고쳐 되돌렸다.

**백업** — 수정 전 다섯 파일 원본을 `scratchpad/backup/` 에 보관했다.
`.env`·키·토큰 비접촉. `git checkout`·`git stash`·`git restore` **사용하지 않았다**
(선행 발주 다섯의 커밋 안 된 성과 보존). git commit·push **하지 않았다**.

---

## 7. `skipped[]`

1. **`tauriAIBridge` 의 행동(런타임) 테스트** — `@tauri-apps/api/core` 매핑이
   `tsconfig.test.json`/`jest.config.cjs` 에 없어 import 자체가 TS2307 로 막힌다.
   두 파일은 이 발주의 금지 대상이라 소스 계약으로 대신했다(3-2).
2. **`no-output` 종류가 UI 배너까지 이어지는 것** — 8-(가) 참조. `useStreamingChat`
   이 오류를 문자열로 눌러 담아 종류가 화면까지 못 간다. 그 파일은 허용 목록 밖이다.
3. **실물 codex 로 「본문 없는 턴이 0으로 끝나는가」 확인** — 테스트에서 실제 codex
   실행이 금지선이고, 수동 호출도 외부 API 라 별도 허락 사안이다. 2-2에 미관측으로
   명시했다.
4. **`apps/desktop/` 미러 3파일** — 같은 병(`/시간 초과/` 정규식)이 그대로 있으나
   폐기 예정이라 손대지 않았다.
5. **`packages/core/src/ai/CodexCLIAdapter.ts`** — 같은 문면을 만드는 두 번째 구현.
   읽기만 했다(두 구현 통합은 별도 발주 대상).

---

## 8. 고치지 않고 보고만 한 것 + 도메인 되먹임

### (가) ★ `useStreamingChat` 이 종류를 «버린다» — 이 발주의 남은 절반

`src/studio/ai/useStreamingChat.ts:104-105`:

```ts
const msg = e instanceof Error ? e.message : String(e);
setError(msg);            // ← 여기서 failure 가 사라진다
```

브리지가 실은 종류는 이 한 줄에서 «문자열» 로 눌려 사라진다. 그래서 실제 화면
네 곳은 지금도 `isUserStopped(error)` 에 **문자열**을 넘기고, 그 경로는 2차(문면)
판별로 동작한다. 이번 변경으로 «깨지지 않게» 되기는 했지만 «종류로 갈리게» 되지는
않았다 — 종류가 화면까지 가려면 다음 한 줄이 필요하다.

```ts
// UseStreamingChatResult 에 errorKind 를 더하고
setErrorKind(readAiFailureKind(e));
```

`useStreamingChat.ts` 는 이 발주의 허용 파일 여섯 밖이라 **손대지 않았다.**
다음 발주 후보로 올린다. 파급: 그 훅을 쓰는 네 화면 + `AiWaitBar` 호출부.

### (나) 오류 배너 문면에 기계 용어가 섞인다

새로 만든 문면은 `AI가 답을 주지 않았습니다 (…) — 정상 — 336바이트` 처럼
끝에 수집 판정(`verdict`)이 붙는다. 이 파일의 다른 오류 문면 전부가 같은 관례라
맞췄고, 진단에는 실제로 쓸모가 있다(「stdout 은 제대로 받았는데 본문만 없다」와
「파이프가 끊겼다」를 가른다). 그러나 `AiWaitBar` 가 선언한 「화면에 컴퓨터 용어를
쓰지 않는다」와는 어긋난다. **사용자용 문면과 진단용 꼬리를 분리하는 일**은 화면 쪽
결정이라 요청 밖으로 두고 보고만 한다.

### (다) codex 작업 디렉터리를 아무도 지우지 않는다

`buildCodexCtx()` 가 매 호출마다 `os.tmpdir()/ai-manuscript-codex-<stamp>/` 를
만들고 그 뒤 **삭제하는 코드가 없다.** 본문 없는 턴을 파일로 남길 자리를 찾다가
발견했다. 요청 밖이라 고치지 않았다.

### (라) 도메인 되먹임 — 「쓰지 마라」 목록과 «테스트 파일» 의 어긋남

선행 발주(`airesult-assembly`)가 이미 같은 취지를 적었는데, 이번에 한 번 더
같은 모양으로 부딪혔다. 이번 지시서의 허용 파일 여섯에는 소스 셋과 테스트 둘이
들어 있었지만, **내 변경이 실제로 빨갛게 만든 테스트는 목록에 없는
`tests/adapters/aiBridgeLifecycle.test.ts`** 였다. 그 파일이 내 수정 대상인
`tauriAIBridge.ts` 의 «소스 모양» 을 계약으로 잡고 있었기 때문이다.

다행히 그 계약이 옳았고(문면 판별을 옮기는 것도 「지우는 것」이다) 결과적으로 설계가
좋아졌다. 그러나 일반화하면 이렇다 — **다음 지시서는 「고칠 파일」뿐 아니라
「그 파일을 계약으로 잡고 있는 테스트」까지 함께 짚어 주는 편이 좋다.**
찾는 법은 한 줄이면 된다.

```bash
grep -rln "고칠파일이름" packages/*/tests
```

### (마) 도메인 되먹임 — 「본문의 정의」를 좁힐 때는 «없을 때» 를 함께 정해야 한다

이 발주가 막은 누출은 선행 발주가 `agent_message` 만 본문으로 인정하도록 «좁히면서»
입구가 넓어진 것이다(F5). 규칙으로 남길 만하다 — **어떤 값의 「인정 범위」를 좁히는
변경은, 같은 발주 안에서 「하나도 인정되지 않을 때 무엇을 내는가」를 반드시 함께
정한다.** 좁히기와 fallback 은 한 몸이고, 나눠서 발주하면 그 사이에 조용한 구멍이
생긴다.
