// conceptWizardStore.test.ts — P1-T1 단계 전이 + 챕터 조작 단위 테스트.
//
// vitest + jsdom (vitest.config.ts 의 environment="jsdom"). sessionStorage 는
// jsdom 이 기본 제공하지만, 안전망으로 setup 단계에서 한 번 비워둔다.

import { beforeEach, describe, expect, it } from "vitest";
import type { OutlineChapter } from "@ai-manuscript-studio/core";
import {
  STORAGE_KEY,
  useConceptWizardStore,
} from "../../src/state/conceptWizardStore";

function reset(): void {
  // store 자체와 persist 캐시를 둘 다 비워서 테스트 격리.
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function makeChapters(n: number): OutlineChapter[] {
  return Array.from({ length: n }, (_, i) => {
    const id = `ch-${String(i + 1).padStart(2, "0")}`;
    return { id, title: `장 ${i + 1}`, summary: `장 ${i + 1} 요약` };
  });
}

beforeEach(() => {
  reset();
});

describe("conceptWizardStore — 단계 전이", () => {
  it("start() 후 stage='concept', session 활성, conversation 빈 배열, attachedNotes 보존", () => {
    const store = useConceptWizardStore.getState();
    store.start({
      seed: "옵시디언으로 글쓰기",
      tone: "essay",
      genre: "essay",
      attachedNotes: ["[[노트A]]", "[[노트B]]"],
    });

    const s = useConceptWizardStore.getState().session;
    expect(s).not.toBeNull();
    expect(s!.stage).toBe("concept");
    expect(s!.conversation).toEqual([]);
    expect(s!.attachedNotes).toEqual(["[[노트A]]", "[[노트B]]"]);
    expect(s!.seed).toBe("옵시디언으로 글쓰기");
    expect(s!.tone).toBe("essay");
    expect(s!.genre).toBe("essay");
    expect(s!.conceptParagraph).toBe("");
    expect(s!.synopsis).toBe("");
    expect(s!.outline).toEqual([]);
    expect(useConceptWizardStore.getState().isOpen).toBe(true);
  });

  it("appendMessage * N + setConceptParagraph + goStage('synopsis') → stage 갱신, paragraph 보존", () => {
    const store = useConceptWizardStore.getState();
    store.start({
      seed: "시드",
      tone: "novel",
      genre: "world",
      attachedNotes: [],
    });

    store.appendMessage("assistant", "어떤 이야기를 쓰고 싶나요?");
    store.appendMessage("user", "성장 소설을 쓰고 싶어요.");
    store.appendMessage("assistant", "주인공의 결핍은 무엇인가요?");
    store.setConceptParagraph("X");
    store.goStage("synopsis");

    const s = useConceptWizardStore.getState().session!;
    expect(s.stage).toBe("synopsis");
    expect(s.conceptParagraph).toBe("X");
    expect(s.conversation).toHaveLength(3);
    expect(s.conversation[0].role).toBe("assistant");
    expect(s.conversation[1].role).toBe("user");
    expect(s.conversation[2].content).toBe("주인공의 결핍은 무엇인가요?");
  });

  it("setSynopsis + setOutline(12) + goStage('outline') → outline 길이 12, stage 갱신", () => {
    const store = useConceptWizardStore.getState();
    store.start({
      seed: "시드",
      tone: "nonfiction",
      genre: "practical",
      attachedNotes: [],
    });
    store.goStage("synopsis");
    store.setSynopsis("Y");
    store.setOutline(makeChapters(12));
    store.goStage("outline");

    const s = useConceptWizardStore.getState().session!;
    expect(s.stage).toBe("outline");
    expect(s.synopsis).toBe("Y");
    expect(s.outline).toHaveLength(12);
    expect(s.outline[0].id).toBe("ch-01");
    expect(s.outline[11].id).toBe("ch-12");
  });

  it("goStage('done') → stage='done'", () => {
    const store = useConceptWizardStore.getState();
    store.start({
      seed: "시드",
      tone: "screenplay",
      genre: "youtube",
      attachedNotes: [],
    });
    store.goStage("done");
    expect(useConceptWizardStore.getState().session!.stage).toBe("done");
  });
});

describe("conceptWizardStore — 챕터 조작", () => {
  beforeEach(() => {
    const store = useConceptWizardStore.getState();
    store.start({
      seed: "시드",
      tone: "novel",
      genre: "world",
      attachedNotes: [],
    });
    store.setOutline(makeChapters(5));
  });

  it("reorderChapters: 명시한 순서대로 재정렬", () => {
    useConceptWizardStore
      .getState()
      .reorderChapters(["ch-03", "ch-01", "ch-05", "ch-02", "ch-04"]);
    const ids = useConceptWizardStore
      .getState()
      .session!.outline.map((c) => c.id);
    expect(ids).toEqual(["ch-03", "ch-01", "ch-05", "ch-02", "ch-04"]);
  });

  it("mergeChapters: 길이 -1, 합쳐진 title 에 '/' 포함, summary 에 '\\n\\n' 포함", () => {
    useConceptWizardStore.getState().mergeChapters("ch-02", "ch-03");
    const out = useConceptWizardStore.getState().session!.outline;
    expect(out).toHaveLength(4);
    // ch-02 자리에 새 머지 챕터, ch-03 사라짐.
    expect(out.some((c) => c.id === "ch-03")).toBe(false);
    const merged = out[1];
    expect(merged.title).toContain("/");
    expect(merged.title).toBe("장 2 / 장 3");
    expect(merged.summary).toContain("\n\n");
    expect(merged.summary).toBe("장 2 요약\n\n장 3 요약");
  });

  it("splitChapter: 1장 → 3장, 길이 +2", () => {
    useConceptWizardStore.getState().splitChapter("ch-03", [
      { title: "전반", summary: "앞쪽" },
      { title: "중반", summary: "가운데" },
      { title: "후반", summary: "뒤쪽" },
    ]);
    const out = useConceptWizardStore.getState().session!.outline;
    expect(out).toHaveLength(7);
    // ch-03 의 위치(index 2)에 새 3장이 들어감.
    expect(out[2].title).toBe("전반");
    expect(out[3].title).toBe("중반");
    expect(out[4].title).toBe("후반");
    // 새 id 들은 ch-06, ch-07, ch-08 (이전 max=5).
    expect(out[2].id).toBe("ch-06");
    expect(out[3].id).toBe("ch-07");
    expect(out[4].id).toBe("ch-08");
    // 원래 ch-03 은 사라짐.
    expect(out.some((c) => c.id === "ch-03")).toBe(false);
  });

  it("removeChapter: 길이 -1", () => {
    useConceptWizardStore.getState().removeChapter("ch-04");
    const out = useConceptWizardStore.getState().session!.outline;
    expect(out).toHaveLength(4);
    expect(out.some((c) => c.id === "ch-04")).toBe(false);
  });
});
