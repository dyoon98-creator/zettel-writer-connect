// RED source-contract tests for planning wizard prompt markdown files and
// CLIWizardBridge.ts prompt rendering.
//
// Failing now because:
// - motive.md / structure-pick.md still reference old genre keys
// - CLIWizardBridge.askNext() doesn't include structured_handoff

import * as fs from "fs";
import * as path from "path";

const PROMPTS_DIR = path.resolve(
  __dirname,
  "../../../src/studio/wizard/prompts",
);
const CLI_BRIDGE_PATH = path.resolve(
  __dirname,
  "../../../src/studio/wizard/CLIWizardBridge.ts",
);
const WIZARD_SEED_PATH = path.resolve(
  __dirname,
  "../../../src/studio/wizard/wizardSeed.ts",
);

// Current 6 genre keys (must be present)
const CURRENT_GENRE_KEYS = [
  "investment-strategy-memo",
  "investment-report",
  "legal-accounting-review",
  "column-essay",
  "lecture-presentation",
  "long-form-manuscript",
];

// Old genre keys (must NOT appear as label identifiers)
const OLD_GENRE_KEYS = ["essay", "practical", "youtube", "lecture", "world"];

function readPrompt(filename: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), "utf-8");
}

// ──────────────────────────────────────────────────────────────────────────────
// motive.md
// ──────────────────────────────────────────────────────────────────────────────
describe("prompts/motive.md — 장르 키 계약", () => {
  let src: string;
  beforeAll(() => {
    src = readPrompt("motive.md");
  });

  for (const key of CURRENT_GENRE_KEYS) {
    it(`현재 genre key "${key}" 가 포함된다`, () => {
      expect(src).toContain(key);
    });
  }

  for (const oldKey of OLD_GENRE_KEYS) {
    // These must not appear as standalone genre identifiers (not as word fragments)
    it(`구 genre key "${oldKey}" 가 독립 식별자로 없어야 한다`, () => {
      // Check that old key doesn't appear as a standalone label (e.g. "essay (수필")
      // We allow "essay" inside words like "column-essay" but not as a standalone
      const standalonePattern = new RegExp(
        `(?:^|\\s|\\(|-)${oldKey}(?:\\s|\\)|:|\\n|$)`,
        "m",
      );
      // "lecture" is a substring of "lecture-presentation" so allow that
      if (oldKey === "lecture") {
        // Old genre key "lecture" should not appear as standalone (only lecture-presentation)
        expect(src).not.toMatch(/^## lecture\s/m);
        expect(src).not.toContain("lecture (강의/교안)");
        expect(src).not.toContain("lecture (강의");
      } else if (oldKey === "essay") {
        expect(src).not.toContain("essay (수필/에세이)");
        expect(src).not.toMatch(/^- essay\b/m);
      } else {
        expect(src).not.toContain(`${oldKey} (`);
        expect(src).not.toMatch(new RegExp(`^- ${oldKey}\\b`, "m"));
      }
    });
  }

  it("investment-report 전용 가이드: thesis 또는 투자 개념이 포함된다", () => {
    expect(src).toMatch(/thesis|투자 thesis|투자 대상|투자보고서/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// structure-pick.md
// ──────────────────────────────────────────────────────────────────────────────
describe("prompts/structure-pick.md — 장르 키 계약", () => {
  let src: string;
  beforeAll(() => {
    src = readPrompt("structure-pick.md");
  });

  for (const key of CURRENT_GENRE_KEYS) {
    it(`현재 genre key "${key}" 가 포함된다`, () => {
      expect(src).toContain(key);
    });
  }

  it('구 genre section "## essay (수필/에세이)" 가 없다', () => {
    expect(src).not.toContain("## essay");
    expect(src).not.toContain("essay (수필/에세이)");
  });

  it('구 genre section "## practical (실용서)" 가 없다', () => {
    expect(src).not.toContain("## practical");
    expect(src).not.toContain("practical (실용서)");
  });

  it('구 genre section "## youtube" 가 없다', () => {
    expect(src).not.toContain("## youtube");
  });

  it('구 genre section "## world" 가 없다', () => {
    expect(src).not.toContain("## world");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CLIWizardBridge.ts — askNext render includes structured_handoff
// ──────────────────────────────────────────────────────────────────────────────
describe("CLIWizardBridge.ts — askNext structured_handoff 계약", () => {
  let src: string;
  beforeAll(() => {
    src = fs.readFileSync(CLI_BRIDGE_PATH, "utf-8");
  });

  it("askNext render() 호출에 structured_handoff 키가 포함된다", () => {
    // Find the render() call inside askNext method
    // The askNext method must pass structured_handoff so {{structured_handoff}} resolves
    const askNextSection = src.slice(
      src.indexOf("async *askNext("),
      src.indexOf("async askNextQuestion("),
    );
    expect(askNextSection).toContain("structured_handoff");
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// tone.md — investment 장르 전용 가이드
// ──────────────────────────────────────────────────────────────────────────────
describe("prompts/tone.md — investment 장르 전용 가이드", () => {
  let src: string;
  beforeAll(() => {
    src = readPrompt("tone.md");
  });

  it("investment 장르 전용 톤 옵션 가이드가 포함된다", () => {
    expect(src).toMatch(/investment|투자/i);
  });

  it("investment 장르에서 논증·근거 중심 옵션 예시가 포함된다", () => {
    expect(src).toMatch(/논증|사실 중심|데이터|근거 중심/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// audience-message.md — investment 장르 전용 가이드
// ──────────────────────────────────────────────────────────────────────────────
describe("prompts/audience-message.md — investment 장르 전용 가이드", () => {
  let src: string;
  beforeAll(() => {
    src = readPrompt("audience-message.md");
  });

  it("investment 장르 전용 독자 옵션 가이드가 포함된다", () => {
    expect(src).toMatch(/investment|투자/i);
  });

  it("고객/client 중심 독자 예시가 포함된다", () => {
    expect(src).toMatch(/고객|client/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// conceptSeed.ts — stale fallback
// ──────────────────────────────────────────────────────────────────────────────
describe("conceptSeed.ts — genre fallback 계약", () => {
  const CONCEPT_SEED_PATH = path.resolve(
    __dirname,
    "../../../src/studio/wizard/concept/conceptSeed.ts",
  );
  let src: string;
  beforeAll(() => {
    src = require("fs").readFileSync(CONCEPT_SEED_PATH, "utf-8");
  });

  it('?? "essay" 가 없다 (구 stale fallback 제거됨)', () => {
    expect(src).not.toContain('?? "essay"');
  });

  // 2026-09-01 — 계약을 «문자열» 에서 «단일 출처» 로 올렸다.
  //
  // 전에는 파일 안에 `?? "investment-strategy-memo"` 라는 리터럴이 «있어야»
  // 통과했다. 그런데 같은 문자열이 7곳에 흩어져 있어서, 기본값을 바꾸려면
  // 일곱 군데를 찾아 고쳐야 했다. core 의 DEFAULT_DRAFT_GENRE 하나로 모으고
  // 계약도 그것을 쓰는지로 바꾼다. 검사가 막으려던 위험(기본값이 조용히
  // 옛 장르로 남는 것)은 그대로 막힌다 — 오히려 한 곳만 보면 된다.
  it("기본 장르를 리터럴이 아니라 DEFAULT_DRAFT_GENRE 로 쓴다", () => {
    expect(src).toContain("DEFAULT_DRAFT_GENRE");
    expect(src).not.toMatch(/\?\?\s*"[a-z-]+"\s*;?\s*\/\/.*genre/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// wizardSeed.ts — stale fallback
// ──────────────────────────────────────────────────────────────────────────────
describe("wizardSeed.ts — genre fallback 계약", () => {
  let src: string;
  beforeAll(() => {
    src = fs.readFileSync(WIZARD_SEED_PATH, "utf-8");
  });

  it('?? "essay" 가 없다 (구 stale fallback 제거됨)', () => {
    expect(src).not.toContain('?? "essay"');
  });

  // 2026-09-01 — 계약을 «문자열» 에서 «단일 출처» 로 올렸다.
  //
  // 전에는 파일 안에 `?? "investment-strategy-memo"` 라는 리터럴이 «있어야»
  // 통과했다. 그런데 같은 문자열이 7곳에 흩어져 있어서, 기본값을 바꾸려면
  // 일곱 군데를 찾아 고쳐야 했다. core 의 DEFAULT_DRAFT_GENRE 하나로 모으고
  // 계약도 그것을 쓰는지로 바꾼다. 검사가 막으려던 위험(기본값이 조용히
  // 옛 장르로 남는 것)은 그대로 막힌다 — 오히려 한 곳만 보면 된다.
  it("기본 장르를 리터럴이 아니라 DEFAULT_DRAFT_GENRE 로 쓴다", () => {
    expect(src).toContain("DEFAULT_DRAFT_GENRE");
    expect(src).not.toMatch(/\?\?\s*"[a-z-]+"\s*;?\s*\/\/.*genre/i);
  });
});
