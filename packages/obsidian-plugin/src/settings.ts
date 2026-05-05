// settings.ts — minimal settings for the slim v2 plugin.
//
// Phase G: only the writing folder root is configurable. AI/skillpack/license
// settings moved to the Tauri desktop app — they have no place in the
// indexer.

import { App, PluginSettingTab, Setting } from "obsidian";
import type AIManuscriptStudioPlugin from "./main";

export interface AIManuscriptStudioSettings {
  /** Vault-relative folder containing per-project subfolders. */
  writingFolder: string;
}

export const OBSIDIAN_SETTINGS_DEFAULTS: AIManuscriptStudioSettings = {
  writingFolder: "3 Writing",
};

export class AIManuscriptStudioSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: AIManuscriptStudioPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI 원고실 — 인덱서 설정" });
    containerEl.createEl("p", {
      text: "이 플러그인은 원고 목록만 보여줍니다. 원고 작성·AI 액션·스킬팩은 별도 데스크톱 앱(AI 원고실)에서 진행됩니다.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("원고 폴더")
      .setDesc("프로젝트 폴더(`project.json` 포함)들이 들어 있는 상위 폴더")
      .addText((t) =>
        t
          .setPlaceholder("3 Writing")
          .setValue(this.plugin.settings.writingFolder)
          .onChange(async (v) => {
            this.plugin.settings.writingFolder = v.trim() || "3 Writing";
            await this.plugin.saveSettings();
          }),
      );
  }
}
