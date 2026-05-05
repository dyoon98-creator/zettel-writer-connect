# Zettel Connect

옵시디언 제텔카스텐 볼트를 위한 하이브리드(구조 + 의미) 연결 추천 플러그인.
Claude Code CLI의 `/permanent` 스킬과 통합돼 **선택한 후보로 창의적 영구노트를 자동 생성**합니다.

## 기능 요약

| 영역 | 구현 |
|------|------|
| **구조 점수** | 4-Way (1-hop / 2-hop / cluster / tag / cousin), 노이즈 필터 |
| **의미 점수** | Ollama 임베딩 + 코사인 유사도 (OFF 가능) |
| **하이브리드** | `α · structural + (1-α) · semantic`, α 슬라이더 조절 |
| **자동 트리거** | 지정 폴더 파일 열면 debounce 후 자동 계산 |
| **후보 선택** | 체크박스 멀티 선택, 전체 선택 토글 |
| **링크 삽입** | 커서 위치에 `[[파일명]]` + frontmatter `links[]` 자동 추가 |
| **CLI 핸드오프** | `connect-candidates.json` 저장 + 클립보드 복사 + Terminal 오픈 |
| **캐시** | 임베딩 mtime 기반 증분 갱신 |

## 빌드

```bash
cd .obsidian/plugins/zettel-connect
npm install
npm run build        # production
npm run dev          # watch
```

빌드 후 옵시디언에서 `Settings → 커뮤니티 플러그인 → Zettel Connect` 토글 ON.

## 워크플로우

```
1. 영구노트 열기 (2 Permanent/*.md)
   └→ 자동 트리거(옵션) or 우측 패널 [추천 받기]
2. 상위 7개 후보 표시 (구조+의미 하이브리드)
3. 후보 체크박스 선택 (N개)
4. [🧠 영구노트 생성] 클릭
   ├→ _index/connect-candidates.json 저장
   ├→ 클립보드에 명령어 복사
   └→ Terminal 플러그인 자동 오픈 시도
5. 터미널에 Cmd+V + Enter
   └→ Claude Code CLI의 /permanent --from-candidates 실행
      └→ picked 후보들의 교차점에서 새 영구노트 생성
         └→ cascade.py가 VAULT_INDEX·GRAPH·wiki 갱신
```

## Ollama (의미 검색) 설정

```bash
# 1. Ollama 실행
ollama serve &

# 2. 임베딩 모델 pull (최초 1회)
ollama pull nomic-embed-text     # 274MB, 768-dim, 한국어 지원
# 또는
ollama pull mxbai-embed-large    # 670MB, 더 높은 품질
```

플러그인 설정에서 연결 테스트 후 사용.

Ollama 없어도 **구조 점수만으로 동작** — 플러그인이 자동 폴백.

## 알고리즘

### 구조 점수 (structural-score.ts)
```
+5  1-hop 이웃 (forward + backward)
+2  2-hop 이웃 (pivot은 unfiltered seedNeighbors)
+3  같은 클러스터  (노이즈 값 제외)
+2  × 겹치는 태그 수  (노이즈 값 제외)
+1  × 공통 이웃 수  (cap +3)
─── (exclude: 자기 + 이미 연결됨)
Top N (설정, 기본 50)
```

### 하이브리드 재정렬 (hybrid-ranker.ts)
```
if 임베딩 ON:
  seedVec = embed(seed.claim)
  for each candidate:
    cosine = cos(seedVec, embed(claim))
  combined = α · normalize(structural) + (1-α) · cosine
else:
  combined = structural
sort desc → Top K (설정, 기본 7)
```

## 설정 항목

- **Top K** (3~20) — 표시 후보 수
- **풀 크기** (20~150) — 임베딩 재정렬 전 구조 점수로 선별
- **α** (0.0~1.0) — 구조 vs 의미 가중치
- **자동 트리거** — on/off, 대상 폴더, debounce
- **임베딩 제공자** — off / ollama
- **Ollama 엔드포인트 / 모델**
- **노이즈 값** — 쉼표 구분 (기본: `미분류, unclassified`)
- **경로** — 영구노트 폴더, candidates.json 저장 위치
- **CLI 명령 템플릿** — `{path}` 치환

## 파일 구조

```
zettel-connect/
├── manifest.json
├── main.js                        # 빌드 산출물 (27KB)
├── styles.css
├── src/
│   ├── main.ts                    # 엔트리, 자동 트리거, 커맨드
│   ├── settings.ts                # 설정 스키마 + SettingTab
│   ├── types.ts
│   ├── engine/
│   │   ├── index-reader.ts        # VAULT_INDEX/GRAPH 파싱
│   │   ├── structural-score.ts    # 4-Way 구조 점수
│   │   ├── embeddings.ts          # Ollama + mtime 캐시
│   │   └── hybrid-ranker.ts       # 구조 + 의미 결합
│   ├── view/
│   │   └── ConnectionPanel.ts     # 사이드 패널 UI
│   └── actions/
│       └── save-candidates.ts     # JSON 저장 + 클립보드 + 터미널
└── tests/
    └── parity.mjs                 # 구조 알고리즘 독립 검증
```

## 제한사항

- **isDesktopOnly**: 모바일 미지원 (Obsidian Mobile은 Ollama 미지원)
- **VAULT_INDEX 의존**: `_index/VAULT_INDEX.md`, `GRAPH.md` 필요 → `/index` CLI로 갱신
- **읽기 전용**: 플러그인은 VAULT_INDEX를 건드리지 않음. 쓰기는 `cascade.py`에만 위임
- **중복 ID 경고만**: Folgezettel 충돌은 감지·경고하되 자동 수정하지 않음
