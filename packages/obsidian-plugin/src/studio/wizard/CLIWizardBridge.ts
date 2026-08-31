// CLIWizardBridge.ts — `WizardAIBridge` 의 production 구현 (Phase F).
//
// MockWizardBridge 의 자리를 대신하며 실제 CLI(codex / claude) 를 spawn하여
// 토큰 스트림을 받는다. summarize 는 단일 응답을 받아 JSON 파싱.
// 파싱 실패 시 MockWizardBridge.summarize 로 fallback.

import { MockWizardBridge } from "@ai-manuscript-studio/core";
import type {
  WizardAIBridge,
  WizardQuestion,
  WizardSession,
  WizardStageId,
  WizardSummarizeResult,
} from "@ai-manuscript-studio/core";
import { tauriNoticeAdapter } from "../noticeAdapter";

import { startAiInvocation, type AiInvocationResult } from "../ai/streamingHandle";
// 실패 «종류» 체계는 adapters/aiBridge 가 정본이다(읽기 전용으로 가져다 쓴다).
// 문면("사용자가 취소했습니다")으로 갈래를 판단하면 문면이 바뀌는 날 조용히 깨진다.
import { readAiFailureKind } from "../../adapters/aiBridge";
// 이어받기 문자열은 순수 계산이라 별도 모듈이 정본이다.
// (이 파일은 `?raw` import 때문에 jest 가 못 읽는다 — 그래서 못 박을 수가 없다.)
import { buildStructuredHandoff } from "./wizardHandoff";

// 빌드 시 raw import — vite의 ?raw suffix 사용.
import motivePrompt from "./prompts/motive.md?raw";
import audienceMessagePrompt from "./prompts/audience-message.md?raw";
import tonePrompt from "./prompts/tone.md?raw";
import structurePickPrompt from "./prompts/structure-pick.md?raw";
import stageSummaryPrompt from "./prompts/stage-summary.md?raw";
import finalSummaryPrompt from "./prompts/final-summary.md?raw";

const STAGE_PROMPT: Record<WizardStageId, string> = {
  motive: motivePrompt,
  "audience-message": audienceMessagePrompt,
  tone: tonePrompt,
  "structure-pick": structurePickPrompt,
};

const STAGE_LABEL: Record<WizardStageId, string> = {
  motive: "동기(글을 쓰게 된 계기)",
  "audience-message": "독자·메시지",
  tone: "톤",
  "structure-pick": "글 구조",
};

const STAGE_DECISION_KEY: Record<WizardStageId, string> = {
  motive: "motive",
  "audience-message": "target_reader+core_message",
  tone: "tone",
  "structure-pick": "structure_template",
};

export interface CLIWizardBridgeOptions {
  provider: "codex" | "claude-code";
  binaryPath: string;
  extraArgs: string;
  timeoutSecs?: number;
  /** summarize 결과 JSON 파싱 실패 시 사용할 fallback bridge. */
  fallback?: WizardAIBridge;
}

function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function transcriptText(session: WizardSession): string {
  if (session.messages.length === 0) return "(아직 메시지가 없습니다)";
  return session.messages
    .map((m) => `[${m.stage}/${m.role}] ${m.content}`)
    .join("\n");
}

function userTurnCount(session: WizardSession, stage: WizardStageId): number {
  return session.messages.filter(
    (m) => m.role === "user" && m.stage === stage,
  ).length;
}

function userAnswers(session: WizardSession, stage: WizardStageId): string {
  const lines = session.messages
    .filter((m) => m.role === "user" && m.stage === stage)
    .map((m, i) => `${i + 1}. ${m.content.trim()}`);
  return lines.length > 0 ? lines.join("\n") : "(없음)";
}

/** {{name}} placeholder 치환 — 누락 시 빈 문자열. */
function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) =>
    key in values ? values[key] : "",
  );
}

/** AI 응답 텍스트에서 첫 JSON 객체를 추출. ```json fence 도 허용. */
function extractJsonObject(text: string): unknown | null {
  // 1. fenced code block 먼저 시도
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* try next */
    }
  }
  // 2. {로 시작하는 첫 블록 찾기
  const start = text.indexOf("{");
  if (start === -1) return null;
  // greedy: 마지막 } 까지 시도
  for (let end = text.lastIndexOf("}"); end > start; end -= 1) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }
  return null;
}

export class CLIWizardBridge implements WizardAIBridge {
  private readonly fallback: WizardAIBridge;

  constructor(private opts: CLIWizardBridgeOptions) {
    this.fallback = opts.fallback ?? new MockWizardBridge();
  }

  async *askNext(
    session: WizardSession,
    opts?: { signal?: AbortSignal },
  ): AsyncIterable<string> {
    const stage = session.currentStage;
    const prompt = render(STAGE_PROMPT[stage], {
      transcript: transcriptText(session),
      stage_user_turn_count: String(userTurnCount(session, stage)),
      stage_id: stage,
      stage_label: STAGE_LABEL[stage],
      structured_handoff: buildStructuredHandoff(session),
    });

    const handle = startAiInvocation({
      provider: this.opts.provider,
      binaryPath: this.opts.binaryPath,
      extraArgs: splitArgs(this.opts.extraArgs),
      prompt,
      timeoutSecs: this.opts.timeoutSecs ?? 180,
      signal: opts?.signal,
    });

    try {
      for await (const tok of handle.tokens()) {
        if (opts?.signal?.aborted) return;
        yield tok;
      }
      // done이 settle 될 때까지 기다린다 (이미 token loop가 끝났으면 즉시).
      await handle.done.catch(() => {
        /* error는 위에서 throw 되었어야 하지만 안전 가드. */
      });
    } catch (e) {
      // 실패 시 fallback bridge로 다시 시도. 사용자에겐 한 번 알린다.
      tauriNoticeAdapter.warn(
        `AI 호출 실패 — mock으로 대체합니다: ${e instanceof Error ? e.message : String(e)}`,
      );
      for await (const tok of this.fallback.askNext(session, opts)) {
        yield tok;
      }
    }
  }

  /**
   * Codex CLI 에 단일 응답을 받아 JSON 파싱 → WizardQuestion 객체로.
   * 빈 응답 발생 시 1회 자동 재시도 (Pivotrix 패턴).
   * 실패 시 명확한 에러 + 사용자 안내.
   */
  /**
   * 실패 «종류» 에 맞는 다음 행동 한 마디.
   * 종류를 모르면 아무 말도 덧붙이지 않는다 — 틀린 안내는 없느니만 못하다.
   */
  private static hintFor(e: unknown): string {
    switch (readAiFailureKind(e)) {
      case "timeout":
        return " 답이 제한 시간 안에 오지 않았습니다. 잠시 뒤 다시 시도해 주세요.";
      case "no-output":
        return " AI 가 아무 내용도 보내지 않았습니다. 잠시 뒤 다시 시도해 주세요.";
      case "process":
        return " AI 프로그램을 실행하지 못했습니다. 설정 → AI 호출에서 CLI 경로를 확인해 주세요.";
      case "exit":
        return " 설정 → AI 호출의 추가 인자를 확인해 주세요.";
      default:
        return "";
    }
  }

  async askNextQuestion(
    session: WizardSession,
    opts?: { signal?: AbortSignal },
  ): Promise<WizardQuestion> {
    const stage = session.currentStage;
    const prompt = render(STAGE_PROMPT[stage], {
      transcript: transcriptText(session),
      stage_user_turn_count: String(userTurnCount(session, stage)),
      stage_id: stage,
      stage_label: STAGE_LABEL[stage],
      structured_handoff: buildStructuredHandoff(session),
    });

    let result: AiInvocationResult | null = null;
    let lastErr: unknown = null;
    // Codex 가 첫 시도에 빈 응답으로 끝나는 경우가 있어 1회 재시도.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = startAiInvocation({
          provider: this.opts.provider,
          binaryPath: this.opts.binaryPath,
          extraArgs: splitArgs(this.opts.extraArgs),
          prompt,
          timeoutSecs: this.opts.timeoutSecs ?? 180,
          signal: opts?.signal,
        });
        void (async () => {
          try {
            for await (const _ of handle.tokens()) {
              /* discard */
            }
          } catch {
            /* swallow */
          }
        })();
        result = await handle.done;
        if (result.fullText.trim().length > 0) break;
        // 빈 응답 — 재시도.
        if (attempt === 0) {
          tauriNoticeAdapter.warn("Codex 가 빈 응답을 반환했습니다. 재시도합니다…", 4000);
        }
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);

        // ── 끊긴 호출은 재시도 대상이 아니다 ─────────────────────────────
        // (대표 실사용 결함 2026-08-31) 앞선 호출이 끊기면 여기서 「첫 시도 실패
        // — 재시도합니다」를 띄우고 «같은 signal» 로 다시 걸었다. 이미 끊긴
        // signal 이라 두 번째도 즉시 실패하고, 그 결과 아무것도 안 누른 사용자
        // 화면에 「사용자가 취소했습니다」가 세 줄로 쌓였다.
        //
        // 끊김은 실패가 아니라 «중단» 이다. 여기서는 아무 말 없이 그대로
        // 올려 보내고, 그것을 보여줄지 말지는 그 끊김의 이유를 아는 쪽
        // (wizardStore)이 정한다.
        if (readAiFailureKind(e) === "canceled" || opts?.signal?.aborted) {
          throw e;
        }

        // OAuth/인증/네트워크 종류 에러는 retry 가 오히려 토큰을 무효화시킨다
        // (refresh token rotation 시 first-use 가 invalidate 됨). 한 번만
        // 시도하고 사용자에게 명확히 알린다.
        const isAuthError =
          /refresh token|access token|sign in|log out|unauthorized|401/i.test(
            msg,
          );
        if (attempt === 0 && !isAuthError) {
          tauriNoticeAdapter.warn(
            `Codex 첫 시도 실패: ${msg} — 재시도합니다`,
            4000,
          );
          continue;
        }
        if (isAuthError) {
          tauriNoticeAdapter.error(
            `Codex 인증 만료. 터미널에서 \`codex logout && codex login\` 으로 재로그인 후 다시 시도해주세요.`,
            12000,
          );
          throw new Error(`CLI 인증 만료 — ${msg}`);
        }
        // 원인별로 다른 안내를 낸다 — 원인이 무엇이든 「다른 모델을 써 보세요」
        // 라고 하면 사용자를 엉뚱한 곳으로 보낸다.
        tauriNoticeAdapter.error(
          `AI 질문 만들기에 실패했습니다: ${msg}${CLIWizardBridge.hintFor(e)}`,
          10000,
        );
        throw new Error(`CLI 호출 실패 — ${msg}`);
      }
    }

    if (!result || result.fullText.trim().length === 0) {
      const reason =
        lastErr instanceof Error ? lastErr.message : "두 번의 시도 모두 빈 응답";
      tauriNoticeAdapter.error(
        `AI 가 두 번 모두 빈 답을 보냈습니다 (${reason}). 잠시 뒤 다시 시도해 주세요. 계속되면 설정 → AI 호출에서 추가 인자를 확인해 주세요.`,
        10000,
      );
      throw new Error("Codex 빈 응답");
    }

    const parsed = extractJsonObject(result.fullText);
    if (!parsed || typeof parsed !== "object") {
      // JSON 파싱 실패 — 응답 텍스트를 그대로 주관식 question 으로.
      // (silent fallback 아님 — 사용자가 응답을 직접 보고 답하도록.)
      tauriNoticeAdapter.warn(
        "AI 응답을 JSON 으로 받지 못했습니다. 주관식으로 진행합니다.",
        5000,
      );
      return {
        question: result.fullText.trim() || "이 단계의 핵심을 한 문장으로 정리해주세요.",
        format: "open",
        intro: "",
      };
    }

    const r = parsed as Record<string, unknown>;
    const intro = typeof r.intro === "string" ? r.intro : "";
    const question = typeof r.question === "string" ? r.question : "";
    const formatRaw = typeof r.format === "string" ? r.format : "open";
    const format: WizardQuestion["format"] =
      formatRaw === "choice" ? "choice" : "open";
    const optionsRaw = Array.isArray(r.options) ? r.options : [];
    const options = optionsRaw
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      .map((o) => o.trim());

    if (format === "choice" && options.length < 2) {
      // 객관식인데 옵션이 부족하면 주관식으로 강등.
      return { intro, question, format: "open" };
    }
    if (format === "choice") {
      return { intro, question, format: "choice", options };
    }
    return { intro, question, format: "open" };
  }

  async summarize(
    session: WizardSession,
    mode: "stage" | "final",
  ): Promise<WizardSummarizeResult> {
    const stage = session.currentStage;
    const prompt =
      mode === "stage"
        ? render(stageSummaryPrompt, {
            stage_id: stage,
            stage_label: STAGE_LABEL[stage],
            stage_user_answers: userAnswers(session, stage),
            decision_key: STAGE_DECISION_KEY[stage],
          })
        : render(finalSummaryPrompt, {
            transcript: transcriptText(session),
          });

    let result: AiInvocationResult;
    try {
      const handle = startAiInvocation({
        provider: this.opts.provider,
        binaryPath: this.opts.binaryPath,
        extraArgs: splitArgs(this.opts.extraArgs),
        prompt,
        timeoutSecs: this.opts.timeoutSecs ?? 180,
      });
      // 토큰을 누적하지 않아도 done은 fullText를 들고 온다.
      // 다만 tokens()를 소비하지 않으면 큐가 자라기만 하므로 일단 비운다.
      void (async () => {
        try {
          for await (const _ of handle.tokens()) {
            // discard
          }
        } catch {
          /* swallow */
        }
      })();
      result = await handle.done;
    } catch (e) {
      tauriNoticeAdapter.warn(
        `AI 요약 실패 — mock으로 대체합니다: ${e instanceof Error ? e.message : String(e)}`,
      );
      return this.fallback.summarize(session, mode);
    }

    const parsed = extractJsonObject(result.fullText);
    if (!parsed || typeof parsed !== "object") {
      tauriNoticeAdapter.warn("AI 응답을 JSON으로 파싱할 수 없어 mock으로 대체합니다.");
      return this.fallback.summarize(session, mode);
    }
    const r = parsed as Record<string, unknown>;
    const summary = typeof r.summary === "string" ? r.summary : "";
    const decisionsRaw = r.decisions;
    const decisions: Record<string, string> = {};
    if (decisionsRaw && typeof decisionsRaw === "object") {
      for (const [k, v] of Object.entries(decisionsRaw as Record<string, unknown>)) {
        if (typeof v === "string") decisions[k] = v;
      }
    }

    let structure: WizardSummarizeResult["structure"];
    if (mode === "final" && Array.isArray(r.structure)) {
      structure = r.structure
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .map((c, i) => ({
          id: typeof c.id === "string" && c.id ? c.id : `chap-${i + 1}`,
          title: typeof c.title === "string" ? c.title : `장 ${i + 1}`,
          synopsis: typeof c.synopsis === "string" ? c.synopsis : "",
        }));
      if (structure.length === 0) structure = undefined;
    }

    return { summary, decisions, structure };
  }
}

/**
 * 마법사 prompt placeholder 처리 결과를 외부에서 검증 가능하도록 공개.
 * 테스트 / 디버깅용.
 */
export function buildMotivePrompt(session: WizardSession): string {
  const stage = "motive";
  return render(STAGE_PROMPT[stage], {
    transcript: transcriptText(session),
    stage_user_turn_count: String(userTurnCount(session, stage)),
    stage_id: stage,
    stage_label: STAGE_LABEL[stage],
    // 실제 호출(askNext / askNextQuestion)과 같은 값을 넣는다. 빠져 있으면
    // 이 디버깅용 출력만 «다시 묻지 말 것» 블록이 비어 실제와 달라 보인다.
    structured_handoff: buildStructuredHandoff(session),
  });
}
