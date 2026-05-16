// voiceFs.ts — Tauri 의 voice_delete_file / voice_open_folder 를
// 옵시디언 Vault API + Electron shell.openPath 로 대체.

import type { App } from "obsidian";
import { electronRequire } from "./electronBridge";

export interface VoiceFsOptions {
  /** vault 기준 voice 폴더 경로 (예: "_attachments/voice"). */
  voiceFolderRelative: string;
}

export class ObsidianVoiceFs {
  constructor(
    private readonly app: App,
    private readonly opts: VoiceFsOptions,
  ) {}

  /** vault 기준 voiceFolder 안의 파일 이름만 받음 (path traversal 차단). */
  async deleteFile(name: string): Promise<void> {
    if (!name || name.includes("/") || name.includes("..")) {
      throw new Error(`voice 파일 이름이 안전하지 않습니다: ${name}`);
    }
    const rel = `${this.opts.voiceFolderRelative.replace(/\/+$/, "")}/${name}`;
    const exists = await this.app.vault.adapter.exists(rel);
    if (!exists) return;
    await this.app.vault.adapter.remove(rel);
  }

  /** Finder/Explorer 로 voice 폴더 열기 (Electron shell.openPath). */
  async openFolder(): Promise<void> {
    const shell = electronRequire<{
      openPath: (p: string) => Promise<string>;
    }>("electron")
      ? electronRequire<{ shell: { openPath: (p: string) => Promise<string> } }>(
          "electron",
        )?.shell
      : null;
    if (!shell) {
      throw new Error(
        "Electron shell 에 접근할 수 없습니다. (모바일 환경에서는 폴더 열기 미지원)",
      );
    }
    const base = this.getBasePath();
    if (!base) throw new Error("Vault 절대 경로를 알 수 없습니다.");
    const absRoot = `${base}/${this.opts.voiceFolderRelative.replace(/\/+$/, "")}`;
    // 폴더가 없으면 미리 생성.
    const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
      electronRequire<typeof import("fs")>("fs");
    if (fs) {
      try {
        fs.mkdirSync(absRoot, { recursive: true });
      } catch {
        /* race */
      }
    }
    await shell.openPath(absRoot);
  }

  private getBasePath(): string | null {
    const adapter = this.app.vault.adapter as unknown as {
      getBasePath?: () => string;
    };
    return typeof adapter.getBasePath === "function" ? adapter.getBasePath() : null;
  }
}
