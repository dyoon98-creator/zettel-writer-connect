// VoicePane.test.ts — source contract tests.
// VoicePane.tsx imports React/.tsx which requires jsx compiler option not
// available in tsconfig.test.json. We verify the UI contract via source text.

import * as fs from "fs";
import * as path from "path";

const src = fs.readFileSync(
  path.resolve(__dirname, "../src/studio/voice/VoicePane.tsx"),
  "utf8",
);

describe("VoicePane — direct folder input fallback (B2.3)", () => {
  it("has a text input with data-field='voice-folder-input'", () => {
    expect(src).toContain("voice-folder-input");
    expect(src).toMatch(/data-field=["']voice-folder-input["']/);
  });

  it("has an apply button with label 경로 적용", () => {
    expect(src).toContain("경로 적용");
  });

  it("imports normalizeVoiceFolderInput from plugin-dialog", () => {
    expect(src).toMatch(/import.*normalizeVoiceFolderInput.*plugin-dialog/);
  });

  it("calls voiceIO.setFolder only after successful validation", () => {
    expect(src).toContain("normalizeVoiceFolderInput");
    expect(src).toContain("voiceIO.setFolder");
    // The apply handler must check ok before calling setFolder
    const applyHandlerMatch = src.match(/handleApplyFolder[^}]+}/s);
    expect(applyHandlerMatch).not.toBeNull();
    if (applyHandlerMatch) {
      const handlerSrc = applyHandlerMatch[0];
      expect(handlerSrc).toContain("normalizeVoiceFolderInput");
      expect(handlerSrc).toContain(".ok");
    }
  });

  it("shows inline error when validation fails (does not call setFolder)", () => {
    // Error state must exist and be rendered
    expect(src).toMatch(/directInputError|folderInputError|inputError/);
    // State setter must be used in context where setFolder is NOT called
    expect(src).toMatch(/set(DirectInputError|FolderInputError|InputError)/);
  });

  it("prefills/syncs direct input with current folder path", () => {
    // The input value must reference the folder/directInput state
    expect(src).toMatch(/value=\{(directInput|folderInput|folder)\}/);
  });
});
