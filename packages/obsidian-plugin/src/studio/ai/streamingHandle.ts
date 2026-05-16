// streamingHandle.ts (옵시디언 shim) — adapters/aiBridge 를 그대로 re-export.
// desktop UI 가 `import { startAiInvocation } from "../ai/streamingHandle"`
// 형태로 호출하는데, 동일 시그니처를 보존한다.

export {
  startAiInvocation,
  type StartAiInvocationInput,
  type AiInvocationResult,
  type AiInvocationError,
  type StreamingHandle,
} from "../../adapters/aiBridge";
