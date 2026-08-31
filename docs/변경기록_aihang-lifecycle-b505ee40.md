*Version: v1.0 (2026-08-31)*

# 변경기록 — aihang-lifecycle-b505ee40

**대상 파일 하나**: `packages/obsidian-plugin/src/adapters/aiBridge.ts`
**베이스**: `b36b9ec` (작업 시작 시 working tree clean)
**원본 백업**: 세션 scratchpad `aiBridge.ts.orig`
(sha256 `29e0107d773e09582328bb60327a42bce348ebb0a1b39c5ede7fe6e906852836`).
레포 안에는 백업본을 만들지 않았다 — 허용 파일 넷 밖이기 때문이다. `git show
HEAD:packages/obsidian-plugin/src/adapters/aiBridge.ts` 가 같은 원본을 준다.

---

## 0. 먼저 잰 것 — 추론이 아니라 실측

고치기 전에 Node 의 «진짜» 동작을 여섯 번 재서 확인했다 (Node v26.7.0, macOS
Darwin 25.6.0). 아래 표가 이 발주의 모든 판단 근거다.

| 실측 | 무엇을 물었나 | 결과 |
|---|---|---|
| probe1 | ENOENT spawn 시 어떤 이벤트가 오나 | `["stdin-write-ok-sync","error:ENOENT","stdout-iter-ended","stderr-iter-ended","close:-2/null"]` — **`'exit'` 은 오지 않는다** |
| probe2 | `'error'` 리스너가 없으면 | `UNCAUGHT: ENOENT` — EventEmitter 가 throw. 우리 async IIFE 밖(process.nextTick)에서 터진다 |
| probe3/4 | EPIPE 는 동기 throw 인가 | 아니다. `write()` 는 `false` 를 반환하고 **stdin 의 `'error'` 이벤트**로 온다. 리스너 없으면 `UNCAUGHT: EPIPE` |
| probe5 | 손자가 stdout 을 물고 있으면 | 자식 `EXIT +4ms` / stdout 해제 `+6,010ms` / `CLOSE +6,013ms` — **손자가 안 죽으면 둘 다 영영 안 온다** |
| probe6a | 스트림을 destroy 하면 `for await` 는 | 끝나는 게 아니라 `ERR_STREAM_PREMATURE_CLOSE` 를 **throw** 한다 |
| probe6b | `detached:true` + `process.kill(-pid)` 는 | 손자까지 즉시 죽는다 (stdout ENDED / EXIT / CLOSE 가 같은 ms 에) |

---

## 1. 경로를 몇 개 셌나 — 13개

E1~E5 는 5개다. **8개를 더 찾았다.** 줄 번호는 모두 «원본» 기준.

### A. `done`·`tokens()` 가 영원히 정착하지 않는 경로 — 6개

| # | 경로 | 파일:줄 | 왜 안 끝나나 |
|---|---|---|---|
| H1 | **spawn `'error'` (ENOENT 등)** — E1 | `aiBridge.ts:170`, `:397-399` | `SpawnedProcess.on` 이 `"exit"` 만 선언하고 `'error'` 리스너가 없다. probe1 대로 ENOENT 는 `'exit'` 을 «절대» 안 내므로 `await new Promise(exit)` 이 영구 대기. `finish()` 가 안 불려 `tokens()` 의 pending `next()` 도 영구 pending |
| H2 | **stdout 태스크가 reject** — 신규 | `:280`, `:400` | `void (async…)()` 에 try/catch 가 없다. 스트림 `'error'`(EIO 등)나 destroy(probe6a)로 `stdoutTask` 가 reject 하면 IIFE 의 rejection 을 `void` 가 삼킨다 → `done` 영구 pending, `finish()` 미호출 |
| H3 | **손자가 stdout 파이프 점유** — E3+E4 | `:351-359`, `:400`, `:354` | probe5. 자식이 죽어도 스트림이 안 닫혀 `await stdoutTask` 가 안 끝난다. 루프 안 `if (finished) break` 는 «다음 청크가 와야» 평가되므로 청크가 영영 안 오면 도달하지 않는다 |
| H4 | **손자가 stderr 파이프 점유** — 신규 | `:361-372`, `:401` | H3 과 «별개의» 관문이다. stdout 이 닫혀도 `await stderrTask` 에서 다시 멈춘다 |
| H5 | **SIGTERM·SIGKILL 을 다 무시하는 자식** — E5 심화 | `:375-389` | 타임아웃 타이머가 kill 만 하고 아무 상태도 안 남긴다. 자식이 안 죽으면 `'exit'` 이 없고, 그 뒤를 책임지는 코드가 없다 |
| H6 | **`tokens()` 소비자가 둘** — 신규 | `:228`, `:341-349`, `:453-461` | resolver 슬롯이 하나뿐이라 두 번째 소비자가 첫 소비자의 resolver 를 덮어쓴다. `finish()` 는 하나만 깨우므로 나머지는 영원히 매달린다 |

### B. 정착은 하되 수명이 깨진 경로 — 7개

| # | 경로 | 파일:줄 | 무엇이 깨졌나 |
|---|---|---|---|
| H7 | **stdin EPIPE** — E2 | `:316-334` | 동기 try/catch 로만 감쌌다. probe4 대로 EPIPE 는 비동기 `'error'` 라 renderer 의 uncaught 로 새고, 프롬프트가 잘린 사실은 어디에도 안 남는다 |
| H8 | **`cancel()` 이 자기 SIGKILL 승급을 스스로 취소** — 신규 | `:267-277` → `:255` | `cancel` 이 `killTimer` 를 걸고 바로 `finish()` 를 부르는데, `finish` 가 그 타이머를 `clearTimeout` 한다. SIGTERM 을 무시하는 자식은 «영영» SIGKILL 을 못 받는다 |
| H9 | **손자를 아무도 안 죽인다** — E3 | `:199`, `:263`, `:383` | `detached:false` + `child.kill()` 은 자식만 죽인다. 그룹이 아니다 |
| H10 | **타임아웃이 상태를 안 남긴다** — E5 | `:375-389` vs `tauriAIBridge.ts:102` | kill 후 `'exit'` 이 `code=null` 로 와서 `AI 호출 실패 (exit -1): 사유 미상` 이 된다. `/시간 초과/` 분기는 **도달 불가능한 죽은 코드** |
| H11 | **`/CLI 종료 코드/` 분기도 죽은 코드** — 신규 | `:435` vs `tauriAIBridge.ts:109` | 원본이 내는 문면은 `AI 호출 실패 (exit N)` 라 소비자의 정규식에 안 걸린다. 모든 종료 코드 실패가 `kind:"spawn"` 으로 오분류된다 |
| H12 | **이미 abort 된 signal 인데 프로세스를 만든다** — 신규 | `:392-395` | signal 배선이 spawn·stdin 쓰기 «뒤» 다. 시작 전에 취소된 호출도 프로세스를 띄우고 죽인다 |
| H13 | **손자 고아 방치** — 신규(실행 중 발견) | 새 구조의 드레인 절단 지점 | 드레인 마감으로 파이프를 끊을 때 그룹을 정리하지 않으면 손자가 `ppid=1` 로 재부모화돼 계속 돈다. **가짜 프로세스 테스트로는 절대 안 보이고, 진짜 프로세스로 돌려서야 `ps` 에 잡혔다** |

> **H13 은 내가 만든 1차 수정본의 결함이었다.** mock 테스트 24개가 전부 초록인
> 상태에서 실제 `/bin/sh` 로 돌려보니 `sleep 40` 손자가 `ppid=1` 로 살아 있었다.
> 초록불이 증거가 아니라는 E-026 이 그대로 맞았다.

### 셈에서 뺀 것 (찾았으나 결함이 아님)

- 「`cancel()` 이 spawn 보다 먼저 도착해 고아를 만든다」 — **성립하지 않는다.**
  `void (async…)()` 의 본문은 첫 `await` 까지 «동기» 실행되고 `spawnProcess` 는
  그 앞에 있다. 즉 `startAiInvocation()` 이 반환하는 시점에 `child` 는 이미 있다.
  같은 부류로 실제 성립하는 것은 H12(이미 abort 된 signal) 하나뿐이다.

### 시도한 탐색 경로 전부 (「없다」가 유효하려면 미시도가 0이어야 하므로)

`aiBridge.ts` 전문 정독 · `CodexCLIAdapter.ts`(참조 구현) 전문 정독 ·
`tauriAIBridge.ts` / `useStreamingChat.ts` / `streamingHandle.ts` /
`electronBridge.ts` / `findBinary.ts` 정독 · `startAiInvocation` 호출자 9곳
grep · 에러 문면 소비자 grep · Node 이벤트 실측 6종(probe1~6) ·
원본 대상 RED 실행 · 수정본 대상 mutation 4종 · 실제 OS 프로세스 6 시나리오 구동.

---

## 2. 각 경로를 어떻게 닫았나

| # | 닫은 방법 |
|---|---|
| H1 | `SpawnedProcess.on` 에 `'error'`·`'close'` 오버로드를 추가하고 셋 다 리스너를 건다. 종료는 `'exit'`(코드) / `'error'` / `'close'`(exit 없이 온 경우) / 확인 마감 넷 중 «먼저 오는 것» 으로 정착시킨다 |
| H2 | stdout·stderr 소비 태스크를 각자 try/catch 로 감싸 **절대 reject 하지 않게** 했다. IIFE 전체도 try/catch/finally 로 감싸 새는 예외가 있어도 `done` 을 정착시킨다 |
| H3·H4 | 종료를 «관측한 뒤에만» 배수 마감(`DRAIN_GRACE_MS` 5초)을 건다. 마감을 넘기면 그룹째 SIGKILL → 스트림 destroy → 받은 것만으로 판정. 마감은 exit 이후에만 켜지므로 살아 있는 호출을 자르지 않는다 |
| H5 | kill 사다리를 SIGTERM → (2s) SIGKILL → (3s) **「종료 확인 못 함」 판정** 으로 연장. 마지막 칸이 반드시 정착시킨다 |
| H6 | resolver 슬롯을 배열로 바꾸고 `finish()` 가 대기 중인 «전부» 를 깨운다 |
| H7 | stdin 에 `'error'` 리스너 + `write()` 콜백을 달아 uncaught 를 막고, 오류를 실패 문면(`stdin 오류: …`)에 싣는다. **비동기 stdin 오류로 프로세스를 죽이지는 않는다** — probe3 에서 본 대로 정상적으로 빨리 끝난 자식도 `ERR_STREAM_DESTROYED` 를 내므로, 그걸 치명으로 보면 멀쩡한 호출을 죽인다(E-028). 동기 throw 만 즉시 실패로 유지 |
| H8 | `finish()` 가 kill 사다리 타이머를 «지우지 않게» 했다. 정리는 종료를 확인했을 때만 |
| H9 | `detached:true` 로 자식을 그룹 리더로 만들고 `process.kill(-pid, sig)` 로 그룹째 신호를 보낸다. 실패하면 `child.kill()` 로 강등 |
| H10 | 타임아웃이 `timedOut` 상태를 남기고, 문면이 `AI 호출 시간 초과 (Ns) · 수집 판정: …` 이 된다 |
| H11 | 종료 코드 실패 문면에 `CLI 종료 코드 N` 을 넣었다(기존 `AI 호출 실패` 접두는 유지). `tauriAIBridge` 를 고치지 않고 그쪽 분기를 도달 가능하게 만든 것이다 |
| H12 | signal 배선을 spawn «이전» 으로 옮겼다. 이미 abort 된 signal 이면 프로세스를 아예 만들지 않는다 |
| H13 | 드레인 마감으로 파이프를 끊기 «직전» 에 그룹째 SIGKILL. 파이프를 아직 물고 있다는 것이 곧 그 그룹이 살아 있다는 증거다 |

### 정착 상한 (유한성 증명)

`timeoutSecs + KILL_GRACE(2s) + KILL_CONFIRM(3s) + DRAIN_GRACE(5s) + DRAIN_HARD(1s)`.
모든 `await` 가 (a) 이벤트 또는 (b) 타이머와의 race 이며, 타이머 없는 대기는
하나도 남기지 않았다.

### 타임아웃 상수는 건드리지 않았다 (E-028)

`timeoutSecs` 기본값(180초)·`KILL_GRACE_MS`(2초)는 원본 그대로다. **새로 넣은
마감 셋은 전부 「이미 죽었거나 죽이라고 명령한 뒤」에만 켜진다** — 살아서 일하는
호출을 자르는 자리에는 마감이 없다. 정상 배수 실측치는 1~4ms 이고 마감은
5,000ms 라 세 자릿수 여유가 있다.

---

## 3. C1 결과 — P1~P5

`packages/obsidian-plugin/tests/adapters/aiBridgeLifecycle.test.ts` (신규, 24 tests).
**「timeout 으로 실패」에 기대지 않는다** — `track()` 이 들고 있는 `settled`
플래그를 직접 보고, 미정착이면 그 자리에서 FAIL 한다. `done` 과 `tokens()` 를
**둘 다** 확인한다.

| 경로 | 기대 | 결과 |
|---|---|---|
| P1 없는 바이너리 (`'error'`, `'exit'` 없음) | reject + 원인 | **PASS** — `프로세스 시작 실패: spawn … ENOENT — 이상 — 프로세스 종료를 확인하지 못함 (경로: spawn-error)` / iterator 종료 |
| P2 프로세스 사망 뒤 stdin 대량 쓰기 (EPIPE) | 정착, 미정착 0건 | **PASS** — 2 tests(사망 후 / 생존 중). uncaught 없음, 생존 중 오류는 문면에 남음 |
| P3 타임아웃 | reject + `시간 초과` 포함 | **PASS** — 2 tests(신호에 죽는 자식 / 신호를 무시하는 자식) |
| P4 자식은 종료·stdout 미폐쇄 (손자 점유) | 유한 시간 정착 | **PASS** — 2 tests. 드레인 마감으로 정착, 그룹 kill 도 확인 |
| P5 `cancel()` | reject + 취소 사유 | **PASS** — 4 tests(취소 / SIGKILL 승급 생존 / 이미 abort 된 signal / AbortSignal) |

추가 6 tests: 스트림 error(H2) · 소비자 둘(H6) · exit 없이 close 만 · spawn 동기
throw · C3 판정 5칸 · C2 분기 도달성.

### 이 테스트가 진짜 증거인가 (E-026)

1. **원본에 걸어보면 빨간불이다.** 최종 테스트 파일 그대로 원본 소스에 붙여
   실행: **21 failed / 3 passed / 24 total**. 통과한 3개는 원본이 이미 제대로
   하던 것(취소 reject · abort→cancel · spawn 동기 throw)이라, 전부 빨간
   「고장난 테스트」가 아님을 보인다. 실패 문면도 진단과 일치했다 —
   P1 은 `Unhandled error. (Error: spawn … ENOENT`(리스너 부재),
   P4 는 시뮬레이션 6.1초 뒤에도 `done.settled === false`(영구 대기).
2. **mock 이 실제 코드 경로를 태운다.** 가짜 프로세스는 진짜 `EventEmitter` 와
   진짜 `stream.PassThrough` 다. 스트림 파싱·바이트 계수·타이머 사다리·판정은
   전부 제품 코드가 실행한다. 상수 반환 stub 도, 하드코딩된 expected 도 없다
   (판정 문면은 `console.info` 로그를 그대로 읽어 비교).
3. **mutation 4종으로 테스트 자체를 검사했다.**

   | 수정본을 일부러 망가뜨림 | 결과 |
   |---|---|
   | `'error'` 리스너 등록 무력화 | P1 2건만 정확히 FAIL |
   | `detached:true` → `false` | 그룹 kill 1건 FAIL |
   | 판정을 상수 `"정상 — 출력 없음"` 로 고정 | 6건 FAIL |
   | `finish()` 가 kill 사다리를 다시 지우게 | SIGKILL 승급 1건 FAIL |
   | (원복) | 24/24 PASS |

4. **진짜 OS 프로세스로도 돌렸다** (codex 아님 — `/bin/sh`). 모듈을 esbuild 로
   번들해 Node 에서 6 시나리오 구동:

   ```
   [정상]        607ms  RESOLVE 정상 — 12바이트
   [ENOENT]        1ms  REJECT  프로세스 시작 실패: … ENOENT — 이상 — 프로세스 종료를 확인하지 못함
   [exit3]         4ms  REJECT  AI 호출 실패 (CLI 종료 코드 3): oops
   [손자점유]    5006ms  RESOLVE 정상 — 6바이트 — 손자 점유로 스트림 절단   ← 원본은 40초+ 대기
   [타임아웃]    5003ms  REJECT  AI 호출 시간 초과 (3s) · 수집 판정: 정상 — 출력 없음
   [취소]         300ms  REJECT  사용자가 취소했습니다.  (tokens iter-ended)
   === 남은 프로세스 확인 === (우리 잔여 프로세스 없음)
   ```

   H13 은 바로 이 실행에서 잡혔다 — 1차 수정본은 같은 자리에서
   `sleep 40` 손자를 `ppid=1` 로 남겼다.

---

## 4. C2 grep 출력 그대로

```console
$ grep -rn '시간 초과' packages/obsidian-plugin/src/adapters/aiBridge.ts \
                       packages/obsidian-plugin/src/studio/ai/tauriAIBridge.ts
packages/obsidian-plugin/src/adapters/aiBridge.ts:798:          `AI 호출 시간 초과 (${timeoutSecs}s) · 수집 판정: ${outcome.verdict}${stdinNote}`,
packages/obsidian-plugin/src/studio/ai/tauriAIBridge.ts:100:      // 우리는 streamingHandle이 던지는 메시지에 "시간 초과", "프로세스 시작 실패",
packages/obsidian-plugin/src/studio/ai/tauriAIBridge.ts:102:      if (/시간 초과/.test(msg)) {
```

**도달 가능성 증명 방식.** `tauriAIBridge.ts` 는 고치지 않았다. 테스트가 그
파일의 «진짜» 분기 정규식을 소스에서 **추출해** 우리 문면에 걸어 본다(정규식을
손으로 베끼면 소비자가 바뀔 때 조용히 어긋나므로). 두 방향 다 확인한다 —
타임아웃 문면은 `timeout` 분기에 걸리고 `exit` 분기에 «안» 걸린다. 그 반대도 같다.

직접 `import` 하지 않은 이유: `tauriAIBridge` 가 `@tauri-apps/api/core` 를
import 하는데 `tsconfig.test.json` / `jest.config.cjs` 에 그 경로 매핑이 없어
ts-jest 가 **TS2307** 로 컴파일을 거부한다. 매핑 추가는 허용 파일 넷 밖이라
손대지 않았다(7항).

---

## 5. C3 판정 다섯 칸

전부 «끝까지 태워서» 확인했다 (테스트 전용 함수를 export 하지 않았다).

| 상태 | 문면 | 어떻게 도달시켰나 |
|---|---|---|
| 종료 확인 · 출력 0바이트 | `정상 — 출력 없음` | exit 0, stdout 무출력 |
| 종료 확인 · 전부 처리 | `정상 — 6바이트` | `"hello\n"` |
| 종료 확인 · 일부만 처리 | `부분 — 10 중 6 (스트림 드레인 마감 초과)` | `"line1\npart"` 후 스트림 미폐쇄 |
| 종료 확인 · 0건 처리 | `이상 — 7 중 0건 (스트림 드레인 마감 초과)` | `"partial"`(개행 없음) 후 미폐쇄 |
| **종료 신호 못 받음** | `이상 — 프로세스 종료를 확인하지 못함 (경로: timeout)` | 신호를 무시하는 자식 |

경로 라벨은 `timeout` · `cancel` · `spawn-error` · `close-무exit` ·
`spawn-동기실패` · `stdin-동기실패` · `작업디렉터리-실패` 를 쓴다.
**「종료를 못 봤다」를 «가장 먼저» 판정한다** — 그러지 않으면 매달린 호출이
출력 0바이트라는 이유로 「정상 — 출력 없음」으로 보고돼, 이 표가 막으려는
바로 그 사고가 난다.

강제 종료 사유는 판정 뒤에 덧붙인다 (`— 타임아웃 강제 종료` / `— 사용자 취소` /
`— 손자 점유로 스트림 절단`). 다섯 칸 문면 자체는 표 그대로 두되, 죽여서 끝낸
호출이 로그에서 「정상」으로만 보이는 일을 막기 위해서다.

기록 위치 둘: `console.info("[aiBridge] <invocationId> 판정: …")` 로그 + 실패
문면. 성공 시엔 `AiInvocationResult.verdict` (신규 optional 필드) 로도 노출한다.

---

## 6. C4 테스트 수 — 전/후

| | 전 | 후 |
|---|---|---|
| `@ai-manuscript-studio/obsidian-plugin` | 28 suites / **283** tests | 29 suites / **307** tests (+1 suite, +24) |
| `@ai-manuscript-studio/core` | 26 passed + 3 skipped suites / 311 passed + 18 skipped | 동일 (건드리지 않음) |

- core 의 skip 3 suites / 18 tests 는 소스에 박힌 `describe.skip`(`MockWizardBridge`,
  `WizardConductor` 2건)과 `AMS_TEST_VAULT_PATH` 미설정 조건부 skip 이다. 이번
  변경과 무관하며 베이스라인과 같다.
- 타입 검사: `tsc -noEmit -skipLibCheck -p tsconfig.json` (빌드 스크립트와 동일
  설정) **exit 0**.
- `main.js` · `styles.css` 미접촉. `git status` 상 변경은 `aiBridge.ts` 1개 +
  신규 테스트 1개뿐. `.env`·키·토큰 비접촉. 커밋·push 안 했다.

---

## 7. skipped[] — 온전히 못 했거나 넘긴 것

1. **`tests/adapters/aiBridge.test.ts` 를 수정하지 않았다.** 허용 목록에 있었지만
   기존 순수 함수 테스트(파서 3종)는 이번 변경으로 동작이 바뀌지 않았고, 수명
   테스트는 전부 신규 파일에 넣는 편이 읽기 쉽다. 요청 산출물은 「테스트 수가
   늘 것」이며 +24 로 충족했다.
2. **실제 codex 실행 검증은 안 했다** (금지 항목). 대신 진짜 OS 프로세스
   (`/bin/sh`)로 손자·타임아웃·취소·ENOENT 를 실측했다. codex 로 도는지의 최종
   확인은 발주자 몫이다.
3. **`detached:true` 의 옵시디언 renderer 실환경 확인은 안 했다.** Node 에서
   그룹 kill 이 손자를 잡는 것은 실측했으나(probe6b·live), Electron renderer 의
   `process.kill` 로 도는 것까지는 못 봤다. 재현 절차: 옵시디언에서 codex 호출
   중 취소 → `ps -eo pid,pgid,command | grep codex` 로 잔여 확인.
4. **드레인 마감 5초·확인 유예 3초의 «현장» 튜닝은 안 했다.** 정상 배수 실측
   1~4ms 대비 세 자릿수 여유지만, 옵시디언 renderer 가 무거운 렌더링 중일 때의
   실측치는 없다. 두 값 다 「이미 죽은 뒤」에만 켜지므로 살아 있는 호출을 자르지는
   않는다.
5. **멀티바이트 문자가 청크 경계에서 쪼개지는 기존 버그는 안 고쳤다** (아래 8항).
6. **`electronRequire("process")` 가 매 신호마다 재호출된다.** 캐시하지 않았다 —
   요청 밖 최적화라 손대지 않았다.
7. **spawn 이전 단계에서 실패해 조기 반환할 때 abort 리스너를 제거하지 않는다.**
   `once:true` 라 누수 규모는 AbortController 수명에 묶인다. 구조를 더 흔들지
   않으려고 그대로 뒀다.

---

## 8. 고치지 않고 보고만 한 것

1. **두 구현이 갈라져 있다.** `packages/core/src/ai/CodexCLIAdapter.ts` 는
   `'error'`·`'close'`·`timedOut`·`aborted`·`settled` 를 처음부터 갖췄는데
   옵시디언 쪽이 열등하게 다시 짜였다. 다만 **참조 구현도 완전하지 않다** —
   `'close'` 만 기다리므로 probe5 의 손자 점유에서 «영구 대기» 한다.
   합치려면 «참조 구현 쪽» 도 고쳐야 한다. 별도 발주 대상.
2. **`readLines` 의 청크 단위 `toString("utf8")`** 은 멀티바이트 문자가 청크
   경계에 걸리면 깨진다(`aiBridge.ts` 신규본의 `readLines`, 원본 `:206-220` 동일).
   `StringDecoder` 를 쓰면 닫힌다. 이번 발주의 「미정착 경로」와 무관해 남겼다.
3. **`tauriAIBridge.ts` 의 오분류가 아직 하나 남아 있다.** `kind:"spawn"` 이
   기본값이라, 우리가 새로 내는 `이상 — 프로세스 종료를 확인하지 못함` 도
   `spawn` 으로 분류된다. 「종료 미확인」 전용 kind 가 필요하면 그 파일을
   고쳐야 한다(이번 발주 금지 대상).
4. **테스트 인프라 결손** — `jest.config.cjs` 의 `moduleNameMapper` 와
   `tsconfig.test.json` 에 `@tauri-apps/*` 매핑이 없어 `src/studio/**` 를
   테스트에서 직접 import 할 수 없다. 후속 발주가 `useStreamingChat` 이나
   `tauriAIBridge` 를 테스트하려면 그 매핑부터 필요하다.
5. **`useStreamingChat.ts:74-82` 는 `tokens()` 를 먼저 소비하고 `done` 을 나중에
   기다린다.** 이번 수정으로 둘 다 유한 정착하니 화면은 더 안 멈춘다. 다만
   에러 시 버퍼에 이미 쌓인 토큰이 화면에 남는데, 실패 문구와 섞여 보일 수
   있다. UI 처리는 후속 발주 몫.

---

## 9. 도메인 되먹임 — 정본·규칙에서 발견한 결함

1. **「허용 파일 넷」과 「수정 전 원본 백업 필수」가 충돌한다.** 백업을 레포 안에
   만들면 다섯 번째 파일이 된다. 이번엔 세션 scratchpad + `git show HEAD:` 로
   풀었다. 다음 지시서에는 **「백업은 레포 밖에 두거나 git HEAD 로 갈음한다」**
   를 한 줄 박아 두는 편이 낫다.
2. **`AGENTS.md` 의 명령 목록에 타입 검사가 없다.** `pnpm build` 는 `tsc` 와
   esbuild 를 «함께» 돌려 `main.js` 를 덮어쓰므로, 「빌드 산출물 수정 금지」를
   지키면서 타입만 보려면 `npx tsc -noEmit -p tsconfig.json` 을 따로 알아야 한다.
   AGENTS.md 명령 목록에 추가할 것을 권한다.
3. **`node_modules/.bin/esbuild` 를 직접 실행하면 이 환경에서 깨진다.** 네이티브
   바이너리가 node 로 실행돼 `SyntaxError` 가 난다. JS API(`require("esbuild")`)로
   우회했다. 빌드 스크립트가 `node esbuild.config.mjs` 라 제품 빌드는 무사하다.
4. **`docs/` 에 마크다운을 쓰면 훅이 `docs/_html/` 17개를 자동 생성한다.**
   이번 보고서를 쓰자마자 생겼고(전부 12:15 생성, 기존 파일 0개), 「허용 파일
   넷」과 어긋나 그 자리에서 지웠다. 마크다운에서 언제든 재생성되는 렌더 결과라
   손실은 없다. 지시서에 **「문서 작성 시 자동 생성되는 산출물은 허용 파일 수에
   포함하지 않는다」** 또는 `.gitignore` 처리를 명시해 두면 다음 실행자가 같은
   판단을 다시 하지 않아도 된다.
5. **E-026 이 이번에도 그대로 맞았다.** mock 24개 전부 초록인 수정본이 실제
   프로세스에서는 손자를 고아로 남겼다(H13). **「가짜 프로세스로만 검증한 프로세스
   수명 수정은 초록불이어도 미검증」** 을 규칙으로 박아 둘 만하다.
