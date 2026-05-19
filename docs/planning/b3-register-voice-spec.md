*Version: v1.0 (2026-05-19)*

# B3 Register-Voice Registry — 설계 스펙

> **상태**: B3.1 설계 완료. B3.2(구현)·B3.3(와이어링) 미착수.
> **근거**: Planning Review 2026-05-19 설계 검토(`.cmux-harness/logs/Planning Review-20260519-211133.log` lines 764-993).

---

## 1. 파일 위치

### 결정

```
<resolved voice 폴더>/.register-guides/<register>.json
```

`resolved voice 폴더`는 `voiceIO.path()`(→ `voice_path` Rust invoke) 반환값. 기본 `_attachments/voice/`, 사용자 custom 가능.

**접근 방식**: `guidePath()` 패턴(`styleGuide.ts:108-142`)과 동일하게 `voiceIO.path()` + 절대경로 합성 + `vault_read_file` / `vault_write_file` / `vault_delete_file` invoke 재사용.

> **주의**: `voice_write_file({name})` 는 flat 파일명 전용 — 서브폴더 경로 불가. 쓰지 말 것.

### 왜 dot-폴더인가

Rust `voice_list_files`는 숨김 파일(`.`으로 시작) + `.md` 전용 필터를 적용한다. `.register-guides/` dot-폴더 안의 JSON은 이 필터에서 자동 제외 → register guide JSON이 voice corpus 샘플로 오인 수집되지 않는다(코퍼스 오염 차단).

---

## 2. Register 정규셋 (B3 MVP)

| 키 | 대응 채널 |
|---|---|
| `email` | 이메일 |
| `kakao` | 카카오 (KakaoTalk) |
| `telegram` | 텔레그램 |
| `report` | 보고서 |
| `summary` | 요약 |
| `memo` | 메모 |

**채택 금지**: `kakao-short`, `telegram-brief`, `report-polish` 등 action-id형 명칭. 이는 `ACTION_TABLE`(`quickCompose.ts:15-23`)의 comms action id이지 register가 아님. register / action-id / guide-key 3중 명명 드리프트 방지를 위해 기존 6 Register 유니온 그대로 사용.

`email`의 `EmailSubType`(`draft | polish`)은 액션 관심사 — voice는 sub-type 무관. guide 키는 `email` 단일.

---

## 3. 스키마 v1

### JSON 예시

```json
{
  "version": 1,
  "register": "email",
  "addedInstructions": "수신자 직위를 고려한 정중한 도입 1문장. 결론을 본문 앞단에 배치. 군더더기 인사말 최소화.",
  "overrides": {
    "readerDistance": "공적·정중, 그러나 형식적이지 않게",
    "sentenceBreath": "이메일에서는 평소보다 1~2문장 더 짧게"
  },
  "note": "대표님 승인 2026-05-19",
  "updatedAt": "2026-05-19T10:00:00+09:00"
}
```

### 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `version` | `number` | 필수 | 현재 `1`. `STYLE_GUIDE_VERSION` 패턴(`styleGuide.ts:20, 119`) 동일. 미스매치 → fallback. |
| `register` | `string` (6-enum) | 필수 | 위 정규셋 중 하나. 불일치 → reject. |
| `addedInstructions` | `string` | 권장 | **주 필드**. base `compressedPrompt` 뒤에 `## 형식별 보정(<register>)` 섹션으로 append. |
| `overrides` | `Record<string, string>` | 선택 | 화이트리스트 스칼라 힌트만. 아래 제약 참조. |
| `note` | `string` | 선택 | 사람 읽기용 메모. 처리에 미사용. |
| `updatedAt` | `string` (ISO 8601) | 권장 | 최종 수정 시각. 처리에 미사용. |

### `overrides` 제약

**화이트리스트 키** (스칼라 `string → string` 만):

```
sentenceBreath | readerDistance | emotionAndAttitude | tone | sentenceLength | endings
```

**절대 금지 키**:
- `styleDna` — 객체 타입, voice 정체성 핵심. 오버라이드 시 analyzeStyle/compressedPrompt 재유도 필요 → 위험·고복잡.
- `compressedPrompt` — base 자체를 치환하면 가산형 delta 모델 붕괴.

비화이트리스트 키: 해당 키만 warn + 무시(하드페일 X). `loadStyleGuide()` 관용 파싱 미러.

---

## 4. 머지 출력 형식

```
<base compressedPrompt>

## 형식별 보정(<register>)
<addedInstructions>

[overrides 각 항목 → "원래 <축> → 이 형식에선 <값>" 라인]
```

- **base `compressedPrompt`는 불변** — voice 정체성. register delta는 증강만, 무음 치환 금지.
- `buildQuickComposePrompt` 시그니처 변경 불필요 (`styleGuide?: string` 그대로, `quickCompose.ts:84-88`).

---

## 5. Fallback 동작

| 조건 | 동작 |
|---|---|
| `.register-guides/<register>.json` 부재 | base `.style-guide.json` `compressedPrompt` 단독 사용 |
| JSON 파싱 실패 | 위와 동일 (에러 던지지 말 것) |
| `version` 미스매치 (현재 버전 초과 포함) | missing 취급 → fallback |
| `register` 6-enum 불일치 | reject → fallback |
| base `.style-guide.json`도 없음 | styleGuide 미주입 — `QuickComposeModal` 수동 붙여넣기 textarea 유지 (`line 127-131`). B0/B1 수동 동작 그대로. |

에러 처리 정책: `loadStyleGuide()` swallow → null 패턴(`styleGuide.ts:114-125`) 미러.

---

## 6. 안전 / 프라이버시

`docs/planning/corpus-governance.md` §2 상속 + 명문화:

1. **원문 코퍼스 텍스트 절대 미포함** — register JSON에는 파생 지침 문자열만 허용. 법률·펀드 민감 내용 2차 디스크 사본 방지.
2. **자동 코퍼스 포함 금지** — register guide는 명시적 저장/분석 명령에서만 생성·갱신. 자동 스캔 금지(governance §2).
3. **compose 시점 read-only** — 쓰기는 명시적 저장 명령에서만.
4. **`.register-guides/` dot-폴더** — `voice_list_files` 비수집 보장(샘플 오인 차단, §1 참조).
5. **VAULT_INDEX 접근 금지** — register guide 로드·머지 경로에서 VAULT_INDEX 조회 X.

---

## 7. B3.2 구현 노트

### 신규 파일

- `packages/obsidian-plugin/src/studio/voice/registerGuide.ts` — `loadRegisterGuide(register)`, `mergeWithBase(base, delta)` 구현
- `packages/obsidian-plugin/src/studio/voice/styleGuide.ts` — delta merge 헬퍼 추가

### 선결 검증 항목 (Obsidian shim 리스크)

> 기존 코드는 hidden flat 파일만 write. `.register-guides/` 서브폴더 생성 전례 없음.

**B3.2 시작 전 필수**: `vault_write_file` (또는 Obsidian shim 상당 경로)가 `.register-guides/` 부모 디렉토리를 자동 생성하는지 확인. 자동 생성 안 되면 `vault_mkdir`(또는 `app.vault.adapter.mkdir`) ensure-dir 호출 추가.

### `loadRegisterGuide` 시그니처 (참고)

```typescript
// packages/obsidian-plugin/src/studio/voice/registerGuide.ts
async function loadRegisterGuide(
  register: Register,
  voiceDir: string
): Promise<RegisterGuideDelta | null>
```

반환 타입:
```typescript
interface RegisterGuideDelta {
  version: number;
  register: Register;
  addedInstructions?: string;
  overrides?: Partial<Record<AllowedOverrideKey, string>>;
  note?: string;
  updatedAt?: string;
}

type AllowedOverrideKey =
  | "sentenceBreath"
  | "readerDistance"
  | "emotionAndAttitude"
  | "tone"
  | "sentenceLength"
  | "endings";
```

---

## 8. B3.3 와이어링 노트

- **와이어링 지점**: `QuickComposeModal`(`packages/obsidian-plugin/src/QuickComposeModal.ts`)
  - styleGuide textarea 수동입력: line 127-131
  - register 변경 이벤트: line 62-68
- **B3.3 흐름**: `loadStyleGuide()` + `loadRegisterGuide(registerValue)` 자동 로드 → 머지 → `styleGuide` 파라미터로 전달. `buildQuickComposePrompt` 시그니처 변경 불필요.
- **register 변경 시**: line 62-68 이벤트 핸들러에 재머지 훅 추가.

---

## 9. B3.2 구현자 Acceptance Checklist

- [ ] `voiceIO.path()` → `vault_read_file(<voiceDir>/.register-guides/<register>.json)` 경로로 register guide 로드
- [ ] JSON 파싱 실패 / version 미스매치 / 6-enum 불일치 → null 반환(에러 throw X)
- [ ] `loadRegisterGuide` null → base `compressedPrompt` 단독 사용 fallback 동작 확인
- [ ] 머지 출력: `base + "\n\n## 형식별 보정("+register+")\n" + addedInstructions + overrides 라인`
- [ ] `styleDna`, `compressedPrompt` 오버라이드 시도 → warn + 무시(하드페일 X)
- [ ] **Obsidian shim 서브폴더 write/ensure-dir 동작 검증** (선결 리스크)
- [ ] 유닛 테스트 (InMemory): email register → delta 적용된 guide 반환 확인
- [ ] 유닛 테스트: register guide 없음 → base guide 단독 반환 확인
- [ ] `pnpm test` pass
- [ ] register JSON에 원문 코퍼스 텍스트 없음 확인
