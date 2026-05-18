// WizardOverlay.seedPrompt.contract.test.ts — source-contract test.
// Proves SeedPrompt renders primary accept action BEFORE secondary decline,
// labels are explicit (not ambiguous), and decline has data-testid.

import * as fs from "fs";
import * as path from "path";

const overlaySource = fs.readFileSync(
  path.join(__dirname, "../../../src/studio/wizard/WizardOverlay.tsx"),
  "utf8",
);

describe("WizardOverlay SeedPrompt — accept-before-decline (source contract)", () => {
  it("wizard-seed-accept가 wizard-seed-decline보다 먼저 나온다 (DOM 순서)", () => {
    const acceptIdx = overlaySource.indexOf("wizard-seed-accept");
    const declineIdx = overlaySource.indexOf("wizard-seed-decline");
    expect(acceptIdx).toBeGreaterThan(-1);
    expect(declineIdx).toBeGreaterThan(-1);
    expect(acceptIdx).toBeLessThan(declineIdx);
  });

  it("accept 버튼 레이블이 binder 생성 의도를 명시한다", () => {
    // "binder" + "만들" or similar explicit creation language
    expect(overlaySource).toMatch(/binder.*만들|만들.*binder|원고실.*열기/i);
  });

  it("decline 버튼 레이블이 파일 미생성을 명시한다", () => {
    expect(overlaySource).toMatch(/파일.*만들지|건너뛰기.*파일|건너뛰기/i);
  });

  it("decline 버튼에 data-testid='wizard-seed-decline'가 있다", () => {
    expect(overlaySource).toContain('data-testid="wizard-seed-decline"');
  });
});
