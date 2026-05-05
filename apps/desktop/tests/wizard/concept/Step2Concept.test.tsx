// Step2Concept.test.tsx — P2-T5 컨셉 마법사 2단계 다턴 chat 테스트.
//
// useStreamingChat 을 vi.mock 으로 stub.
// fetchNotesForContext 를 vi.mock 으로 stub.
// useConceptWizardStore 실 store 를 사용 (격리 위해 beforeEach 에서 reset).

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// ---- mock: useStreamingChat ------------------------------------------------

type StreamingChatRunFn = (opts: unknown) => Promise<string>;

const mockRun = vi.fn<StreamingChatRunFn>();
const mockCancel = vi.fn();
const mockReset = vi.fn();

// 각 테스트에서 buffer/isStreaming/error 를 제어할 수 있도록 state ref 로 관리.
let mockBuffer = "";
let mockIsStreaming = false;
let mockError: string | null = null;

vi.mock("../../../src/ai/useStreamingChat", () => ({
  useStreamingChat: () => ({
    run: mockRun,
    buffer: mockBuffer,
    isStreaming: mockIsStreaming,
    error: mockError,
    cancel: mockCancel,
    reset: mockReset,
  }),
}));

// ---- mock: fetchNotesForContext --------------------------------------------

vi.mock("../../../src/vaultAdapter", () => ({
  fetchNotesForContext: vi.fn(async () => ({
    context: "",
    found: [],
    notFound: [],
  })),
}));

// ---- store -----------------------------------------------------------------

import { STORAGE_KEY, useConceptWizardStore } from "../../../src/state/conceptWizardStore";
import { Step2Concept } from "../../../src/wizard/concept/Step2Concept";

function resetStore(): void {
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function startSession(seed = "옵시디언으로 책 쓰기"): void {
  useConceptWizardStore.getState().start({
    seed,
    tone: "essay",
    genre: "essay",
    attachedNotes: [],
  });
}

// ---- 공통 setup ------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockBuffer = "";
  mockIsStreaming = false;
  mockError = null;
  resetStore();

  // 기본 run stub: "첫 AI 응답입니다" 반환.
  (mockRun as MockedFunction<StreamingChatRunFn>).mockResolvedValue("첫 AI 응답입니다.");
});

afterEach(() => {
  resetStore();
});

// ---- 시나리오 1: 첫 렌더 — 시드를 user message 로 push 후 AI 호출 ----------

describe("시나리오 1: 첫 진입 시 시드 push + AI 호출", () => {
  it("세션이 없으면 아무것도 렌더하지 않는다 (null session guard)", () => {
    // store.start() 없이 렌더.
    render(<Step2Concept />);
    // step2-concept 루트는 렌더되지만 session null 이므로 conversation 없음.
    expect(screen.getByTestId("step2-concept")).toBeInTheDocument();
    // AI 호출 없음 — session 없으면 useEffect 조기 리턴.
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("첫 진입 시 시드가 user 메시지로 push 되고 AI(run)가 호출된다", async () => {
    startSession("옵시디언으로 책 쓰기");

    render(<Step2Concept />);

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledOnce();
    });

    // run 에 전달된 messages 의 첫 원소가 { role: "user", content: seed }.
    const callArg = (mockRun as MockedFunction<StreamingChatRunFn>).mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(callArg.messages[0]).toMatchObject({ role: "user", content: "옵시디언으로 책 쓰기" });
  });

  it("AI run 완료 후 assistant 메시지가 conversation 에 추가된다", async () => {
    (mockRun as MockedFunction<StreamingChatRunFn>).mockResolvedValue("AI 코치의 첫 질문입니다.");
    startSession();

    render(<Step2Concept />);

    await waitFor(() => {
      const store = useConceptWizardStore.getState();
      const msgs = store.session?.conversation ?? [];
      return expect(msgs.some((m) => m.role === "assistant" && m.content === "AI 코치의 첫 질문입니다.")).toBe(true);
    });

    // 화면에도 렌더되어야 함.
    await waitFor(() => {
      expect(screen.getByText("AI 코치의 첫 질문입니다.")).toBeInTheDocument();
    });
  });

  it("이미 conversation 이 있으면 AI 첫 호출을 중복하지 않는다 (resume)", async () => {
    startSession();
    // 미리 conversation 채워두기.
    useConceptWizardStore.getState().appendMessage("user", "기존 시드");
    useConceptWizardStore.getState().appendMessage("assistant", "기존 AI 응답");

    render(<Step2Concept />);

    // 첫 useEffect 가 conversation.length > 0 을 감지해 skip.
    await new Promise((r) => setTimeout(r, 50));
    expect(mockRun).not.toHaveBeenCalled();
  });
});

// ---- 시나리오 2: 작가 textarea 입력 + Cmd+Enter 전송 ----------------------

describe("시나리오 2: 작가 textarea 입력 + Cmd+Enter", () => {
  it("Cmd+Enter 로 전송 시 user 메시지 추가 + AI run 호출", async () => {
    (mockRun as MockedFunction<StreamingChatRunFn>).mockResolvedValue("AI 응답.");
    startSession();
    render(<Step2Concept />);

    // 첫 AI 호출 완료 대기.
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    const ta = screen.getByTestId("concept-input") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "더 어두운 톤" } });
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(mockRun).toHaveBeenCalledTimes(2);
    });

    const store = useConceptWizardStore.getState();
    const userMsgs = store.session?.conversation.filter((m) => m.role === "user") ?? [];
    expect(userMsgs.some((m) => m.content === "더 어두운 톤")).toBe(true);
  });

  it("빈 draft 는 전송하지 않는다", async () => {
    startSession();
    render(<Step2Concept />);

    // 첫 AI 호출 완료 대기.
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    const ta = screen.getByTestId("concept-input") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "   " } });
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });

    await new Promise((r) => setTimeout(r, 30));
    // 추가 호출 없음.
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("AI 신호 감지 시 readyHint 버튼 텍스트가 변경된다", async () => {
    (mockRun as MockedFunction<StreamingChatRunFn>).mockResolvedValue("이제 컨셉 단락을 정리해 드릴까요?");
    startSession();
    render(<Step2Concept />);

    await waitFor(() => {
      expect(screen.getByTestId("concept-distill-btn")).toHaveTextContent(
        "AI 신호 — 정리해 보기",
      );
    });
  });
});

// ---- 시나리오 3: "정리해 보기" 버튼 → conceptParagraph 갱신 ---------------

describe("시나리오 3: 정리해 보기 → conceptParagraph 갱신", () => {
  it("정리해 보기 클릭 시 distill run 호출 + setConceptParagraph", async () => {
    // 첫 호출: 일반 AI 응답 / 두 번째 호출: distill 결과.
    (mockRun as MockedFunction<StreamingChatRunFn>)
      .mockResolvedValueOnce("AI 코치 응답.")
      .mockResolvedValueOnce("정리된 컨셉 단락입니다.");

    startSession();
    render(<Step2Concept />);

    // 첫 AI 호출 완료 대기.
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));

    const distillBtn = screen.getByTestId("concept-distill-btn");
    await act(async () => {
      fireEvent.click(distillBtn);
    });

    await waitFor(() => {
      const para = useConceptWizardStore.getState().session?.conceptParagraph;
      expect(para).toBe("정리된 컨셉 단락입니다.");
    });

    // 미리보기에도 반영.
    await waitFor(() => {
      expect(screen.getByTestId("concept-paragraph-preview")).toHaveTextContent(
        "정리된 컨셉 단락입니다.",
      );
    });
  });

  it("session 이 없으면 정리해 보기 버튼이 disabled (no session guard)", () => {
    // store.start() 없이 렌더 — session null 이므로 conversation 빈 배열.
    render(<Step2Concept />);

    const distillBtn = screen.getByTestId("concept-distill-btn");
    expect(distillBtn).toBeDisabled();
  });
});

// ---- 시나리오 4: "다음" 버튼 disabled/enabled + onAdvance 호출 ------------

describe("시나리오 4: 다음 버튼 disabled/enabled", () => {
  it("conceptParagraph 가 비어있으면 다음 버튼이 disabled", () => {
    startSession();
    render(<Step2Concept />);

    expect(screen.getByTestId("concept-next")).toBeDisabled();
  });

  it("conceptParagraph 설정 후 다음 버튼 enabled, 클릭 시 onAdvance 호출", async () => {
    startSession();
    render(<Step2Concept />);

    // conceptParagraph 직접 설정.
    act(() => {
      useConceptWizardStore.getState().setConceptParagraph("컨셉 단락입니다.");
    });

    await waitFor(() => {
      expect(screen.getByTestId("concept-next")).not.toBeDisabled();
    });

    const onAdvance = vi.fn();
    // re-render 없이 store 변경만으로 버튼이 enabled 되므로 직접 클릭.
    fireEvent.click(screen.getByTestId("concept-next"));
    // onAdvance 는 prop 으로 전달 안 했으므로 goStage 만 확인.
    const stage = useConceptWizardStore.getState().session?.stage;
    expect(stage).toBe("synopsis");
  });

  it("onAdvance prop 이 있으면 클릭 시 호출된다", async () => {
    startSession();
    const onAdvance = vi.fn();

    render(<Step2Concept onAdvance={onAdvance} />);

    act(() => {
      useConceptWizardStore.getState().setConceptParagraph("단락.");
    });

    await waitFor(() => {
      expect(screen.getByTestId("concept-next")).not.toBeDisabled();
    });

    fireEvent.click(screen.getByTestId("concept-next"));
    expect(onAdvance).toHaveBeenCalledOnce();
  });
});

// ---- 시나리오 5: 노트 chip 추가/제거 --------------------------------------

describe("시나리오 5: 노트 chip 추가/제거", () => {
  it("노트 input 에 [[제목]] 입력 후 Enter → chip 추가", async () => {
    startSession();
    render(<Step2Concept />);

    const noteInput = screen.getByTestId("concept-note-input") as HTMLInputElement;
    fireEvent.change(noteInput, { target: { value: "[[내 노트]]" } });
    fireEvent.keyDown(noteInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("[[내 노트]]")).toBeInTheDocument();
    });

    const store = useConceptWizardStore.getState();
    expect(store.session?.attachedNotes).toContain("[[내 노트]]");
  });

  it("추가 버튼 클릭으로도 노트 추가 가능", async () => {
    startSession();
    render(<Step2Concept />);

    const noteInput = screen.getByTestId("concept-note-input") as HTMLInputElement;
    fireEvent.change(noteInput, { target: { value: "[[노트B]]" } });
    fireEvent.click(screen.getByTestId("concept-note-add"));

    await waitFor(() => {
      expect(screen.getByText("[[노트B]]")).toBeInTheDocument();
    });
  });

  it("chip × 버튼 클릭 시 노트 제거", async () => {
    startSession();
    // 미리 노트 추가.
    act(() => {
      useConceptWizardStore.getState().attachNote("[[제거할 노트]]");
    });

    render(<Step2Concept />);

    await waitFor(() => {
      expect(screen.getByText("[[제거할 노트]]")).toBeInTheDocument();
    });

    const removeBtn = screen.getByTestId("concept-note-chip-remove");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      const store = useConceptWizardStore.getState();
      expect(store.session?.attachedNotes).not.toContain("[[제거할 노트]]");
    });
  });

  it("빈 input 으로 추가 버튼을 눌러도 아무 일도 없다", async () => {
    startSession();
    render(<Step2Concept />);

    const addBtn = screen.getByTestId("concept-note-add");
    expect(addBtn).toBeDisabled();
    fireEvent.click(addBtn);

    const store = useConceptWizardStore.getState();
    expect(store.session?.attachedNotes).toHaveLength(0);
  });
});

// ---- 시나리오 6: 에러 배너 -------------------------------------------------

describe("시나리오 6: 에러 배너", () => {
  it("mainChat.error 가 있으면 에러 배너가 표시된다", async () => {
    mockError = "AI 연결 실패";
    startSession();
    render(<Step2Concept />);

    expect(screen.getByTestId("concept-error-banner")).toBeInTheDocument();
    expect(screen.getByText("AI 연결 실패")).toBeInTheDocument();
  });

  it("재시도 버튼 클릭 시 reset 이 호출된다", async () => {
    mockError = "에러 발생";
    startSession();
    render(<Step2Concept />);

    fireEvent.click(screen.getByTestId("concept-error-retry"));
    expect(mockReset).toHaveBeenCalled();
  });
});
