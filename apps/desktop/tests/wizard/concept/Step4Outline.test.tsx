// Step4Outline.test.tsx — P2-T7 12-30장 master-detail 단위 테스트.
// @TASK P2-T7
//
// 시나리오:
//  1. outline 빈 상태로 마운트 → 자동 streaming 호출 + parseOutlineResponse + setOutline.
//  2. outline 12개 있는 상태로 마운트 → 자동 호출 X, 첫 장 선택됨.
//  3. 우측 title 변경 → updateChapter 호출.
//  4. "이 장만 재제안" → mock chat 호출 + JSON parse → updateChapter.
//  5. "다음" disabled (outline.length=11) → 12로 늘리면 enabled → 클릭 시 onAdvance.
//  6. "이전" 클릭 → onBack.
//  7. parseOutlineResponse 단위 테스트 — 정상 / fence 감싼 / 잡담 포함 / invalid throw.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// useStreamingChat mock
vi.mock("../../../src/ai/useStreamingChat", () => ({
  useStreamingChat: vi.fn(),
}));

// fetchNotesForContext mock
vi.mock("../../../src/vaultAdapter", () => ({
  fetchNotesForContext: vi.fn().mockResolvedValue({
    context: "",
    found: [],
    notFound: [],
  }),
}));

import { useStreamingChat } from "../../../src/ai/useStreamingChat";
import {
  STORAGE_KEY,
  useConceptWizardStore,
} from "../../../src/state/conceptWizardStore";
import { Step4Outline } from "../../../src/wizard/concept/Step4Outline";
import { parseOutlineResponse } from "../../../src/wizard/concept/outlinePrompts";
import type { OutlineChapter } from "@ai-manuscript-studio/core";

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeStreamingHook(
  overrides: Partial<{
    run: Mock;
    buffer: string;
    isStreaming: boolean;
    error: string | null;
    cancel: Mock;
    reset: Mock;
  }> = {},
) {
  return {
    run: overrides.run ?? vi.fn().mockResolvedValue("[]"),
    buffer: overrides.buffer ?? "",
    isStreaming: overrides.isStreaming ?? false,
    error: overrides.error ?? null,
    cancel: overrides.cancel ?? vi.fn(),
    reset: overrides.reset ?? vi.fn(),
  };
}

function makeChapters(count: number): OutlineChapter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ch-${String(i + 1).padStart(2, "0")}`,
    title: `장 제목 ${i + 1}`,
    summary: `장 ${i + 1} 의 일세 내용입니다. 충분히 길게 작성한 요약.`,
  }));
}

const VALID_JSON_RESPONSE = JSON.stringify(
  makeChapters(14).map((c) => ({ title: c.title, summary: c.summary })),
);

function startSession(outline: OutlineChapter[] = []): void {
  useConceptWizardStore.getState().start({
    seed: "테스트 시드",
    tone: "novel",
    genre: "world",
    attachedNotes: [],
  });
  useConceptWizardStore.getState().setConceptParagraph("컨셉 단락 내용.");
  useConceptWizardStore.getState().setSynopsis("시놉시스 내용입니다.");
  if (outline.length > 0) {
    useConceptWizardStore.getState().setOutline(outline);
  }
}

function resetStore(): void {
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// ─── 테스트 ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(() => {
  resetStore();
});

// ── 시나리오 1: outline 빈 상태 → 자동 streaming 호출 ────────────────────────

describe("Step4Outline — 시나리오1: 빈 outline → 자동 streaming", () => {
  it("outline 빈 상태로 마운트 시 run 이 자동 호출되고 setOutline 이 반영된다", async () => {
    const mockRun = vi.fn().mockResolvedValue(VALID_JSON_RESPONSE);
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun }),
    );

    startSession(); // outline = []
    render(<Step4Outline />);

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const { outline } = useConceptWizardStore.getState().session!;
      expect(outline.length).toBe(14);
      expect(outline[0].title).toBe("장 제목 1");
    });
  });

  it("자동 streaming 호출 시 generating indicator 가 표시된다", () => {
    let resolveRun!: (v: string) => void;
    const mockRun = vi.fn().mockReturnValue(
      new Promise<string>((r) => {
        resolveRun = r;
      }),
    );
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun, isStreaming: true }),
    );

    startSession();
    render(<Step4Outline />);

    expect(screen.getByTestId("step4-generating-indicator")).toBeInTheDocument();

    // cleanup
    act(() => {
      resolveRun("[]");
    });
  });
});

// ── 시나리오 2: outline 있는 상태 → 자동 호출 X, 첫 장 선택됨 ───────────────

describe("Step4Outline — 시나리오2: outline 있으면 자동 호출 X", () => {
  it("outline 12개 있는 상태로 마운트 시 run 미호출, 첫 장이 선택된다", () => {
    const mockRun = vi.fn();
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun }),
    );

    const chapters = makeChapters(12);
    startSession(chapters);
    render(<Step4Outline />);

    // run 호출 없어야 함
    expect(mockRun).not.toHaveBeenCalled();

    // 첫 장 제목이 우측 input 에 표시됨
    const titleInput = screen.getByTestId(
      "step4-chapter-title-input",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("장 제목 1");
  });
});

// ── 시나리오 3: 우측 title 변경 → updateChapter 호출 ──────────────────────────

describe("Step4Outline — 시나리오3: title 변경", () => {
  it("title input 변경 시 store.updateChapter 가 반영된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const chapters = makeChapters(12);
    startSession(chapters);
    render(<Step4Outline />);

    const titleInput = screen.getByTestId(
      "step4-chapter-title-input",
    ) as HTMLInputElement;

    act(() => {
      fireEvent.change(titleInput, { target: { value: "새로운 장 제목" } });
    });

    const { outline } = useConceptWizardStore.getState().session!;
    expect(outline[0].title).toBe("새로운 장 제목");
  });

  it("summary textarea 변경 시 store.updateChapter 가 반영된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const chapters = makeChapters(12);
    startSession(chapters);
    render(<Step4Outline />);

    const textarea = screen.getByTestId(
      "step4-chapter-summary-textarea",
    ) as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(textarea, { target: { value: "변경된 일세 내용입니다." } });
    });

    const { outline } = useConceptWizardStore.getState().session!;
    expect(outline[0].summary).toBe("변경된 일세 내용입니다.");
  });
});

// ── 시나리오 4: "이 장만 재제안" → run 호출 + updateChapter ──────────────────

describe("Step4Outline — 시나리오4: 단장 재제안", () => {
  it("'이 장만 재제안' 클릭 시 singleStreaming.run 이 호출되고 updateChapter 가 반영된다", async () => {
    const refinedJson = JSON.stringify([
      { title: "재제안된 제목", summary: "재제안된 일세입니다." },
    ]);
    // 두 번째 useStreamingChat 인스턴스 (singleStreaming)
    const mainRunMock = vi.fn().mockResolvedValue("[]");
    const singleRunMock = vi.fn().mockResolvedValue(refinedJson);

    let callCount = 0;
    (useStreamingChat as Mock).mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return makeStreamingHook({ run: mainRunMock });
      }
      return makeStreamingHook({ run: singleRunMock });
    });

    const chapters = makeChapters(12);
    startSession(chapters);
    render(<Step4Outline />);

    const refineBtn = screen.getByTestId("step4-single-refine-btn");
    await act(async () => {
      fireEvent.click(refineBtn);
    });

    await waitFor(() => {
      expect(singleRunMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      const { outline } = useConceptWizardStore.getState().session!;
      expect(outline[0].title).toBe("재제안된 제목");
      expect(outline[0].summary).toBe("재제안된 일세입니다.");
    });
  });
});

// ── 시나리오 5: "다음" disabled/enabled + onAdvance ───────────────────────────

describe("Step4Outline — 시나리오5: 다음 버튼", () => {
  it("outline.length=11 이면 다음 버튼이 disabled 된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const chapters = makeChapters(11);
    startSession(chapters);
    render(<Step4Outline />);

    const nextBtn = screen.getByTestId("step4-next-btn");
    expect(nextBtn).toBeDisabled();
  });

  it("outline.length=12 이면 다음 버튼이 활성화되고 클릭 시 onAdvance 가 호출된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const onAdvance = vi.fn();
    const chapters = makeChapters(12);
    startSession(chapters);
    render(<Step4Outline onAdvance={onAdvance} />);

    const nextBtn = screen.getByTestId("step4-next-btn");
    expect(nextBtn).not.toBeDisabled();

    act(() => {
      fireEvent.click(nextBtn);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(useConceptWizardStore.getState().session?.stage).toBe("done");
  });

  it("outline.length=30 이상이어도 다음 버튼이 활성화된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const chapters = makeChapters(30);
    startSession(chapters);
    render(<Step4Outline />);

    expect(screen.getByTestId("step4-next-btn")).not.toBeDisabled();
  });
});

// ── 시나리오 6: "이전" 클릭 → onBack ─────────────────────────────────────────

describe("Step4Outline — 시나리오6: 이전 버튼", () => {
  it("'이전' 클릭 시 onBack 이 호출되고 stage='synopsis' 로 전이된다", () => {
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook());

    const chapters = makeChapters(12);
    startSession(chapters);

    const onBack = vi.fn();
    render(<Step4Outline onBack={onBack} />);

    const backBtn = screen.getByTestId("step4-back-btn");
    act(() => {
      fireEvent.click(backBtn);
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(useConceptWizardStore.getState().session?.stage).toBe("synopsis");
  });
});

// ── 시나리오 7: parseOutlineResponse 단위 테스트 ─────────────────────────────

describe("parseOutlineResponse", () => {
  it("정상 JSON 배열을 파싱한다", () => {
    const raw = JSON.stringify([
      { title: "첫 번째 장", summary: "첫 번째 요약." },
      { title: "두 번째 장", summary: "두 번째 요약." },
    ]);
    const result = parseOutlineResponse(raw);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("첫 번째 장");
    expect(result[1].summary).toBe("두 번째 요약.");
  });

  it("```json ... ``` 코드 펜스가 감싼 응답을 파싱한다", () => {
    const raw = `\`\`\`json\n${JSON.stringify([
      { title: "펜스 장", summary: "펜스 요약." },
    ])}\n\`\`\``;
    const result = parseOutlineResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("펜스 장");
  });

  it("앞뒤 잡담이 포함된 응답에서 JSON 배열만 추출한다", () => {
    const arr = [{ title: "잡담 속 장", summary: "잡담 속 요약." }];
    const raw = `여기 목차입니다:\n\n${JSON.stringify(arr)}\n\n이상입니다.`;
    const result = parseOutlineResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("잡담 속 장");
  });

  it("JSON 배열이 없으면 에러를 throw 한다", () => {
    expect(() => parseOutlineResponse("배열이 없는 텍스트입니다.")).toThrow(
      /JSON 배열을 찾지 못했습니다/,
    );
  });

  it("title 이 비어있는 항목이 있으면 에러를 throw 한다", () => {
    const raw = JSON.stringify([{ title: "", summary: "요약" }]);
    expect(() => parseOutlineResponse(raw)).toThrow(/title 비어있음/);
  });

  it("배열 형태가 아닌 JSON 이면 에러를 throw 한다", () => {
    const raw = JSON.stringify({ title: "객체", summary: "요약" });
    expect(() => parseOutlineResponse(raw)).toThrow();
  });
});

// ── 에러 배너 ─────────────────────────────────────────────────────────────────

describe("Step4Outline — 에러 배너", () => {
  it("streaming.error 가 있으면 에러 배너가 표시된다", () => {
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({
        run: vi.fn().mockRejectedValue(new Error("API 실패")),
        error: "API 실패",
      }),
    );

    startSession();
    render(<Step4Outline />);

    const banner = screen.getByTestId("step4-error-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("API 실패");
  });

  it("에러 배너의 '다시 시도' 버튼 클릭 시 run 이 재호출된다", async () => {
    const mockRun = vi
      .fn()
      .mockResolvedValue(VALID_JSON_RESPONSE);
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun, error: "이전 에러" }),
    );

    startSession();
    render(<Step4Outline />);

    const retryBtn = screen.getByTestId("step4-retry-btn");
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    // 마운트 시 자동 run + 재시도 클릭 run = 2회
    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(2);
    });
  });
});
