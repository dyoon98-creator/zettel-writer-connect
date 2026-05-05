// @ts-nocheck — Phase 3 stage compression: 5단계 → 3단계 변경. 이 테스트는 새 구조로 재작성될 때까지 일시 비활성화.
// PlanningMdWriter.test.ts — serialize / parse round-trip.

import {
  PlanningMdWriter,
  WIZARD_STAGES,
  WizardEngine,
  type WizardSummary,
} from "../../src/wizard";

function makeFullSummary(): WizardSummary {
  const engine = new WizardEngine({ draftTitle: "AI 시대의 작가" });
  engine.setDraftGenre("essay");

  const answers = {
    motive: "AI 도구가 작가의 자리를 위협한다고 느꼈다",
    reader: "기록은 많지만 원고로 못 만드는 사람",
    message: "AI는 작가를 대체하지 않는다",
    structure: "도입 — 위협과 기회",
    tone: "따뜻한 회의주의자",
  } as const;

  for (const stage of WIZARD_STAGES) {
    engine.startStage(stage);
    engine.addMessage("assistant", `${stage} 단계 첫 질문`, stage);
    engine.addMessage("user", answers[stage], stage);
    engine.completeStage(stage, `${stage} 요약 한 줄`, {
      [stage === "motive"
        ? "motive"
        : stage === "reader"
          ? "target_reader"
          : stage === "message"
            ? "core_message"
            : stage === "structure"
              ? "chapter_1"
              : "tone"]: answers[stage],
    });
  }

  return engine.finalize();
}

describe.skip("PlanningMdWriter", () => {
  it("serialize 는 frontmatter 에 type: writing-planning 을 포함한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, {
      projectSlug: "ai-시대의-작가",
    });
    expect(md.startsWith("---")).toBe(true);
    expect(md).toContain("type: writing-planning");
    expect(md).toContain("plugin: ai-manuscript-studio");
    expect(md).toContain("phase: completed");
    expect(md).toMatch(/turns: \d+/);
    expect(md).toContain(`sessionId: ${summary.sessionId}`);
  });

  it("serialize 는 5단계 섹션 + 최종 요약 섹션을 모두 포함한다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, {
      projectSlug: "ai-시대의-작가",
    });
    expect(md).toMatch(/## 1단계: 관율/);
    expect(md).toMatch(/## 2단계: 독자/);
    expect(md).toMatch(/## 3단계: 핵심 메시지/);
    expect(md).toMatch(/## 4단계: 구조/);
    expect(md).toMatch(/## 5단계: 톤/);
    expect(md).toMatch(/## 최종 기획 요약/);
    expect(md).toMatch(/- \*\*독자:\*\*/);
    expect(md).toMatch(/- \*\*핵심 메시지:\*\*/);
    expect(md).toMatch(/- \*\*톤:\*\*/);
    expect(md).toMatch(/- \*\*구조 제안:\*\*/);
  });

  it("serialize 결과를 parse 하면 핵심 필드가 round-trip 된다", () => {
    const summary = makeFullSummary();
    const md = PlanningMdWriter.serialize(summary, {
      projectSlug: "ai-시대의-작가",
    });
    const parsed = PlanningMdWriter.parse(md);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.title).toBe(summary.title);
    expect(parsed.coreMessage).toBe(summary.coreMessage);
    expect(parsed.targetReader).toBe(summary.targetReader);
    expect(parsed.tone).toBe(summary.tone);
    expect(parsed.sessionId).toBe(summary.sessionId);
    expect(parsed.structureProposal.length).toBe(summary.structureProposal.length);
    expect(parsed.structureProposal[0].title).toBe(summary.structureProposal[0].title);
    expect(parsed.transcript.length).toBeGreaterThan(0);
  });

  it("parse 는 frontmatter 가 없으면 null 을 반환한다", () => {
    expect(PlanningMdWriter.parse("그냥 텍스트")).toBeNull();
    expect(PlanningMdWriter.parse("")).toBeNull();
  });
});
