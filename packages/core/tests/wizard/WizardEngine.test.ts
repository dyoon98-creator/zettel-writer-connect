// WizardEngine.test.ts — 순수 상태 머신 검증.
//
// Phase 3 단계 압축 이후의 현재 구조를 검증한다. 단계 식별자/개수를 하드코딩하지
// 않고 src 의 WIZARD_STAGES 에서 그대로 끌어와, 단계 시퀀스가 다시 바뀌어도
// 불변식(invariant) 검증이 유지되도록 작성했다.

import {
  STAGE_LABEL_KO,
  WIZARD_STAGES,
  WizardEngine,
  type StageStatus,
  type WizardStageId,
} from "../../src/wizard";

const FIRST_STAGE = WIZARD_STAGES[0];
const LAST_STAGE = WIZARD_STAGES[WIZARD_STAGES.length - 1];

/** 현재 active 상태인 단계 id 목록. */
function activeStages(engine: WizardEngine): WizardStageId[] {
  return WIZARD_STAGES.filter((s) => engine.session.stages[s].status === "active");
}

/** stage → status 맵. 불변식 검증용. */
function statusMap(engine: WizardEngine): Record<WizardStageId, StageStatus> {
  const out = {} as Record<WizardStageId, StageStatus>;
  for (const s of WIZARD_STAGES) out[s] = engine.session.stages[s].status;
  return out;
}

/** 모든 단계를 순서대로 시작 + 완료 (decisions 선택). */
function completeAll(
  engine: WizardEngine,
  decisionsPerStage?: Partial<Record<WizardStageId, Record<string, string>>>,
): void {
  for (const s of WIZARD_STAGES) {
    engine.startStage(s);
    engine.completeStage(s, `${STAGE_LABEL_KO[s]} 요약`, decisionsPerStage?.[s] ?? {});
  }
}

describe("WizardEngine", () => {
  it("새 세션은 첫 단계 하나만 active, 나머지는 모두 pending 으로 시작한다", () => {
    const engine = new WizardEngine();

    // (b) 첫 단계는 WIZARD_STAGES[0] 이다.
    expect(engine.session.currentStage).toBe(FIRST_STAGE);

    // (a) 정확히 하나의 단계만 active, 그 단계가 곧 첫 단계.
    expect(activeStages(engine)).toEqual([FIRST_STAGE]);

    // 나머지는 전부 pending.
    for (const s of WIZARD_STAGES) {
      expect(engine.session.stages[s].status).toBe(s === FIRST_STAGE ? "active" : "pending");
    }

    expect(engine.session.messages).toEqual([]);
  });

  it("불변식: 진행 도중에도 동시에 active 인 단계는 항상 0~1 개다", () => {
    const engine = new WizardEngine();
    // 시작 직후.
    expect(activeStages(engine).length).toBe(1);

    // 각 단계를 시작/완료/전진하며 매 시점마다 active 가 1 개 이하인지 확인.
    for (let i = 0; i < WIZARD_STAGES.length; i += 1) {
      const stage = engine.session.currentStage;
      expect(activeStages(engine).length).toBeLessThanOrEqual(1);

      engine.completeStage(stage, `${stage} 요약`, {});
      // 완료 직후: active 단계 0 개 (현재 단계는 complete).
      expect(activeStages(engine).length).toBe(0);

      const next = engine.advance();
      if (next === null) {
        // 마지막 단계였다.
        expect(stage).toBe(LAST_STAGE);
      } else {
        // 전진 후: 새 단계 정확히 1 개만 active.
        expect(activeStages(engine)).toEqual([next]);
      }
    }
  });

  it("addMessage 는 현재 단계(첫 단계) 태그를 자동으로 채운다", () => {
    const engine = new WizardEngine();
    const msg = engine.addMessage("user", "그날 카페에서 노트북을 펼쳤다.");
    expect(msg.stage).toBe(FIRST_STAGE);
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("그날 카페에서 노트북을 펼쳤다.");
    expect(engine.session.messages).toHaveLength(1);
    expect(engine.session.messages[0]).toBe(msg);
  });

  it("addMessage 는 명시적 stage 인자를 우선한다", () => {
    const engine = new WizardEngine();
    const explicit = WIZARD_STAGES[WIZARD_STAGES.length - 1];
    const msg = engine.addMessage("assistant", "마지막 단계에 대해 여쭤볼게요.", explicit);
    expect(msg.stage).toBe(explicit);
    expect(msg.stage).not.toBe(engine.session.currentStage);
  });

  it("completeStage 후 advance 가 다음 단계로 진행한다", () => {
    const engine = new WizardEngine();
    const second = WIZARD_STAGES[1];

    engine.completeStage(FIRST_STAGE, "계기 요약", { motive: "분노" });
    expect(engine.canAdvance()).toBe(true);

    const next = engine.advance();
    expect(next).toBe(second);
    expect(engine.session.currentStage).toBe(second);
    expect(engine.session.stages[FIRST_STAGE].status).toBe("complete");
    expect(engine.session.stages[second].status).toBe("active");
  });

  it("canAdvance 는 현재 단계가 complete 일 때만 true 다", () => {
    const engine = new WizardEngine();
    expect(engine.canAdvance()).toBe(false);
    // 완료되지 않은 상태에서 advance 는 진행하지 않고 null.
    expect(engine.advance()).toBe(null);
    expect(engine.session.currentStage).toBe(FIRST_STAGE);

    engine.completeStage(FIRST_STAGE, "요약", {});
    expect(engine.canAdvance()).toBe(true);
  });

  it("advance 는 마지막 단계 다음에는 null 을 반환한다", () => {
    const engine = new WizardEngine();
    completeAll(engine);
    expect(engine.session.currentStage).toBe(LAST_STAGE);
    expect(engine.advance()).toBe(null);
  });

  it("모든 단계를 완료하면 isFullyComplete 가 true 가 되고 진척도가 가득 찬다", () => {
    const engine = new WizardEngine();
    expect(engine.isFullyComplete()).toBe(false);

    completeAll(engine);

    expect(engine.isFullyComplete()).toBe(true);
    expect(engine.getProgress()).toEqual({
      complete: WIZARD_STAGES.length,
      total: WIZARD_STAGES.length,
    });
    // 마지막 시점: 모든 단계 complete, active 단계 0.
    for (const s of WIZARD_STAGES) {
      expect(engine.session.stages[s].status).toBe("complete");
    }
    expect(activeStages(engine).length).toBe(0);
  });

  it("revisitStage 는 종료된 단계를 다시 active 로 만들고 양보된 단계는 pending 이 된다", () => {
    const engine = new WizardEngine();
    const second = WIZARD_STAGES[1];

    engine.completeStage(FIRST_STAGE, "계기", { motive: "x" });
    engine.advance(); // → second
    expect(engine.session.currentStage).toBe(second);

    engine.revisitStage(FIRST_STAGE);
    expect(engine.session.currentStage).toBe(FIRST_STAGE);
    expect(engine.session.stages[FIRST_STAGE].status).toBe("active");
    // second 는 active 였다가 양보 → pending.
    expect(engine.session.stages[second].status).toBe("pending");
    // 불변식: 여전히 active 는 정확히 1 개 (첫 단계).
    expect(activeStages(engine)).toEqual([FIRST_STAGE]);
  });

  it("getProgress 는 complete 단계 수를 정확히 세고 total 은 단계 수와 같다", () => {
    const engine = new WizardEngine();
    expect(engine.getProgress()).toEqual({ complete: 0, total: WIZARD_STAGES.length });

    engine.completeStage(WIZARD_STAGES[0], "x", {});
    engine.completeStage(WIZARD_STAGES[1], "x", {});
    expect(engine.getProgress()).toEqual({ complete: 2, total: WIZARD_STAGES.length });
  });

  it("startStage / completeStage / revisitStage 는 알 수 없는 단계에 대해 throw 한다", () => {
    const engine = new WizardEngine();
    // 타입상 존재하지 않는 단계 — 런타임 가드 검증을 위해 강제 캐스팅.
    const bogus = "not-a-real-stage" as WizardStageId;
    expect(() => engine.startStage(bogus)).toThrow(/unknown stage/);
    expect(() => engine.completeStage(bogus, "x", {})).toThrow(/unknown stage/);
    expect(() => engine.revisitStage(bogus)).toThrow(/unknown stage/);
  });

  it("finalize 는 모든 단계가 끝나기 전에는 throw 한다", () => {
    const engine = new WizardEngine();
    engine.completeStage(FIRST_STAGE, "계기", { motive: "x" });
    expect(() => engine.finalize()).toThrow(/단계가 완료되지 않았습니다/);
  });

  it("finalize 는 stage decisions 를 기반으로 WizardSummary 를 만든다", () => {
    const engine = new WizardEngine({ draftTitle: "AI 시대의 작가" });
    engine.setDraftGenre("investment-strategy-memo");

    // 현재 단계 식별자에 맞춘 decisions.
    completeAll(engine, {
      motive: { motive: "AI 도구가 작가의 자리를 위협한다고 느꼈다" },
      "audience-message": {
        target_reader: "기록은 많지만 원고로 못 만드는 사람",
        core_message: "AI는 작가를 대체하지 않는다",
      },
      tone: { tone: "따뜻한 회의주의자" },
    });

    const summary = engine.finalize();
    expect(summary.sessionId).toBe(engine.session.id);
    expect(summary.title).toBe("AI 시대의 작가");
    expect(summary.genre).toBe("investment-strategy-memo");
    expect(summary.motive).toBe("AI 도구가 작가의 자리를 위협한다고 느꼈다");
    expect(summary.targetReader).toBe("기록은 많지만 원고로 못 만드는 사람");
    expect(summary.coreMessage).toBe("AI는 작가를 대체하지 않는다");
    expect(summary.tone).toBe("따뜻한 회의주의자");

    // 구조 인자를 주지 않으면 4부 fallback 구조가 채워진다.
    expect(summary.structureProposal).toHaveLength(4);
    expect(summary.structureProposal[0].title).toBe("도입");
  });

  it("finalize 는 빈 제목/장르를 기본값으로 대체한다", () => {
    const engine = new WizardEngine();
    completeAll(engine);
    const summary = engine.finalize();
    expect(summary.title).toBe("새 원고");
    expect(summary.genre).toBe("investment-strategy-memo");
  });

  it("finalize 는 explicit structureProposal 인자를 우선 사용한다", () => {
    const engine = new WizardEngine({ draftTitle: "X" });
    completeAll(engine);

    const summary = engine.finalize([
      { id: "a", title: "A", synopsis: "a-syn" },
      { id: "b", title: "B", synopsis: "b-syn" },
      { id: "c", title: "C", synopsis: "c-syn" },
    ]);
    expect(summary.structureProposal).toHaveLength(3);
    expect(summary.structureProposal.map((c) => c.title)).toEqual(["A", "B", "C"]);
  });
});
