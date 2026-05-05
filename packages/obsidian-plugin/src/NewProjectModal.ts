// NewProjectModal.ts — 인덱서 사이드바에서 새 원고를 빠르게 만들기 위한 모달.
// v2 의 의도는 "깊은 작업은 데스크톱 앱"이지만, 옵시디언에서 빈 프로젝트 폴더를
// 한 번에 시드해 두면 카드가 등장하므로 흐름이 빨라진다.

import { App, Modal, Setting } from "obsidian";

export type NewProjectGenre =
  | "essay"
  | "practical"
  | "youtube"
  | "lecture"
  | "world";

export const GENRE_LABEL_KO: Record<NewProjectGenre, string> = {
  essay: "에세이",
  practical: "실용서",
  youtube: "유튜브 대본",
  lecture: "강의안",
  world: "세계관/웹소설",
};

export interface NewProjectInput {
  title: string;
  genre: NewProjectGenre;
  wordGoal: number;
  openInApp: boolean;
}

export class NewProjectModal extends Modal {
  private title = "";
  private genre: NewProjectGenre = "essay";
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
      text: "프로젝트 폴더와 빈 binder/planning 파일이 만들어집니다. 깊은 마법사 인터뷰는 데스크톱 앱에서 진행하세요.",
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
        this.genre = v as NewProjectGenre;
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
      .setName("만든 뒤 데스크톱 앱에서 열기")
      .setDesc("URL scheme 으로 'AI 원고실' 앱이 그 프로젝트로 부팅됩니다.")
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
