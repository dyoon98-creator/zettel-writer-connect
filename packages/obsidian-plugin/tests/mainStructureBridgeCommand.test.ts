// Source-contract test: verifies that main.ts registers the W1 import command.
// Uses fs.readFileSync because main.ts transitively imports TSX React files
// that require the jsx compiler option — not available in the test tsconfig.

import * as fs from "fs";
import * as path from "path";

const mainSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/main.ts"),
  "utf8",
);

describe("main.ts — W1 import-active-structure-note command", () => {
  it("contains command id import-active-structure-note", () => {
    expect(mainSrc).toContain("import-active-structure-note");
  });

  it("contains Korean command name", () => {
    expect(mainSrc).toContain("현재 구조노트를 원고 프로젝트로 가져오기");
  });

  it("imports parseStructureNote from structureBridge", () => {
    expect(mainSrc).toMatch(/import.*parseStructureNote.*structureBridge/);
  });

  it("imports createWritingProjectFromHandoff from structureBridge", () => {
    expect(mainSrc).toMatch(
      /import[\s\S]*createWritingProjectFromHandoff[\s\S]*structureBridge/,
    );
  });

  it("handles missing active file (safe no-op path)", () => {
    // The callback should call getActiveFile() and handle null.
    expect(mainSrc).toContain("getActiveFile");
  });

  it("checks path is under 3.Structure", () => {
    expect(mainSrc).toMatch(/3\.Structure|3\\.Structure/);
  });
});

describe("main.ts — W3 writing-handoff JSON command", () => {
  it("contains command id import-writing-handoff-json", () => {
    expect(mainSrc).toContain("import-writing-handoff-json");
  });

  it("contains Korean command name for handoff JSON import", () => {
    expect(mainSrc).toContain("원고실 handoff JSON 가져오기");
  });

  it("reads the singleton handoff path", () => {
    expect(mainSrc).toContain("_index/writing-handoff.json");
    expect(mainSrc).toMatch(/readFile\(WRITING_HANDOFF_JSON_PATH\)/);
  });

  it("imports parseWritingHandoffJson and handles missing JSON safely", () => {
    expect(mainSrc).toMatch(/import[\s\S]*parseWritingHandoffJson[\s\S]*structureBridge/);
    expect(mainSrc).toContain("handoff JSON을 읽을 수 없습니다");
  });
});
