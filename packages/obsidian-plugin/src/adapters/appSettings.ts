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
  /**
   * `true`(기본) → codex 호출에 `--ignore-user-config` 를 붙여 사용자의
   * `~/.codex/config.toml` 을 «안 읽는다». 로그인(auth) 은 그대로 유지된다.
   * `false` 로 되돌리면 그 설정 파일이 다시 딸려 들어온다.
   */
  codexIgnoreUserConfig: boolean;
  /**
   * `true`(기본) → codex 호출에 `--disable shell_tool` 을 붙여 셸 도구를 끈다.
   * `false` 로 되돌리면 codex 가 글을 쓰다가도 명령을 실행할 수 있다.
   */
  codexDisableShellTool: boolean;
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
  codexIgnoreUserConfig: true,
  codexDisableShellTool: true,
};

/* ---------------------------------------------------------------------------
 * codex 인자 스위치의 «읽는 쪽»
 *
 * `adapters/aiBridge.buildCodexArgs()` 는 React 트리 밖(모달·백그라운드 호출
 * 포함)에서도 돌고 동기 함수라, zustand store 를 볼 수 없다. 그래서 이 파일이
 * 마지막으로 읽거나 저장한 값을 스냅숏으로 들고 있고 브리지가 그것을 본다.
 *
 * 초기값은 `DEFAULT_APP_SETTINGS` 즉 «플래그가 붙은 상태» 다 — 설정을 아직
 * 못 읽었을 때 남의 짐이 딸려 들어가지 않도록 안전한 쪽으로 기울여 둔다.
 * ------------------------------------------------------------------------- */

/**
 * 필드 이름은 `AppSettings` 의 키와 «글자 그대로» 같게 둔다. 읽는 쪽
 * (`aiBridge.buildCodexArgs`)이 같은 이름을 쓰므로, 설정 키 하나를 grep 하면
 * 저장·표시·읽기 세 자리가 한 번에 잡힌다.
 */
export type CodexArgSettings = Pick<
  AppSettings,
  "codexIgnoreUserConfig" | "codexDisableShellTool"
>;

let codexArgSnapshot: CodexArgSettings = {
  codexIgnoreUserConfig: DEFAULT_APP_SETTINGS.codexIgnoreUserConfig,
  codexDisableShellTool: DEFAULT_APP_SETTINGS.codexDisableShellTool,
};

function rememberCodexArgSettings(s: AppSettings): void {
  // `!== false` — 옛 data.json 에 키가 아예 없으면 `undefined` 가 오는데,
  // 그때는 「플래그가 붙은 상태」(기본값)로 읽는다.
  codexArgSnapshot = {
    codexIgnoreUserConfig: s.codexIgnoreUserConfig !== false,
    codexDisableShellTool: s.codexDisableShellTool !== false,
  };
}

/** `buildCodexArgs` 가 부르는 진입점. 마지막으로 load/save 된 값. */
export function getCodexArgSettings(): CodexArgSettings {
  return codexArgSnapshot;
}

export class ObsidianAppSettingsStore {
  constructor(private readonly plugin: AIManuscriptStudioPlugin) {}

  async load(): Promise<AppSettings> {
    const data = (await this.plugin.loadData()) as
      | Record<string, unknown>
      | null;
    const app = (data?.app as Partial<AppSettings> | undefined) ?? {};
    const merged = { ...DEFAULT_APP_SETTINGS, ...app };
    rememberCodexArgSettings(merged);
    return merged;
  }

  async save(settings: AppSettings): Promise<void> {
    const data =
      ((await this.plugin.loadData()) as Record<string, unknown> | null) ?? {};
    data.app = settings;
    rememberCodexArgSettings(settings);
    await this.plugin.saveData(data);
  }
}
