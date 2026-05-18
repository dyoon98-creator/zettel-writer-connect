// tauriShims/plugin-dialog.ts — `@tauri-apps/plugin-dialog` 의 옵시디언용 stub.
//
// desktop 은 voice 폴더 선택 등에서 OS native file picker 를 띄운다.
// 옵시디언 환경에서는 native dialog 를 지원하지 않으므로 open() 은 null 반환.
// 대신 VoicePane 에서 직접 텍스트 입력 fallback(data-field="voice-folder-input")
// 을 제공하며, 입력값 검증에는 normalizeVoiceFolderInput 을 사용한다.

export interface OpenDialogOptions {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export async function open(
  _opts?: OpenDialogOptions,
): Promise<string | string[] | null> {
  // 옵시디언 환경에서는 native OS picker 미지원 — VoicePane 직접 입력 fallback 사용.
  console.warn(
    "[tauriShims/plugin-dialog] open() 은 옵시디언 환경에서 미지원입니다. VoicePane 의 직접 경로 입력을 사용하세요.",
  );
  return null;
}

// ── Voice folder path validation ─────────────────────────────────────────────

export type VoiceFolderInputResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * 사용자가 직접 입력한 voice 폴더 경로를 검증·정규화한다.
 * 절대 경로(macOS/Linux 또는 Windows)만 허용.
 */
export function normalizeVoiceFolderInput(raw: string): VoiceFolderInputResult {
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { ok: false, error: "경로가 비어 있습니다 (empty)." };
  }

  if (trimmed.includes("\0")) {
    return { ok: false, error: "경로에 허용되지 않는 NUL 문자가 포함되어 있습니다." };
  }

  // Windows absolute: drive letter (C:\...) or UNC (\\server\share)
  const isWindowsAbsolute =
    /^[A-Za-z]:[/\\]/.test(trimmed) || /^\\\\[^\\]/.test(trimmed);

  // Unix/macOS absolute: starts with /
  const isUnixAbsolute = trimmed.startsWith("/");

  if (!isWindowsAbsolute && !isUnixAbsolute) {
    return {
      ok: false,
      error: "절대 경로만 허용됩니다 (absolute path required). 예: /Users/me/voice",
    };
  }

  return { ok: true, path: trimmed };
}
