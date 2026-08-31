// studioButtonReset — 작업실 버튼이 «호스트에도, 우리 reset 에도» 안 지워지는지.
//
// ── 왜 이 파일이 있나 (2026-08-31 실측) ────────────────────────────────
//
// 옵시디언 app.css(637KB, obsidian-1.13.7.asar 에서 추출)에는 이런 규칙이 있다.
//
//     button:not(.clickable-icon) { background-color: var(--interactive-normal) }
//
// 구체성이 (0,1,1) 이다. 작업실 버튼 class 규칙은 `.wizard-send-btn` 처럼
// (0,1,0) 이라 여기에 «진다». 그래서 작업실이 정한 배경이 옵시디언 회색으로
// 덮이거나, 배경만 사라지고 `color:#fff` 만 남아 흰 바탕에 흰 글씨가 됐다.
//
// 우리 reset(`.manuscript-studio-root button`)도 (0,1,1) 이다. 이건 옵시디언을
// 이기라고 그렇게 만든 것이라 «낮추면 안 된다» — 실제로 `:where(button)` 로
// 낮췄더니 「취소」·「재생성」이 옵시디언 회색 알약으로 바뀌었다.
//
// 따라서 답은 하나뿐이다. **작업실 버튼 class 규칙을 (0,1,1) «위»로 올린다.**
// global.css 에서 `:root` 를 앞에 붙여 (0,2,0) 이상으로 만든다. 구체성만으로
// 이기므로 CSS 합치는 순서에 기대지 않는다.
//
// ── headless Chromium 실측 (옵시디언 app.css + 우리 styles.css 동시 로드) ──
//
//   활성 버튼 51개  · 글자 대비 4.5:1 미만  →  고치기 전 다수 / 고친 뒤 0개
//   「답변」(wizard-send-btn)        1.04 → 4.76
//   「binder 만들고 원고실 열기」    1.04 → 4.76
//   비활성 「답변」                  1.45 → 4.12   (opacity 0.5 → 중립 팔레트)

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
/** 주석을 먼저 벗긴다 — 안 벗기면 선택자 캡처에 주석 본문이 섞인다. */
const BUILT = readFileSync(join(ROOT, "styles.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** `<button className="...">` 에 실제로 쓰인 class 이름 — 소스에서 직접 읽는다. */
function buttonClasses(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith(".tsx")) continue;
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/<button\b([\s\S]*?)>/g)) {
        for (const c of m[1].matchAll(/className=(?:"([^"]+)"|\{"([^"]+)"\})/g)) {
          for (const one of (c[1] ?? c[2]).split(/\s+/)) if (one) out.add(one);
        }
      }
    }
  };
  walk(join(ROOT, "src"));
  return out;
}

const BUTTON_CLASSES = buttonClasses();

/** 옵시디언 `button:not(.clickable-icon)` 의 구체성. 이걸 넘어야 이긴다. */
const HOST_BUTTON_SPECIFICITY = { b: 1, c: 1 };

/** (id, class, element) 구체성. `:is()`/`:not()` 는 인자의 구체성을 갖는다. */
export function specificity(sel: string): { a: number; b: number; c: number } {
  let s = sel.trim();
  // :is()/:not()/:has() 는 괄호를 벗겨 안쪽을 그대로 센다(가장 구체적인 인자 근사).
  s = s.replace(/:(?:is|not|has)\(([^()]*)\)/g, " $1 ");
  // :where() 는 구체성 0 — 통째로 지운다.
  s = s.replace(/:where\([^()]*\)/g, " ");
  const a = (s.match(/#[\w-]+/g) ?? []).length;
  const b =
    (s.match(/\.[\w-]+/g) ?? []).length +
    (s.match(/\[[^\]]+\]/g) ?? []).length +
    (s.match(/:(?!:)[\w-]+/g) ?? []).length;
  const c = (s.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) ?? []).length;
  return { a, b, c };
}

/** x 가 y 보다 «세게» 이기나 (동점은 false — 순서 의존을 허용하지 않는다). */
function beats(
  x: { a: number; b: number; c: number },
  y: { b: number; c: number },
): boolean {
  if (x.a > 0) return true;
  if (x.b !== y.b) return x.b > y.b;
  return x.c > y.c;
}

/** styles.css 의 최상위 규칙을 (선택자, 본문) 으로 훑는다. */
function* rules(): Generator<{ selector: string; body: string }> {
  for (const m of BUILT.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith("@") || /^\d|%$/.test(selector)) continue;
    yield { selector, body: m[2] };
  }
}

describe("작업실 버튼 — 호스트 CSS 와의 구체성 계약", () => {
  it("specificity() 자기 검사", () => {
    expect(specificity("button:not(.clickable-icon)")).toEqual({ a: 0, b: 1, c: 1 });
    expect(specificity(".wizard-send-btn")).toEqual({ a: 0, b: 1, c: 0 });
    expect(specificity(":root .wizard-send-btn")).toEqual({ a: 0, b: 2, c: 0 });
    expect(specificity(".manuscript-studio-root :where(button)")).toEqual({ a: 0, b: 1, c: 0 });
  });

  it("reset 은 옵시디언 button 규칙을 이길 만큼 구체적이다", () => {
    // 낮추면 옵시디언 기본 버튼 모양이 작업실 전체에 새어 나온다.
    const reset = [...rules()].find(
      (r) => r.selector === ".manuscript-studio-root button",
    );

    expect(reset).toBeDefined();
    const sp = specificity(reset!.selector);
    // 동점 + 나중 로드로 이긴다 — 낮아지지만 않으면 된다.
    expect(sp.b).toBeGreaterThanOrEqual(HOST_BUTTON_SPECIFICITY.b);
    expect(sp.c).toBeGreaterThanOrEqual(HOST_BUTTON_SPECIFICITY.c);
  });

  it("배경·색을 정하는 버튼 class 규칙은 모두 (0,1,1) 을 넘는다", () => {
    // 넘지 못하면 옵시디언 회색에 덮이거나 배경만 사라져 흰 글씨만 남는다.
    const weak: string[] = [];

    for (const { selector, body } of rules()) {
      if (!/(^|;|\s)(background(-color)?|color)\s*:/.test(body)) continue;
      for (const one of selector.split(",")) {
        const s = one.trim();
        // 작업실이 «자기 버튼 class» 로 지정한 규칙만 본다.
        if (!/^[:.]/.test(s)) continue;
        // 선택자의 «마지막 덩어리»가 버튼 class 일 때만 본다. 조상 쪽에 이름이
        // 스쳐 지나가는 규칙(예: `.header-status-menu button`)은 대상이 아니다.
        const last = s.split(/[\s>+~]+/).filter(Boolean).pop() ?? "";
        const names = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        if (!names.some((n) => BUTTON_CLASSES.has(n))) continue;
        if (beats(specificity(s), HOST_BUTTON_SPECIFICITY)) continue;
        // reset 과 «같은» 선택자는 reset 자신이므로 제외.
        if (s === ".manuscript-studio-root button") continue;
        weak.push(s);
      }
    }

    expect(weak).toEqual([]);
  });

  it("흰 글자를 쓰는 규칙은 배경도 함께 정한다", () => {
    // 배경이 지워지는 순간 흰 바탕에 흰 글씨가 된다 — 그 조합 자체를 막는다.
    const offenders: string[] = [];
    for (const { selector, body } of rules()) {
      if (!/(^|;|\s)color\s*:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) continue;
      if (/(^|;|\s)background(-color)?\s*:/i.test(body)) continue;
      offenders.push(selector.replace(/\s+/g, " ").slice(0, 80));
    }
    expect(offenders).toEqual([]);
  });

  it("비활성 버튼은 opacity 로 뭉개지 않고 읽히는 팔레트를 쓴다", () => {
    // opacity 0.5 는 배경과 글씨를 함께 흐리게 해 대비가 1.45 까지 떨어졌다.
    const rule = [...rules()].find(
      (r) => r.selector.includes("button:disabled") && r.selector.includes(":root"),
    );

    expect(rule).toBeDefined();
    expect(rule!.body).toMatch(/opacity\s*:\s*1/);
    expect(rule!.body).toMatch(/background\s*:[^;]*!important/);
    expect(rule!.body).toMatch(/color\s*:[^;]*!important/);
  });
});
