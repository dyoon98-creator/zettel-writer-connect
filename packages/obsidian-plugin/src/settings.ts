// settings.ts — minimal settings for the slim v2 plugin.
//
// Only the writing folder root is configurable here. AI/skillpack/voice
// settings live in the Obsidian AI 원고실 작업실 view, not in this tab.

import { App, PluginSettingTab, Setting } from "obsidian";
import type AIManuscriptStudioPlugin from "./main";

export interface AIManuscriptStudioSettings {
  /** Vault-relative folder containing per-project subfolders. */
  writingFolder: string;
}

export const OBSIDIAN_SETTINGS_DEFAULTS: AIManuscriptStudioSettings = {
  writingFolder: "4.Writing",
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
      text: "이 플러그인은 원고 목록 인덱싱과 빠른 프로젝트 생성을 제공합니다. 원고 작성·AI 액션·스킬팩은 Obsidian 내 AI 원고실 작업실 view 에서 진행됩니다.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("원고 폴더")
      .setDesc("프로젝트 폴더(`project.json` 포함)들이 들어 있는 상위 폴더")
      .addText((t) =>
        t
          .setPlaceholder("4.Writing")
          .setValue(this.plugin.settings.writingFolder)
          .onChange(async (v) => {
            this.plugin.settings.writingFolder = v.trim() || "4.Writing";
            await this.plugin.saveSettings();
          }),
      );
  }
}
