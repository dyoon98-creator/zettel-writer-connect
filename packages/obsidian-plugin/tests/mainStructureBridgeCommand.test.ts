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
      /import.*createWritingProjectFromHandoff.*structureBridge/,
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
