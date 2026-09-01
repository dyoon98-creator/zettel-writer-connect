// ConceptResumeToast — 「이어서 하기」 알림이 화면을 가리지 않는다.
//
// 왜 (2026-09-01 실측 화면). 미완 세션 수만큼 알림이 쌓였다. 다섯 개가 겹쳐
// 컨셉 마법사 오른쪽 절반을 덮었고, 정작 눌러야 할 「다음」이 그 뒤에 숨었다.
// 이어서 할 것은 보통 «마지막에 하던 것» 하나다.

import { readFileSync } from "fs";
import { join } from "path";

const SRC = readFileSync(
  join(__dirname, "../../../src/studio/wizard/concept/ConceptResumeToast.tsx"),
  "utf8",
);

describe("ConceptResumeToast — 하나만 띄우고 나머지는 접는다", () => {
  it("모든 세션을 한꺼번에 map 으로 펼치지 않는다", () => {
    // 예전 코드: `{pendingSessions.map((s) => (<SessionToast …`
    expect(SRC).not.toMatch(/\{\s*pendingSessions\.map\(/);
  });

  it("가장 최근 하나와 나머지를 «가른다»", () => {
    expect(SRC).toMatch(/const \[latest, \.\.\.rest\] = pendingSessions/);
  });

  it("나머지가 있으면 «몇 개 더 있는지» 알려 주고 펼칠 수 있다", () => {
    expect(SRC).toMatch(/rest\.length > 0/);
    expect(SRC).toContain("이어서 할 것이");
    expect(SRC).toContain('data-testid="concept-resume-more"');
  });

  it("펼친 뒤에는 나머지도 보여 준다", () => {
    expect(SRC).toMatch(/expanded &&\s*\n?\s*rest\.map\(/);
  });
});
