// WizardEngine — 마법사 인터뷰의 순수 상태 머신.
//
// 이 클래스는 IO 가 없다. 파일 시스템도, AI 호출도, 타이머도 모른다.
// 단계 전이 / 메시지 누적 / 단계 종료 / 회귀 / 진척도 / 최종 요약만 책임진다.
// AI 측 작업은 WizardConductor 가, 파일 작성은 wizardSeed 가 맡는다.

import type { Genre } from "../types";
import {
  STAGE_LABEL_KO,
  StageOutcome,
  WIZARD_STAGES,
  WizardMessage,
  WizardMessageRole,
  WizardSession,
  WizardStageId,
  WizardSummary,
} from "./types";

let messageCounter = 0;
function genMessageId(): string {
  messageCounter += 1;
  const ts = Date.now().toString(36);
  return `${ts}-m${messageCounter.toString(36)}`;
}

let sessionCounter = 0;
function genSessionId(): string {
  sessionCounter += 1;
  const ts = Date.now().toString(36);
  return `${ts}-w${sessionCounter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStages(initialActive: WizardStageId): Record<WizardStageId, StageOutcome> {
  const out = {} as Record<WizardStageId, StageOutcome>;
  for (const s of WIZARD_STAGES) {
    out[s] = { stage: s, status: s === initialActive ? "active" : "pending" };
  }
  return out;
}

export class WizardEngine {
  private _session: WizardSession;

  constructor(initial?: Partial<WizardSession>) {
    const id = initial?.id ?? genSessionId();
    const start = initial?.startedAt ?? nowIso();
    const currentStage = initial?.currentStage ?? "motive";
    this._session = {
      id,
      startedAt: start,
      updatedAt: initial?.updatedAt ?? start,
      draftTitle: initial?.draftTitle,
      draftGenre: initial?.draftGenre,
      currentStage,
      stages: initial?.stages ?? emptyStages(currentStage),
      messages: initial?.messages ? [...initial.messages] : [],
    };
  }

  get session(): WizardSession {
    return this._session;
  }

  /** 외부에서 부분 업데이트가 필요한 경우 (제목 / 장르 등). */
  setDraftTitle(title: string): void {
    this._session = { ...this._session, draftTitle: title, updatedAt: nowIso() };
  }
  setDraftGenre(genre: Genre): void {
    this._session = { ...this._session, draftGenre: genre, updatedAt: nowIso() };
  }

  /**
   * 특정 단계를 active 로 만든다. 이미 complete 인 단계는 active 로 되돌리며
   * (회귀 흐름과 동일), 다른 active 단계가 있다면 pending 으로 양보한다.
   */
  startStage(stage: WizardStageId): void {
    if (!WIZARD_STAGES.includes(stage)) {
      throw new Error(`WizardEngine.startStage: unknown stage ${stage}`);
    }
    const stages = { ...this._session.stages };
    for (const s of WIZARD_STAGES) {
      const cur = stages[s];
      if (s === stage) {
        stages[s] = { ...cur, status: "active" };
      } else if (cur.status === "active") {
        // 다른 단계가 active 였다면 pending 으로 양보 (이미 complete 였던 단계는 그대로).
        stages[s] = { ...cur, status: "pending" };
      }
    }
    this._session = {
      ...this._session,
      stages,
      currentStage: stage,
      updatedAt: nowIso(),
    };
  }

  /**
   * 현재 단계(또는 명시적 stage)에 메시지를 추가하고 그 메시지를 반환한다.
   * 이 메서드는 시스템/사용자/어시스턴트 모두에 사용된다.
   */
  addMessage(
    role: WizardMessageRole,
    content: string,
    stage?: WizardStageId,
  ): WizardMessage {
    const msg: WizardMessage = {
      id: genMessageId(),
      stage: stage ?? this._session.currentStage,
      role,
      content,
      createdAt: nowIso(),
    };
    this._session = {
      ...this._session,
      messages: [...this._session.messages, msg],
      updatedAt: msg.createdAt,
    };
    return msg;
  }

  /** 단계 종료 시 호출. summary / decisions 를 기록하고 status 를 complete 로 바꾼다. */
  completeStage(
    stage: WizardStageId,
    summary: string,
    decisions?: Record<string, string>,
  ): void {
    if (!WIZARD_STAGES.includes(stage)) {
      throw new Error(`WizardEngine.completeStage: unknown stage ${stage}`);
    }
    const cur = this._session.stages[stage];
    const next: StageOutcome = {
      stage,
      status: "complete",
      summary,
      decisions: decisions ? { ...decisions } : cur.decisions,
    };
    const stages = { ...this._session.stages, [stage]: next };
    this._session = { ...this._session, stages, updatedAt: nowIso() };
  }

  /** 종료된 단계를 다시 active 로 되돌린다 (사이드바 재방문). */
  revisitStage(stage: WizardStageId): void {
    if (!WIZARD_STAGES.includes(stage)) {
      throw new Error(`WizardEngine.revisitStage: unknown stage ${stage}`);
    }
    this.startStage(stage);
  }

  /** 다음 단계로 갈 조건이 충족되었는지. */
  canAdvance(): boolean {
    const cur = this._session.stages[this._session.currentStage];
    return cur.status === "complete";
  }

  /**
   * 현재 단계가 완료된 경우 다음 단계로 진행. 마지막(tone) 까지 완료되었으면 null 반환.
   * `currentStage` 도 함께 갱신.
   */
  advance(): WizardStageId | null {
    if (!this.canAdvance()) return null;
    const idx = WIZARD_STAGES.indexOf(this._session.currentStage);
    if (idx === -1 || idx === WIZARD_STAGES.length - 1) return null;
    const next = WIZARD_STAGES[idx + 1];
    this.startStage(next);
    return next;
  }

  /** 진척도. complete 단계 수 / 전체 단계 수 (현재 정의에 따라 동적). */
  getProgress(): { complete: number; total: number } {
    let n = 0;
    for (const s of WIZARD_STAGES) {
      if (this._session.stages[s].status === "complete") n += 1;
    }
    return { complete: n, total: WIZARD_STAGES.length };
  }

  /** 모든 단계가 complete 인지. */
  isFullyComplete(): boolean {
    return this.getProgress().complete === WIZARD_STAGES.length;
  }

  /**
   * 모든 단계 complete 된 경우 최종 요약을 반환한다. 부족하면 throw.
   * `structureProposal` 은 구조 템플릿(별도 단계) 또는 wizardSeed 의 fallback 으로 채워진다.
   */
  finalize(structureProposal?: WizardSummary["structureProposal"]): WizardSummary {
    if (!this.isFullyComplete()) {
      const pending = WIZARD_STAGES.filter(
        (s) => this._session.stages[s].status !== "complete",
      ).map((s) => STAGE_LABEL_KO[s]);
      throw new Error(
        `WizardEngine.finalize: 모든 단계가 완료되지 않았습니다 — 남은 단계: ${pending.join(", ")}`,
      );
    }

    const decisionsOf = (s: WizardStageId): Record<string, string> =>
      this._session.stages[s].decisions ?? {};

    const motiveDecisions = decisionsOf("motive");
    const audMsgDecisions = decisionsOf("audience-message");
    const toneDecisions = decisionsOf("tone");

    return {
      sessionId: this._session.id,
      title: this._session.draftTitle?.trim() || "새 원고",
      genre: this._session.draftGenre ?? "investment-strategy-memo",
      motive: motiveDecisions.motive ?? motiveDecisions.summary ?? "",
      targetReader:
        audMsgDecisions.target_reader ??
        audMsgDecisions.reader ??
        "",
      coreMessage:
        audMsgDecisions.core_message ??
        audMsgDecisions.message ??
        audMsgDecisions.summary ??
        "",
      tone:
        toneDecisions.tone ??
        toneDecisions.summary ??
        "",
      structureProposal:
        structureProposal && structureProposal.length > 0
          ? structureProposal.map((s) => ({ ...s }))
          : this.fallbackStructure(),
      transcript: [...this._session.messages],
      completedAt: nowIso(),
    };
  }

  private fallbackStructure(): WizardSummary["structureProposal"] {
    // 압축 인터뷰에는 별도 구조 단계가 없다. 4부 안전망만 반환.
    // (페이즈 3-2 의 구조 템플릿이 도입되면 외부에서 structureProposal 을 주입한다.)
    return [
      { id: "chap-1", title: "도입", synopsis: "" },
      { id: "chap-2", title: "전개", synopsis: "" },
      { id: "chap-3", title: "절정", synopsis: "" },
      { id: "chap-4", title: "결말", synopsis: "" },
    ];
  }
}
