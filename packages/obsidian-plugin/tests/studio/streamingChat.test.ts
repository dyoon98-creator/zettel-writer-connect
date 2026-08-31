import {
  buildChatPrompt,
  extractDisplayText,
} from "../../src/studio/ai/streamingChat";

describe("buildChatPrompt", () => {
  it("serializes notesContext predictably inside the system block", () => {
    const prompt = buildChatPrompt({
      systemPrompt: "system base",
      notesContext: "NOTE A\nNOTE B",
      messages: [{ role: "user", content: "draft" }],
    });

    expect(prompt).toContain("<system>\nsystem base");
    expect(prompt).toContain("## 참고 노트 (옵시디언 볼트)\nNOTE A\nNOTE B");
    expect(prompt.indexOf("NOTE A")).toBeLessThan(prompt.indexOf("<user>"));
  });
});

/* ---------------------------------------------------------------------------
 * extractDisplayText — 「무엇을 보이고 무엇을 감추나」를 못 박는다.
 *
 * 입력의 출처를 구분해 둔다(테스트 기계 자체를 의심할 수 있게):
 *   [실물]  codex 0.151.0 을 직접 실행해 관측된 이벤트 문자열 그대로.
 *   [합성]  최상위 type · item.type 값은 관측된 것(F4·F5)이지만, 나머지 필드는
 *          이 테스트가 만든 것. 통과시키려고 형태를 비튼 곳은 없다.
 * ------------------------------------------------------------------------- */

/** [실물] codex 0.151.0 이 매 턴 내는 스킬 예산 안내. item.text 가 «없다». */
const REAL_SKILL_BUDGET_EVENT =
  '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Skill descriptions were shortened to fit the skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave more room for the rest."}}';

describe("extractDisplayText — 본문", () => {
  it("[합성] agent_message 본문은 그대로 나온다", () => {
    const line =
      '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"첫 문장은 이렇게 시작합니다."}}';

    expect(extractDisplayText(line)).toBe("첫 문장은 이렇게 시작합니다.\n");
  });

  it("[합성] 본문에는 어떤 표식도 붙지 않는다 (알림 줄과 구별된다)", () => {
    const line =
      '{"type":"item.completed","item":{"type":"agent_message","text":"본문"}}';

    const out = extractDisplayText(line);
    expect(out).not.toContain("[AI ");
    expect(out).toBe("본문\n");
  });

  it("[합성] 구 필드명 item_type 도 본문으로 받는다 (기존 호환)", () => {
    const line =
      '{"type":"item.completed","item":{"item_type":"agent_message","text":"옛 포맷 본문"}}';

    expect(extractDisplayText(line)).toBe("옛 포맷 본문\n");
  });
});

describe("extractDisplayText — item.type === \"error\"", () => {
  it("[실물] 매 턴 반복되는 codex 스킬 예산 안내는 감춘다", () => {
    const spy = jest.spyOn(console, "debug").mockImplementation(() => {});
    try {
      expect(extractDisplayText(REAL_SKILL_BUDGET_EVENT)).toBe("");
      // 감췄다고 사라지면 안 된다 — 콘솔에는 남긴다.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0][1])).toContain("skills context budget");
    } finally {
      spy.mockRestore();
    }
  });

  it("[합성] benign 목록에 없는 경고는 한국어 표식과 원문으로 보인다", () => {
    const line =
      '{"type":"item.completed","item":{"id":"item_3","type":"error","message":"Model gpt-5.5 is deprecated and will stop working."}}';

    const out = extractDisplayText(line);
    expect(out).toContain("[AI 알림]");
    expect(out).toContain("AI 도구가 알림을 보냈습니다.");
    // 원문은 «한국어 뒤에» 붙는다.
    expect(out).toContain("(원문: Model gpt-5.5 is deprecated");
    expect(out.indexOf("AI 도구가 알림을 보냈습니다.")).toBeLessThan(
      out.indexOf("(원문:"),
    );
    expect(out.endsWith("\n")).toBe(true);
  });

  it("[합성] 사용량 한도 경고는 손쓸 방법이 담긴 한국어로 바뀐다", () => {
    const line =
      '{"type":"item.completed","item":{"type":"error","message":"You have hit your usage limit for this model."}}';

    const out = extractDisplayText(line);
    expect(out).toContain("[AI 알림] AI 사용량 한도에 걸렸습니다.");
    expect(out).toContain("(원문: You have hit your usage limit");
  });
});

describe("extractDisplayText — command_execution", () => {
  it("[합성] 시작 때 한 번만 진행 표시를 낸다 (명령 문자열은 감춘다)", () => {
    const line =
      '{"type":"item.started","item":{"id":"item_4","type":"command_execution","command":"bash -lc \'ls -la /tmp\'","status":"in_progress"}}';

    const out = extractDisplayText(line);
    expect(out).toContain("[AI 진행]");
    expect(out).toContain("도구를 실행하는 중입니다.");
    expect(out).not.toContain("bash");
    expect(out).not.toContain("/tmp");
  });

  it("[합성] 같은 명령의 updated·completed 는 중복이므로 감춘다", () => {
    const updated =
      '{"type":"item.updated","item":{"id":"item_4","type":"command_execution","command":"bash -lc \'ls\'","status":"in_progress"}}';
    const completed =
      '{"type":"item.completed","item":{"id":"item_4","type":"command_execution","command":"bash -lc \'ls\'","exit_code":0,"aggregated_output":"a.txt\\nb.txt"}}';

    expect(extractDisplayText(updated)).toBe("");
    expect(extractDisplayText(completed)).toBe("");
  });
});

describe("extractDisplayText — 최상위 turn.failed / error", () => {
  it("[합성] turn.failed 는 본문이 아니라 오류로 구별돼 보인다", () => {
    const line =
      '{"type":"turn.failed","error":{"message":"stream disconnected before completion"}}';

    const out = extractDisplayText(line);
    expect(out).toContain("[AI 오류]");
    expect(out).toContain("AI 서버와 연결이 끊겼습니다.");
    expect(out).toContain("(원문: stream disconnected before completion)");
  });

  it("[합성] 최상위 error 의 message 가 본문인 척 새지 않는다", () => {
    const line =
      '{"type":"error","message":"Unauthorized: please run codex login."}';

    const out = extractDisplayText(line);
    // 표식 없이 원문만 흘러나오던 것이 이 판정으로 막힌다.
    expect(out.startsWith("[AI 오류]")).toBe(true);
    expect(out).toContain("AI 계정 인증이 풀렸습니다.");
    expect(out).toContain("(원문: Unauthorized: please run codex login.)");
  });

  it("[합성] 사유를 못 알아들어도 오류 사실 자체는 한국어로 알린다", () => {
    const line = '{"type":"error"}';

    expect(extractDisplayText(line)).toBe("[AI 오류] 생성이 중단됐습니다.\n");
  });
});

describe("extractDisplayText — 소음과 비 JSON", () => {
  it.each([
    ['{"type":"thread.started","thread_id":"th_1"}', "thread.started"],
    ['{"type":"turn.started"}', "turn.started"],
    [
      '{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":34}}',
      "turn.completed",
    ],
  ])("[합성] %s 는 소음이라 감춘다", (line) => {
    expect(extractDisplayText(line)).toBe("");
  });

  it("[합성] JSON 이 아닌 평문은 원문 그대로 (claude-code 등 호환)", () => {
    expect(extractDisplayText("그냥 평문 한 줄\n")).toBe("그냥 평문 한 줄\n");
  });

  it("[합성] 중괄호로 시작하지만 JSON 이 아니면 원문 그대로", () => {
    expect(extractDisplayText("{ 이건 JSON 이 아님")).toBe("{ 이건 JSON 이 아님");
  });

  it("[합성] 빈 줄은 감춘다", () => {
    expect(extractDisplayText("   \n")).toBe("");
  });
});
