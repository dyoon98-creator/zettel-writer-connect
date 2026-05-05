// Step5Commit.test.tsx — Step5Commit UI 시나리오 테스트.
//
// seedFromConceptDraft 를 vi.mock 으로 교체하여 I/O 없이 검증.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { installTauriMocks, clearVault } from "../../__mocks__/tauri";

installTauriMocks();

import { useConceptWizardStore } from "../../../src/state/conceptWizardStore";
import { useProjectStore } from "../../../src/state/projectStore";
import { Step5Commit } from "../../../src/wizard/concept/Step5Commit";
import {
  type ConceptDraftSession,
  CONCEPT_DRAFT_SCHEMA,
} from "@ai-manuscript-studio/core";

// seedFromConceptDraft mock
vi.mock("../../../src/wizard/concept/conceptSeed", () => ({
  seedFromConceptDraft: vi.fn(),
}));

// vaultAdapter mock — getVaultBasePath 가 "/mock-vault" 반환
vi.mock("../../../src/vaultAdapter", () => ({
  tauriVaultAdapter: {},
  getVaultBasePath: () => "/mock-vault",
  setVaultBasePath: vi.fn(),
  writeAttachmentBinary: vi.fn(),
  copyExternalFile: vi.fn(),
}));

// noticeAdapter mock
vi.mock("../../../src/noticeAdapter", () => ({
  tauriNoticeAdapter: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// frontmatterAdapter mock
vi.mock("../../../src/frontmatterAdapter", () => ({
  createFrontmatterAdapter: vi.fn(() => ({})),
}));

import { seedFromConceptDraft } from "../../../src/wizard/concept/conceptSeed";

const mockSeed = vi.mocked(seedFromConceptDraft);

function makeSession(overrides: Partial<ConceptDraftSession> = {}): ConceptDraftSession {
  return {
    schema: CONCEPT_DRAFT_SCHEMA,
    id: "test-session-1",
    seed: "AI 시대에 작가로 산다는 것\n두 번째 줄",
    tone: "essay",
    genre: "essay",
    attachedNotes: ["note-A", "note-B"],
    conversation: [],
    conceptParagraph: "이 책은 AI 도구와 함께 일하는 방법을 탐구한다.",
    synopsis: "AI가 모든 것을 쓸 수 있는 시대에 왜 인간이 써야 하는가.",
    outline: [
      { id: "ch-01", title: "도입", summary: "왜 이 책인가" },
      { id: "ch-02", title: "전개", summary: "도구의 한계" },
    ],
    stage: "done",
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  clearVault();
  vi.clearAllMocks();
  // 스토어 초기화
  useConceptWizardStore.getState().close();
  useProjectStore.getState().clear();
});

afterEach(() => {
  useConceptWizardStore.getState().close();
  useProjectStore.getState().clear();
});

describe("Step5Commit", () => {
  it("1. 기본 렌더 — 제목 자동 추론, 생성 버튼 enabled", () => {
    // session 셋업
    act(() => {
      useConceptWizardStore.getState().start({
        seed: "AI 시대에 작가로 산다는 것",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
      useConceptWizardStore.getState().setSynopsis("AI가 모든 것을 쓸 수 있는 시대에 왜 인간이 써야 하는가.");
    });

    render(<Step5Commit />);

    // 제목 input 이 존재하고 값이 있어야 함
    const titleInput = screen.getByTestId("step5-title-input");
    expect(titleInput).toBeInTheDocument();
    // 시놉시스 첫 줄로 채워짐
    expect((titleInput as HTMLInputElement).value).toContain("AI");

    // 생성 버튼 enabled
    const submitBtn = screen.getByTestId("step5-submit");
    expect(submitBtn).not.toBeDisabled();
  });

  it("2. 제목 비우면 생성 버튼 disabled", () => {
    act(() => {
      useConceptWizardStore.getState().start({
        seed: "AI 시대에 작가로 산다는 것",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
      useConceptWizardStore.getState().setSynopsis("시놉시스 한 줄");
    });

    render(<Step5Commit />);

    const titleInput = screen.getByTestId("step5-title-input");
    fireEvent.change(titleInput, { target: { value: "" } });

    const submitBtn = screen.getByTestId("step5-submit");
    expect(submitBtn).toBeDisabled();
  });

  it("3. 생성 버튼 클릭 → seedFromConceptDraft + loadProject + close + onComplete 호출", async () => {
    mockSeed.mockResolvedValue({
      vaultPath: "/mock-vault",
      projectFolder: "3 Writing/test-slug-20260506",
      projectSlug: "test-slug-20260506",
    });

    // loadProject mock
    const loadProjectMock = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ loadProject: loadProjectMock } as never);

    const onComplete = vi.fn();

    act(() => {
      useConceptWizardStore.getState().start({
        seed: "AI 시대에 작가로 산다는 것",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
      useConceptWizardStore.getState().setSynopsis("시놉시스 한 줄");
    });

    render(<Step5Commit onComplete={onComplete} />);

    const submitBtn = screen.getByTestId("step5-submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSeed).toHaveBeenCalledOnce();
    });
    expect(loadProjectMock).toHaveBeenCalledWith("/mock-vault", "test-slug-20260506");
    expect(useConceptWizardStore.getState().session).toBeNull();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("4. seedFromConceptDraft throw → 빨간 배너 + 재시도 버튼", async () => {
    mockSeed.mockRejectedValue(new Error("디스크 쓰기 실패"));

    act(() => {
      useConceptWizardStore.getState().start({
        seed: "AI 시대에 작가로 산다는 것",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
      useConceptWizardStore.getState().setSynopsis("시놉시스");
    });

    render(<Step5Commit />);

    fireEvent.click(screen.getByTestId("step5-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("step5-error")).toBeInTheDocument();
    });

    expect(screen.getByTestId("step5-error")).toHaveTextContent("디스크 쓰기 실패");
    expect(screen.getByTestId("step5-retry")).toBeInTheDocument();
  });

  it("5. 이전 버튼 클릭 → onBack 호출", () => {
    act(() => {
      useConceptWizardStore.getState().start({
        seed: "seed",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
    });

    const onBack = vi.fn();
    render(<Step5Commit onBack={onBack} />);

    fireEvent.click(screen.getByTestId("step5-back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("첨부 노트 chip 렌더링", () => {
    act(() => {
      useConceptWizardStore.getState().start({
        seed: "seed",
        tone: "essay",
        genre: "essay",
        attachedNotes: ["note-A", "note-B"],
      });
      useConceptWizardStore.getState().setSynopsis("시놉시스");
    });

    render(<Step5Commit />);

    const notes = screen.getByTestId("step5-attached-notes");
    expect(notes).toHaveTextContent("note-A");
    expect(notes).toHaveTextContent("note-B");
  });

  it("목차 클릭 시 summary 토글", () => {
    act(() => {
      useConceptWizardStore.getState().start({
        seed: "seed",
        tone: "essay",
        genre: "essay",
        attachedNotes: [],
      });
      useConceptWizardStore.getState().setOutline([
        { id: "ch-01", title: "도입", summary: "왜 이 책인가" },
      ]);
      useConceptWizardStore.getState().setSynopsis("시놉시스");
    });

    render(<Step5Commit />);

    // summary 초기에는 숨겨짐
    expect(screen.queryByText("왜 이 책인가")).not.toBeInTheDocument();

    // 클릭 → 펼쳐짐
    fireEvent.click(screen.getByTestId("step5-chapter-toggle-ch-01"));
    expect(screen.getByText("왜 이 책인가")).toBeInTheDocument();

    // 다시 클릭 → 접힘
    fireEvent.click(screen.getByTestId("step5-chapter-toggle-ch-01"));
    expect(screen.queryByText("왜 이 책인가")).not.toBeInTheDocument();
  });
});
