*Version: v1.0 (2026-08-31)*

# 변경기록 — aiargs-assembly-c71f2a93

**대상 파일 넷 (+ 이 보고서)**

| 파일 | 무엇을 했나 |
|---|---|
| `packages/obsidian-plugin/src/adapters/aiBridge.ts` | 파서 3종 수정 + 플래그 둘 + 기본 모델 |
| `packages/obsidian-plugin/src/adapters/appSettings.ts` | 되돌림 스위치 둘 + 「읽는 쪽」 스냅숏 |
| `packages/obsidian-plugin/src/studio/settings/SettingsPanel.tsx` | 스위치 둘 + 한국어 설명 |
| `packages/obsidian-plugin/tests/adapters/aiBridge.test.ts` | 17 → **45** tests |

**시작점**: 선행 두 발주(`aihang-lifecycle-b505ee40` · `aiwarn-surface-e0d4b117`)의
커밋 안 된 작업 트리. **그 위에 얹었고 한 줄도 되돌리지 않았다.**
`git checkout` / `git stash` / `git restore` 는 한 번도 실행하지 않았다.
`streamingChat.ts`(+166/-10)·`streamingChat.test.ts`(+158)·`aiBridgeLifecycle.test.ts`
는 시작 때와 **바이트까지 동일**하다.

**원본 백업** — 세션 scratchpad `backup-orig/` (레포 안에 두면 허용 파일 다섯을
넘기 때문이다).

```
4ffa994158c5c09a82d6ecda8485a6eeb5f70a7fe53e2cd231b306e316b8af45  aiBridge.ts
5b4b6bd14418a4268183547d1e97ad9637f16e0cd5a21f40a4035744f1a996ea  aiBridge.test.ts
e06792919e3c3a10dd0b23722bc72cc5034515d9614a521d6f901c0a0007eb10  appSettings.ts
f6073891a3556ee3aeba6540e39efff44702014806e4bd23666762ff34490470  SettingsPanel.tsx
```

---

## 0. 판단 근거를 먼저 — 지시서 밖에서 확인한 것

발주자가 준 F1~F13 위에, 결론을 바꾸는 것만 **1차 출처**로 다시 확인했다.
codex 를 실행하지 않고(=토큰을 쓰지 않고) 확인할 수 있는 것만 골랐다.

| 무엇 | 어떻게 | 결과 |
|---|---|---|
| **`--ignore-user-config` 가 로그인을 안 끊나** | `codex exec --help` 원문 | *"Do not load `$CODEX_HOME/config.toml`; **auth still uses `CODEX_HOME`**"* — F3 확인 |
| **`--disable` 이 반복 가능한가** | 같은 `--help` | *"Disable a feature (**repeatable**). Equivalent to `-c features.<name>=false`"* — 사용자가 추가 인자에 같은 걸 넣어도 충돌하지 않는다 |
| **`--output-last-message` 가 무엇을 쓰나** | 같은 `--help` | *"Specifies file where **the last message from the agent** should be written"* — 에이전트 메시지가 없으면 쓸 것이 없다(F10 의 근거) |
| **codex 0.151 의 이벤트 tag 전수** | 설치된 Rust 바이너리 문자열 테이블 직접 추출 | `ThreadStarted→thread.started` · `TurnStarted→turn.started` · `TurnCompleted→turn.completed` · `TurnFailed→turn.failed` · `ItemStarted→item.started` · `ItemUpdated→item.updated` · `ItemCompleted→item.completed` |
| **item 안의 이름이 `type` 인가 `item_type` 인가** | 같은 바이너리의 SQL: `json_extract(item_json, '$.type')` | **JSON 필드는 `type`.** `item_type` 은 codex 내부 DB 컬럼 이름이지 JSON 필드가 아니다 → F9 확인 |
| **item 종류 목록** | 같은 문자열 테이블 | `agent_message` · `reasoning` · `command_execution` · `file_change` · `mcp_tool_call` · `web_search` · `todo_list` — **`reasoning` 도 `text` 를 갖는다** (아래 A-1 의 판단 근거) |
| **F12 가 실재하는가** | Node v26 로 직접 재현 | `"한"` 3바이트를 1:2 로 쪼개면 `"한"` → `"���"`. **그런데도 `JSON.parse` 는 성공한다** — U+FFFD 는 JSON 문자열 안에서 합법이라 조용히 통과한다 |

버전: `codex-cli 0.151.0` (`/Users/dongchanyoon/.local/bin/codex`).
사용자의 `~/.codex/config.toml` 은 **읽지도 쓰지도 않았다.**

---

## 1. 과제 A — 파서를 몇 개 세었고 몇 개가 어긋났나

### 1.1 셈 — **응답을 해석하는 자리 다섯. 그중 셋이 어긋나 있었다.**

줄 번호는 「전」 = 이번 발주 시작점(선행 발주 반영본), 「후」 = 수정본.

| # | 자리 | 전 | 후 | 기대한 모양 | codex 0.151 의 실제 모양 | 판정 |
|---|---|---|---|---|---|---|
| **P1** | `readLines()` — 청크→줄 | `:273-293` | `:439-475` | 청크 하나하나가 «그 자체로» 완결된 UTF-8 | 파이프는 **바이트** 경계에서 자른다. 한글 3바이트 가운데를 지난다 | **어긋남** (F12) |
| **P2** | `extractLastCodexMessage()` | `:142-162` | `:217-274` | 최상위 `message` / `output` / `turn.message` | `{"type":"item.completed","item":{"type":"agent_message","text":"…"}}` | **어긋남** (F9) |
| **P3** | `extractCodexFailureReason()` | `:164-196` | `:276-337` | 최상위 `type` 이 `error` / `turn.failed` | 그 둘 **더하기** `item.type === "error"` | **어긋남** (F11) |
| P4 | last-message 파일 읽기 | `:761-776` | `:931-946` | `--output-last-message` 파일에 본문 | 맞다 (`--help` 원문 확인) | 어긋나지 않음 — 다만 **대체 경로가 P2 때문에 망가져 있었다** |
| P5 | stdout 토큰 조립 `` `${piece.text}\n` `` | `:640` | `:806` | 줄 끝에 개행 | 개행 없이 끝난 마지막 조각에도 `\n` 을 붙인다 | 어긋나지 않음 — JSONL 소비자가 `trim()` 하므로 무해. **바이트 계수는 `hadNewline` 으로 이미 구분한다** |

**셈에서 뺀 것**: `buildCodexArgs`(요청 조립이지 응답 해석이 아님) ·
`classifyOutcome`(판정) · `stderrTail` 누적(부가 정보, JSON 을 해석하지 않음).
`stderrTail` 은 P1 을 고치면서 함께 고쳐졌다 — 같은 `readLines` 를 쓴다.

### 1.2 어긋난 셋을 어떻게 맞췄나 — «더하되 빼지 않았다»

| # | 무엇을 더했나 |
|---|---|
| **P1** | `createIncrementalDecoder()` 신설. 청크 «경계를 넘어» 이어서 해독한다. 우선순위 **StringDecoder**(Electron renderer — codex 가 도는 유일한 환경) → **TextDecoder**(모바일 webview) → 종전 방식(마지막 수단). 스트림이 글자 가운데서 끊기면 `decoder.end()` 의 잔여도 버리지 않는다 — 버리면 `bytesIn` 과 내보낸 양이 어긋나 선행 발주의 판정 다섯 칸이 흔들린다 |
| **P2** | **1차 통과** = `item.*` 이벤트의 `agent_message` (실물). **2차 통과** = 옛 필드명 경로 `message`/`output`/`turn.message` — **한 글자도 안 지웠다**. 구 필드명 `item.item_type` 도 함께 받는다. 순서만 「실물 먼저」로 두었으므로 옛 경로의 보장은 그대로다(기존 7 tests 전부 그대로 통과) |
| **P3** | **1차 통과** = 최상위 `error`/`turn.failed` (원본 동작 그대로). **2차 통과** = `item.type === "error"` 의 `message` ?? `text`. 순서를 뒤집으면 시작 무렵의 무해한 안내(스킬 설명 예산)가 «진짜» 사유를 밀어내고 `?? stderrTail` 로 가야 할 경로까지 막는다 — 그래서 2차를 **fallback 으로만** 붙였다 |

**`reasoning` 은 일부러 본문으로 안 집었다.** 바이너리에서 확인한 대로
`reasoning` item 도 `text` 를 갖는다. 「아무 `item.text` 나 집기」로 짰으면
**AI 의 생각 요약이 원고 본문으로 박힌다.** `agent_message` 만 인정한다.
(테스트: `[실물] reasoning 의 text 는 본문으로 집지 않는다`)

### 1.3 물음 2 — F10 은 «어떤 조건에서» 실제로 일어나는가

**답: 조건 셋 중 하나만 걸리면 «반드시» 일어난다. 확률이 아니라 결정론이다.**

대체 경로의 입구는 정확히 셋이고 전부 같은 곳(`전:761-776`)으로 모인다.

| 입구 | 코드 | 실재하나 |
|---|---|---|
| (a) `fs` 모듈이 없다 | `전:770-772` | **이론상만.** codex 경로에서는 `buildCodexCtx()` 가 `os`/`fs`/`path` 를 먼저 요구하고 없으면 그 자리에서 throw 한다 → 도달 불가 |
| (b) `readFileSync` 가 던진다 (파일 없음) | `전:773-775` | **실재.** `--help` 가 말하는 대로 그 파일은 「에이전트의 마지막 메시지」를 담는다. 메시지가 없으면 쓸 것이 없다 |
| (c) 파일은 있는데 `s.trim()` 이 빈다 | `전:769` | **실재.** 같은 이유 |

그리고 **입구에 들어서는 순간 결과는 정해져 있었다** — 대체식이
`extractLastCodexMessage(stdoutAcc) ?? stdoutAcc` 인데, 그 함수가 codex 0.151 의
모양을 **한 건도 못 걸러 언제나 `null`** 이므로 `??` 의 오른쪽, 즉 **stdout JSONL
전문**이 그대로 원고가 된다. 「대체 경로」가 아니라 사실상 **유일 경로**였다.

**재현을 말이 아니라 테스트로 냈다.** 수정 전 구현에 걸었을 때 실제로 나온 값:

```
● last-message 대체 경로 (F10) › 파일이 비어 있으면 stdout 에서 «본문» 을 꺼낸다

    - Expected  - 1
    + Received  + 7

    - 안녕하세요. 요청하신 원고입니다.
    + {"type":"thread.started","thread_id":"th_1"}
    + {"type":"turn.started"}
    + {"type":"item.started","item":{"id":"item_0","type":"reasoning"}}
    + {"type":"item.completed","item":{"id":"item_0","type":"reasoning","text":"먼저 구조를 잡는다"}}
    + {"type":"item.started","item":{"id":"item_1","type":"agent_message"}}
    ...
```

**정직하게 남기는 한계**: (b)·(c) 가 «얼마나 자주» 일어나는지는 못 쟀다.
실제 codex 가 exit 0 으로 끝내면서 last-message 를 비우는 장면을 직접 관측하지는
않았다(테스트에서 codex 실행 금지). 내가 증명한 것은 **「그 입구에 들어서면
반드시 raw JSONL 이 나온다」** 와 **「이제는 안 나온다」** 둘이다.

### 1.4 물음 3 — F12 판정: **실재한다. 고쳤다.**

Node v26 실측. `"한"`(U+D55C, UTF-8 `EC 95 88`)의 첫 1바이트 뒤에서 자르면:

```
naive  : "t\":\"���글 응답입니다\"}}\n"     ← 종전 방식
decoder: "t\":\"한글 응답입니다\"}}\n"        ← StringDecoder
```

수정 전 구현에 새 테스트를 걸었을 때 실제로 나온 값:

```
● 한글 청크 경계 (F12) › [실물] 한 글자가 두 청크에 걸쳐도 토큰이 안 깨진다
    Expected substring: not "�"
    Received string: "{\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"text\":\"���녕하세요. …\"}}"
```

**이게 왜 조용히 새는 버그인가** — 깨진 문자열도 `JSON.parse` 를 통과한다
(U+FFFD 는 JSON 문자열 안에서 합법). 그래서 파싱 성공은 증거가 못 되고,
깨진 글자가 그대로 화면 버퍼(`useStreamingChat.buffer`)로 흘러간다.
테스트도 파싱 성공이 아니라 **본문 문자열 자체**를 본다.

---

## 2. 과제 B — 추가한 플래그 · 설정 키 · C3-4 grep

### 2.1 추가한 것

| 무엇 | 값 |
|---|---|
| 플래그 1 | `--ignore-user-config` |
| 플래그 2 | `--disable shell_tool` (인접한 두 인자) |
| 기본 모델 | `gpt-5.5` → **`gpt-5.6-terra`** (대표 확정값. 변종을 바꾸지 않았다) |
| 설정 키 1 | `AppSettings.codexIgnoreUserConfig` — 기본 `true` |
| 설정 키 2 | `AppSettings.codexDisableShellTool` — 기본 `true` |

**기본값은 「플래그가 붙은 상태」다.** 설정을 아직 못 읽었을 때도
`DEFAULT_APP_SETTINGS` 가 스냅숏의 초기값이라 남의 짐이 딸려 들어가지 않는다.
옛 `data.json` 에 키가 아예 없어 `undefined` 가 와도 `!== false` 로 읽어 기본값
쪽으로 기운다.

### 2.2 「읽는 쪽까지 잇는다」를 어떻게 이었나

`buildCodexArgs()` 는 React 트리 밖(모달·백그라운드)에서도 돌고 **동기 함수**라
zustand store 를 볼 수 없다. 그래서 `appSettings.ts` 가 마지막으로 `load()`/`save()`
한 값을 스냅숏으로 들고, 브리지가 `getCodexArgSettings()` 로 그것을 본다.

```
SettingsPanel 체크박스 → settingsStore.update() → (300ms debounce)
  → ObsidianAppSettingsStore.save() → rememberCodexArgSettings()
  → getCodexArgSettings() → buildCodexArgs() → codex 인자
```

`CodexArgSettings` 의 필드 이름을 `AppSettings` 의 키와 **글자 그대로 같게** 두었다.
설정 키 하나를 grep 하면 저장·표시·읽기 세 자리가 한 번에 잡히게 하기 위해서다.

### 2.3 C3-4 grep 출력 — 그대로

```console
$ grep -rn 'codexIgnoreUserConfig' packages/obsidian-plugin/src | grep -v appSettings.ts
packages/obsidian-plugin/src/studio/settings/SettingsPanel.tsx:117:                checked={settings.codexIgnoreUserConfig}
packages/obsidian-plugin/src/studio/settings/SettingsPanel.tsx:119:                  void update({ codexIgnoreUserConfig: e.target.checked })
packages/obsidian-plugin/src/adapters/aiBridge.ts:131: * 되돌릴 수 있다(`AppSettings.codexIgnoreUserConfig` / `codexDisableShellTool`).
packages/obsidian-plugin/src/adapters/aiBridge.ts:162:  if (opts.codexIgnoreUserConfig) args.push("--ignore-user-config");

$ grep -rn 'codexDisableShellTool' packages/obsidian-plugin/src | grep -v appSettings.ts
packages/obsidian-plugin/src/studio/settings/SettingsPanel.tsx:138:                checked={settings.codexDisableShellTool}
packages/obsidian-plugin/src/studio/settings/SettingsPanel.tsx:140:                  void update({ codexDisableShellTool: e.target.checked })
packages/obsidian-plugin/src/adapters/aiBridge.ts:131: * 되돌릴 수 있다(`AppSettings.codexIgnoreUserConfig` / `codexDisableShellTool`).
packages/obsidian-plugin/src/adapters/aiBridge.ts:163:  if (opts.codexDisableShellTool) args.push("--disable", "shell_tool");
```

**grep 은 「이름이 있다」까지만 증명한다.** 값이 실제로 흐르는지는 테스트가
증명한다 — `저장된 false 를 load 하면 그 플래그가 실제로 빠진다` ·
`save 한 값도 즉시 읽는 쪽에 반영된다` · `실제 spawn 인자에도 두 플래그가 실린다`
(마지막 것은 가짜 프로세스를 띄워 `spawn()` 에 실제로 넘어간 argv 를 본다).

### 2.4 설정 화면 문면 — 코드에 박힌 그대로

> ☑ **AI 를 부를 때 내 Codex 개인 설정을 빼고 부르기**
> 켜 두면(권장) 컴퓨터에 저장된 Codex 개인 설정 파일을 이번 호출에만 읽지
> 않습니다. 매번 딸려 들어가던 설명이 빠져서 요청이 가벼워지고 답이 빨라집니다.
> 로그인은 그대로 유지되니 다시 로그인할 필요는 없습니다. 끄면 그 설정이 다시
> 함께 전달됩니다.
>
> ☑ **글 쓸 때 AI 가 컴퓨터 명령을 실행하지 않게 하기**
> 켜 두면(권장) AI 가 글만 씁니다. 끄면 AI 가 글을 쓰다 말고 컴퓨터 명령을
> 실행할 수 있어 답이 느려지고 요청도 커집니다. 글쓰기에는 필요 없는 기능입니다.

컴퓨터 용어(`config.toml`·`shell_tool`·플래그·토큰)를 한 개도 안 썼다.
「무엇이 달라지는가」만 적었다. 스타일은 기존 `.settings-field-label`(작은 muted
캡션)을 재사용했다 — `global.css` 는 이 발주의 허용 파일이 아니라 새 CSS 규칙을
만들지 않았다.

---

## 3. C1 · C2 테스트 결과

전부 **PASS**. 입력 출처를 파일 안에 `[실물]` / `[합성]` 으로 표기했다.

| 기준 | 테스트 | 결과 |
|---|---|---|
| **C1** `extractLastCodexMessage` 가 F9 실물을 읽는다 | `[실물] item.completed / agent_message 의 text 를 꺼낸다 (F9)` | PASS |
| C1 | `[실물] 한 턴 전문에서 본문만 꺼낸다 — raw JSONL 이 아니다` | PASS |
| C1 | `[실물] agent_message 가 옛 필드명 경로보다 우선한다` | PASS |
| C1 | `[실물] reasoning 의 text 는 본문으로 집지 않는다` | PASS |
| C1 | `[합성] 구 필드명 item_type 도 그대로 받는다` | PASS |
| **C1** `extractCodexFailureReason` 가 `item.type === "error"` 를 읽는다 | `[실물] item.type === error 의 message 를 꺼낸다 (F11)` | PASS |
| C1 | `[실물] item 오류만 있고 최상위 오류가 없으면 「사유 미상」이 아니다` | PASS |
| C1 | `[합성] 최상위 오류가 item 오류보다 «먼저» 채택된다` (순서 보장) | PASS |
| C1 | `[합성] item 오류의 text 필드도 받는다` | PASS |
| **C2** 재현 조건이 진짜 글자 가운데인가 | `재현 조건 확인 — '안' 의 첫 바이트 뒤에서 자르면 문자 가운데다` (바이트 값으로 검증) | PASS |
| **C2** | `[실물] 한 글자가 두 청크에 걸쳐도 토큰이 안 깨진다` | PASS |
| **C2** | `[실물] 1바이트씩 쪼개도 안 깨진다` (110개 청크) | PASS |
| **C2** | `[실물] 개행 없이 끝나는 마지막 조각도 안 깨진다` | PASS |
| F10 | `파일이 비어 있으면 stdout 에서 «본문» 을 꺼낸다 (raw JSONL 아님)` | PASS |
| F10 | `파일이 아예 없어(ENOENT) 읽기가 실패해도 마찬가지다` | PASS |
| F10 | `파일에 본문이 있으면 그 값이 그대로 쓰인다 (기존 보장)` | PASS |

**실제 codex 는 부르지 않았다.** C2·F10 은 `electronBridge` 를 mock 해
진짜 Node `PassThrough` 와 진짜 `StringDecoder` 로 만든 가짜 자식 프로세스를
주입하고, 제품 코드의 실제 경로(스트림 해독 → 줄 분리 → 토큰 조립 → last-message
읽기 → 파서 → `fullText` 결정)를 **그대로** 태운다. 상수 반환 stub 은 없다.

---

## 4. C5 — 수정 전 구현에서 몇 개가 빨강이었나

### 4.1 먼저: 「완전 원본」으로는 셀 수가 없다 (그리고 그것도 정보다)

두 소스를 **손대지 않은 원본** 으로 되돌리고 새 테스트를 그대로 돌리면
**컴파일 자체가 안 된다.**

```
Test Suites: 1 failed, 1 total
Tests:       0 total
  TS2554: Expected 2 arguments, but got 3.                       (buildCodexArgs 3번째 인자)
  TS2339: Property 'codexIgnoreUserConfig' does not exist on type 'AppSettings'.
  TS2339: Property 'codexDisableShellTool' does not exist on type 'AppSettings'.
  TS2353: 'codexDisableShellTool' does not exist in type 'AppSettings'.
```

「45개 전부 빨강」이라고 적을 수는 있지만 그건 **아무것도 안 잡는 것과 구별이
안 되는 숫자**다. 그래서 «컴파일되는 최소 되돌림» 둘로 쪼개 쟀다.

### 4.2 스테이지 A — 파서 3종만 원본 본문 (과제 A 측정)

새 `buildCodexArgs`/설정은 그대로 두고, `readLines`·`extractLastCodexMessage`·
`extractCodexFailureReason` 만 원본 본문으로 되돌렸다.

```
Tests:       12 failed, 33 passed, 45 total
```

빨강 12건 (전부 과제 A 것):

```
✕ [실물] item.completed / agent_message 의 text 를 꺼낸다 (F9)      → Received: null
✕ [실물] 한 턴 전문에서 본문만 꺼낸다 — raw JSONL 이 아니다          → Received: null
✕ [합성] 구 필드명 item_type 도 그대로 받는다
✕ [실물] agent_message 가 옛 필드명 경로보다 우선한다
✕ [실물] item.type === error 의 message 를 꺼낸다 (F11)
✕ [합성] item 오류의 text 필드도 받는다
✕ [실물] item 오류만 있고 최상위 오류가 없으면 「사유 미상」이 아니다
✕ [실물] 한 글자가 두 청크에 걸쳐도 토큰이 안 깨진다                → "���녕하세요…"
✕ [실물] 1바이트씩 쪼개도 안 깨진다
✕ [실물] 개행 없이 끝나는 마지막 조각도 안 깨진다
✕ 파일이 비어 있으면 stdout 에서 «본문» 을 꺼낸다 (raw JSONL 아님)   → raw JSONL 7줄
✕ 파일이 아예 없어(ENOENT) 읽기가 실패해도 마찬가지다                → raw JSONL 7줄
```

### 4.3 스테이지 B — `buildCodexArgs` 만 원본 동작 (과제 B 측정)

새 파서는 그대로 두고 인자 조립만 원본으로(플래그 미출력 + 모델 `gpt-5.5`).

```
Tests:       9 failed, 36 passed, 45 total

✕ 사용자가 -m 을 안 주면 기본 모델 gpt-5.6-terra 가 추가된다
✕ 기본 모델 slug 오타 방지 — 변종 없는 이름은 쓰지 않는다
✕ 기본으로 --ignore-user-config 가 붙는다
✕ 기본으로 --disable shell_tool 이 인접한 쌍으로 붙는다
✕ 두 플래그는 prompt 표시자(-) 앞에 온다
✕ 개인 설정 스위치만 끄면 그것만 빠진다
✕ 셸 도구 스위치만 끄면 그것만 빠진다
✕ 아무것도 저장된 적 없으면 두 플래그가 붙는다
✕ 실제 spawn 인자에도 두 플래그가 실린다
```

### 4.4 합산 — **신규 28건 중 21건이 수정 전 빨강**

| | 수 |
|---|---|
| 신규 테스트 | 28 (17 → 45) |
| 수정 전 빨강 (A 12 + B 9) | **21** |
| 양쪽 다 초록인 신규 7건 | 회귀 가드다 — 「고쳐도 안 깨진다」를 증명하는 쪽 |

양쪽 다 초록인 7건: `reasoning 을 본문으로 안 집는다` · `최상위 오류가 item 오류보다
먼저` · `파일에 본문이 있으면 그대로` · `되돌림 둘 다 끄면 안 나온다` ·
`재현 조건 확인(바이트 값)` · `기본값은 붙은 상태` · `저장된 false 를 load` /
`save 반영`(스테이지 B 에서는 새 appSettings 를 쓰므로 통과 — 완전 원본에서는
§4.1 처럼 컴파일 자체가 안 된다).

**기존 17건은 전부 그대로 유지**했고 전부 통과한다. 옛 필드명 경로가 안 지워졌다는
증거다.

### 4.5 원상복구 확인

세 스테이지 실험 뒤 수정본을 되돌려 놓았고 `45 passed / 45 total` 로 확인했다.
`git status` 에 실험 잔여물 없음.

---

## 5. C4 — 회귀

| 항목 | 전 (기준선 F13) | 후 |
|---|---|---|
| `@ai-manuscript-studio/obsidian-plugin` | **29 suites / 324 tests** | **29 suites / 352 tests** (+28) |
| 그중 `tests/adapters/aiBridge.test.ts` | 17 | 45 |
| `@ai-manuscript-studio/core` | 26 passed + 3 skipped / 311 passed + 18 skipped | **동일** (안 건드림) |
| `pnpm typecheck` | exit 0 | **exit 0** |

- 실패 0건. 줄어든 것 0건.
- core 의 skip 3 suites / 18 tests 는 소스에 박힌 `describe.skip` 과
  `AMS_TEST_VAULT_PATH` 조건부 skip 이다. 기준선과 같다.
- `main.js` · `styles.css` · `global.css` 비접촉. `apps/desktop/` 비접촉.
- `.env` · 키 · 토큰 비접촉. 사용자 `~/.codex/config.toml` 비접촉.
- **git commit · push 안 했다.**
- `git status` 상 이번 발주의 변경은 허용 파일 넷 + 이 보고서뿐이다.

---

## 6. `skipped[]` — 온전히 못 했거나 넘긴 것

1. **실제 codex 를 한 번도 실행하지 않았다** (금지 항목). F1·F8 의 토큰·시간
   실측은 발주자 것을 그대로 인용했고 내가 다시 재지 않았다. 확인 절차:
   옵시디언에서 원고 생성 1회 → devtools 콘솔의 `[aiBridge] … 판정:` 로그.
2. **exit 0 인데 last-message 가 비는 장면을 실제 codex 로 관측하지 못했다.**
   §1.3 (b)(c) 의 «빈도» 는 미지수다. 증명한 것은 「그 입구에 들어서면 반드시
   raw JSONL」과 「이제는 아니다」 둘.
3. **`--ephemeral` 과 `--output-last-message` 의 상호작용을 확인하지 못했다.**
   `--help` 는 둘을 독립 옵션으로 적지만, `--ephemeral`(세션 파일 미영속)이
   last-message 기록에 영향을 주는지는 원문에 안 나온다. **추측이므로 단정하지
   않는다.** 확인 방법: 두 옵션을 함께 준 뒤 파일 존재 확인 1회.
4. **`gpt-5.6-terra` 로 실제 호출을 해 보지 않았다.** 상수 문자열만 테스트로
   고정했다. slug 유효성은 발주자 F8(exit 0 · 24,967토큰) 을 근거로 쓴다.
5. **옵시디언 renderer 에서 `window.require("node:string_decoder")` 가 되는지
   실환경 확인은 못 했다.** 안 되면 `TextDecoder` 로, 그것도 없으면 종전 방식으로
   자동 강등되므로 «더 나빠지지는» 않는다. 확인 절차: devtools 콘솔에
   `require("node:string_decoder")` 입력.
6. **설정 저장은 300ms debounce 라 스위치를 토글한 «직후 0.3초 안에» 생성 버튼을
   누르면 직전 값으로 나간다.** debounce 는 `settingsStore.update()` 에 있고 그
   파일은 이 발주의 허용 파일이 아니다. 실사용에서 문제 되는 창은 아니라고 본다.
7. **사용자가 「추가 인자」에 `--ignore-user-config` 나 `--disable shell_tool` 을
   직접 넣으면 중복 출력된다.** 중복 제거 가드를 넣지 않았다 — `--help` 가
   `--disable` 을 *repeatable* 이라 명시하므로 무해할 것으로 «판단» 하지만
   실측하지 않았고, 실측 없는 가드를 넣는 것이 더 나쁘다고 봤다.
8. **`SettingsPanel` 에 대한 단위 테스트는 안 만들었다.** 이 레포에 그 파일의
   테스트가 원래 없고(`jest.config.cjs` 에 `@tauri-apps/*` 매핑이 없어
   `src/studio/**` 를 테스트에서 import 할 수 없다 — 선행 발주 보고 4항), 매핑
   추가는 허용 파일 밖이다. 대신 설정→인자 연결을 **어댑터 층에서** 끝까지 태워
   증명했다.
9. **`.settings-field-note` CSS 규칙을 만들지 않았다.** `global.css` 가 허용 파일
   밖이라 기존 `.settings-field-label` 을 함께 걸어 두었다. 지금도 작은 muted
   글씨로 읽히지만, 전용 여백·줄간격은 후속에서 붙일 자리를 남겨 뒀다.

---

## 7. 고치지 않고 보고만 한 것

1. **[중] `{"type":"error","message":"…"}` 가 «본문» 으로 채택될 수 있다.**
   `extractLastCodexMessage` 의 2차 통과는 최상위 `message` 를 무조건 받는데,
   codex 0.151 에서 최상위 `message` 가 나오는 이벤트는 사실상 오류뿐이다.
   즉 exit 0 이면서 `agent_message` 가 하나도 없으면 **오류 문구가 원고 본문으로
   박힐 수 있다.** 고치려면 2차 통과에서 `type === "error"|"turn.failed"` 를
   건너뛰어야 하는데, 그것은 지시서 금지 표의 **「옛 필드명 지원 경로 삭제 —
   더하되 빼지 마라」** 와 부딪친다. 그래서 **순서만 바꾸고(실물 우선) 삭제는
   하지 않았다.** 1차 통과가 생겼으므로 남는 구멍은 「agent_message 가 아예
   없는 exit 0」 하나로 좁아졌다. 판단을 요청드린다.
2. **[중] 대체의 마지막 칸이 여전히 `?? stdoutAcc` (= raw JSONL) 다.**
   `전:769·771·774` / `후:939·941·944`. 파서를 고쳐 «현실적인» 도달 경로는
   닫혔지만, 「last-message 도 비고 stdout 에 `agent_message` 도 없는」 극단에서는
   아직 JSON 덩어리가 나온다. `?? ""` 로 바꾸면 그 자리가 조용해지는 대신 진단
   정보가 사라진다 — 요청 밖 판단이라 손대지 않았다.
3. **[하] `STDERR_TAIL_BYTES` 는 «바이트» 이름인데 `stderrTail.length`(UTF-16
   코드 단위)로 잰다.** 한글 stderr 에서 실제 보관량이 이름보다 작아진다.
   `전:655-661` / `후:821-827`. 이번 발주의 범위 밖.
4. **[하] `tauriAIBridge.ts` 의 오분류가 남아 있다** (선행 발주도 같은 보고).
   `kind:"spawn"` 이 기본값이라 「종료 미확인」도 spawn 으로 분류된다.
   그 파일은 이 발주의 수정 금지 대상.
5. **[하] `apps/desktop/src/ai/…` 의 쌍둥이 구현과 `packages/core/src/ai/CodexCLIAdapter.ts`
   에는 이번 수정이 반영되지 않았다.** 둘 다 수정 금지 대상. 데스크톱 앱을 살리거나
   core 어댑터를 쓰는 경로에서는 F9·F11·F12 가 그대로 남는다.
6. **[하] 요청 밖 리팩토링·주석 정리는 하지 않았다.** `electronRequire("process")`
   반복 호출, `readLines` 의 `decoder` 매 호출 생성 등은 그대로 뒀다.

---

## 8. 도메인 되먹임 — 정본·규칙에서 발견한 결함

1. **「수정 전 원본 백업 필수」(C4) 와 「허용 파일 다섯」이 또 부딪쳤다.**
   선행 발주가 이미 같은 보고를 했는데 이번 지시서에도 그대로 남아 있다.
   다음 지시서에 **「백업은 레포 밖(세션 scratchpad)에 두거나 `git show HEAD:` 로
   갈음한다」** 한 줄을 박으면 두 번 다시 안 부딪친다.
2. **C5(「수정 전 구현에 돌려라」)가 «타입이 바뀌는 변경»에서는 문자 그대로
   수행 불가능하다.** 새 설정 키·새 인자를 요구하는 테스트는 원본에서 컴파일이
   안 되므로 「전부 빨강 / 0건 실행」이 나오고, 그 숫자는 아무것도 증명하지
   못한다. 이번엔 «컴파일되는 최소 되돌림» 스테이지 둘로 쪼개 풀었다.
   다음 지시서에 **「타입이 바뀌면 기능별 최소 되돌림으로 나눠 재고, 컴파일
   실패도 그 자체로 보고한다」** 를 넣기를 권한다.
3. **`AGENTS.md` 의 명령 목록에 아직 `pnpm typecheck` 가 없다.** 선행 발주가
   같은 지적을 했고 아직 반영이 안 됐다. C4 가 매번 요구하는 명령인데 정본에
   없어 실행자가 매번 찾아야 한다.
4. **레포 `CLAUDE.md` §2 는 `styles.css` 의 두 source 를 말하지만 «설정 화면에
   새 UI 를 붙일 때 CSS 를 어디에 쓰나» 는 안 말한다.** 이번처럼 `*.tsx` 만
   허용된 발주에서는 새 클래스를 만들 수 없어 기존 클래스를 빌려 써야 한다.
   그런 발주에는 `global.css` 를 허용 파일에 함께 넣거나, 「새 CSS 클래스 금지」를
   명시하는 편이 낫다.
5. **`docs/` 에 마크다운을 쓰면 훅이 `docs/_html/` 을 자동 생성한다.** 선행 발주
   보고 그대로다. 이 보고서를 쓰면 또 생긴다 — 허용 파일 목록에 없는 산출물이
   자동으로 늘어나는 구조라, 지시서에 「`docs/_html/` 자동 생성물은 허용 파일
   셈에서 제외」를 한 줄 적어 두는 편이 낫다.
