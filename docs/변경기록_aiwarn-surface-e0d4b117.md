*Version: v1.0 (2026-08-31)*

# 변경기록 — aiwarn-surface-e0d4b117

**대상 파일 둘**

- `packages/obsidian-plugin/src/studio/ai/streamingChat.ts` (수정)
- `packages/obsidian-plugin/tests/studio/streamingChat.test.ts` (수정)

**베이스**: `b36b9ec`
**원본 백업**: 세션 scratchpad `backup-aiwarn/`

- `streamingChat.ts.orig` sha256 `6c4d680317e7c6fda0f6c6db81414d515b9e3fe23821298c16ccc3157b56484a`
- `streamingChat.test.ts.orig` sha256 `dbcab949a21a7e9470b9f9436781b9331cdee7159829e59d3d318d59b90b3443`

레포 안에는 백업본을 만들지 않았다 — 허용 파일 셋 밖이기 때문이다.
`git show HEAD:packages/obsidian-plugin/src/studio/ai/streamingChat.ts` 가 같은
원본을 준다.

---

## 0. 판정을 내리기 전에 확인한 것 — 이 문자열이 «어디에» 뜨는가

판정의 근거가 여기서 갈렸으므로 먼저 적는다. `extractDisplayText()` 의 반환값은
`useStreamingChat` 의 `buffer` 로만 흘러가고, `buffer` 는 소비자 UI 에서
**`isStreaming === true` 인 동안에만** 렌더된다
(`studio/wizard/concept/Step2Concept.tsx:408` — `{isStreaming && (…{mainChat.buffer}…)}`).
대화에 박히는 원고 본문은 `run()` 의 반환값 `result.fullText`(codex 의
`--output-last-message` 파일)이고 `buffer` 가 아니다
(`Step2Concept.tsx:228`·`263` `appendMessage("assistant", fullText)`).

따라서:

| 물음 | 답 |
|---|---|
| 여기 넣은 알림 줄이 원고 본문을 더럽히는가 | **아니다.** 턴이 끝나면 사라지는 진행 영역이다 |
| 이 영역이 비어 있으면 사용자가 보는 것은 | **아무것도 없음.** codex `--json` 에 글자 델타가 없어(F6) 본문은 턴 끝에 통째로 한 번 온다. 그 전까지 화면은 백지다 |

즉 「본문 오염」이라는 침묵의 근거는 성립하지 않고, 침묵의 대가는 「멈춤과 작업
중을 구별할 수 없음」이다. 선은 그 위에서 그었다.

**그은 선**: *지금 하는 일(원고 생성)에 영향을 주는가* **또는** *사용자가 손쓸
수 있는가* — 둘 중 하나라도 «예»면 보인다. 둘 다 «아니오»이고 **매 턴 반복**되는
것만 감춘다.

---

## 1. 판정 — 무엇을 보이고 무엇을 감췄나

| 이벤트 | 판정 | 근거 (한 줄) |
|---|---|---|
| `item.type === "agent_message"` | **보인다** (그대로, 표식 없음) | 사용자가 주문한 물건 자체다 |
| `item.type === "error"` — 일반 | **보인다** `[AI 알림]` | 생성에 영향을 주거나 사용자가 손쓸 수 있는 유일한 통로다. 지금은 한 글자도 안 뜬다(F1·F3) |
| `item.type === "error"` — F2 의 스킬 예산 안내 | **감춘다** (콘솔에는 남김) | 매 턴 뜨고, 스스로 「Codex can still see every skill」이라 말하며, 이 앱 안에 손쓸 화면이 없다. 매번 뜨는 경고는 «진짜» 경고까지 무시하게 만든다 |
| `item.type === "command_execution"` — `item.started` | **보인다** `[AI 진행]` (명령 문자열은 감춤) | 델타가 없어(F6) 이것이 「살아 있다」는 유일한 신호다. 다만 `-s read-only` + `--ephemeral` 임시 디렉터리라(`aiBridge.buildCodexArgs`) 사용자 승인이 필요한 행위가 아니므로, **명령 내용은 구현 세부로 감추고 사실만 알린다** |
| `item.type === "command_execution"` — `updated`/`completed` | **감춘다** | 같은 명령이 세 번 온다. 이 함수는 상태가 없어 dedup 이 불가능하므로 «시작» 한 번으로 고정 |
| `type === "turn.failed"` | **보인다** `[AI 오류]` | 멈춘 이유 그 자체 |
| `type === "error"` (최상위) | **보인다** `[AI 오류]` | 아래 §1.1 |
| `thread.started`·`turn.started`·`turn.completed` | **감춘다** | 사용자에게 알릴 내용이 없다 |
| JSON 이 아닌 평문 | **원문 그대로** | claude-code 등 다른 provider 호환 — 기존 보장 |

### 1.1 지시서 물음 3에 대한 답 — 최상위 `error` 는 「본문인 척」 섞이고 있었다

수정 전 코드는 최상위 `type` 을 아예 보지 않고 `text`→`message`→`output`→…
순으로 훑었다. 그래서:

- `{"type":"error","message":"Unauthorized: …"}` → **`"Unauthorized: …\n"` 을 그대로
  반환**. 표식이 없어 화면에서는 AI 가 쓴 문장과 구별되지 않았다.
  (A/B 실측: 원본 구현에서 `out.startsWith("[AI 오류]")` 가 `false`)
- `{"type":"turn.failed","error":{"message":"…"}}` → `error` 가 «객체»라 문자열
  fallback 에 안 걸려 **`""`**. 아무것도 안 떴다.
  (A/B 실측: Received `""`)

즉 최상위 오류는 **하나는 본문인 척 새고 하나는 통째로 사라지는** 상태였다.
지금은 둘 다 `[AI 오류]` 표식으로 나온다.

### 1.2 감춘 것을 사라지게 하지 않았다

benign 목록에 걸려 화면에서 감춘 줄은 `console.debug("[Studio] codex 내부 안내를
화면에서 숨김:", …)` 로 devtools 에 남긴다(레포 `CLAUDE.md` §5 의 `[Studio]` 로그
규약). 「측정했는데 조용히 버림」을 만들지 않기 위해서다. 이 동작도 테스트로
고정했다(스파이 호출 1회 + 원문 포함 확인).

---

## 2. 보이기로 한 것의 한국어 문면 실물

코드에 박힌 그대로다.

```
[AI 진행] 자료를 확인하려고 도구를 실행하는 중입니다. 잠시만 기다려 주세요.
[AI 알림] AI 도구가 알림을 보냈습니다. (원문: Model gpt-5.5 is deprecated and will stop working.)
[AI 오류] 생성이 중단됐습니다.
[AI 오류] AI 서버와 연결이 끊겼습니다. 다시 시도해 주세요. (원문: stream disconnected before completion)
[AI 오류] AI 계정 인증이 풀렸습니다. AI CLI 로그인을 다시 해 주세요. (원문: Unauthorized: please run codex login.)
[AI 알림] AI 사용량 한도에 걸렸습니다. 잠시 뒤에 다시 시도해 주세요. (원문: You have hit your usage limit for this model.)
```

**설계 규칙 둘**

1. 한국어가 «앞», 영어 원문은 «뒤» 괄호 안. 지시서 C2 그대로.
2. 자주 나오는 사유 넷(사용량 한도 / 인증 / 시간 초과 / 연결 끊김)은 *사용자가 할
   수 있는 일*이 담긴 한국어로 바꾼다. 부분 문자열 heuristic 이라 못 맞히면 일반
   문면(`AI 도구가 알림을 보냈습니다.` / `생성이 중단됐습니다.`)으로 떨어진다
   (fail-open). 원문을 항상 붙이므로 오역이 정보를 지우지 않는다.

표식(`[AI 진행]`·`[AI 알림]`·`[AI 오류]`)이 본문과 구별하는 **유일한** 수단이다 —
진행 영역은 `white-space: pre-wrap` 평문이고 UI 컴포넌트(`*.tsx`) 수정은 이
발주에서 금지다. 색·아이콘으로 구별하는 것은 후속 발주 몫이라고 본다.

---

## 3. C1 표 — 각 행 PASS/FAIL

| 입력 | 고정한 것 | 테스트 | 결과 |
|---|---|---|---|
| `item.type === "agent_message"` | 본문 그대로, 표식 없음, 구 `item_type` 호환 | 3건 | **PASS** |
| `item.type === "error"` (**F2 실물 그대로**) | `""` (감춤) + 콘솔 1회 기록 | 1건 | **PASS** |
| `item.type === "error"` (그 밖) | `[AI 알림]` + 한국어 + 원문, 한국어가 원문보다 앞 | 2건 | **PASS** |
| `item.type === "command_execution"` | `item.started` 만 `[AI 진행]`, 명령 문자열 미노출 / `updated`·`completed` 는 `""` | 2건 | **PASS** |
| `type === "turn.failed"` / `type === "error"` | `[AI 오류]` 로 시작 — 본문과 구별됨 (사유 없으면 사실만) | 3건 | **PASS** |
| `thread.started`·`turn.started`·`turn.completed` | `""` | 3건 | **PASS** |
| JSON 아닌 평문 | 원문 그대로 (+ 깨진 JSON, 빈 줄) | 3건 | **PASS** |

### 3.1 E-026 대조 — 이 테스트가 «기계»로서 작동하는가

**입력 출처를 테스트 파일 안에 표기했다.** `[실물]` 은 지시서 F2 의 관측 문자열
그대로(`REAL_SKILL_BUDGET_EVENT` 상수 — 한 글자도 고치지 않음), `[합성]` 은 최상위
`type`·`item.type` 값만 F4·F5 의 관측값을 쓰고 나머지 필드는 이 테스트가 만든 것이다.
통과시키려고 형태를 비튼 곳은 없다.

**A/B 실측** — 새 테스트를 **원본 구현**에 그대로 돌렸다 (원본 복원 → 실행 →
새 구현 복원, 로그: scratchpad `backup-aiwarn/ab-old-impl.log`).

```
원본 구현: 7 failed, 11 passed, 18 total
새 구현  : 18 passed, 18 total
```

- **7건이 원본에서 실패** = 이 테스트는 F3 의 결함을 실제로 잡는다 (초록만 내는
  기계가 아니다).
- **10건(신규) 이 양쪽 모두 통과** = 본문·소음·평문 보장이 이번 변경으로 깨지지
  않았음을 증명하는 회귀 가드다.

원본에서 실패한 7건의 Received 값: `""` 넷(감춰져 있던 것들), 콘솔 호출 0회,
`startsWith("[AI 오류]") === false`(본문인 척 새던 것), 그리고 `[AI 진행]` 부재.

---

## 4. C3 — 테스트 수 전/후, typecheck

| 항목 | 전 | 후 |
|---|---|---|
| `pnpm --filter @ai-manuscript-studio/obsidian-plugin test` | **307 passed / 29 suites** | **324 passed / 29 suites** |
| 그중 `tests/studio/streamingChat.test.ts` | 1 | 18 |
| 신규 테스트 | — | **+17** (내가 만든 수와 정확히 일치) |

- 전 측정 시점에 다른 발주의 `tests/adapters/aiBridgeLifecycle.test.ts` 는 이미
  존재했고(307에 포함), 내 작업 창 동안 그쪽 테스트 수는 변하지 않았다 —
  증가분 17이 내 신규분과 정확히 같다.
- `pnpm typecheck` → `EXIT=0` (모노레포 전체, `pnpm -r exec tsc -noEmit`).
- 실패·스킵 0건. `.env`·키·토큰 비접촉. git commit·push 하지 않았다.

---

## 5. skipped[]

1. **`item.updated` 가 본문(`agent_message`) 텍스트를 나를 가능성** — 지금 구현은
   `item.text` 가 있으면 이벤트 단계와 무관하게 낸다(기존 동작 보존). F6 이
   「델타 없음」이라 실물에서 중복 출력은 관측되지 않지만, codex 가 델타를 켜면
   같은 문장이 두 번 쌓일 수 있다. 상태 없는 함수라 dedup 을 넣으려면 호출부
   (`useStreamingChat.ts` — 이 발주 금지 파일)를 건드려야 해 손대지 않았다.
2. **관측되지 않은 item 타입**(`reasoning`·`mcp_tool_call`·`web_search`·`todo_list`
   등)의 전용 문면 — 실물을 못 봤으므로 추측으로 문면을 만들지 않았다. 현재는
   `item.text` 가 있으면 본문, 없으면 `""` 로 떨어진다.
3. **한국어 사유 사전의 확장** — 넷(한도·인증·시간초과·연결)만 넣었다. 나머지는
   일반 문면 + 원문으로 나간다. 실물 없이 사전을 늘리면 오역만 늘어난다.
4. **UI 상의 시각적 구별**(색·아이콘·별도 영역) — `*.tsx` 수정 금지라 문자 표식으로만
   구별했다. 후속 발주 몫.
5. **`apps/desktop/src/ai/streamingChat.ts` 의 쌍둥이 구현** — 같은 함수가 1:1 사본으로
   존재하나(149행, 동일 코드) 수정 금지 대상(폐기 예정)이라 손대지 않았다. 데스크톱
   앱을 살릴 경우 이 판정이 반영되지 않은 상태로 남는다.

---

## 6. 고치지 않고 보고만 한 것

1. **[중] codex 응답이 통째로 raw JSONL 로 화면에 박힐 수 있는 경로** —
   `adapters/aiBridge.ts` 의 `extractLastCodexMessage()` 는 최상위 `message`/`output`/
   `turn.message` 만 훑고 **`item.text` 를 보지 않는다**. F5 의 실제 포맷
   (`item.completed` → `item.text`)에는 하나도 안 걸려 `null` 을 반환하고, 그러면
   `fullText = stdoutAcc`(= raw JSONL 전문)가 된다. `--output-last-message` 파일이
   비거나 읽기에 실패하는 경우 사용자 화면과 대화 기록에 JSON 덩어리가 그대로
   들어간다. **다른 발주가 지금 그 파일을 쓰고 있어 손대지 않았다.**
   (`aiBridge.ts` 의 `fullText` 결정 블록 — `extractLastCodexMessage(stdoutAcc) ?? stdoutAcc` 세 곳)
2. **[하] `extractCodexFailureReason()` 도 같은 사각** — 최상위 `error`/`turn.failed` 만
   보고 `item.type === "error"` 는 안 본다. `item` 오류만 나고 CLI 가 0이 아닌 코드로
   죽으면 오류 배너에 「사유 미상」이 뜬다. 같은 이유로 손대지 않았다.
3. **[하] 실패 시 진행 영역이 통째로 사라진다** — `isStreaming` 이 `false` 가 되면
   소비자 UI 가 `buffer` 를 렌더하지 않으므로, 지금 새로 내보내는 `[AI 오류]` 줄은
   실패 순간 화면에서 사라지고 오류 배너(영어 원문)만 남는다. 진행 로그를 실패
   후에도 남기려면 UI 또는 훅 수정이 필요하다 — 둘 다 이 발주 금지 범위다.
4. **[하] 오류 배너 문면은 여전히 영어** — `aiBridge` 가 만드는 `AiInvocationError`
   메시지는 codex 원문을 그대로 담는다. C2 의 한국어화가 스트리밍 영역에만
   적용되고 배너에는 적용되지 않은 상태다.

---

## 7. 도메인 되먹임

1. **지시서 F1 의 진단은 맞았지만 원인 하나가 더 있었다.** 「`item.text` 가 없으면
   `""`」 외에, **최상위 `error` 는 반대로 «표식 없이 본문인 척» 새고 있었다**.
   「한 글자도 안 뜬다」와 「본문인 척 뜬다」가 같은 함수에 공존했다. 물음 3이
   그것을 짚어 준 덕에 잡혔다.
2. **레포 `CLAUDE.md` §3 의 어댑터 매핑 표가 낡았다.** `ai_invoke/cancel` 행이
   여전히 Tauri 기준으로 적혀 있는데, 실제 `aiBridge.ts` 는 프로세스 «그룹» kill·
   배수 마감·다섯 칸 판정까지 갖춘 별개 수명 계약을 이미 갖고 있다. 표만 보고
   들어오면 「얇은 shim」으로 오해한다.
3. **소스 코드 주석의 포맷 표기가 실물과 어긋나 있었다.** 수정 전 주석은
   `item: { item_type: "agent_message" }` 라고 적었으나 codex 0.151.0 은 `item.type`
   을 쓴다. 주석을 실물에 맞추고 구 필드명은 호환 경로로 남겼다.
