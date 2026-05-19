jest.mock("../../src/studio/voice/styleGuide", () => ({
  buildSignatures: (files: Array<{ name: string; modifiedMs: number; size: number }>) =>
    files.map((f) => ({ name: f.name, modifiedMs: f.modifiedMs, size: f.size })),
  saveStyleGuide: jest.fn(),
  STYLE_GUIDE_VERSION: 2,
}));

jest.mock("../../src/studio/voice/voiceIO", () => ({
  voiceIO: {
    listFiles: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock("../../src/studio/ai/streamingHandle", () => ({
  startAiInvocation: jest.fn(),
}));

jest.mock("../../src/studio/noticeAdapter", () => ({
  tauriNoticeAdapter: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("../../src/studio/state/settingsStore", () => ({
  useSettingsStore: { getState: jest.fn() },
}));

import { _internal } from "../../src/studio/voice/analyzeStyle";

interface VoiceFileEntry {
  name: string;
  absPath: string;
  modifiedMs: number;
  size: number;
}

function file(name: string, absPath = `/vault/_attachments/voice/${name}`): VoiceFileEntry {
  return { name, absPath, modifiedMs: name.length * 100, size: name.length * 10 };
}

describe("voice corpus exclusion", () => {
  test.each([
    ["unquoted true", "---\nvoice-exclude: true\n---\nbody"],
    ["double quoted true", "---\nvoice-exclude : \"true\"\n---\nbody"],
    ["single quoted true", "---\n voice-exclude: 'true'\n---\nbody"],
  ])("frontmatter %s is excluded", (_label, raw) => {
    expect(_internal.isVoiceExcludedFrontmatter(raw)).toBe(true);
  });

  test.each([
    ["false", "---\nvoice-exclude: false\n---\nbody"],
    ["no frontmatter", "voice-exclude: true\nbody"],
    ["malformed frontmatter", "---\nvoice-exclude: true\nbody"],
  ])("%s is included", (_label, raw) => {
    expect(_internal.isVoiceExcludedFrontmatter(raw)).toBe(false);
  });

  test("excluded markdown files are removed from prompt samples and sample signatures", async () => {
    const files = [file("keep.md"), file("exclude.md"), file("plain.md")];
    const contents: Record<string, string> = {
      [files[0].absPath]: "---\nvoice-exclude: false\n---\nKEEP BODY",
      [files[1].absPath]: "---\nvoice-exclude: true\n---\nEXCLUDED BODY",
      [files[2].absPath]: "PLAIN BODY",
    };

    const includedFiles = await _internal.filterVoiceIncludedFiles(
      files,
      async (absPath) => contents[absPath],
    );
    const samples = await _internal.loadSamples(includedFiles, async (absPath) => contents[absPath]);
    const prompt = _internal.assemblePrompt(samples);

    expect(includedFiles.map((f) => f.name)).toEqual(["keep.md", "plain.md"]);
    expect(prompt).toContain("KEEP BODY");
    expect(prompt).toContain("PLAIN BODY");
    expect(prompt).not.toContain("EXCLUDED BODY");
    // analyzeStyle builds sampleSignatures from this same includedFiles list.
    expect(includedFiles.map((f) => ({ name: f.name, modifiedMs: f.modifiedMs, size: f.size }))).toEqual([
      { name: "keep.md", modifiedMs: 700, size: 70 },
      { name: "plain.md", modifiedMs: 800, size: 80 },
    ]);
  });
});
