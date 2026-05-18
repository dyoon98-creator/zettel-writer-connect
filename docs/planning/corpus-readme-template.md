*Version: v1.0 (2026-05-18)*

# Corpus README Template

> 이 파일의 내용을 vault에 복사하는 것은 대표님 승인 후에만 진행.

## 옵션 비교

| 항목 | 옵션 A: `_voice-samples/` | 옵션 B: `4.Writing/_voice/` |
|---|---|---|
| 4.Writing 자가오염 위험 | 없음 | 있음 — source_notes 재귀 포함 가능 |
| Obsidian 그래프 노출 | `_` prefix로 최소화 | 4.Writing 하위로 노출 |
| 플러그인 sourceNotes 자동 포함 | 없음 | 잠재적 위험 |
| 경로 명확성 | `_voice-samples/` 목적 자명 | `_voice` 폴더명 모호 |

**권장: 옵션 A — `_voice-samples/`**. 4.Writing 소스노트 오염 방지가 핵심 이유.

---

## vault에 복사할 README 초안

> 아래 내용을 `_voice-samples/README.md` 로 복사 (대표님 승인 후).

```markdown
# 내 문체 샘플 폴더

AI 원고실 '내 문체' 기능의 학습 코퍼스.
대표님이 직접 쓴 .md 파일만 이 폴더에 보관합니다.

## 규칙
- .md 파일만 허용
- 포함 여부는 대표님이 결정. 어떤 자료든 대표님이 승인하면 포함 가능.
- 대표님 승인 없이 자동으로 수집되는 파일 없음.
- 파일 추가/삭제 후 반드시 VoicePane → "재분석" 실행

## 파일 네이밍
YYYY-MM-DD-<주제>.md
예: 2026-05-01-투자위원회메모.md

## 주의
이 폴더의 내용은 AI 문체 분석에만 사용됩니다.
외부 전송·공유되지 않습니다.
```

---

## vault에 복사할 template 초안

> 아래 내용을 `_voice-samples/template.md` 로 복사 (대표님 승인 후).

```markdown
---
date: YYYY-MM-DD
topic: <주제>
register: email | kakao | report | memo | essay
---

(여기에 대표님이 직접 쓴 글을 붙여넣기)
```
