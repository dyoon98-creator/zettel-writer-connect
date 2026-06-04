// PlanningMdWriter — 전사 메시지의 stage 라운드트립 회귀.
//
// 버그(수정 전): extractTranscript의 stageByLabel이 structure-pick을 누락 →
// 해당 전사 메시지가 parse 시 motive로 오복원됨. 이제 stageByLabel을
// WIZARD_STAGES에서 파생하므로 모든 단계가 라운드트립한다.

import { PlanningMdWriter, type WizardSummary } from "../../src/wizard";

function summaryWithTranscript(): WizardSummary {
  return {
    sessionId: "sess-stage-rt",
    title: "스테이지 라운드트립",
    genre: "column-essay",
    motive: "동기",
    targetReader: "독자",
    coreMessage: "핵심",
    tone: "톤",
    structureProposal: [{ id: "c1", title: "도입", synopsis: "처음" }],
    transcript: [
      { id: "m1", stage: "motive", role: "user", content: "동기 메시지", createdAt: "2026-01-01T00:00:00Z" },
      { id: "m2", stage: "audience-message", role: "assistant", content: "독자 질문", createdAt: "2026-01-01T00:01:00Z" },
      { id: "m3", stage: "tone", role: "user", content: "톤 메시지", createdAt: "2026-01-01T00:02:00Z" },
      { id: "m4", stage: "structure-pick", role: "user", content: "구조 메시지", createdAt: "2026-01-01T00:03:00Z" },
    ],
    completedAt: "2026-01-01T00:04:00Z",
  } as unknown as WizardSummary;
}

describe("PlanningMdWriter transcript stage round-trip", () => {
  it("모든 4단계의 전사 메시지 stage가 serialize→parse 후 보존된다 (structure-pick 포함)", () => {
    const summary = summaryWithTranscript();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: "stage-rt" });
    const parsed = PlanningMdWriter.parse(md);

    expect(parsed).not.toBeNull();
    expect(parsed!.transcript.map((m) => m.stage)).toEqual([
      "motive",
      "audience-message",
      "tone",
      "structure-pick",
    ]);
  });

  it("structure-pick 메시지가 motive로 오복원되지 않는다 (버그 회귀 가드)", () => {
    const summary = summaryWithTranscript();
    const md = PlanningMdWriter.serialize(summary, { projectSlug: "stage-rt" });
    const parsed = PlanningMdWriter.parse(md);
    const last = parsed!.transcript[parsed!.transcript.length - 1];
    expect(last.stage).toBe("structure-pick");
    expect(last.content).toBe("구조 메시지");
  });
});
