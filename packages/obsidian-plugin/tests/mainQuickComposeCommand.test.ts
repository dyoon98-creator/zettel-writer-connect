// Test that quick-compose-communication command is registered in main.ts.
// We verify via source analysis because main.ts transitively imports React .tsx
// files that require the jsx compiler option — not available in the test tsconfig.

import * as fs from "fs";
import * as path from "path";

const mainSrc = fs.readFileSync(
  path.resolve(__dirname, "../src/main.ts"),
  "utf8",
);

describe("main.ts — quick-compose command declaration", () => {
  it("contains quick-compose-communication command id", () => {
    expect(mainSrc).toContain("quick-compose-communication");
  });

  it("contains command name 즉석 커뮤니케이션 작성", () => {
    expect(mainSrc).toContain("즉석 커뮤니케이션 작성");
  });

  it("imports QuickComposeModal", () => {
    expect(mainSrc).toMatch(/import.*QuickComposeModal.*from.*QuickComposeModal/);
  });

  it("opens QuickComposeModal in the callback", () => {
    expect(mainSrc).toContain("new QuickComposeModal(");
  });
});
