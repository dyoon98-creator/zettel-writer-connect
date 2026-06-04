// PlanningMdWriter.test.ts — serialize / parse round-trip.
//
// Phase 3 단계 압축(5단계 → 현재 4단계: motive → audience-message → tone →
// structure-pick) 이후의 현재 구조를 검증한다. 단계 식별자/개수를 하드코딩하지
// 않고 src 의 WIZARD_STAGES / STAGE_LABEL_KO 에서 끌어와, 단계 시퀀스가 다시
// 바뀌어도 검증이 유지되도록 작성했다.

import {
  PlanningMdWriter,
  STAGE_LABEL_KO,
  WIZARD_STAGES,
  WizardEngine,
  type WizardSummary,
} from "../../src/wizard";

const PROJECT_SLUG = "ai-시대의-작가";

const ANSWERS = {
  motive: "AI 도구가 작가의 자리를 위협한다고 느꼈다",
  targetReader: "기록은 많지만 원고로 못 만드는 사람",
  coreMessage: "AI는 작가를 대체하지 않는다",
  tone: "따뜻한 회의주의자",
} as const;

// 현재 4단계 decisions / WizardSummary 필드에 맞춘 완전한 요약을 만든다.
// targetReader 와 coreMessage 는 모두 audience-message 단계의 decisions 에서 온다
// (WizardEngine.finalize). 구조 제안 title 은 파서가 첫 구분자(— / - / :)에서
// title/synopsis 를 가르므로, 깨끗한 round-trip 을 위해 구분자 없는 title 을 쓴다.
function makeFullSummary(): WizardSummary {
  const engine = new WizardEngine({ draftTitle: "AI 시대의 작가" });
  engine.setDraftGenre("column-essay");

  const decisionsByStage = {
    motive: { motive: ANSWERS.motive },
    "audience-message": {
      target_reader: ANSWERS.targetReader,
      core_message: ANSWERS.coreMessage,
    },
    tone: { tone: ANSWERS.tone },
    "structure-pick": {},
  } as const;

  for (const stage of WIZARD_STAGES) {
    engine.startStage(stage);
    engine.addMessage("assistant", `${STAGE_LABEL_KO[stage]} 단계 첫 질문`, stage);
    engine.addMessage("user", `${STAGE_LABEL_KO[stage]} 단계 답변`, stage);
    engine.completeStage(stage, `${STAGE_LABEL_KO[stage]} 요약 한 줄`, decisionsByStage[stage]);
  }

  return engine.finalize([
    { id: "c1", title: "도입", synopsis: "AI 시대 작가의 불안" },
    { id: "c2", title: "전개", synopsis: "도구로서의 AI" },
    { id: "c3", title: "결말", synopsis: "공존의 길" },
  ]);
}

describe("PlanningMdWriter", () => {
  it("serialize 는 frontmatter 에 type/plugin/phase/turns/sessionId 를 박는다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });

    expect(md.startsWith("---")).toBe(true);
    expect(md).toContain("type: writing-planning");
    expect(md).toContain("plugin: ai-manuscript-studio");
    expect(md).toContain("phase: completed");
    expect(md).toMatch(/turns: \d+/);
    expect(md).toContain(`sessionId: ${summary.sessionId}`);
    expect(md).toContain(`title: ${summary.title}`);
    expect(md).toContain(`genre: ${summary.genre}`);
  });

  it("serialize 는 현재 4단계 섹션 + 최종 요약 섹션 마커를 모두 포함한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });

    // 단계 라벨/개수를 하드코딩하지 않고 src 의 시퀀스에서 끌어와 확인한다.
    WIZARD_STAGES.forEach((stage, idx) => {
      expect(md).toContain(`## ${idx + 1}단계: ${STAGE_LABEL_KO[stage]}`);
    });

    expect(md).toContain("## 최종 기획 요약");
    expect(md).toMatch(/- \*\*계기:\*\*/);
    expect(md).toMatch(/- \*\*독자:\*\*/);
    expect(md).toMatch(/- \*\*핵심 메시지:\*\*/);
    expect(md).toMatch(/- \*\*톤:\*\*/);
    expect(md).toMatch(/- \*\*구조 제안:\*\*/);
    expect(md).toContain("## 전사");
  });

  it("최종 요약 섹션에 결정된 값들이 실제로 직렬화된다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });

    expect(md).toContain(`- **계기:** ${ANSWERS.motive}`);
    expect(md).toContain(`- **독자:** ${ANSWERS.targetReader}`);
    expect(md).toContain(`- **핵심 메시지:** ${ANSWERS.coreMessage}`);
    expect(md).toContain(`- **톤:** ${ANSWERS.tone}`);
    // 구조 제안은 "N. <title> — <synopsis>" 형태로 박힌다.
    expect(md).toContain("1. 도입 — AI 시대 작가의 불안");
  });

  it("serialize → parse 는 핵심 필드를 round-trip 한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });
    const parsed = PlanningMdWriter.parse(md);

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    // frontmatter 에서 복원되는 필드.
    expect(parsed.sessionId).toBe(summary.sessionId);
    expect(parsed.title).toBe(summary.title);
    expect(parsed.genre).toBe(summary.genre);
    expect(parsed.completedAt).toBe(summary.completedAt);

    // 최종 요약 섹션에서 복원되는 필드.
    expect(parsed.motive).toBe(summary.motive);
    expect(parsed.targetReader).toBe(summary.targetReader);
    expect(parsed.coreMessage).toBe(summary.coreMessage);
    expect(parsed.tone).toBe(summary.tone);
  });

  it("parse 는 구조 제안(title + synopsis)을 구조화해 복원한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });
    const parsed = PlanningMdWriter.parse(md);

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.structureProposal).toHaveLength(summary.structureProposal.length);
    expect(parsed.structureProposal.map((c) => c.title)).toEqual(
      summary.structureProposal.map((c) => c.title),
    );
    expect(parsed.structureProposal.map((c) => c.synopsis)).toEqual(
      summary.structureProposal.map((c) => c.synopsis),
    );
  });

  it("parse 는 전사(transcript)의 내용과 메시지 수를 복원한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: PROJECT_SLUG });
    const parsed = PlanningMdWriter.parse(md);

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const originalNonSystem = summary.transcript.filter((m) => m.role !== "system");
    expect(parsed.transcript).toHaveLength(originalNonSystem.length);
    expect(parsed.transcript.length).toBeGreaterThan(0);

    // 역할/내용은 그대로 복원되어야 한다 (단계 라벨 매핑은 별도 — structure-pick
    // 라벨이 stageByLabel 에 없어 motive 로 폴백되므로 stage 동치는 단언하지 않는다).
    expect(parsed.transcript.map((m) => m.role)).toEqual(
      originalNonSystem.map((m) => m.role),
    );
    expect(parsed.transcript.map((m) => m.content)).toEqual(
      originalNonSystem.map((m) => m.content),
    );
  });

  it("parse 는 frontmatter 가 없으면 null 을 반환한다", () => {
    expect(PlanningMdWriter.parse("그냥 텍스트")).toBeNull();
    expect(PlanningMdWriter.parse("")).toBeNull();
  });
});
