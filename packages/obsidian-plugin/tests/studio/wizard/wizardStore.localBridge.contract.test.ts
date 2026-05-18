// wizardStore.immediateAck.contract.test.ts — source-contract test.
// Proves that sendUserMessage and completeCurrentStage set isAwaitingQuestion: true
// SYNCHRONOUSLY (before any await) so the UI immediately acknowledges user clicks
// and prevents duplicate submissions during CLI round-trip latency.
// Also proves CLIWizardBridge is preserved as the quality path when Codex is configured.

import * as fs from "fs";
import * as path from "path";

const storeSource = fs.readFileSync(
  path.join(__dirname, "../../../src/studio/wizard/wizardStore.ts"),
  "utf8",
);

describe("wizardStore — 즉시 응답 acknowledgment + CLI 품질 경로 보존 (source contract)", () => {
  it("CLIWizardBridge가 여전히 import·instantiate된다 — Codex/CLI 품질 경로 보존", () => {
    expect(storeSource).toContain("CLIWizardBridge");
    expect(storeSource).toContain("new CLIWizardBridge(");
  });

  it("sendUserMessage가 isAwaitingQuestion: true를 동기적으로 set한다 (await 이전)", () => {
    // The set call with isAwaitingQuestion: true must appear before any await
    // in the sendUserMessage implementation block.
    const sendUserMessageMatch = storeSource.match(
      /async sendUserMessage\(content\)([\s\S]*?)(?=async regenerateLast)/,
    );
    expect(sendUserMessageMatch).not.toBeNull();
    const body = sendUserMessageMatch![1];
    const awaitIdx = body.indexOf("await");
    const ackIdx = body.indexOf("isAwaitingQuestion: true");
    expect(ackIdx).toBeGreaterThan(-1);
    expect(ackIdx).toBeLessThan(awaitIdx);
  });

  it("completeCurrentStage가 isAwaitingQuestion: true를 동기적으로 set한다 (await 이전)", () => {
    const completeMatch = storeSource.match(
      /async completeCurrentStage\(\)([\s\S]*?)(?=revisitStage)/,
    );
    expect(completeMatch).not.toBeNull();
    const body = completeMatch![1];
    const awaitIdx = body.indexOf("await");
    const ackIdx = body.indexOf("isAwaitingQuestion: true");
    expect(ackIdx).toBeGreaterThan(-1);
    expect(ackIdx).toBeLessThan(awaitIdx);
  });
});
