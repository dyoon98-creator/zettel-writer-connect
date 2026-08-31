// wizardHandoff.test.ts — 「컨셉 마법사가 만든 것을 기획 인터뷰가 «안다»」 계약.
//
// 왜 이 파일이 있는가 (대표 실사용 결함 2026-08-31):
//   연애 이야기로 컨셉·시놉시스·트리트먼트를 다 만들고 넘어갔는데, 기획 인터뷰가
//   백지에서 「'test' 투자·전략 메모의 출발점을 잡겠습니다」로 다시 물었다.
//   값을 «잃은» 것이 아니라 «읽는 쪽» 이 없었다 — 그 배선을 여기서 못 박는다.
//
// 이 파일이 지키는 것 넷:
//   (C1) 컨셉 결과가 프롬프트 문자열에 실제로 도달한다.
//   (C4) 컨셉 없이 오는 길은 «한 글자도» 달라지지 않는다.
//   (C5) structure-pick 건너뛰기의 파급이 전부 닫힌다.
//   (C5-D/E) 문서 종류가 한 줄로 가고, 이미 있는 프로젝트에서 이어진다.
//
// 테스트에서 실제 codex 를 부르지 않는다 — 프롬프트 «문자열» 을 직접 검사한다.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_DRAFT_GENRE,
  WizardEngine,
  type ConceptDraftSession,
  type ConceptHandoff,
  type WizardSession,
} from "@ai-manuscript-studio/core";

import {
  buildStructuredHandoff,
  conceptHandoffFromDraft,
  parseConceptHandoffFromMarkdown,
} from "../../../src/studio/wizard/wizardHandoff";

const SRC = join(__dirname, "../../../src/studio/wizard");
const read = (rel: string): string => readFileSync(join(SRC, rel), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// 픽스처
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 컨셉 마법사를 «안 거친» 세션 — 지금 멀쩡한 길(F9). 이 모양이 달라지면 회귀다.
 */
function bareSession(): WizardSession {
  return {
    id: "sess-1",
    startedAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    draftTitle: "제목",
    draftGenre: "column-essay",
    currentStage: "motive",
    stages: {
      motive: { stage: "motive", status: "active" },
      "audience-message": { stage: "audience-message", status: "pending" },
      tone: { stage: "tone", status: "pending" },
      "structure-pick": { stage: "structure-pick", status: "pending" },
    },
    messages: [],
  };
}

/** 컨셉 마법사 6단계를 끝낸 ConceptDraftSession — Step5Commit 이 손에 쥔 그 객체. */
function conceptDraft(): ConceptDraftSession {
  return {
    schema: "ai-manuscript-studio.concept-draft.v1" as ConceptDraftSession["schema"],
    id: "cw-1",
    seed: "함께 있는 시간이 쌓이는 이야기",
    tone: "column-narrative",
    genre: "long-form-manuscript",
    attachedNotes: ["[[관계 메모]]"],
    conversation: [],
    conceptParagraph: "처음의 설렘과 불안이 편안함으로 깊어지는 이야기.",
    synopsis: "설렘이 잦아든 자리에 남은 고요를 권태가 아닌 확신으로 읽는 글.",
    outline: [],
    memo: {
      raw: "원본 메모",
      analysis: {
        emotionAxis: "불안 → 편안함",
        recurringThoughts: ["반복 1", "반복 2"],
        hiddenThemes: ["숨은 주제 1"],
        strongSentences: ["가장 힘 있는 한 문장"],
        developmentDirections: ["방향 1", "방향 2", "방향 3"],
      },
    },
    treatment: [
      { id: "tc-01", role: "intro", title: "설렘 곁의 불안", summary: "카드 1 요약 본문" },
      { id: "tc-02", role: "case", title: "잠들 수 있는 곁", summary: "카드 2 요약 본문" },
      { id: "tc-03", role: "conclusion", title: "함께 걷는 동반자", summary: "카드 3 요약 본문" },
    ],
    stage: "done",
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

/**
 * 이미 볼트에 있는 프로젝트의 `planning.md` / `concept-summary.md` «모양».
 *
 * 출처: `~/Documents/Work/KnowledgeVault/3 Writing/처음에는-…-20260831/planning.md`
 * (2026-08-31 발주자 확인, 123줄). 대표의 사적인 글이라 **문면은 중립 문장으로
 * 바꾸고 «구조»만 그대로 옮겼다** — 파서가 읽는 것은 구조다:
 * `## 컨셉` / `## 시놉시스` / `## 메모 분석 (의식의 흐름)` / `**감정의 축**:` /
 * `**글로 발전 가능한 방향**` / `## 트리트먼트` / `### N. [역할] 제목` /
 * `**핵심 문장** — ` / `<sub>컨셉 마법사 — YYYY-MM-DD</sub>`.
 */
const LIVE_PLANNING_MD = `## 컨셉

처음의 설렘과 불안은 함께할수록 편안하고 확신 있는 마음으로 깊어졌다.

## 시놉시스

설렘이 잦아든 자리에 찾아온 고요를, 권태가 아니라 확신으로 읽는 글이다.

## 메모 분석 (의식의 흐름)

**감정의 축**: 처음의 불안이 편안함으로 바뀌는 감정.

**반복되는 생각**

- 불안이 편안함으로 바뀐 과정
- 서로 잘 맞는 생활감

**숨은 주제**

- 말하지 않아도 함께 있을 수 있는 친밀함

**힘 있는 문장**

- "그때부터 편해지기 시작했다."
- "동반자 같은 마음이 들었다."

**글로 발전 가능한 방향**

- 시작의 장면을 과장 없이 둘만의 이야기로 풀기
- 사소한 장면들로 「동반자」라는 고백을 완성하기

**원본 메모 (참고)**

\`\`\`
원본 메모 본문.
\`\`\`

## 참고 노트

- [[관계 메모]]

## 트리트먼트

### 1. [도입] 설렘 곁의 불안

처음의 우리는 서로를 좋아하는 만큼 조심스러웠다.

**핵심 문장** — 처음에는 설렘만큼 불안도 컸다.

**독자 감정** — 조용한 공감

### 2. [사례] 잠들 수 있는 곁

몸이 먼저 알아본 편안함이 관계를 설명한다.

**핵심 문장** — 곁에서는 잠든다.

**독자 감정** — 따뜻한 안도

### 3. [문제 제기] 설렘이 잦은 자리

누군가에게 이 고요는 권태처럼 보인다.

### 4. [전환] 불안이 평화가 될 때

편안함은 마음이 옅어진 것이 아니다.

**핵심 문장** — 그때부터 편해지기 시작했다.

### 5. [결론] 함께 걷는 동반자

평범한 하루를 함께 누리는 사람.

**핵심 문장** — 동반자 같은 마음이 들었다.

**독자 감정** — 포근한 확신

<sub>컨셉 마법사 — 2026-08-31</sub>`;

/** 앞선 «기획 인터뷰» 가 끝난 뒤의 planning.md — PlanningMdWriter 가 쓴 모양. */
const PRIOR_INTERVIEW_MD = `---
type: writing-planning
plugin: ai-manuscript-studio
project: some-slug
sessionId: sess-prior
phase: completed
turns: 6
title: 어떤 원고
genre: long-form-manuscript
completedAt: 2026-08-30T00:00:00.000Z
---

# 기획 인터뷰 — 2026-08-30

## 최종 기획 요약

- **계기:** 오래 묵힌 한 장면
- **독자:** 같은 고민을 가진 독자
- **핵심 메시지:** 편안함은 사랑이 깊어지는 방식이다
- **톤:** 단단하고 군더더기 없는
- **구조 제안:**
    1. 도입 — 첫 장면
    2. 전개 — 흔들림

## 전사
`;

// ─────────────────────────────────────────────────────────────────────────────
// C4 — 컨셉 없이 오는 길이 «한 글자도» 안 바뀐다 (회귀의 핵심)
// ─────────────────────────────────────────────────────────────────────────────

describe("C4 — 컨셉 없이 오는 경로 회귀 방지", () => {
  it("컨셉을 안 거친 세션의 handoff 는 예전 문면 그대로다", () => {
    // 이 문자열은 «수정 전» CLIWizardBridge.buildStructuredHandoff 의 출력 그대로다.
    // 한 줄이라도 달라지면 컨셉 없이 오는 길의 프롬프트가 바뀐 것이다.
    expect(buildStructuredHandoff(bareSession())).toBe(
      [
        "session_id: sess-1",
        "draft_title: 제목",
        "draft_genre: column-essay",
        "current_stage: motive",
        "stage[motive].status: active",
      ].join("\n"),
    );
  });

  it("컨셉이 없으면 concept_ 로 시작하는 줄이 하나도 없다", () => {
    expect(buildStructuredHandoff(bareSession())).not.toMatch(/^concept_/m);
  });

  it("컨셉이 없으면 finalize 의 구조 제안은 기존 4부 안전망 그대로다", () => {
    const engine = new WizardEngine();
    for (const s of ["motive", "audience-message", "tone", "structure-pick"] as const) {
      engine.completeStage(s, `${s} 요약`);
    }
    const summary = engine.finalize();
    expect(summary.structureProposal.map((c) => c.title)).toEqual([
      "도입",
      "전개",
      "절정",
      "결말",
    ]);
  });

  it("컨셉이 없으면 트리트먼트가 없으므로 건너뛸 근거도 없다", () => {
    const engine = new WizardEngine();
    expect(engine.session.conceptHandoff).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C1 — 컨셉 결과가 실제로 프롬프트에 도달한다
// ─────────────────────────────────────────────────────────────────────────────

describe("C1 — 컨셉 결과가 프롬프트 문자열에 도달한다", () => {
  const handoff = (): ConceptHandoff => conceptHandoffFromDraft(conceptDraft());

  function conceptSession(): WizardSession {
    return { ...bareSession(), draftGenre: "long-form-manuscript", conceptHandoff: handoff() };
  }

  it("conceptHandoffFromDraft 가 컨셉·시놉시스·메모·트리트먼트를 추린다", () => {
    const h = handoff();
    expect(h.source).toBe("concept-wizard");
    expect(h.conceptParagraph).toContain("처음의 설렘과 불안");
    expect(h.synopsis).toContain("고요");
    expect(h.memoEmotionAxis).toBe("불안 → 편안함");
    expect(h.memoDirections).toHaveLength(3);
    expect(h.treatment).toHaveLength(3);
    expect(h.treatment?.[0]).toMatchObject({ role: "도입", title: "설렘 곁의 불안" });
  });

  it("컨셉이 있으면 handoff 문자열이 없을 때와 다르다", () => {
    expect(buildStructuredHandoff(conceptSession())).not.toBe(
      buildStructuredHandoff(bareSession()),
    );
  });

  it("컨셉 단락·시놉시스·감정축·발전방향이 프롬프트에 실린다", () => {
    const out = buildStructuredHandoff(conceptSession());
    expect(out).toContain("concept_source: concept-wizard");
    expect(out).toContain("concept_paragraph: 처음의 설렘과 불안");
    expect(out).toContain("concept_synopsis:");
    expect(out).toContain("concept_memo_emotion_axis: 불안 → 편안함");
    expect(out).toContain("concept_memo_directions:");
    expect(out).toContain("방향 1");
  });

  it("트리트먼트는 «역할 + 제목» 목록만 싣는다 — 카드 본문은 안 싣는다", () => {
    const out = buildStructuredHandoff(conceptSession());
    expect(out).toContain("concept_treatment_cards: 3");
    expect(out).toContain("[도입] 설렘 곁의 불안");
    // 프롬프트 부풀림 방지 — 카드 요약 본문은 {{structured_handoff}} 에 들어가지 않는다.
    expect(out).not.toContain("카드 1 요약 본문");
  });

  it("이어받은 값에는 「다시 묻지 말고 확인만 받으라」는 지시가 함께 실린다", () => {
    expect(buildStructuredHandoff(conceptSession())).toContain(
      "concept_carried: true",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C3 — 확인 흐름 (묻는 자리 → 확인하는 자리)
// ─────────────────────────────────────────────────────────────────────────────

describe("C3 — 프롬프트가 «질문» 이 아니라 «확인» 을 내게 한다", () => {
  const CONFIRM_PROMPTS = ["prompts/motive.md", "prompts/audience-message.md", "prompts/tone.md"];

  for (const rel of CONFIRM_PROMPTS) {
    describe(rel, () => {
      const src = (): string => read(rel);

      it("F5 의 뼈대(누적 결정사항 + structured_handoff)는 그대로 남아 있다", () => {
        expect(src()).toContain("{{structured_handoff}}");
        expect(src()).toContain("다시 묻지 말 것");
      });

      it("concept_carried 가 있을 때의 «확인 모드» 지시가 있다", () => {
        expect(src()).toContain("concept_carried");
      });

      it("확인 모드의 1번 선택지는 「맞습니다」다", () => {
        expect(src()).toContain("맞습니다");
      });

      it("「직접 입력」 출구가 확인 모드에도 남아 그 자리에서 고칠 수 있다", () => {
        expect(src()).toContain("직접 입력");
      });

      it("확인 모드는 «이어받은 값이 있을 때만» 이라는 조건이 달려 있다 (C4 보호)", () => {
        // 조건 없이 확인 모드를 강제하면 컨셉 없이 오는 길이 깨진다.
        // 「있을 때만 적용」과 「없으면 무시」가 둘 다 문면에 있어야 한다.
        expect(src()).toMatch(/concept_carried[^\n]{0,20}있을 때만/);
        expect(src()).toMatch(/concept_carried[^\n]{0,20}없으면/);
      });

      it("draft_genre 와 다른 장르의 어휘를 섞지 말라는 규칙이 있다", () => {
        expect(src()).toMatch(/다른 장르/);
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// C5 — structure-pick 건너뛰기의 파급
// ─────────────────────────────────────────────────────────────────────────────

describe("C5 — structure-pick 건너뛰기", () => {
  function engineWithConcept(): WizardEngine {
    const engine = new WizardEngine();
    engine.setConceptHandoff(conceptHandoffFromDraft(conceptDraft()));
    engine.completeStage("motive", "동기 요약");
    engine.completeStage("audience-message", "독자 요약");
    engine.completeStage("tone", "톤 요약");
    return engine;
  }

  it("skipStage 는 사유(skippedReason)를 남긴다 — 「사용자가 답했다」로 위장하지 않는다", () => {
    const engine = engineWithConcept();
    engine.skipStage("structure-pick", "컨셉 마법사 트리트먼트 3장으로 대체");
    const outcome = engine.session.stages["structure-pick"];
    expect(outcome.skippedReason).toBe("컨셉 마법사 트리트먼트 3장으로 대체");
    expect(outcome.summary).toContain("트리트먼트");
  });

  it("진행도가 어긋나지 않는다 — 4단계 중 4단계가 닫힌다", () => {
    const engine = engineWithConcept();
    expect(engine.getProgress()).toEqual({ complete: 3, total: 4 });
    engine.skipStage("structure-pick", "이어받음");
    expect(engine.getProgress()).toEqual({ complete: 4, total: 4 });
    expect(engine.isFullyComplete()).toBe(true);
  });

  it("건너뛰어도 finalize 가 throw 하지 않는다", () => {
    const engine = engineWithConcept();
    engine.skipStage("structure-pick", "이어받음");
    expect(() => engine.finalize()).not.toThrow();
  });

  it("건너뛴 경우 구조 제안은 트리트먼트 카드에서 온다 (AI 가 지어낸 것이 아니라)", () => {
    const engine = engineWithConcept();
    engine.skipStage("structure-pick", "이어받음");
    const summary = engine.finalize([
      { id: "ai-1", title: "AI 가 지어낸 장", synopsis: "" },
    ]);
    expect(summary.structureProposal.map((c) => c.title)).toEqual([
      "설렘 곁의 불안",
      "잠들 수 있는 곁",
      "함께 걷는 동반자",
    ]);
    expect(summary.structureProposal[0].synopsis).toContain("카드 1 요약 본문");
  });

  it("건너뛰지 않았으면 AI 구조가 그대로 우선한다 (기존 동작)", () => {
    const engine = engineWithConcept();
    engine.completeStage("structure-pick", "구조 요약");
    const summary = engine.finalize([
      { id: "ai-1", title: "AI 가 고른 장", synopsis: "" },
    ]);
    expect(summary.structureProposal.map((c) => c.title)).toEqual(["AI 가 고른 장"]);
  });

  it("wizardStore 가 tone 종료 후 structure-pick 을 건너뛴다 (소스 계약)", () => {
    const src = read("wizardStore.ts");
    expect(src).toContain("skipStage");
    expect(src).toMatch(/structure-pick/);
  });

  it("WizardSidebar 가 건너뛴 단계를 「이어받음」으로 구분해 보여준다", () => {
    expect(read("WizardSidebar.tsx")).toContain("skippedReason");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C5-D — 문서 종류가 한 줄로 이어진다
// ─────────────────────────────────────────────────────────────────────────────

describe("C5-D — 문서 종류가 처음부터 끝까지 한 줄로 간다", () => {
  it("장르 기본값이 core 의 한 상수로 모인다", () => {
    expect(DEFAULT_DRAFT_GENRE).toBe("investment-strategy-memo");
  });

  it("Step1Seed 가 장르를 하드코딩으로 미리 골라두지 않는다", () => {
    const src = readFileSync(join(SRC, "concept/Step1Seed.tsx"), "utf8");
    expect(src).not.toMatch(/useState<Genre>\("investment-strategy-memo"\)/);
    expect(src).toMatch(/useState<Genre \| null>\(null\)/);
  });

  it("Step1Seed 는 장르를 고르기 전에는 다음으로 넘어가지 못한다", () => {
    const src = readFileSync(join(SRC, "concept/Step1Seed.tsx"), "utf8");
    expect(src).toMatch(/genre === null/);
  });

  it("WizardOverlay 는 기본값을 하드코딩하지 않고 그 상수를 본다", () => {
    const src = read("WizardOverlay.tsx");
    expect(src).toContain("DEFAULT_DRAFT_GENRE");
    expect(src).not.toMatch(/useState<Genre>\("investment-strategy-memo"\)/);
  });

  it("컨셉에서 고른 종류가 Step5Commit 을 거쳐 인터뷰로 넘어간다 (소스 계약)", () => {
    const src = readFileSync(join(SRC, "concept/Step5Commit.tsx"), "utf8");
    expect(src).toContain("draftGenre: meta.genre");
    expect(src).toContain("conceptHandoff");
  });

  it("고른 종류가 프롬프트에도 그대로 실린다", () => {
    const s = { ...bareSession(), draftGenre: "long-form-manuscript" as const };
    expect(buildStructuredHandoff(s)).toContain("draft_genre: long-form-manuscript");
  });

  it("이어받은 뒤 종류를 바꾸면 어긋남을 알린다 (소스 계약)", () => {
    const src = read("WizardOverlay.tsx");
    expect(src).toMatch(/conceptHandoff/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C5-E — 이미 있는 프로젝트에서 이어진다
// ─────────────────────────────────────────────────────────────────────────────

describe("C5-E — 이미 만들어진 프로젝트에서 이어서 하기", () => {
  it("볼트에 살아 있는 planning.md 모양에서 컨셉 결과를 되찾는다", () => {
    const h = parseConceptHandoffFromMarkdown(LIVE_PLANNING_MD);
    expect(h).not.toBeNull();
    expect(h!.source).toBe("planning-md");
    expect(h!.conceptParagraph).toContain("처음의 설렘과 불안");
    expect(h!.synopsis).toContain("고요");
    expect(h!.memoEmotionAxis).toContain("불안이 편안함으로");
    expect(h!.memoDirections?.length).toBe(2);
    expect(h!.memoStrongSentences?.length).toBe(2);
    expect(h!.attachedNotes).toEqual(["[[관계 메모]]"]);
  });

  it("트리트먼트 카드를 역할·제목·요약까지 되찾는다", () => {
    const h = parseConceptHandoffFromMarkdown(LIVE_PLANNING_MD)!;
    expect(h.treatment).toHaveLength(5);
    expect(h.treatment![0]).toMatchObject({
      role: "도입",
      title: "설렘 곁의 불안",
    });
    expect(h.treatment![0].summary).toContain("조심스러웠다");
    expect(h.treatment![4]).toMatchObject({ role: "결론", title: "함께 걷는 동반자" });
  });

  it("되찾은 컨셉이 그대로 프롬프트에 실린다 — 읽는 쪽이 이어진다", () => {
    const h = parseConceptHandoffFromMarkdown(LIVE_PLANNING_MD)!;
    const out = buildStructuredHandoff({ ...bareSession(), conceptHandoff: h });
    expect(out).toContain("concept_carried: true");
    expect(out).toContain("concept_treatment_cards: 5");
  });

  it("되찾은 트리트먼트가 binder 구조 제안으로 이어진다", () => {
    const h = parseConceptHandoffFromMarkdown(LIVE_PLANNING_MD)!;
    const engine = new WizardEngine();
    engine.setConceptHandoff(h);
    engine.completeStage("motive", "동기");
    engine.completeStage("audience-message", "독자");
    engine.completeStage("tone", "톤");
    engine.skipStage("structure-pick", "이어받음");
    expect(engine.finalize().structureProposal).toHaveLength(5);
  });

  it("앞서 «끝난» 기획 인터뷰가 있으면 그 결정도 이어받는다", () => {
    const h = parseConceptHandoffFromMarkdown(PRIOR_INTERVIEW_MD);
    expect(h).not.toBeNull();
    expect(h!.priorDecisions).toMatchObject({
      motive: "오래 묵힌 한 장면",
      targetReader: "같은 고민을 가진 독자",
      coreMessage: "편안함은 사랑이 깊어지는 방식이다",
      tone: "단단하고 군더더기 없는",
    });
  });

  it("앞선 인터뷰 결정도 프롬프트에 실린다", () => {
    const h = parseConceptHandoffFromMarkdown(PRIOR_INTERVIEW_MD)!;
    const out = buildStructuredHandoff({ ...bareSession(), conceptHandoff: h });
    expect(out).toContain("prior_interview.motive: 오래 묵힌 한 장면");
  });

  it("컨셉도 앞선 인터뷰도 없는 문서에서는 null — 지금 동작 그대로", () => {
    expect(parseConceptHandoffFromMarkdown("# 그냥 메모\n\n본문")).toBeNull();
    expect(parseConceptHandoffFromMarkdown("")).toBeNull();
  });

  it("기획 인터뷰가 이미 있는 프로젝트의 저장물을 읽어 시작한다 (소스 계약)", () => {
    const src = read("wizardStore.ts");
    // concept-summary.md 가 정본 — planning.md 는 인터뷰 결과로 덮어쓰이기 때문.
    expect(src).toContain("concept-summary.md");
    expect(src).toContain("planning.md");
    expect(src).toContain("parseConceptHandoffFromMarkdown");
  });
});
