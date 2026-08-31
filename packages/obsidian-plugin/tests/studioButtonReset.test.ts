// studioButtonReset — 작업실 버튼이 옵시디언 reset 에 지워지지 않는지.
//
// 왜 이 파일이 있나 (2026-08-31 실측).
//
// `styles-indexer.css` 는 옵시디언 기본 button 스타일을 무력화하려고
// 작업실 스코프 안 모든 button 에 reset 을 건다. 그런데 그 선택자가
// `.manuscript-studio-root button` (구체성 0,1,1) 이라, `.wizard-send-btn`
// 같은 «class 한 개짜리» 규칙(0,1,0)을 전부 이겨 버렸다. 배경이 지워진 채
// `color: #fff` 만 남은 버튼은 흰 바탕에 흰 글씨가 되어 «아예 안 보였다».
//
// 실제 피해 (headless Chromium 으로 계산한 글자 대비):
//   · .wizard-send-btn      1.04 — 기획 인터뷰 「답변」 버튼
//   · .wizard-seed-accept   1.04 — 「지금 binder 만들고 원고실 열기」 버튼
// 둘 다 대표가 «버튼이 없다» 고 보고한 그 버튼이다.
//
// 고침은 `:where(button)` 으로 구체성을 (0,1,0) 으로 낮추는 것이다. 그러면
// 옵시디언 기본 `button`(0,0,1) 은 여전히 이기고, 작업실 class 규칙과는
// 구체성이 같아져 «뒤에 오는» global.css 가 이긴다.
//
// 앞서 이 문제를 allow-list (`.manuscript-studio-root .foo`) 로 막으려 했는데
// 51개 중 41개가 목록에서 빠져 있었다. 목록은 못 따라간다 — 그래서 이 테스트는
// 목록이 아니라 «reset 의 구체성» 자체를 잠근다.

import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("작업실 button reset 의 구체성", () => {
  it.each(["styles-indexer.css", "styles.css"])(
    "%s — reset 이 :where() 로 감싸여 있다",
    (file) => {
      const css = read(file);

      expect(css).toContain(".manuscript-studio-root :where(button)");
      // 감싸지 않은 형태가 남아 있으면 class 규칙이 다시 지워진다.
      expect(css).not.toMatch(/\.manuscript-studio-root button\s*[{,]/);
      expect(css).not.toMatch(/\.manuscript-studio-root button:hover\s*[{,]/);
    },
  );

  it("빌드 산출물 styles.css 가 source 두 개를 모두 담고 있다", () => {
    // 이 테스트가 styles.css 를 검사하는 것이 의미 있으려면 산출물이
    // 최신이어야 한다. indexer·studio 양쪽의 표식을 하나씩 확인한다.
    const built = read("styles.css");

    expect(built).toContain(".manuscript-studio-root"); // styles-indexer.css
    expect(built).toContain(".wizard-send-btn"); // src/studio/styles/global.css
  });

  it("흰 글자 버튼은 배경도 함께 정한다", () => {
    // `color: #fff` 만 있고 배경이 없는 규칙은 reset 이 배경을 지우는 순간
    // 흰 바탕에 흰 글씨가 된다. 그 조합 자체를 금지한다.
    const css = read("styles.css");
    const offenders: string[] = [];

    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1].trim();
      const body = m[2];
      if (!/(^|;|\s)color\s*:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) continue;
      if (/(^|;|\s)background(-color)?\s*:/i.test(body)) continue;
      offenders.push(selector.replace(/\s+/g, " "));
    }

    expect(offenders).toEqual([]);
  });
});
