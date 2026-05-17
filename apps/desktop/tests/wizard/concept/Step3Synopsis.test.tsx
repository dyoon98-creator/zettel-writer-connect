// Step3Synopsis.test.tsx — P2-T6 시놉시스 streaming + 인라인 편집 단위 테스트.
// @TASK P2-T6
//
// 시나리오:
//  1. session.synopsis 빈 상태로 마운트 → useStreamingChat.run 자동 호출 + setSynopsis 호출.
//  2. session.synopsis 있는 상태로 마운트 → 자동 호출 X, textarea 즉시 보임.
//  3. "다시 다듬기" 클릭 + refineHint 입력 → run 재호출.
//  4. "다음" disabled (synopsis 빈) → 입력 후 enabled → 클릭 시 onAdvance.
//  5. "이전" 클릭 → onBack 호출.

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

// useStreamingChat mock — run 을 교체.
vi.mock("../../../src/ai/useStreamingChat", () => ({
  useStreamingChat: vi.fn(),
}));

// fetchNotesForContext mock — 네트워크/vault 없이 동작.
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
import { Step3Synopsis } from "../../../src/wizard/concept/Step3Synopsis";

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function makeStreamingHook(overrides: Partial<{
  run: Mock;
  buffer: string;
  isStreaming: boolean;
  error: string | null;
  cancel: Mock;
  reset: Mock;
}> = {}) {
  return {
    run: overrides.run ?? vi.fn().mockResolvedValue("생성된 시놉시스"),
    buffer: overrides.buffer ?? "",
    isStreaming: overrides.isStreaming ?? false,
    error: overrides.error ?? null,
    cancel: overrides.cancel ?? vi.fn(),
    reset: overrides.reset ?? vi.fn(),
  };
}

function startSession(synopsisOverride = ""): void {
  useConceptWizardStore.getState().start({
    seed: "테스트 시드",
    tone: "novel",
    genre: "world",
    attachedNotes: [],
  });
  // conceptParagraph 세팅 (직접 setConceptParagraph 사용).
  useConceptWizardStore.getState().setConceptParagraph("컨셉 단락 내용입니다.");
  if (synopsisOverride) {
    useConceptWizardStore.getState().setSynopsis(synopsisOverride);
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

describe("Step3Synopsis", () => {
  // ── 시나리오 1: 빈 synopsis → 자동 streaming 호출 ─────────────────────────

  it("시나리오1: synopsis 빈 상태로 마운트 시 run 이 자동 호출되고 setSynopsis 가 불린다", async () => {
    const mockRun = vi.fn().mockResolvedValue("자동 생성 시놉시스");
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook({ run: mockRun }));

    startSession(); // synopsis = ""

    render(<Step3Synopsis />);

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    // setSynopsis 가 store 에 반영됨.
    await waitFor(() => {
      const s = useConceptWizardStore.getState().session;
      expect(s?.synopsis).toBe("자동 생성 시놉시스");
    });
  });

  // ── 시나리오 2: synopsis 있으면 자동 호출 X, textarea 즉시 보임 ─────────────

  it("시나리오2: synopsis 있는 상태로 마운트 시 run 호출 없이 textarea 가 보인다", async () => {
    const mockRun = vi.fn();
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook({ run: mockRun }));

    startSession("기존 시놉시스 텍스트");

    render(<Step3Synopsis />);

    // textarea 가 즉시 보임.
    const textarea = await screen.findByTestId("synopsis-textarea");
    expect(textarea).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value).toBe("기존 시놉시스 텍스트");

    // run 은 호출되지 않아야 함.
    expect(mockRun).not.toHaveBeenCalled();
  });

  // ── 시나리오 3: "다시 다듬기" 클릭 + refineHint → run 재호출 ────────────────

  it("시나리오3: refineHint 입력 후 '다시 다듬기' 클릭 시 run 이 재호출된다", async () => {
    const mockRun = vi.fn().mockResolvedValue("다듬어진 시놉시스");
    (useStreamingChat as Mock).mockReturnValue(makeStreamingHook({ run: mockRun }));

    startSession("기존 시놉시스");

    render(<Step3Synopsis />);

    // refineHint 입력.
    const refineInput = screen.getByTestId("refine-hint-input");
    fireEvent.change(refineInput, { target: { value: "더 짧게 써줘" } });

    // "다시 다듬기" 클릭.
    const refineBtn = screen.getByTestId("refine-button");
    await act(async () => {
      fireEvent.click(refineBtn);
    });

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    // run 호출 인자에 refineHint 가 포함됐는지 확인.
    const callArg = mockRun.mock.calls[0][0];
    const userContent = callArg.messages[0].content as string;
    expect(userContent).toContain("더 짧게 써줘");
  });

  // ── 시나리오 4: "다음" 버튼 disabled → 입력 후 enabled → onAdvance ──────────

  it("시나리오4: synopsis 비어있으면 다음 버튼 disabled, 입력 후 enabled, 클릭 시 onAdvance 호출", async () => {
    // synopsis 없는 상태. run 은 resolve 되기 전까지 pending.
    let resolveRun!: (v: string) => void;
    const mockRun = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => { resolveRun = resolve; }),
    );
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun, isStreaming: true }),
    );

    startSession(); // synopsis = ""

    const onAdvance = vi.fn();
    const onBack = vi.fn();

    render(<Step3Synopsis onAdvance={onAdvance} onBack={onBack} />);

    // streaming 중: 다음 버튼 disabled.
    const nextBtn = screen.getByTestId("next-button");
    expect(nextBtn).toBeDisabled();

    // streaming 완료 시뮬레이션 — isStreaming=false + synopsis 있음.
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: mockRun, isStreaming: false }),
    );
    act(() => {
      resolveRun("새 시놉시스");
      useConceptWizardStore.getState().setSynopsis("새 시놉시스");
    });

    // textarea 에 직접 값 입력 후 활성화 확인.
    await waitFor(async () => {
      const textarea = screen.queryByTestId("synopsis-textarea");
      if (textarea) {
        fireEvent.change(textarea, { target: { value: "새 시놉시스" } });
      }
    });

    // store 에 직접 set 해서 next 버튼 활성화 유도.
    act(() => {
      useConceptWizardStore.getState().setSynopsis("새 시놉시스");
    });

    // re-render 로 버튼 상태 확인은 최신 mock 상태로.
    // isStreaming=false + synopsis 있음 → enabled.
    const { rerender } = render(<Step3Synopsis onAdvance={onAdvance} onBack={onBack} />);
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: vi.fn().mockResolvedValue(""), isStreaming: false }),
    );
    rerender(<Step3Synopsis onAdvance={onAdvance} onBack={onBack} />);

    const nextBtnActive = screen.getAllByTestId("next-button")[1];
    expect(nextBtnActive).not.toBeDisabled();

    fireEvent.click(nextBtnActive);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // store stage 가 "outline" 으로 변경됐는지.
    expect(useConceptWizardStore.getState().session?.stage).toBe("outline");
  });

  // ── 시나리오 5: "이전" 클릭 → onBack 호출 ────────────────────────────────

  it("시나리오5: '이전' 클릭 시 onBack 호출 + stage='concept' 전이", async () => {
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({ run: vi.fn().mockResolvedValue("") }),
    );

    startSession("기존 시놉시스");

    const onBack = vi.fn();
    render(<Step3Synopsis onBack={onBack} />);

    const backBtn = screen.getByTestId("back-button");
    fireEvent.click(backBtn);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(useConceptWizardStore.getState().session?.stage).toBe("concept");
  });

  // ── 에러 배너 렌더 확인 ───────────────────────────────────────────────────

  it("streaming 에러 발생 시 에러 배너가 보인다", () => {
    (useStreamingChat as Mock).mockReturnValue(
      makeStreamingHook({
        run: vi.fn().mockRejectedValue(new Error("API 실패")),
        error: "API 실패",
      }),
    );

    startSession("기존 시놉시스");

    render(<Step3Synopsis />);

    const banner = screen.getByTestId("error-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("API 실패");
  });
});
