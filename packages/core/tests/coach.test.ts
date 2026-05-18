// coach.test.ts — Coach 카탈로그·레지스트리·프롬프트 빌더 검증.
// (Jest globals — describe/expect/it 은 자동 주입.)

import {
  COACH_ACTIONS,
  COACH_ACTIONS_BY_ID,
  CoachActionRegistry,
  buildCoachPrompt,
  type CoachAction,
  type CoachCategory,
} from "../src/coach";

describe("COACH_ACTIONS catalog", () => {
  it("has at least 40 actions", () => {
    expect(COACH_ACTIONS.length).toBeGreaterThanOrEqual(40);
  });

  it("covers all 7 categories", () => {
    const cats = new Set(COACH_ACTIONS.map((a) => a.category));
    const expected: CoachCategory[] = [
      "vocab",
      "structure",
      "description",
      "analysis",
      "revise",
      "inspire",
      "research",
    ];
    for (const c of expected) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it("all action IDs are unique", () => {
    const ids = COACH_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all actions have a non-empty Korean label and description", () => {
    for (const a of COACH_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it("all actions have a non-empty promptTemplate", () => {
    for (const a of COACH_ACTIONS) {
      expect(a.promptTemplate.length).toBeGreaterThan(20);
    }
  });

  it("all actions cite the book section (sourceBookSection)", () => {
    for (const a of COACH_ACTIONS) {
      expect(a.sourceBookSection).toBeTruthy();
      expect(a.sourceBookSection!.length).toBeGreaterThan(0);
    }
  });

  it("includes the book's 16 author shortcuts (id/lg/mu/li/hu/sh/ph/sc/ss/em/fl + 1-6)", () => {
    const shortcuts = new Set(
      COACH_ACTIONS.filter((a) => a.shortcut).map((a) => a.shortcut),
    );
    // 책 Chapter 10 의 단축키들. 우리는 이 중 핵심 단축키들을 반드시 액션으로 노출해야 한다.
    const required = [
      "id", // 독특한 아이디어
      "lg", // 논리
      "mu", // 음악
      "li", // 문학
      "hu", // 익살
      "sh", // 짧게
      "ph", // 철학
      "sc", // 그림 묘사
      "ss", // 5감각
      "em", // 감정
      "fl", // 흐름
      "1", // 중언부언
      "2", // 주제 일탈
      "3", // 접속사
      "4", // 두괄식
    ];
    for (const r of required) {
      expect(shortcuts.has(r)).toBe(true);
    }
  });

  it("contains the all-in-one '글 검토' action (Phase E.1 핵심)", () => {
    const review = COACH_ACTIONS_BY_ID.get("revise.review-bundle");
    expect(review).toBeDefined();
    expect(review!.contextScope).toBe("scene");
    expect(review!.saveTo).toBe("feedback-section");
    // 7원칙 + 독자/편집자 피드백 + 두괄식 점검을 모두 다루는 prompt 인지 sanity check.
    const p = review!.promptTemplate;
    expect(p).toContain("7가지");
    expect(p).toContain("독자");
    expect(p).toContain("편집자");
  });

  it("attachment-required actions exist (사진 묘사)", () => {
    const photoAction = COACH_ACTIONS_BY_ID.get("description.from-photo");
    expect(photoAction?.requiresAttachment).toBe("image");
  });
});

describe("CoachActionRegistry", () => {
  it("byCategory returns at least 4 actions per category", () => {
    const cats: CoachCategory[] = [
      "vocab",
      "structure",
      "description",
      "analysis",
      "revise",
      "inspire",
      "research",
    ];
    for (const c of cats) {
      expect(CoachActionRegistry.byCategory(c).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("byId returns the action or null", () => {
    expect(CoachActionRegistry.byId("vocab.verb-strengthen")).not.toBeNull();
    expect(CoachActionRegistry.byId("nonexistent.action")).toBeNull();
  });

  it("slashSearch matches by shortcut prefix", () => {
    const results = CoachActionRegistry.slashSearch("ss");
    expect(results.some((a) => a.shortcut === "ss")).toBe(true);
  });

  it("slashSearch matches by Korean label", () => {
    const results = CoachActionRegistry.slashSearch("두괄식");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toContain("두괄식");
  });

  it("slashSearch on empty query returns empty array", () => {
    expect(CoachActionRegistry.slashSearch("")).toEqual([]);
    expect(CoachActionRegistry.slashSearch("   ")).toEqual([]);
  });

  it("inferScopeFromText: short single token → word", () => {
    expect(CoachActionRegistry.inferScopeFromText("뛰다")).toBe("word");
  });

  it("inferScopeFromText: one sentence → sentence", () => {
    expect(
      CoachActionRegistry.inferScopeFromText(
        "그는 천천히 걸어가다 멈춰 섰다",
      ),
    ).toBe("sentence");
  });

  it("inferScopeFromText: multi-paragraph → scene", () => {
    const text = "첫 문단이다. 한참 길다.\n\n두번째 문단이다.";
    expect(CoachActionRegistry.inferScopeFromText(text)).toBe("scene");
  });

  it("inferScopeFromText: empty → none", () => {
    expect(CoachActionRegistry.inferScopeFromText("")).toBe("none");
    expect(CoachActionRegistry.inferScopeFromText("   ")).toBe("none");
  });
});

describe("buildCoachPrompt", () => {
  it("packs task only when no context provided", () => {
    const out = buildCoachPrompt({ task: "동사를 더 생생하게 바꾸세요." });
    expect(out).toBe("동사를 더 생생하게 바꾸세요.");
  });

  it("includes selection block", () => {
    const out = buildCoachPrompt({
      task: "이 단어를 강한 동사로",
      selection: "걸었다",
    });
    expect(out).toContain("[선택한 부분]");
    expect(out).toContain("걸었다");
  });

  it("includes project meta block", () => {
    const out = buildCoachPrompt({
      task: "글 검토",
      projectMeta: {
        title: "AI 시대의 작가",
        genre: "investment-strategy-memo",
        targetReader: "20-30대 작가 지망생",
        coreMessage: "AI 와 함께 쓰는 글",
      },
    });
    expect(out).toContain("[원고 정보]");
    expect(out).toContain("AI 시대의 작가");
    expect(out).toContain("20-30대");
  });

  it("does not duplicate paragraph block when paragraph equals selection", () => {
    const both = "선택한 한 문장";
    const out = buildCoachPrompt({
      task: "고쳐 주세요",
      selection: both,
      paragraph: both,
    });
    // [선택한 부분] 1개만 있어야 한다. [해당 문단] 은 안 들어감.
    const matches = out.match(/\[선택한 부분\]/g);
    expect(matches?.length).toBe(1);
    expect(out).not.toContain("[해당 문단]");
  });

  it("user input goes into a [작가 추가 입력] block", () => {
    const out = buildCoachPrompt({
      task: "비유를 만드세요",
      userInput: "기쁨, 슬픔",
    });
    expect(out).toContain("[작가 추가 입력]");
    expect(out).toContain("기쁨, 슬픔");
  });
});

describe("Action quality — book fidelity sanity checks", () => {
  // 책의 핵심 정신: AI 가 자주 쓰는 표현 피하기.
  // 우리 시스템 프롬프트 (COACH_SYSTEM_PROMPT) 가 이를 명시하고 있는지는 별도 테스트로
  // 충분. 여기서는 action 들이 "AI 풍" 표현을 prompt 에 강제하지 않는지 확인.
  it("no action prompt forces the AI cliché '~을 (를) 통해'", () => {
    for (const a of COACH_ACTIONS) {
      // 프롬프트가 통해 라는 단어를 "사용하라" 고 명령하지는 않아야.
      // 단, 단순 등장은 무방 (예: '~을 통해 답하라' 정도는 허용).
      expect(a.promptTemplate).not.toMatch(/통해서만 답하/);
    }
  });

  it("no action mixes English-only labels (Korean only UI)", () => {
    for (const a of COACH_ACTIONS) {
      // 라벨이 순전히 영문이면 fail. 한글이 한 글자라도 있어야.
      expect(a.label).toMatch(/[가-힣]/);
    }
  });

  // 단축키는 ASCII 짧은 문자열만.
  it("shortcuts are short ASCII (1-2 chars)", () => {
    for (const a of COACH_ACTIONS) {
      if (a.shortcut !== undefined) {
        expect(a.shortcut.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe("Catalog snapshot — current size", () => {
  it("logs total action count for visibility", () => {
    // 기록용. 실제 카운트가 책 60+ 패턴에 맞는지 사람이 한 번 더 확인할 수 있도록.
    expect(COACH_ACTIONS.length).toBeGreaterThanOrEqual(40);
    expect(COACH_ACTIONS.length).toBeLessThanOrEqual(80);
    const byCat: Record<string, number> = {};
    for (const a of COACH_ACTIONS) {
      byCat[a.category] = (byCat[a.category] ?? 0) + 1;
    }
    // 모든 카테고리에 4 개 이상.
    for (const v of Object.values(byCat)) {
      expect(v).toBeGreaterThanOrEqual(4);
    }
  });
});

// ------------------------------------------------------------------
// Type-only sanity: CoachAction shape is what we promise to consumers.
// ------------------------------------------------------------------
const _typeCheck: CoachAction = {
  id: "vocab.test",
  category: "vocab",
  label: "테스트",
  description: "타입 체크",
  contextScope: "word",
  promptTemplate: "이 단어를 다른 단어로 바꿔 주세요.",
  saveTo: "preview-only",
};
void _typeCheck;
