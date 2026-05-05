// tauriAIBridge.ts — `LocalAIBridge` (core 인터페이스) 의 Tauri 구현.
//
// Phase A의 Node-only 어댑터(CodexCLIAdapter / ClaudeCodeAdapter)를 대체하여,
// `ResultPipeline` 이 데스크톱 앱에서 그대로 동작하게 만든다. 토큰 스트리밍은
// streamingHandle 이 처리하고, 이 어댑터는 invoke()의 단일 응답 (`AIResult`)
// 만 반환한다. ResultPipeline은 스트리밍이 필요 없는 경우 (확인 모달용 임시
// 호출 등) 에 이 어댑터를 사용한다.

import { invoke } from "@tauri-apps/api/core";
import {
  AIBridgeInvocationError,
  type AIInvokeContext,
  type AIProviderId,
  type AIResult,
  type LocalAIBridge,
} from "@ai-manuscript-studio/core";

import { startAiInvocation } from "./streamingHandle";

export interface TauriAIBridgeOptions {
  providerId: AIProviderId;
  /** UI에 표시될 한국어 어댑터 이름. */
  displayName: string;
  /** 사용자 설정에서 받은 절대 경로 또는 PATH 검색 가능한 명령. */
  binaryPath: string;
  /** "--model gpt-5 --foo bar" 형식. (공백 구분) */
  extraArgs: string;
  /** 기본 60초. */
  timeoutSecs?: number;
}

function splitArgs(s: string): string[] {
  return s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export class TauriAIBridge implements LocalAIBridge {
  readonly id: AIProviderId;
  readonly displayName: string;
  private cachedAvailable: boolean | null = null;
  private cachedAt = 0;

  constructor(private opts: TauriAIBridgeOptions) {
    this.id = opts.providerId;
    this.displayName = opts.displayName;
  }

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedAvailable !== null && now - this.cachedAt < 5_000) {
      return this.cachedAvailable;
    }
    this.cachedAt = now;
    const trimmed = this.opts.binaryPath.trim();
    if (!trimmed) {
      this.cachedAvailable = false;
      return false;
    }
    try {
      const ok = await invoke<boolean>("ai_resolve_binary", {
        binaryPath: trimmed,
      });
      this.cachedAvailable = ok;
      return ok;
    } catch {
      this.cachedAvailable = false;
      return false;
    }
  }

  async invoke(ctx: AIInvokeContext): Promise<AIResult> {
    const handle = startAiInvocation({
      provider: this.id,
      binaryPath: this.opts.binaryPath,
      extraArgs: splitArgs(this.opts.extraArgs),
      prompt: ctx.prompt,
      timeoutSecs: this.opts.timeoutSecs ?? 60,
      signal: ctx.signal,
    });

    try {
      const result = await handle.done;
      return {
        text: result.fullText,
        durationMs: result.durationMs,
        exitCode: result.exitCode,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // signal에 의해 abort 된 경우 우선.
      if (ctx.signal?.aborted) {
        throw new AIBridgeInvocationError({
          kind: "aborted",
          message: msg || "사용자가 취소했습니다.",
        });
      }
      // stderr가 따라오면 exit, 아니면 spawn 등으로 분류.
      // 우리는 streamingHandle이 던지는 메시지에 "시간 초과", "프로세스 시작 실패",
      // "CLI 종료 코드" 패턴이 있으므로 분기.
      if (/시간 초과/.test(msg)) {
        throw new AIBridgeInvocationError({
          kind: "timeout",
          message: msg,
          durationMs: 0,
        });
      }
      if (/CLI 종료 코드/.test(msg)) {
        throw new AIBridgeInvocationError({
          kind: "exit",
          message: msg,
          exitCode: -1,
          stderrTail: (e as { stderr?: string }).stderr ?? "",
        });
      }
      throw new AIBridgeInvocationError({
        kind: "spawn",
        message: msg,
      });
    }
  }
}
