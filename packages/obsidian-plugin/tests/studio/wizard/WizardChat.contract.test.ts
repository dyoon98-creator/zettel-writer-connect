// WizardChat.contract.test.ts — source-contract tests for auto-submit click behavior.
//
// RED criteria:
//   - handleChoiceSelect 함수가 존재해야 한다
//   - onSelect={setSelectedChoice} 직접 전달을 사용하지 않는다
//   - non-last 옵션 클릭 시 sendUserMessage 직접 호출 로직이 있어야 한다

import * as fs from "fs";
import * as path from "path";

const WIZARD_CHAT_PATH = path.resolve(
  __dirname,
  "../../../src/studio/wizard/WizardChat.tsx",
);

describe("WizardChat — ChoiceInput auto-submit 계약", () => {
  let src: string;
  beforeAll(() => {
    src = fs.readFileSync(WIZARD_CHAT_PATH, "utf-8");
  });

  it("handleChoiceSelect 함수가 정의되어 있다", () => {
    expect(src).toContain("handleChoiceSelect");
  });

  it("ChoiceInput에 setSelectedChoice를 onSelect로 직접 전달하지 않는다", () => {
    expect(src).not.toContain("onSelect={setSelectedChoice}");
  });

  it("handleChoiceSelect 내부에서 sendUserMessage를 호출한다 (non-last auto-submit)", () => {
    const handleStart = src.indexOf("handleChoiceSelect");
    expect(handleStart).toBeGreaterThan(-1);
    // The function body should contain sendUserMessage call
    const funcBody = src.slice(handleStart, handleStart + 600);
    expect(funcBody).toContain("sendUserMessage");
  });

  it("직접 입력(last option) 경우에만 textarea + 답변 버튼 표시", () => {
    // ChoiceInput should only show submit button when other (last) option selected
    // This means the submit button render is guarded by isOtherSelected
    expect(src).toContain("isOtherSelected");
  });
});
