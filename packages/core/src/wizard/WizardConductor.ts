// WizardConductor — WizardEngine 과 WizardAIBridge 사이의 조정자.
//
// engine 은 IO 가 없는 순수 상태 머신. bridge 는 비결정적 토큰 스트림을 만든다.
// conductor 는 둘을 연결한다:
//   - askNext(): bridge.askNext() 를 await for-of 로 소비하면서 토큰 콜백을 emit
//   - completeCurrentStage(): bridge.summarize("stage") → engine.completeStage()
//   - finalize(): bridge.summarize("final") → engine.finalize() 에 structure 전달

import type { WizardEngine } from "./WizardEngine";
import type {
  WizardMessage,
  WizardSession,
  WizardStageId,
  WizardSummary,
} from "./types";

export interface WizardSummarizeResult {
  summary: string;
  decisions: Record<string, string>;
  /** "final" 모드일 때만 채워진다. */
  structure?: WizardSummary["structureProposal"];
}

/**
 * AI 측 어댑터의 인터페이스. Phase E 에서는 MockWizardBridge 만 구현되며,
 * Phase F 에서 실제 CLI 어댑터로 교체된다.
 */
/**
 * 마법사가 사용자에게 던지는 한 개의 질문.
 *
 * - format: "choice" → 라디오 객관식 (5지선다 권장). 마지막 항목은 항상 "기타(직접 입력)" 같이
 *   직접 입력 fallback 으로 처리한다.
 * - format: "open" → 단답/서술 주관식 (textarea).
 *
 * 각 단계는 5개 객관식 + 1개 주관식 (마지막 turn) 패턴이 권장된다.
 * intro 는 직전 사용자 답변에 대한 한 줄 인용/공감 — 핸드오프 자연스럽게.
 */
export interface WizardQuestion {
  /** 화면에 굵게 보여줄 질문 본문. */
  question: string;
  /** 선택형/주관식 구분. */
  format: "choice" | "open";
  /** choice 일 때만. 5개 권장. 마지막 옵션은 "기타" 류일 수 있다. */
  options?: string[];
  /** 직전 답변 인용/공감/핸드오프 멘트. 첫 질문이면 빈 문자열. */
  intro?: string;
  /** 작가가 자유 텍스트도 함께 입력 가능한지 (choice 에서 "기타" 슬롯 활성화 등). */
  allow_other?: boolean;
}

export interface WizardAIBridge {
  /**
   * (Legacy) 다음 질문 / 안내를 토큰 단위로 흘려보낸다. 자유형 텍스트.
   * 이전 Phase E 흐름. CLIWizardBridge / 신규 UI 는 askNextQuestion 을 우선 사용.
   * 호환을 위해 인터페이스에 남는다.
   */
  askNext(
    session: WizardSession,
    opts?: { signal?: AbortSignal },
  ): AsyncIterable<string>;

  /**
   * 현재 단계의 다음 질문을 구조화된 객체로 받는다.
   * 객관식 5 + 주관식 1 형태로 작가에게 묻는 것이 기본 패턴.
   * 구현이 없으면 wizardStore 가 askNext (텍스트 스트림) 로 fallback.
   */
  askNextQuestion?(
    session: WizardSession,
    opts?: { signal?: AbortSignal },
  ): Promise<WizardQuestion>;

  /**
   * 현재 단계 또는 전체 세션을 요약. mode === "stage" 면 현재 단계만, "final" 이면
   * 전체. summarize 는 즉시 완성된 객체를 반환한다 (스트리밍 아님).
   */
  summarize(
    session: WizardSession,
    mode: "stage" | "final",
  ): Promise<WizardSummarizeResult>;
}

export interface ConductorOptions {
  /** 토큰이 한 chunk 도착할 때마다 호출. 누적 텍스트도 함께 전달. */
  onToken?: (chunk: string, accumulated: string) => void;
  /** abort 용 signal. */
  signal?: AbortSignal;
}

export class WizardConductor {
  constructor(
    private readonly engine: WizardEngine,
    private readonly bridge: WizardAIBridge,
  ) {}

  /**
   * bridge.askNext() 를 흘려보내 받은 모든 토큰을 합쳐 한 개의 assistant 메시지로
   * engine 에 추가한다. 메시지가 추가된 후 그 메시지를 반환한다.
   * 토큰이 한 개도 없을 때는 빈 문자열로 메시지를 추가한다.
   */
  async runAskNext(opts?: ConductorOptions): Promise<WizardMessage> {
    let acc = "";
    const session = this.engine.session;
    for await (const chunk of this.bridge.askNext(session, {
      signal: opts?.signal,
    })) {
      if (opts?.signal?.aborted) {
        // chunk 가 도착했더라도 aborted 면 더 이상 누적하지 않는다.
        break;
      }
      acc += chunk;
      opts?.onToken?.(chunk, acc);
    }
    return this.engine.addMessage("assistant", acc);
  }

  /** 현재 단계를 닫는다. summarize → engine.completeStage. */
  async completeCurrentStage(): Promise<{
    stage: WizardStageId;
    summary: string;
    decisions: Record<string, string>;
  }> {
    const stage = this.engine.session.currentStage;
    const out = await this.bridge.summarize(this.engine.session, "stage");
    this.engine.completeStage(stage, out.summary, out.decisions);
    return { stage, summary: out.summary, decisions: out.decisions };
  }

  /**
   * 모든 단계가 끝났을 때 호출 — 최종 요약을 받고 engine.finalize 에 넘겨
   * WizardSummary 를 만들어 반환한다.
   */
  async finalize(): Promise<WizardSummary> {
    const out = await this.bridge.summarize(this.engine.session, "final");
    return this.engine.finalize(out.structure);
  }
}
