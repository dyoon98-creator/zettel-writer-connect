*Version: v1.0 (2026-05-18)*

# B1 커뮤니케이션 스킬팩 사용 가이드

> 대표님용 참조 문서. vault 설치는 별도 승인 단계.

## 구축된 것

`_skillpacks/comms-studio/` — 7가지 액션:

| 액션 ID | 레이블 | 용도 | 저장 위치 |
|---|---|---|---|
| `comms.email-draft` | 이메일 초안 쓰기 | 의도→이메일 초안 생성 | draft |
| `comms.email-polish` | 이메일 다듬기 | 기존 이메일 문체 교정 | revising |
| `comms.kakao-short` | 카카오톡 메시지 쓰기 | 3~5줄 카카오 메시지 | draft |
| `comms.telegram-brief` | 텔레그램 메시지 쓰기 | 텔레그램 간결 메시지 | draft |
| `comms.report-polish` | 보고서 다듬기 | 보고서 초안 문체 교정 (팩트 수정 X) | revising |
| `comms.summary-briefing` | 요약 보고자료 만들기 | 원문→현황/핵심/시사점 보고자료 | draft |
| `comms.memo-capture` | 메모 정리하기 | 거친 메모→명료한 메모 (길이 보존) | draft |

**현재 제약**: 외부 발송(이메일 전송, 카카오 발송) 기능 없음. 초안 텍스트 생성·복사만 가능.

---

## 현재 한계: 수동 문체 주입

현재 렌더러는 `voice_guide` 자동 주입을 지원하지 않습니다. B3(register-specific voice guides) 이후 자동화 예정.

**지금 사용하는 방법**: VoicePane에서 압축 프롬프트를 복사해 `user_input`에 직접 붙여넣기.

---

## 기본 워크플로우

1. AI 원고실 → 내 문체(VoicePane) 열기
2. "압축 프롬프트 복사" 클릭 (§14 압축 문체 지침 1,500자 이내)
3. 원하는 스킬팩 액션 실행 (`user_input` 입력창 표시됨)
4. `user_input`에 아래 형식으로 입력:
   ```
   [작성 의도/맥락]
   (빈 줄)
   [복사한 압축 프롬프트 붙여넣기]
   ```
5. 결과는 draft/revising으로 저장됨. 외부 발송 없음.

---

## 액션별 사용 예시

### 이메일 초안 쓰기 (`comms.email-draft`)

`user_input` 예시:
```
A 투자사 김 대표에게 다음 주 미팅 일정 조율 이메일.
화요일 오전 10시 또는 수요일 오후 2시 제안.

[압축 프롬프트 붙여넣기]
```
- `reader` 필드: "A투자사 김대표 (50대, 격식체 선호)"
- `core_message` 필드: "미팅 일정 확정 요청"

---

### 이메일 다듬기 (`comms.email-polish`)

- `manuscript` 필드: 다듬을 이메일 원문 붙여넣기
- `user_input` 예시:
  ```
  격식체 유지하되 너무 딱딱하지 않게. 마지막 문단 더 간결하게.

  [압축 프롬프트 붙여넣기]
  ```

---

### 카카오톡 메시지 쓰기 (`comms.kakao-short`)

`user_input` 예시:
```
B 파트너에게 내일 오후 회의 30분 늦어진다고 전달. 사과 포함.

[압축 프롬프트 붙여넣기]
```
결과: 3~5줄 이내 카카오톡 메시지

---

### 텔레그램 메시지 쓰기 (`comms.telegram-brief`)

`user_input` 예시:
```
팀 단톡방에 이번 주 금요일 오후 3시 전사 미팅 공지.
참석 필수, 장소는 본사 3층 대회의실.

[압축 프롬프트 붙여넣기]
```
- `source_notes` 필드: 회의 아젠다 메모 붙여넣기 (선택)

---

### 보고서 다듬기 (`comms.report-polish`)

- `manuscript`: 보고서 초안
- `user_input` 예시:
  ```
  이사회 보고용. 전문 용어 줄이고 핵심 수치 강조.

  [압축 프롬프트 붙여넣기]
  ```
- `reader`: "이사회 (비전문가 포함)"
- `core_message`: 핵심 결론
- 주의: **원문 사실·수치 변경 금지** 지시가 프롬프트에 포함됨

---

### 요약 보고자료 만들기 (`comms.summary-briefing`)

- `manuscript`: 원문 자료 (보고서, 기사, 미팅 노트 등)
- `user_input` 예시:
  ```
  C 펀드 LP에게 분기 업데이트 보고 목적. A4 1장 이내.

  [압축 프롬프트 붙여넣기]
  ```
- `reader`: "LP (재무 배경, 요약 선호)"
- 결과: 현황 / 핵심 / 시사점 3단 구조로 생성됨

---

### 메모 정리하기 (`comms.memo-capture`)

- `manuscript`: 거친 메모 (구어체, 단편적 아이디어 OK)
- `user_input` 예시:
  ```
  이사회 안건 정리용. 구어체만 다듬고 내용·길이는 최대한 유지.

  [압축 프롬프트 붙여넣기]
  ```
- 주의: **길이 대폭 축소 금지** 지시가 프롬프트에 포함됨

---

## 코퍼스 포함 원칙

코퍼스(voice 폴더)에 어떤 자료를 포함할지는 대표님이 결정합니다.
회사 기밀·법률 의견·펀드 자료도 대표님이 승인하면 포함 가능.
Hermes/워커는 임의로 포함·제외 결정하지 않습니다.
자세한 규칙: `docs/planning/corpus-governance.md` 참조.

---

## vault 설치 단계

현재 `_skillpacks/comms-studio/`는 프로젝트 레포에만 존재합니다.
vault(지식창고)에 복사하는 것은 별도 승인 단계입니다.

설치 승인 후 실행:
```bash
# vault의 _skillpacks/ 폴더에 comms-studio 폴더 복사 (경로는 대표님 확인 후)
cp -r _skillpacks/comms-studio \
  "/Users/dongchanyoon/Library/CloudStorage/OneDrive-개인/지식창고/_skillpacks/"
```
