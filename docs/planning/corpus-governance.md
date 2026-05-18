*Version: v1.0 (2026-05-18)*

# Voice Corpus Governance

> 참조 문서 (consult, not read-through). 다음 세션 실행자가 즉시 적용 가능한 형태로 박제.

## 1. 허용 규칙 (Allow-list)

| 항목 | 규칙 |
|---|---|
| **대상 폴더** | 대표님이 지정한 단일 폴더만 (`_voice-samples/` 권장 — corpus-convention.md 참조) |
| **포함 방식** | 대표님이 파일을 수동으로 폴더에 복사해야 포함됨. 자동 수집 없음 |
| **파일 형식** | `.md` 파일만 |
| **갱신** | 파일 변경 후 VoicePane → "재분석" 버튼 수동 트리거 필수 |

## 2. 자동 수집 금지 및 대표님 승인 원칙

| 항목 | 규칙 |
|---|---|
| **전체 볼트 자동 학습** | 절대 X. 2.Permanent/**, 3.Structure/**, 4.Writing/** 자동 수집 금지 |
| **코퍼스 포함 결정권** | 어떤 파일을 코퍼스에 넣을지는 대표님이 결정. 법률 의견·펀드·회사 자료도 대표님이 승인하면 포함 가능. Hermes·워커가 임의로 포함·제외 결정 금지 |
| **외부 발송** | MVP(B0/B1/B2) 전 구간에서 이메일·카카오·텔레그램 직접 발송 기능 없음 |
| **VAULT_INDEX 접근** | voice 분석 코드에서 VAULT_INDEX 읽기 금지 |

## 3. 코퍼스 갱신 절차

1. 대표님이 승인된 .md 파일을 voice 폴더에 수동 복사
2. VoicePane 열기 → 파일 목록 확인
3. "재분석" 클릭 → StyleGuide 갱신 확인
4. §14 "압축 프롬프트" 내용 변경 여부 확인

## 4. MVP 문체 주입 방식 (B0/B1)

`voice_guide` 플레이스홀더는 현재 렌더러에서 미지원. B0/B1에서는 **수동 주입**:
1. VoicePane → "압축 프롬프트 복사" 클릭
2. skillpack 액션 실행 시 `user_input` 필드에 의도 + 복사한 문체 가이드 함께 입력

자동 voice_guide 주입은 B3(register-specific voice guides) core 패치 후 지원.
