// StreamView.test.tsx — 스트리밍 표시의 phase 별 행동.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StreamView } from "../../src/ai/StreamView";

describe("StreamView", () => {
  it("스트리밍 중에는 취소 버튼이 보이고, 마크다운이 점진 렌더된다", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <StreamView
        actionLabel="첫 문장 코칭"
        adapterName="Codex CLI"
        text="# 시작"
        phase="streaming"
        onCancel={onCancel}
      />,
    );

    // 헤더에 액션/어댑터 표시.
    expect(screen.getByText("첫 문장 코칭")).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();

    // 취소 버튼.
    const cancelBtn = screen.getByTestId("stream-view-cancel");
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();

    // 추가 토큰 도착 시 body 가 갱신된다 (debounce 100ms 후).
    rerender(
      <StreamView
        actionLabel="첫 문장 코칭"
        adapterName="Codex CLI"
        text="# 시작\n\n안녕"
        phase="streaming"
        onCancel={onCancel}
      />,
    );
    await waitFor(
      () => {
        const body = screen.getByTestId("stream-view-body");
        expect(body.innerHTML).toMatch(/시작/);
      },
      { timeout: 500 },
    );
  });

  it("phase=done 이면 4개 결과 버튼이 노출된다", () => {
    const onSave = vi.fn();
    const onInsert = vi.fn();
    const onCopy = vi.fn();
    const onDiscard = vi.fn();
    render(
      <StreamView
        actionLabel="제목 후보"
        adapterName="Codex CLI"
        text="후보 1\n후보 2"
        phase="done"
        durationMs={1234}
        saveButtonLabel="기획 탭에 저장"
        onSave={onSave}
        onInsert={onInsert}
        onCopy={onCopy}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByTestId("stream-view-save")).toHaveTextContent("기획 탭에 저장");
    expect(screen.getByTestId("stream-view-insert")).toBeInTheDocument();
    expect(screen.getByTestId("stream-view-copy")).toBeInTheDocument();
    expect(screen.getByTestId("stream-view-discard")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("stream-view-save"));
    expect(onSave).toHaveBeenCalled();
  });

  it("phase=error 이면 에러 메시지가 보인다", () => {
    render(
      <StreamView
        actionLabel="x"
        adapterName="Codex"
        text=""
        phase="error"
        errorMessage="시간 초과 (60s)"
      />,
    );
    expect(screen.getByTestId("stream-view-error")).toHaveTextContent("시간 초과");
  });
});
