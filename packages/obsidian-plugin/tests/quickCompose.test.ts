import { getActionId, buildQuickComposePrompt } from "../src/quickCompose";

describe("getActionId — register → B1 action route table", () => {
  it("email draft → comms.email-draft", () => {
    expect(getActionId("email", "draft")).toBe("comms.email-draft");
  });

  it("email polish → comms.email-polish", () => {
    expect(getActionId("email", "polish")).toBe("comms.email-polish");
  });

  it("kakao → comms.kakao-short", () => {
    expect(getActionId("kakao")).toBe("comms.kakao-short");
  });

  it("telegram → comms.telegram-brief", () => {
    expect(getActionId("telegram")).toBe("comms.telegram-brief");
  });

  it("report → comms.report-polish", () => {
    expect(getActionId("report")).toBe("comms.report-polish");
  });

  it("summary → comms.summary-briefing", () => {
    expect(getActionId("summary")).toBe("comms.summary-briefing");
  });

  it("memo → comms.memo-capture", () => {
    expect(getActionId("memo")).toBe("comms.memo-capture");
  });

  it("email without subtype defaults to draft", () => {
    expect(getActionId("email")).toBe("comms.email-draft");
  });
});

describe("buildQuickComposePrompt — base behavior", () => {
  const base = {
    register: "kakao" as const,
    intent: "B 파트너에게 내일 회의 30분 늦어진다고 전달",
  };

  it("produced prompt contains no-external-send guard", () => {
    const prompt = buildQuickComposePrompt(base);
    expect(prompt).toMatch(/외부.*발송|전송.*없|발송.*없|외부로 보내지|외부 전송/);
  });

  it("includes intent in prompt", () => {
    const prompt = buildQuickComposePrompt(base);
    expect(prompt).toContain(base.intent);
  });

  it("includes reader when provided", () => {
    const prompt = buildQuickComposePrompt({ ...base, reader: "B 파트너" });
    expect(prompt).toContain("B 파트너");
  });

  it("includes length hint when provided", () => {
    const prompt = buildQuickComposePrompt({ ...base, length: "짧게" });
    expect(prompt).toContain("짧게");
  });
});

describe("buildQuickComposePrompt — style guide injection", () => {
  it("does NOT include style guide section when styleGuide is absent", () => {
    const prompt = buildQuickComposePrompt({
      register: "email",
      intent: "미팅 일정 조율 요청",
    });
    expect(prompt).not.toMatch(/문체 가이드|VoiceGuide|style_guide/i);
  });

  it("includes style guide block when styleGuide is provided", () => {
    const guide = "격식체 유지, 너무 딱딱하지 않게";
    const prompt = buildQuickComposePrompt({
      register: "email",
      intent: "미팅 일정 조율 요청",
      styleGuide: guide,
    });
    expect(prompt).toContain(guide);
  });
});

describe("buildQuickComposePrompt — source text", () => {
  it("includes source text when provided", () => {
    const source = "기존 이메일 원문 내용입니다.";
    const prompt = buildQuickComposePrompt({
      register: "email",
      emailSubType: "polish",
      intent: "문체 다듬기",
      source,
    });
    expect(prompt).toContain(source);
  });

  it("does not include source section when source absent", () => {
    const prompt = buildQuickComposePrompt({
      register: "kakao",
      intent: "안녕 메시지",
    });
    expect(prompt).not.toMatch(/참고 텍스트.*없음|source.*없음/i);
  });
});

describe("buildQuickComposePrompt — register-specific guards", () => {
  it("report prompt contains fact/no-number-change guard", () => {
    const prompt = buildQuickComposePrompt({
      register: "report",
      intent: "이사회 보고용 다듬기",
      source: "원본 보고서 내용",
    });
    expect(prompt).toMatch(/사실|수치|결론.*변경.*금지|수치.*변경.*금지|팩트.*유지|원문.*사실|수치.*바꾸지/);
  });

  it("summary prompt contains 현황/핵심/시사점 structure hint", () => {
    const prompt = buildQuickComposePrompt({
      register: "summary",
      intent: "LP 업데이트 보고",
      source: "원문 자료",
    });
    expect(prompt).toContain("현황");
    expect(prompt).toContain("핵심");
    expect(prompt).toContain("시사점");
  });

  it("kakao prompt is oriented toward short message by default", () => {
    const prompt = buildQuickComposePrompt({
      register: "kakao",
      intent: "회의 공지",
    });
    expect(prompt).toMatch(/짧|간결|3.{0,5}5줄|카카오/);
  });
});
