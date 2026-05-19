import {
  buildSelectionPrompt,
  type SelectionActionDef,
} from "../../src/studio/editor/selectionPrompts";

const action: SelectionActionDef = {
  id: "test.selection",
  label: "Test",
  shortLabel: "Test",
  description: "test action",
  icon: "wand",
  saveTo: "feedback",
  promptBody: "선택 텍스트를 검토하세요.",
};

describe("buildSelectionPrompt", () => {
  it("keeps default output free of project/source-note context", () => {
    const prompt = buildSelectionPrompt(action, "선택 본문");

    expect(prompt).toContain("선택 본문");
    expect(prompt).not.toContain("현재 프로젝트 컨텍스트");
    expect(prompt).not.toContain("SOURCE NOTE BODY");
  });

  it("optionally includes current project/source-note context before the selected text", () => {
    const prompt = buildSelectionPrompt(action, "선택 본문", {
      sourceNotesContext: "SOURCE NOTE BODY",
    });

    expect(prompt).toContain("## 현재 프로젝트 컨텍스트");
    expect(prompt).toContain("SOURCE NOTE BODY");
    expect(prompt.indexOf("SOURCE NOTE BODY")).toBeLessThan(prompt.indexOf("선택 본문"));
  });
});
