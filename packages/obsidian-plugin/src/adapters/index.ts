// Adapter barrel — 작업실 UI 가 Tauri 의존성 대신 임포트할 옵시디언 어댑터.

export { electronAvailable, electronRequire } from "./electronBridge";
export {
  type AppSettings,
  type AIProvider,
  DEFAULT_APP_SETTINGS,
  ObsidianAppSettingsStore,
} from "./appSettings";
export { findBinary } from "./findBinary";
export { ObsidianVoiceFs, type VoiceFsOptions } from "./voiceFs";
export { ObsidianVaultBinaryHelper } from "./vaultBinary";
export {
  type StartAiInvocationInput,
  type AiInvocationResult,
  type AiInvocationError,
  type StreamingHandle,
  startAiInvocation,
} from "./aiBridge";
