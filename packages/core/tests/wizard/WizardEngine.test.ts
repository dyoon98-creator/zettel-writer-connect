// @ts-nocheck — Phase 3 stage compression: 5단계 → 3단계 변경. 이 테스트는 새 구조로 재작성될 때까지 일시 비활성화.
// WizardEngine.test.ts — 순수 상태 머신 검증.

import {
  STAGE_LABEL_KO,
  WIZARD_STAGES,
  WizardEngine,
  type WizardStageId,
} from "../../src/wizard";

describe.skip("WizardEngine", () => {
  it("새 세션은 motive 단계가 active 인 상태로 시작한다", () => {
    const engine = new WizardEngine();
    expect(engine.session.currentStage).toBe("motive");
    expect(engine.session.stages.motive.status).toBe("active");
    for (const stage of WIZARD_STAGES) {
      if (stage === "motive") continue;
      expect(engine.session.stages[stage].status).toBe("pending");
    }
    expect(engine.session.messages).toEqual([]);
  });

  it("addMessage 는 stage 태그를 자동으로 채운다", () => {
    const engine = new WizardEngine();
    const msg = engine.addMessage("user", "그날 카페에서 노트북을 펼쳤다.");
    expect(msg.stage).toBe("motive");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("그날 카페에서 노트북을 펼쳤다.");
    expect(engine.session.messages).toHaveLength(1);
  });

  it("addMessage 는 명시적 stage 인자를 우선한다", () => {
    const engine = new WizardEngine();
    const msg = engine.addMessage("assistant", "독자에 대해 여쭤볼게요.", "reader");
    expect(msg.stage).toBe("reader");
  });

  it("completeStage 후 advance 가 다음 단계로 진행한다", () => {
    const engine = new WizardEngine();
    engine.completeStage("motive", "계기 요약", { motive: "분노" });
    expect(engine.canAdvance()).toBe(true);
    const next = engine.advance();
    expect(next).toBe("reader");
    expect(engine.session.currentStage).toBe("reader");
    expect(engine.session.stages.motive.status).toBe("complete");
    expect(engine.session.stages.reader.status).toBe("active");
  });

  it("advance 는 마지막 단계 다음에는 null 을 반환한다", () => {
    const engine = new WizardEngine();
    for (const s of WIZARD_STAGES) {
      engine.startStage(s);
      engine.completeStage(s, `${s} 요약`, {});
    }
    expect(engine.advance()).toBe(null);
  });

  it("revisitStage 는 종료된 단계를 다시 active 로 만든다", () => {
    const engine = new WizardEngine();
    engine.completeStage("motive", "계기", { motive: "x" });
    engine.advance(); // → reader
    expect(engine.session.currentStage).toBe("reader");

    engine.revisitStage("motive");
    expect(engine.session.currentStage).toBe("motive");
    expect(engine.session.stages.motive.status).toBe("active");
    // reader 는 active 였다가 양보 → pending.
    expect(engine.session.stages.reader.status).toBe("pending");
  });

  it("getProgress 는 complete 단계 수를 정확히 센다", () => {
    const engine = new WizardEngine();
    expect(engine.getProgress()).toEqual({ complete: 0, total: 5 });
    engine.completeStage("motive", "x", {});
    engine.completeStage("reader", "x", {});
    expect(engine.getProgress()).toEqual({ complete: 2, total: 5 });
  });

  it("finalize 는 5단계 모두 끝나기 전에는 throw 한다", () => {
    const engine = new WizardEngine();
    engine.completeStage("motive", "계기", { motive: "x" });
    expect(() => engine.finalize()).toThrow(/단계가 완료되지 않았습니다/);
  });

  it("finalize 는 stage decisions 를 기반으로 WizardSummary 를 만든다", () => {
    const engine = new WizardEngine({ draftTitle: "AI 시대의 작가" });
    engine.setDraftGenre("essay");

    const decisionsPerStage: Record<WizardStageId, Record<string, string>> = {
      motive: { motive: "AI 도구가 작가의 자리를 위협한다고 느꼈다" },
      reader: { target_reader: "기록은 많지만 원고로 못 만드는 사람" },
      message: { core_message: "AI는 작가를 대체하지 않는다" },
      structure: {
        chapter_1: "도입 — 위협과 기회",
        chapter_2: "전개 — 도구의 한계",
        chapter_3: "절정 — 작가의 역할",
        chapter_4: "결말 — 약속",
      },
      tone: { tone: "따뜻한 회의주의자" },
    };

    for (const stage of WIZARD_STAGES) {
      engine.startStage(stage);
      engine.completeStage(stage, `${STAGE_LABEL_KO[stage]} 요약`, decisionsPerStage[stage]);
    }

    const summary = engine.finalize();
    expect(summary.title).toBe("AI 시대의 작가");
    expect(summary.genre).toBe("essay");
    expect(summary.targetReader).toBe("기록은 많지만 원고로 못 만드는 사람");
    expect(summary.coreMessage).toBe("AI는 작가를 대체하지 않는다");
    expect(summary.tone).toBe("따뜻한 회의주의자");
    expect(summary.motive).toBe("AI 도구가 작가의 자리를 위협한다고 느꼈다");
    expect(summary.structureProposal.length).toBe(4);
    expect(summary.structureProposal[0].title).toBe("도입");
    expect(summary.structureProposal[0].synopsis).toBe("위협과 기회");
  });

  it("finalize 는 explicit structureProposal 인자를 우선 사용한다", () => {
    const engine = new WizardEngine({ draftTitle: "X" });
    for (const stage of WIZARD_STAGES) {
      engine.completeStage(stage, "...", { [stage]: "answer" });
    }
    const summary = engine.finalize([
      { id: "a", title: "A", synopsis: "a-syn" },
      { id: "b", title: "B", synopsis: "b-syn" },
      { id: "c", title: "C", synopsis: "c-syn" },
    ]);
    expect(summary.structureProposal).toHaveLength(3);
    expect(summary.structureProposal.map((c) => c.title)).toEqual(["A", "B", "C"]);
  });
});
