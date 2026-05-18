// Tests that main.ts surfaces the indexer panel automatically on layout ready.
// Source-contract approach: direct importing main.ts pulls .tsx dependencies
// that require jsx compiler option unavailable in tsconfig.test.json.

import * as fs from "fs";
import * as path from "path";

const mainSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/main.ts"),
  "utf8",
);

describe("main.ts — auto-surface indexer on layout ready", () => {
  it("calls onLayoutReady during onload", () => {
    expect(mainSrc).toContain("onLayoutReady");
  });

  it("onLayoutReady callback invokes openIndexer (not gated on active file)", () => {
    // Must reference openIndexer inside or near the onLayoutReady call.
    // A simple check: onLayoutReady and openIndexer both appear, and the
    // call is not behind activeProjectFolder() which requires frontmatter.
    expect(mainSrc).toMatch(/onLayoutReady[\s\S]{0,300}openIndexer/);
  });

  it("openIndexer is called unconditionally (no frontmatter gate) in the layout callback", () => {
    // The layout-ready block must NOT reference activeProjectFolder.
    // We extract the onLayoutReady callback region and confirm it is clean.
    const match = mainSrc.match(/onLayoutReady\s*\(\s*\(\s*\)\s*=>\s*\{?[\s\S]*?\}\s*\)/);
    if (match) {
      expect(match[0]).not.toContain("activeProjectFolder");
      expect(match[0]).not.toContain("getActiveFile");
    } else {
      // Arrow form without braces: onLayoutReady(() => void this.someMethod())
      const arrowMatch = mainSrc.match(/onLayoutReady\s*\([^)]{0,200}\)/);
      expect(arrowMatch).not.toBeNull();
    }
  });

  it("existing open-indexer command and ribbon icon are still present", () => {
    expect(mainSrc).toContain('"open-indexer"');
    expect(mainSrc).toContain("AI 원고실 인덱서 열기");
  });
});
