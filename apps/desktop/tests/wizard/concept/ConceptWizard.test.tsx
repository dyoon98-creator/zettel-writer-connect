// @TASK P3-T10 — ConceptWizard 모달 컨테이너 단위 테스트
//
// Step 컴포넌트는 모두 mock — 내부 AI/streaming 로직 격리.
// store 는 실 store 사용 (beforeEach 에서 reset).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import {
  STORAGE_KEY,
  useConceptWizardStore,
} from "../../../src/state/conceptWizardStore";
import { ConceptWizard } from "../../../src/wizard/concept/ConceptWizard";

// ─── Step 컴포넌트 mock ───────────────────────────────────────────────────────

vi.mock("../../../src/wizard/concept/Step1Seed", () => ({
  Step1Seed: ({ onAdvance }: { onAdvance?: () => void }) => (
    <div data-testid="mock-step1">
      Step1Seed
      <button onClick={onAdvance}>advance</button>
    </div>
  ),
}));

vi.mock("../../../src/wizard/concept/Step2Concept", () => ({
  Step2Concept: ({ onAdvance, onBack }: { onAdvance?: () => void; onBack?: () => void }) => (
    <div data-testid="mock-step2">
      Step2Concept
      <button onClick={onAdvance}>advance</button>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

vi.mock("../../../src/wizard/concept/Step3Synopsis", () => ({
  Step3Synopsis: ({ onAdvance, onBack }: { onAdvance?: () => void; onBack?: () => void }) => (
    <div data-testid="mock-step3">
      Step3Synopsis
      <button onClick={onAdvance}>advance</button>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

vi.mock("../../../src/wizard/concept/Step4Outline", () => ({
  Step4Outline: ({ onAdvance, onBack }: { onAdvance?: () => void; onBack?: () => void }) => (
    <div data-testid="mock-step4">
      Step4Outline
      <button onClick={onAdvance}>advance</button>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

vi.mock("../../../src/wizard/concept/Step5Commit", () => ({
  Step5Commit: ({ onComplete, onBack }: { onComplete?: () => void; onBack?: () => void }) => (
    <div data-testid="mock-step5">
      Step5Commit
      <button onClick={onComplete}>complete</button>
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

// conceptSessionPersist mock (vault I/O 차단)
vi.mock("../../../src/wizard/concept/conceptSessionPersist", () => ({
  saveSession: vi.fn(async () => undefined),
  listSessions: vi.fn(async () => []),
  archiveSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  SESSION_DIR: ".ai-manuscript-studio/wizard-sessions",
  CONCEPT_DRAFT_SCHEMA: "concept-draft-v1",
}));

// ─── store reset 헬퍼 ────────────────────────────────────────────────────────

function resetStore(): void {
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function makeTestSession(stage: "concept" | "synopsis" | "outline" | "done") {
  const at = new Date().toISOString();
  return {
    schema: "concept-draft-v1" as const,
    id: "test-session",
    seed: "테스트 시드",
    tone: "novel" as const,
    genre: "world" as const,
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "",
    synopsis: "",
    outline: [],
    stage,
    createdAt: at,
    updatedAt: at,
  };
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

// ─── 1. session=null + isOpen=true → Step1Seed ───────────────────────────────

describe("ConceptWizard — step 라우팅", () => {
  it("session=null + isOpen=true 이면 Step1Seed 를 렌더한다", () => {
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    expect(screen.getByTestId("mock-step1")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-step2")).toBeNull();
  });

  it("session.stage='concept' 이면 Step2Concept 를 렌더한다", () => {
    useConceptWizardStore.getState().loadFromSession(makeTestSession("concept"));
    render(<ConceptWizard />);

    expect(screen.getByTestId("mock-step2")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-step1")).toBeNull();
  });

  it("session.stage='synopsis' 이면 Step3Synopsis 를 렌더한다", () => {
    useConceptWizardStore.getState().loadFromSession(makeTestSession("synopsis"));
    render(<ConceptWizard />);

    expect(screen.getByTestId("mock-step3")).toBeInTheDocument();
  });

  it("session.stage='outline' 이면 Step4Outline 을 렌더한다", () => {
    useConceptWizardStore.getState().loadFromSession(makeTestSession("outline"));
    render(<ConceptWizard />);

    expect(screen.getByTestId("mock-step4")).toBeInTheDocument();
  });

  it("session.stage='done' 이면 Step5Commit 을 렌더한다", () => {
    useConceptWizardStore.getState().loadFromSession(makeTestSession("done"));
    render(<ConceptWizard />);

    expect(screen.getByTestId("mock-step5")).toBeInTheDocument();
  });
});

// ─── 2. isOpen=false → 렌더 없음 ────────────────────────────────────────────

describe("ConceptWizard — 가시성", () => {
  it("isOpen=false 이면 모달이 렌더되지 않는다", () => {
    // store 는 기본 isOpen=false
    render(<ConceptWizard />);
    expect(screen.queryByTestId("concept-wizard-backdrop")).toBeNull();
  });

  it("isOpen=true 이면 백드롭이 렌더된다", () => {
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);
    expect(screen.getByTestId("concept-wizard-backdrop")).toBeInTheDocument();
  });
});

// ─── 3. 백드롭 클릭 → close 안 됨 ──────────────────────────────────────────

describe("ConceptWizard — 백드롭 클릭 차단", () => {
  it("백드롭 클릭 시 isOpen 이 true 로 유지된다", () => {
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    const backdrop = screen.getByTestId("concept-wizard-backdrop");
    fireEvent.click(backdrop);

    expect(useConceptWizardStore.getState().isOpen).toBe(true);
  });
});

// ─── 4. Cmd+. → pauseForBinder ──────────────────────────────────────────────

describe("ConceptWizard — Cmd+. 단축키", () => {
  it("isOpen=true 에서 Cmd+. 입력 시 pauseForBinder 호출 (isOpen=false)", () => {
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    expect(useConceptWizardStore.getState().isOpen).toBe(true);

    act(() => {
      fireEvent.keyDown(window, { key: ".", metaKey: true });
    });

    expect(useConceptWizardStore.getState().isOpen).toBe(false);
    expect(useConceptWizardStore.getState().pausedForBinder).toBe(true);
  });

  it("pausedForBinder=true 에서 Cmd+. 입력 시 resumeFromBinder 호출 (isOpen=true)", () => {
    useConceptWizardStore.getState().openEmpty();
    // 먼저 pause
    useConceptWizardStore.getState().pauseForBinder();
    expect(useConceptWizardStore.getState().pausedForBinder).toBe(true);

    render(<ConceptWizard />); // isOpen=false 이므로 실제로 렌더는 null

    act(() => {
      fireEvent.keyDown(window, { key: ".", metaKey: true });
    });

    expect(useConceptWizardStore.getState().isOpen).toBe(true);
    expect(useConceptWizardStore.getState().pausedForBinder).toBe(false);
  });

  it("input 안에서 Cmd+. 는 무시된다", () => {
    useConceptWizardStore.getState().openEmpty();
    const { container } = render(
      <>
        <input data-testid="test-input" />
        <ConceptWizard />
      </>,
    );

    const input = container.querySelector("[data-testid='test-input']");
    act(() => {
      fireEvent.keyDown(input!, { key: ".", metaKey: true });
    });

    // isOpen 변경 없음
    expect(useConceptWizardStore.getState().isOpen).toBe(true);
    expect(useConceptWizardStore.getState().pausedForBinder).toBe(false);
  });
});

// ─── 5. 임시로 닫기 버튼 ────────────────────────────────────────────────────

describe("ConceptWizard — 임시 닫기 버튼", () => {
  it("'임시로 닫기' 버튼 클릭 시 pauseForBinder 가 호출된다", () => {
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    fireEvent.click(screen.getByTestId("concept-wizard-pause-btn"));

    expect(useConceptWizardStore.getState().isOpen).toBe(false);
    expect(useConceptWizardStore.getState().pausedForBinder).toBe(true);
  });
});

// ─── 6. 취소 버튼 → window.confirm 후 close ─────────────────────────────────

describe("ConceptWizard — 취소 버튼", () => {
  it("취소 버튼 클릭 후 confirm 동의 시 isOpen=false", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    fireEvent.click(screen.getByTestId("concept-wizard-cancel-btn"));

    expect(useConceptWizardStore.getState().isOpen).toBe(false);
    expect(useConceptWizardStore.getState().session).toBeNull();
  });

  it("취소 버튼 클릭 후 confirm 거부 시 isOpen=true 유지", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    useConceptWizardStore.getState().openEmpty();
    render(<ConceptWizard />);

    fireEvent.click(screen.getByTestId("concept-wizard-cancel-btn"));

    expect(useConceptWizardStore.getState().isOpen).toBe(true);
  });
});
