// @TASK P2-T4 — Step1Seed 컴포넌트 단위 테스트
// vitest + jsdom + @testing-library/react

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// conceptWizardStore 는 sessionStorage persist를 사용하므로 격리.
import {
  STORAGE_KEY,
  useConceptWizardStore,
} from "../../../src/state/conceptWizardStore";
import { Step1Seed } from "../../../src/wizard/concept/Step1Seed";

function resetStore(): void {
  useConceptWizardStore.getState().close();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

beforeEach(() => {
  resetStore();
});

// ─── 1. 기본 렌더 ──────────────────────────────────────────────────────────────

describe("Step1Seed — 기본 렌더", () => {
  it("textarea + 4개 톤 라디오 + 5개 장르 라디오 + 비활성 다음 버튼이 렌더된다", () => {
    render(<Step1Seed />);

    // textarea
    expect(screen.getByTestId("step1-seed-textarea")).toBeInTheDocument();

    // 톤 4개
    expect(screen.getByTestId("step1-tone-novel")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-essay")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-nonfiction")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-screenplay")).toBeInTheDocument();

    // 장르 5개
    expect(screen.getByTestId("step1-genre-essay")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-practical")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-youtube")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-lecture")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-world")).toBeInTheDocument();

    // 다음 버튼 — 비활성
    const nextBtn = screen.getByTestId("step1-next-btn");
    expect(nextBtn).toBeDisabled();
  });

  it("기본 톤은 소설(novel), 기본 장르는 세계관/웹소설(world)이다", () => {
    render(<Step1Seed />);

    const novelRadio = screen.getByTestId("step1-tone-novel").querySelector("input[type=radio]") as HTMLInputElement;
    const worldRadio = screen.getByTestId("step1-genre-world").querySelector("input[type=radio]") as HTMLInputElement;

    expect(novelRadio.checked).toBe(true);
    expect(worldRadio.checked).toBe(true);
  });
});

// ─── 2. 시드 입력 후 다음 버튼 활성화 ────────────────────────────────────────

describe("Step1Seed — seed 입력 → 다음 활성화", () => {
  it("seed 입력 후 다음 버튼이 활성화된다", () => {
    render(<Step1Seed />);

    const textarea = screen.getByTestId("step1-seed-textarea");
    const nextBtn = screen.getByTestId("step1-next-btn");

    expect(nextBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "옵시디언으로 글쓰기" } });
    expect(nextBtn).not.toBeDisabled();
  });

  it("공백만 입력하면 다음 버튼이 비활성 상태로 유지된다", () => {
    render(<Step1Seed />);

    const textarea = screen.getByTestId("step1-seed-textarea");
    fireEvent.change(textarea, { target: { value: "   " } });

    expect(screen.getByTestId("step1-next-btn")).toBeDisabled();
  });
});

// ─── 3. 노트 chip 추가/제거 ───────────────────────────────────────────────────

describe("Step1Seed — 노트 첨부", () => {
  it("노트 입력 후 추가 버튼 클릭 시 chip이 나타난다", () => {
    render(<Step1Seed />);

    fireEvent.change(screen.getByTestId("step1-note-input"), {
      target: { value: "[[노트A]]" },
    });
    fireEvent.click(screen.getByTestId("step1-note-add-btn"));

    expect(screen.getByText("[[노트A]]", { exact: false })).toBeInTheDocument();
    // input이 비워진다
    expect(screen.getByTestId("step1-note-input")).toHaveValue("");
  });

  it("Enter 키로도 노트를 추가할 수 있다", () => {
    render(<Step1Seed />);

    const noteInput = screen.getByTestId("step1-note-input");
    fireEvent.change(noteInput, { target: { value: "[[노트B]]" } });
    fireEvent.keyDown(noteInput, { key: "Enter" });

    expect(screen.getByText("[[노트B]]", { exact: false })).toBeInTheDocument();
  });

  it("chip X 버튼 클릭 시 해당 노트가 제거된다", () => {
    render(<Step1Seed />);

    // 추가
    fireEvent.change(screen.getByTestId("step1-note-input"), {
      target: { value: "[[노트C]]" },
    });
    fireEvent.click(screen.getByTestId("step1-note-add-btn"));

    // 제거
    fireEvent.click(screen.getByTestId("note-chip-remove-[[노트C]]"));

    expect(screen.queryByText("[[노트C]]", { exact: false })).toBeNull();
  });

  it("동일한 노트는 중복 추가되지 않는다", () => {
    render(<Step1Seed />);

    const noteInput = screen.getByTestId("step1-note-input");
    const addBtn = screen.getByTestId("step1-note-add-btn");

    fireEvent.change(noteInput, { target: { value: "[[노트D]]" } });
    fireEvent.click(addBtn);
    fireEvent.change(noteInput, { target: { value: "[[노트D]]" } });
    fireEvent.click(addBtn);

    // 오직 1개의 [[노트D]] chip만 존재해야 한다
    const chips = screen.queryAllByText("[[노트D]]", { exact: false });
    // chip 텍스트는 "[[노트D]]" 와 X 버튼이 포함된 span 안에 있음. 텍스트 노드 1개만.
    expect(chips.length).toBe(1);
  });
});

// ─── 4. 톤 변경 시 장르 자동 추천 변경 ──────────────────────────────────────

describe("Step1Seed — 톤 변경 → 장르 자동 추천", () => {
  it("톤을 에세이로 바꾸면 장르 자동 추천이 essay로 변경된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-essay").querySelector("input[type=radio]") as Element,
    );

    const essayGenreRadio = screen.getByTestId("step1-genre-essay").querySelector("input[type=radio]") as HTMLInputElement;
    expect(essayGenreRadio.checked).toBe(true);
  });

  it("톤을 논픽션으로 바꾸면 장르 자동 추천이 practical로 변경된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-nonfiction").querySelector("input[type=radio]") as Element,
    );

    const practicalRadio = screen.getByTestId("step1-genre-practical").querySelector("input[type=radio]") as HTMLInputElement;
    expect(practicalRadio.checked).toBe(true);
  });

  it("톤을 시나리오로 바꾸면 장르 자동 추천이 youtube로 변경된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-screenplay").querySelector("input[type=radio]") as Element,
    );

    const youtubeRadio = screen.getByTestId("step1-genre-youtube").querySelector("input[type=radio]") as HTMLInputElement;
    expect(youtubeRadio.checked).toBe(true);
  });

  it("사용자가 장르를 직접 선택한 후 톤을 바꿔도 장르 자동 추천이 적용되지 않는다", () => {
    render(<Step1Seed />);

    // 사용자가 직접 장르 변경
    fireEvent.click(
      screen.getByTestId("step1-genre-lecture").querySelector("input[type=radio]") as Element,
    );

    // 그 후 톤 변경
    fireEvent.click(
      screen.getByTestId("step1-tone-essay").querySelector("input[type=radio]") as Element,
    );

    // lecture가 그대로 유지되어야 함
    const lectureRadio = screen.getByTestId("step1-genre-lecture").querySelector("input[type=radio]") as HTMLInputElement;
    expect(lectureRadio.checked).toBe(true);
  });
});

// ─── 5. 다음 클릭 → store.start 호출 + onAdvance 호출 ────────────────────────

describe("Step1Seed — 다음 클릭", () => {
  it("다음 클릭 시 store.start가 올바른 인수로 호출되고 onAdvance가 호출된다", () => {
    const onAdvance = vi.fn();
    render(<Step1Seed onAdvance={onAdvance} />);

    // 시드 입력
    fireEvent.change(screen.getByTestId("step1-seed-textarea"), {
      target: { value: "성장 소설을 쓰고 싶어요." },
    });

    // 노트 추가
    fireEvent.change(screen.getByTestId("step1-note-input"), {
      target: { value: "[[아이디어 노트]]" },
    });
    fireEvent.click(screen.getByTestId("step1-note-add-btn"));

    // 톤 에세이로 변경
    fireEvent.click(
      screen.getByTestId("step1-tone-essay").querySelector("input[type=radio]") as Element,
    );

    // 다음 클릭
    act(() => {
      fireEvent.click(screen.getByTestId("step1-next-btn"));
    });

    // onAdvance 호출 확인
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // store 상태 확인
    const session = useConceptWizardStore.getState().session;
    expect(session).not.toBeNull();
    expect(session!.seed).toBe("성장 소설을 쓰고 싶어요.");
    expect(session!.tone).toBe("essay");
    expect(session!.genre).toBe("essay"); // essay 톤의 기본 genre
    expect(session!.attachedNotes).toEqual(["[[아이디어 노트]]"]);
    expect(session!.stage).toBe("concept"); // store.start 직후 stage
  });

  it("seed가 비어있으면 다음 클릭 시 store.start가 호출되지 않는다", () => {
    const onAdvance = vi.fn();
    render(<Step1Seed onAdvance={onAdvance} />);

    act(() => {
      fireEvent.click(screen.getByTestId("step1-next-btn"));
    });

    expect(onAdvance).not.toHaveBeenCalled();
    expect(useConceptWizardStore.getState().session).toBeNull();
  });
});
