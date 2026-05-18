// RED source-contract: Step2Concept.tsx must use buildConceptSystemPrompt
// (genre/tone-aware) instead of static CONCEPT_STAGE_SYSTEM_PROMPT.

import * as fs from "fs";
import * as path from "path";

const STEP2_PATH = path.resolve(
  __dirname,
  "../../../src/studio/wizard/concept/Step2Concept.tsx",
);

describe("Step2Concept.tsx — system prompt 계약", () => {
  let src: string;
  beforeAll(() => {
    src = fs.readFileSync(STEP2_PATH, "utf-8");
  });

  it("buildConceptSystemPrompt 를 임포트한다", () => {
    expect(src).toContain("buildConceptSystemPrompt");
  });

  it("systemPrompt 에 CONCEPT_STAGE_SYSTEM_PROMPT 를 직접 전달하지 않는다 (genre-aware builder 사용)", () => {
    // systemPrompt: CONCEPT_STAGE_SYSTEM_PROMPT should not appear (use buildConceptSystemPrompt instead)
    expect(src).not.toMatch(/systemPrompt\s*:\s*CONCEPT_STAGE_SYSTEM_PROMPT/);
  });

  it("callAI 또는 runAI 에서 session 이 buildConceptSystemPrompt 에 전달된다", () => {
    expect(src).toMatch(/buildConceptSystemPrompt\s*\(\s*session\s*\)/);
  });
});
