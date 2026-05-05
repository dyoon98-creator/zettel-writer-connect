// ConfirmModal.test.tsx — 확인 모달의 prompt 미리보기 / 버튼 / skipForSession.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ConfirmModal } from "../../src/ai/ConfirmModal";

describe("ConfirmModal", () => {
  it("프롬프트 미리보기가 60줄 안에서 보이고 그 이상은 잘린다", () => {
    const longPrompt = Array.from({ length: 100 }, (_, i) => `라인 ${i}`).join("\n");
    render(
      <ConfirmModal
        actionLabel="첫 문장 코칭"
        adapterName="Codex CLI"
        prompt={longPrompt}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const pre = screen.getByTestId("confirm-modal-prompt");
    expect(pre.textContent).toContain("라인 0");
    expect(pre.textContent).toContain("이하 생략");
    expect(pre.textContent).not.toContain("라인 99");
  });

  it("취소 버튼 → onCancel, 실행 버튼 → onConfirm 호출", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        actionLabel="x"
        adapterName="y"
        prompt="짧은 프롬프트"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("confirm-modal-cancel"));
    expect(onCancel).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("confirm-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ skipForSession: false });
  });

  it("이번 세션은 다시 묻지 않기 체크 → onConfirm 에 skipForSession=true", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        actionLabel="x"
        adapterName="y"
        prompt="hi"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("confirm-modal-skip"));
    fireEvent.click(screen.getByTestId("confirm-modal-confirm"));
    expect(onConfirm).toHaveBeenCalledWith({ skipForSession: true });
  });
});
