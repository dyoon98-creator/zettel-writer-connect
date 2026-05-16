// appSettings.ts — Tauri 의 settings_load / settings_save 를 옵시디언
// plugin.loadData / plugin.saveData 로 대체.
//
// 옵시디언 플러그인의 단일 data.json 안에 두 영역을 분리해 저장한다:
//   - 최상위 키 `writingFolder` — 기존 인덱서 설정 (PluginSetting)
//   - 최상위 키 `app`        — 작업실 (AI / skillpack / license) 설정
// 이 어댑터는 `app` 영역만 읽고 쓴다. 인덱서 설정은 main.ts 의
// loadSettings/saveSettings 가 그대로 처리한다.

import type AIManuscriptStudioPlugin from "../main";

export type AIProvider = "codex" | "claude-code" | "mock";

export interface AppSettings {
  aiProvider: AIProvider;
  codexPath: string;
  codexExtraArgs: string;
  claudeCodePath: string;
  confirmBeforeRun: boolean;
  enableExecLog: boolean;
  excludedFolders: string;
  licenseKey: string;
  skillpackFolder: string;
  useMockBridge: boolean;
  /**
   * 사용자가 지정한 voice (내 문체 학습) 폴더의 절대 경로. 빈 문자열이면
   * default = `<vault>/_attachments/voice`. vault 안의 폴더든 외부든 절대
   * 경로로 보관 (옛 Tauri settings.json 의 `voiceFolder` 와 동일 시맨틱).
   */
  voiceFolder: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  aiProvider: "codex",
  codexPath: "",
  codexExtraArgs: "",
  claudeCodePath: "",
  confirmBeforeRun: true,
  enableExecLog: false,
  excludedFolders: "0 raw,3 Archive",
  licenseKey: "",
  skillpackFolder: "_skillpacks",
  useMockBridge: false,
  voiceFolder: "",
};

export class ObsidianAppSettingsStore {
  constructor(private readonly plugin: AIManuscriptStudioPlugin) {}

  async load(): Promise<AppSettings> {
    const data = (await this.plugin.loadData()) as
      | Record<string, unknown>
      | null;
    const app = (data?.app as Partial<AppSettings> | undefined) ?? {};
    return { ...DEFAULT_APP_SETTINGS, ...app };
  }

  async save(settings: AppSettings): Promise<void> {
    const data =
      ((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
    data.app = settings;
    await this.plugin.saveData(data);
  }
}
