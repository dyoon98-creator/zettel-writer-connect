// NewProjectModal.ts — 인덱서 사이드바에서 새 원고를 빠르게 만들기 위한 모달.

import { App, Modal, Setting } from "obsidian";
import { type Genre, GENRE_LABEL_KO } from "@ai-manuscript-studio/core/browser";

export type { Genre };
export { GENRE_LABEL_KO };

export interface NewProjectInput {
  title: string;
  genre: Genre;
  wordGoal: number;
  openInApp: boolean;
}

export class NewProjectModal extends Modal {
  private title = "";
  private genre: Genre = "investment-strategy-memo";
  private wordGoal = 3000;
  private openInApp = true;

  constructor(
    app: App,
    private readonly onSubmit: (input: NewProjectInput) => Promise<void> | void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ams-new-project-modal");
    contentEl.createEl("h2", { text: "새 원고 만들기" });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "프로젝트 폴더와 빈 binder/planning 파일이 만들어집니다. 완성 후 Obsidian AI 원고실에서 바로 작업하세요.",
    });

    new Setting(contentEl)
      .setName("제목")
      .setDesc("원고의 가제. 폴더 이름의 slug 가 됩니다.")
      .addText((t) =>
        t
          .setPlaceholder("AI 시대의 작가")
          .onChange((v) => {
            this.title = v.trim();
          }),
      );

    new Setting(contentEl).setName("장르").addDropdown((d) => {
      for (const [k, label] of Object.entries(GENRE_LABEL_KO)) {
        d.addOption(k, label);
      }
      d.setValue(this.genre).onChange((v) => {
        this.genre = v as Genre;
      });
    });

    new Setting(contentEl)
      .setName("목표 글자 수")
      .setDesc("나중에 inspector 에서 변경 가능합니다.")
      .addText((t) =>
        t
          .setPlaceholder("3000")
          .setValue(String(this.wordGoal))
          .onChange((v) => {
            const n = parseInt(v.replace(/[^\d]/g, ""), 10);
            if (Number.isFinite(n) && n > 0) this.wordGoal = n;
          }),
      );

    new Setting(contentEl)
      .setName("만든 뒤 Obsidian 원고실에서 열기")
      .setDesc("프로젝트를 만든 직후 Obsidian AI 원고실 작업실 view 를 엽니다.")
      .addToggle((t) =>
        t.setValue(this.openInApp).onChange((v) => {
          this.openInApp = v;
        }),
      );

    const buttons = contentEl.createDiv({ cls: "ams-modal-buttons" });
    const cancel = buttons.createEl("button", { text: "취소" });
    cancel.addEventListener("click", () => this.close());
    const submit = buttons.createEl("button", {
      text: "만들기",
      cls: "mod-cta",
    });
    submit.addEventListener("click", () => {
      if (!this.title) return;
      void Promise.resolve(
        this.onSubmit({
          title: this.title,
          genre: this.genre,
          wordGoal: this.wordGoal,
          openInApp: this.openInApp,
        }),
      ).then(() => this.close());
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
