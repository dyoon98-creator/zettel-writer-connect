// synopsisRefine.test.ts — 「다시 다듬기」가 앞서 쓴 글을 버리지 않는다는 계약.
//                           (대표 실사용 결함 · 2026-08-31)
//
// 무엇이 잘못돼 있었나:
//   재제안 경로가 화면에 있는 시놉시스를 프롬프트에 한 글자도 싣지 않아서,
//   「다시 다듬기」가 사실은 「처음부터 다시 쓰기」였다. 쌓아 올린 글도, 작가가 손으로
//   고친 대목도 못 본 채 컨셉 단락만 보고 새로 썼으니 결과가 나빠졌다.
//
// 이 파일이 못박는 것:
//   A. 다듬기 프롬프트에 «지금 글» 이 실린다 — 이것이 빠지면 결함 재발.
//   B. 첫 생성과 다듬기가 «다른» 프롬프트를 낸다 — 같으면 다듬기가 다시 새로 쓰기다.
//   C. 다듬기 프롬프트가 「새로 쓰라」가 아니라 「고치라」로 읽힌다.
//   D. 「고민해서 쓰게」 하는 지시가 있고, 그 고민이 화면으로 새지 않도록 출력 계약이 있다.
//   E. 화면(Step3Synopsis)이 실제로 그 경로를 부른다 — 빌더만 고쳐 두면 아무 소용 없다.

import * as fs from "fs";
import * as path from "path";

import {
  SYNOPSIS_REFINE_SYSTEM_PROMPT,
  SYNOPSIS_SYSTEM_PROMPT,
  buildSynopsisUserPrompt,
} from "../../../src/studio/wizard/concept/synopsisPrompts";

const CONCEPT = "아이의 첫 등교를 배웅하는 아버지의 하루.";
const EXISTING =
  "아버지는 교문 앞에서 아이의 등을 본다. 그 등은 이미 자기 것이 아니다.";

// ─── A~C. 다듬기 프롬프트 ───────────────────────────────────────────────────

describe("다듬기 — 지금 글이 프롬프트에 실린다 (C9·C10)", () => {
  test("기존 시놉시스 + 추가 지시 → 둘 다 프롬프트에 있다", () => {
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: EXISTING,
      refineHint: "더 짧게, 비유를 강화해줘",
    });
    expect(p).toContain(EXISTING);
    expect(p).toContain("더 짧게, 비유를 강화해줘");
    expect(p).toContain("## 지금 시놉시스");
    expect(p).toContain("## 추가 지시");
    expect(p).toContain("## 컨셉 단락");
  });

  test("마무리 문면이 「새로 쓰라」가 아니라 「다듬으라」로 읽힌다", () => {
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: EXISTING,
      refineHint: "더 짧게",
    });
    expect(p).toContain("다듬어 주세요");
    expect(p).not.toContain("위 컨셉으로 시놉시스를 작성하세요.");
    // 지시가 닿지 않는 문장까지 휩쓸어 다시 쓰지 말라고 못박는다.
    expect(p).toContain("지시가 닿지 않는 문장은 그대로 두세요");
  });

  test("작가가 손으로 고친 글도 그대로 대상이 된다", () => {
    const handEdited = EXISTING + " 아버지는 돌아서지 못한다.";
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: handEdited,
      refineHint: "마지막 문장을 살려줘",
    });
    // 「AI 가 만든 마지막 판」이 아니라 「지금 화면에 있는 글」이 실린다.
    expect(p).toContain("아버지는 돌아서지 못한다.");
  });

  test("추가 지시가 없어도 다듬는다 — 다만 크게 바꾸지 말라고 이른다 (판정 3)", () => {
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: EXISTING,
    });
    expect(p).toContain(EXISTING);
    expect(p).toContain("다듬어 주세요");
    expect(p).toContain("실제로 약한 곳만 손보고");
    expect(p).not.toContain("## 추가 지시");
  });
});

describe("첫 생성 — 다듬을 것이 없다 (C10)", () => {
  test("기존 시놉시스가 없으면 「다듬으라」 지시가 붙지 않는다", () => {
    const p = buildSynopsisUserPrompt({ conceptParagraph: CONCEPT });
    expect(p).not.toContain("다듬어 주세요");
    expect(p).not.toContain("## 지금 시놉시스");
    expect(p).toContain("위 컨셉으로 시놉시스를 작성하세요.");
  });

  test("추가 지시만 있고 기존 글이 없으면 «첫 생성» 으로 다룬다 (판정)", () => {
    // 다듬을 대상이 없으면 다듬기가 성립하지 않는다. 지시는 살려서 함께 넘긴다.
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      refineHint: "더 짧게",
    });
    expect(p).toContain("## 추가 지시");
    expect(p).toContain("더 짧게");
    expect(p).toContain("위 컨셉으로 시놉시스를 작성하세요.");
    expect(p).not.toContain("다듬어 주세요");
  });

  test("공백뿐인 글은 «없는 것» 으로 다룬다", () => {
    const p = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: "   \n  ",
    });
    expect(p).not.toContain("## 지금 시놉시스");
    expect(p).toContain("위 컨셉으로 시놉시스를 작성하세요.");
  });

  test("두 경로는 결코 같은 프롬프트를 내지 않는다", () => {
    const first = buildSynopsisUserPrompt({ conceptParagraph: CONCEPT });
    const refine = buildSynopsisUserPrompt({
      conceptParagraph: CONCEPT,
      currentSynopsis: EXISTING,
    });
    expect(refine).not.toBe(first);
    // 그리고 다듬기 쪽에만 «지금 글» 이 있다.
    expect(refine.includes(EXISTING)).toBe(true);
    expect(first.includes(EXISTING)).toBe(false);
  });
});

// ─── D. 「고민해서 쓰게」 + 화면을 더럽히지 않기 ────────────────────────────

describe("다듬기 역할 프롬프트 (C9)", () => {
  test("역할이 «새로 쓰는 사람» 이 아니라 «고쳐 주는 사람» 이다", () => {
    expect(SYNOPSIS_REFINE_SYSTEM_PROMPT).toContain("고쳐 주는 편집자");
    expect(SYNOPSIS_REFINE_SYSTEM_PROMPT).toContain("새로 쓰는 사람이 아닙니다");
  });

  test("즉답으로 쓰지 말고 «먼저 판단» 하게 한다", () => {
    const p = SYNOPSIS_REFINE_SYSTEM_PROMPT;
    expect(p).toContain("쓰기 전에 먼저 판단하세요");
    // 무엇을 판단할지가 실제로 열거돼 있다 — 「잘 생각해봐」 한 줄로 끝내지 않는다.
    expect(p).toContain("어디를 겨냥하는가");
    expect(p).toContain("반드시 살려야 할 것은 무엇인가");
    expect(p).toContain("앞뒤가 어긋나지 않는가");
  });

  test("그 판단이 사용자 화면으로 새지 않도록 출력 계약이 있다", () => {
    const p = SYNOPSIS_REFINE_SYSTEM_PROMPT;
    expect(p).toContain("속으로만 하세요");
    expect(p).toContain("본문 한 단락뿐입니다");
    expect(p).toContain("변경 요약");
    expect(p).toContain("설명");
    // 작가가 받는 것이 무엇인지 못박는다.
    expect(p).toContain("글이지 보고서가 아닙니다");
  });

  test("작가가 손댄 대목을 되돌리지 말라고 이른다", () => {
    expect(SYNOPSIS_REFINE_SYSTEM_PROMPT).toContain("작가가 직접 고친 흔적");
    expect(SYNOPSIS_REFINE_SYSTEM_PROMPT).toContain("되돌리지 마세요");
  });

  test("첫 생성 프롬프트와 «다른» 프롬프트다", () => {
    expect(SYNOPSIS_REFINE_SYSTEM_PROMPT).not.toBe(SYNOPSIS_SYSTEM_PROMPT);
  });

  test("첫 생성 프롬프트는 손대지 않았다 — 지금 잘 도는 경로다", () => {
    expect(SYNOPSIS_SYSTEM_PROMPT).toContain(
      "당신은 책의 시놉시스를 짓는 편집자입니다.",
    );
    expect(SYNOPSIS_SYSTEM_PROMPT).toContain("헤더/번호/볼드 없이 단락 하나만 출력.");
  });
});

// ─── E. 화면이 실제로 그 경로를 부르는가 ────────────────────────────────────

describe("Step3Synopsis 소스 계약 — 빌더만 고쳐 두면 소용없다 (C9)", () => {
  const src = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../src/studio/wizard/concept/Step3Synopsis.tsx",
    ),
    "utf-8",
  );

  test("다듬기 경로가 «지금 글» 을 실제로 넘긴다", () => {
    expect(src).toContain("currentSynopsis: isRefine ? existing : undefined");
    expect(src).toContain("const existing = session.synopsis.trim()");
  });

  test("다듬기 경로가 다듬기 전용 역할 프롬프트를 쓴다", () => {
    expect(src).toContain("SYNOPSIS_REFINE_SYSTEM_PROMPT");
    expect(src).toMatch(
      /systemPrompt: isRefine\s*\?\s*SYNOPSIS_REFINE_SYSTEM_PROMPT\s*:\s*SYNOPSIS_SYSTEM_PROMPT/,
    );
  });

  test("«다듬기냐 첫 생성이냐» 를 한 곳에서만 정한다 (둘이 갈라지지 못한다)", () => {
    // user prompt 와 system prompt 가 같은 isRefine 하나에서 나온다.
    const decls = src.match(/const isRefine = existing\.length > 0;/g) ?? [];
    expect(decls).toHaveLength(1);
  });

  test("첫 자동 생성 경로는 «지금 글» 을 넘기지 않는다 (넘길 것이 없다)", () => {
    // 자동 호출은 session.synopsis 가 비었을 때만 도는 경로다.
    expect(src).toContain("if (session.synopsis.trim())");
  });

  test("버튼 이름이 하는 일과 맞다 (판정 4)", () => {
    expect(src).toContain('synopsis.trim() ? "이 글 다듬기" : "시놉시스 만들기"');
    // 옛 이름 「재제안」은 «새로 제안한다» 는 뜻이라 지금 동작과 어긋난다.
    expect(src).not.toContain("다시 다듬기 (재제안)");
  });
});
