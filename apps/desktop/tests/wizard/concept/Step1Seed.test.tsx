// 2026-09-01 — 장르 체계를 창작용(에세이·유튜브·세계관)에서 업무용
// (투자·법률·강의)으로 바꾸면서 이 검사의 id 도 함께 옮겼다. 옛 id 를 그대로
// 두면 «없는 요소를 찾다 실패» 하는데, 그 실패는 회귀가 아니라 낡은 기대다.
// 검사가 지키는 «톤을 바꾸면 장르가 따라온다» 는 계약 자체는 그대로다.
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
  it("textarea + 8개 톤 라디오 + 6개 장르 라디오 + 비활성 다음 버튼이 렌더된다", () => {
    render(<Step1Seed />);

    // textarea
    expect(screen.getByTestId("step1-seed-textarea")).toBeInTheDocument();

    // 톤 4개
    expect(screen.getByTestId("step1-tone-decision-memo")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-column-narrative")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-analytical-report")).toBeInTheDocument();
    expect(screen.getByTestId("step1-tone-lecture-presentation")).toBeInTheDocument();

    // 장르 5개
    expect(screen.getByTestId("step1-genre-column-essay")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-investment-report")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-lecture-presentation")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-lecture-presentation")).toBeInTheDocument();
    expect(screen.getByTestId("step1-genre-investment-strategy-memo")).toBeInTheDocument();

    // 다음 버튼 — 비활성
    const nextBtn = screen.getByTestId("step1-next-btn");
    expect(nextBtn).toBeDisabled();
  });

  it("톤·장르 모두 «미리 골라두지 않는다» — 침묵이 문서 종류를 정하지 못하게", () => {
    render(<Step1Seed />);

    const checked = document.querySelectorAll(
      '[data-testid^="step1-tone-"] input:checked, [data-testid^="step1-genre-"] input:checked',
    );

    expect(checked.length).toBe(0);
  });

  it("톤을 고르면 장르가 «따라온다» — 클릭 한 번으로 둘이 정해진다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-column-narrative").querySelector("input[type=radio]") as Element,
    );

    const genreRadio = screen
      .getByTestId("step1-genre-column-essay")
      .querySelector("input[type=radio]") as HTMLInputElement;
    expect(genreRadio.checked).toBe(true);
  });
});

// ─── 2. 시드 입력 후 다음 버튼 활성화 ────────────────────────────────────────

describe("Step1Seed — seed 입력 → 다음 활성화", () => {
  it("seed 만으로는 다음이 활성화되지 않는다 — 문체까지 골라야 한다", () => {
    render(<Step1Seed />);
    fireEvent.change(screen.getByTestId("step1-seed-textarea"), {
      target: { value: "쓰고 싶은 이야기" },
    });

    expect(screen.getByTestId("step1-next-btn")).toBeDisabled();
  });

  it("seed + 문체를 고르면 다음이 활성화된다", () => {
    render(<Step1Seed />);
    fireEvent.change(screen.getByTestId("step1-seed-textarea"), {
      target: { value: "쓰고 싶은 이야기" },
    });
    fireEvent.click(
      screen.getByTestId("step1-tone-column-narrative").querySelector("input[type=radio]") as Element,
    );

    expect(screen.getByTestId("step1-next-btn")).not.toBeDisabled();
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
  it("톤을 칼럼형 서술체로 바꾸면 장르가 칼럼/에세이로 추천된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-column-narrative").querySelector("input[type=radio]") as Element,
    );

    const essayGenreRadio = screen.getByTestId("step1-genre-column-essay").querySelector("input[type=radio]") as HTMLInputElement;
    expect(essayGenreRadio.checked).toBe(true);
  });

  it("톤을 분석적 보고체로 바꾸면 장르가 투자보고서로 추천된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-analytical-report").querySelector("input[type=radio]") as Element,
    );

    const practicalRadio = screen.getByTestId("step1-genre-investment-report").querySelector("input[type=radio]") as HTMLInputElement;
    expect(practicalRadio.checked).toBe(true);
  });

  it("톤을 강의·발표체로 바꾸면 장르가 강의·발표안으로 추천된다", () => {
    render(<Step1Seed />);

    fireEvent.click(
      screen.getByTestId("step1-tone-lecture-presentation").querySelector("input[type=radio]") as Element,
    );

    const youtubeRadio = screen.getByTestId("step1-genre-lecture-presentation").querySelector("input[type=radio]") as HTMLInputElement;
    expect(youtubeRadio.checked).toBe(true);
  });

  it("사용자가 장르를 직접 선택한 후 톤을 바꿔도 장르 자동 추천이 적용되지 않는다", () => {
    render(<Step1Seed />);

    // 사용자가 직접 장르 변경
    fireEvent.click(
      screen.getByTestId("step1-genre-lecture-presentation").querySelector("input[type=radio]") as Element,
    );

    // 그 후 톤 변경
    fireEvent.click(
      screen.getByTestId("step1-tone-column-narrative").querySelector("input[type=radio]") as Element,
    );

    // lecture가 그대로 유지되어야 함
    const lectureRadio = screen.getByTestId("step1-genre-lecture-presentation").querySelector("input[type=radio]") as HTMLInputElement;
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
      screen.getByTestId("step1-tone-column-narrative").querySelector("input[type=radio]") as Element,
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
    expect(session!.tone).toBe("column-narrative");
    // 칼럼형 서술체 → 칼럼/에세이. 톤을 바꾸면 장르가 «따라오는» 것을 여기서도 확인한다.
    expect(session!.genre).toBe("column-essay");
    expect(session!.attachedNotes).toEqual(["[[아이디어 노트]]"]);
    // 컨셉 마법사에 「메모 정리」 단계가 생기면서 첫 단계가 memo 로 바뀌었다.
    expect(session!.stage).toBe("memo"); // store.start 직후 stage
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
