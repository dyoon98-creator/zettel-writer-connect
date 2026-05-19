import { buildChatPrompt } from "../../src/studio/ai/streamingChat";

describe("buildChatPrompt", () => {
  it("serializes notesContext predictably inside the system block", () => {
    const prompt = buildChatPrompt({
      systemPrompt: "system base",
      notesContext: "NOTE A\nNOTE B",
      messages: [{ role: "user", content: "draft" }],
    });

    expect(prompt).toContain("<system>\nsystem base");
    expect(prompt).toContain("## 참고 노트 (옵시디언 볼트)\nNOTE A\nNOTE B");
    expect(prompt.indexOf("NOTE A")).toBeLessThan(prompt.indexOf("<user>"));
  });
});
