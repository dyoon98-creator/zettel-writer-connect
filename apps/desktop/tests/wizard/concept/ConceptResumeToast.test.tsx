// @TASK P3-T9 — ConceptResumeToast 단위 테스트

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";

// ─── vi.hoisted 로 mock 변수 선언 ────────────────────────────────────────────
// vi.mock factory 가 hoist 되므로, 변수도 hoisted 블록에서 선언해야 한다.

const { mockListSessions, mockArchiveSession } = vi.hoisted(() => ({
  mockListSessions: vi.fn(async (): Promise<ConceptDraftSession[]> => []),
  mockArchiveSession: vi.fn(async (_id: string) => undefined),
}));

// ─── conceptSessionPersist mock ──────────────────────────────────────────────

vi.mock("../../../src/wizard/concept/conceptSessionPersist", () => ({
  listSessions: mockListSessions,
  archiveSession: mockArchiveSession,
  saveSession: vi.fn(async () => undefined),
  deleteSession: vi.fn(async () => undefined),
  SESSION_DIR: ".ai-manuscript-studio/wizard-sessions",
  CONCEPT_DRAFT_SCHEMA: "concept-draft-v1",
}));

// ─── projectStore mock ────────────────────────────────────────────────────────
// useProjectStore 를 직접 stub. 실 store 의 Zustand 초기화 우회.

const { getVaultPath, setVaultPath } = vi.hoisted(() => {
  let _vaultPath: string | null = null;
  return {
    getVaultPath: () => _vaultPath,
    setVaultPath: (p: string | null) => { _vaultPath = p; },
  };
});

vi.mock("../../../src/state/projectStore", () => ({
  useProjectStore: (selector: (s: { vaultPath: string | null }) => unknown) =>
    selector({ vaultPath: getVaultPath() }),
}));

// ─── conceptWizardStore — 실 store ───────────────────────────────────────────

import {
  STORAGE_KEY,
  useConceptWizardStore,
} from "../../../src/state/conceptWizardStore";
import { ConceptResumeToast } from "../../../src/wizard/concept/ConceptResumeToast";

// ─── fixture ─────────────────────────────────────────────────────────────────

function makeSession(id: string, seed = "테스트 시드"): ConceptDraftSession {
  const at = new Date().toISOString();
  return {
    schema: "concept-draft-v1",
    id,
    seed,
    tone: "novel",
    genre: "world",
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "",
    synopsis: "",
    outline: [],
    stage: "concept",
    createdAt: at,
    updatedAt: at,
  };
}

function resetStore(): void {
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
  mockListSessions.mockResolvedValue([]);
  setVaultPath(null);
});

// ─── 1. 토스트 N개 렌더 ──────────────────────────────────────────────────────

describe("ConceptResumeToast — 렌더", () => {
  it("vaultPath 없으면 listSessions 를 호출하지 않고 아무것도 렌더하지 않는다", async () => {
    setVaultPath(null);
    mockListSessions.mockResolvedValue([makeSession("s1"), makeSession("s2")]);

    render(<ConceptResumeToast />);

    // vaultPath 없으면 useEffect 가 listSessions 를 호출하지 않음
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("concept-resume-toast")).toBeNull();
    expect(mockListSessions).not.toHaveBeenCalled();
  });

  it("vaultPath 있고 미완료 세션 2개 → 토스트 2개 렌더", async () => {
    setVaultPath("/some/vault");
    mockListSessions.mockResolvedValue([makeSession("s1"), makeSession("s2")]);

    render(<ConceptResumeToast />);

    await waitFor(() => {
      const toasts = screen.getAllByTestId("concept-resume-toast");
      expect(toasts.length).toBe(2);
    });
  });

  it("빈 세션 목록이면 아무것도 렌더하지 않는다", async () => {
    setVaultPath("/some/vault");
    mockListSessions.mockResolvedValue([]);

    render(<ConceptResumeToast />);

    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByTestId("concept-resume-toast")).toBeNull();
  });
});

// ─── 2. "이어하기" 클릭 → loadFromSession ────────────────────────────────────

describe("ConceptResumeToast — 이어하기", () => {
  it('"이어하기" 클릭 시 loadFromSession 이 호출되고 토스트가 dismiss 된다', async () => {
    setVaultPath("/some/vault");
    const session = makeSession("resume-me");
    mockListSessions.mockResolvedValue([session]);

    render(<ConceptResumeToast />);

    await waitFor(() => {
      expect(screen.getByTestId("concept-resume-toast")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("concept-toast-resume"));
    });

    // store 상태 확인
    const state = useConceptWizardStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.session?.id).toBe("resume-me");

    // 토스트 dismiss
    await waitFor(() => {
      expect(screen.queryByTestId("concept-resume-toast")).toBeNull();
    });
  });
});

// ─── 3. "버리기" 클릭 → archiveSession + dismiss ─────────────────────────────

describe("ConceptResumeToast — 버리기", () => {
  it('"버리기" 클릭 시 archiveSession 이 호출되고 토스트가 dismiss 된다', async () => {
    setVaultPath("/some/vault");
    const session = makeSession("dismiss-me");
    mockListSessions.mockResolvedValue([session]);

    render(<ConceptResumeToast />);

    await waitFor(() => {
      expect(screen.getByTestId("concept-resume-toast")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("concept-toast-dismiss"));
    });

    // archiveSession 호출 확인
    expect(mockArchiveSession).toHaveBeenCalledWith("dismiss-me");

    // 토스트 dismiss
    await waitFor(() => {
      expect(screen.queryByTestId("concept-resume-toast")).toBeNull();
    });

    // store 는 변경 없음
    expect(useConceptWizardStore.getState().isOpen).toBe(false);
  });
});
