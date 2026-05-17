// streamingChat.test.ts — buildChatPrompt 직렬화 검증.
//
// 실제 invoke 는 Tauri 의존성 (mock 도 가능하지만 streamingHandle 쪽에서 이미
// 검증) 이므로 본 파일은 prompt 빌더의 행동만 단위 테스트한다.

import { describe, expect, it } from "vitest";

import {
  buildChatPrompt,
  type ChatMessage,
} from "../../src/ai/streamingChat";

describe("buildChatPrompt", () => {
  it("systemPrompt + notesContext + 3턴 대화 모두 포함하여 직렬화한다", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "안녕하세요." },
      { role: "assistant", content: "반갑습니다." },
      { role: "user", content: "제 글을 봐주세요." },
    ];
    const out = buildChatPrompt({
      messages,
      systemPrompt: "당신은 글쓰기 코치입니다.",
      notesContext: "노트A 본문\n---\n노트B 본문",
    });

    // <system> 블록 존재.
    expect(out).toContain("<system>");
    expect(out).toContain("</system>");
    expect(out).toContain("당신은 글쓰기 코치입니다.");
    expect(out).toContain("## 참고 노트 (옵시디언 볼트)");
    expect(out).toContain("노트A 본문");
    expect(out).toContain("노트B 본문");

    // 모든 messages 직렬화.
    expect(out).toContain("<user>\n안녕하세요.\n</user>");
    expect(out).toContain("<assistant>\n반갑습니다.\n</assistant>");
    expect(out).toContain("<user>\n제 글을 봐주세요.\n</user>");

    // 순서: system 블록이 first, 마지막 메시지가 last.
    expect(out.indexOf("<system>")).toBeLessThan(out.indexOf("<user>"));
    expect(out.lastIndexOf("<user>\n제 글을 봐주세요.\n</user>")).toBe(
      out.length - "<user>\n제 글을 봐주세요.\n</user>".length,
    );
  });

  it("notesContext 가 빈 문자열이면 '## 참고 노트' 섹션을 생략한다", () => {
    const out = buildChatPrompt({
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "system text",
      notesContext: "",
    });

    expect(out).toContain("<system>");
    expect(out).toContain("system text");
    expect(out).not.toContain("## 참고 노트");
  });

  it("notesContext undefined 일 때도 섹션을 생략한다", () => {
    const out = buildChatPrompt({
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "only system",
    });
    expect(out).toContain("only system");
    expect(out).not.toContain("## 참고 노트");
  });

  it("systemPrompt + notesContext 둘 다 비어있으면 <system> 블록 자체가 없다", () => {
    const out = buildChatPrompt({
      messages: [
        { role: "user", content: "한 줄 메시지" },
      ],
    });
    expect(out).not.toContain("<system>");
    expect(out).not.toContain("</system>");
    expect(out).not.toContain("## 참고 노트");
    expect(out).toBe("<user>\n한 줄 메시지\n</user>");
  });

  it("systemPrompt 만 공백이고 notesContext 가 있으면 system 블록 안에 노트만 들어간다", () => {
    const out = buildChatPrompt({
      messages: [{ role: "user", content: "q" }],
      systemPrompt: "   ",
      notesContext: "노트 본문",
    });
    expect(out).toContain("<system>");
    expect(out).toContain("## 참고 노트");
    expect(out).toContain("노트 본문");
  });

  it("messages.length === 0 이면 throw 한다", () => {
    expect(() =>
      buildChatPrompt({ messages: [], systemPrompt: "x" }),
    ).toThrow(/messages 가 비어있음/);
  });

  it("마지막 메시지가 assistant 인 경우도 그대로 직렬화한다", () => {
    const out = buildChatPrompt({
      messages: [
        { role: "user", content: "첫 질문" },
        { role: "assistant", content: "응답입니다." },
      ],
    });
    // assistant 가 마지막에 위치.
    const userIdx = out.indexOf("<user>\n첫 질문\n</user>");
    const asstIdx = out.indexOf("<assistant>\n응답입니다.\n</assistant>");
    expect(userIdx).toBeGreaterThanOrEqual(0);
    expect(asstIdx).toBeGreaterThan(userIdx);
    // 그리고 마지막 토큰이 </assistant>.
    expect(out.endsWith("</assistant>")).toBe(true);
  });
});
