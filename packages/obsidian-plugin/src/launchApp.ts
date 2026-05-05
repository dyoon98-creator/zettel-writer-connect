// launchApp.ts — fires the `ai-manuscript-studio://` URL scheme to bring
// the desktop app to focus on a specific project.
//
// Strategy:
//   1. Try Electron's `shell.openExternal` (Obsidian desktop is Electron).
//   2. Fall back to `window.open(url, "_blank")` — the OS's URL handler
//      registry will catch it.
// If neither path works the caller's NoticeAdapter surfaces a friendly
// install-prompt message.

import type { NoticeAdapter } from "@ai-manuscript-studio/core/adapters";

export interface LaunchAppOptions {
  vaultPath: string;
  /**
   * vault 기준 상대 폴더 경로 (예: "3 Writing/ai-시대에-신입이-해야할-일").
   * 옛날 단일 slug 도 호환을 위해 받지만, 데스크톱 앱은 폴더 경로를 기대한다.
   */
  projectFolder: string;
  notice?: NoticeAdapter;
}

export function buildLaunchUrl(
  vaultPath: string,
  projectFolder: string,
): string {
  const v = encodeURIComponent(vaultPath);
  const p = encodeURIComponent(projectFolder);
  return `ai-manuscript-studio://open?vault=${v}&project=${p}`;
}

export function launchApp(opts: LaunchAppOptions): void {
  const { vaultPath, projectFolder, notice } = opts;
  const url = buildLaunchUrl(vaultPath, projectFolder);

  // 1) Electron shell — preferred, no popup blocker risk.
  try {
    const req = (window as unknown as { require?: (m: string) => unknown })
      .require;
    if (typeof req === "function") {
      const electron = req("electron") as { shell?: { openExternal?: (u: string) => void } };
      if (electron?.shell?.openExternal) {
        electron.shell.openExternal(url);
        return;
      }
    }
  } catch {
    // fall through
  }

  // 2) Browser fallback. Some Electron contexts leak window.open through.
  try {
    const opened = window.open(url, "_blank");
    if (opened) return;
  } catch {
    // fall through
  }

  notice?.error(
    "원고실 앱이 설치되어 있지 않거나 URL 핸들러가 등록되지 않았습니다.",
  );
}
