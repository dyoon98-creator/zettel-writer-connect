// WizardOverlay.test.tsx — empty state → 마법사 → 5단계 → seed prompt.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { installTauriMocks, clearVault } from "../__mocks__/tauri";
installTauriMocks();

import { App } from "../../src/App";
import { useProjectStore } from "../../src/state/projectStore";
import { useWizardStore } from "../../src/wizard/wizardStore";
import {
  MockWizardBridge,
  WIZARD_STAGES,
} from "@ai-manuscript-studio/core";

beforeEach(() => {
  clearVault();
  useProjectStore.getState().clear();
  useWizardStore.getState().close();
});

afterEach(() => {
  useProjectStore.getState().clear();
  useWizardStore.getState().close();
});

describe("WizardOverlay", () => {
  it("empty state 에서 '새 원고 만들기' 버튼이 보이고 누르면 오버레이가 뜬다", () => {
    render(<App />);
    const cta = screen.getByTestId("app-empty-new-manuscript");
    expect(cta).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-overlay")).toBeNull();

    fireEvent.click(cta);

    expect(screen.getByTestId("wizard-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-chat")).toBeInTheDocument();
  });

  it("사용자 메시지를 보내면 assistant 메시지가 누적된다", async () => {
    render(<App />);
    // 마법사 시작 — 즉시 mock bridge 로(0ms 토큰).
    act(() => {
      useWizardStore.getState().start({
        bridge: new MockWizardBridge({ tokenDelayMs: 0 }),
        draftTitle: "테스트 원고",
      });
    });

    // 첫 assistant 메시지가 합쳐져 들어올 때까지 대기.
    await waitFor(
      () => {
        expect(useWizardStore.getState().isStreaming).toBe(false);
      },
      { timeout: 1500 },
    );
    const engine = useWizardStore.getState().engineRef!;
    expect(engine.session.messages.some((m) => m.role === "assistant")).toBe(true);

    // textarea 에 답을 입력 후 Cmd+Enter.
    const ta = screen.getByTestId("wizard-input") as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "제 답변입니다" } });
    fireEvent.keyDown(ta, { key: "Enter", metaKey: true });

    // 사용자 메시지가 추가되고 다음 assistant 가 등장할 때까지 대기.
    await waitFor(
      () => {
        const e = useWizardStore.getState().engineRef!;
        const userCount = e.session.messages.filter((m) => m.role === "user").length;
        const aiCount = e.session.messages.filter((m) => m.role === "assistant").length;
        expect(userCount).toBeGreaterThanOrEqual(1);
        expect(aiCount).toBeGreaterThanOrEqual(2);
      },
      { timeout: 2000 },
    );
  });

  it("5단계 모두 끝나면 seed prompt 가 등장한다", async () => {
    render(<App />);
    act(() => {
      useWizardStore.getState().start({
        bridge: new MockWizardBridge({ tokenDelayMs: 0 }),
        draftTitle: "AI 시대의 작가",
      });
    });

    // 단계마다 첫 askNext 가 끝날 때까지 기다리고 사용자 답 → completeCurrentStage.
    for (const stage of WIZARD_STAGES) {
      // 첫 question stream 이 끝날 때까지.
      await waitFor(
        () => {
          expect(useWizardStore.getState().isStreaming).toBe(false);
          // engine 의 currentStage 가 이 stage 여야.
          expect(useWizardStore.getState().engineRef?.session.currentStage).toBe(
            stage,
          );
        },
        { timeout: 2000 },
      );

      // 답변을 한 번만 보내고 즉시 completeCurrentStage 로 강제 단계 종료.
      act(() => {
        const e = useWizardStore.getState().engineRef!;
        e.addMessage("user", `${stage} 단계 답`, stage);
      });
      await act(async () => {
        await useWizardStore.getState().completeCurrentStage();
      });
    }

    await waitFor(
      () => {
        expect(useWizardStore.getState().phase).toBe("awaiting-seed");
      },
      { timeout: 2000 },
    );
    expect(screen.getByTestId("wizard-seed-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-seed-accept")).toBeInTheDocument();
  });

  it("취소 버튼은 마법사를 닫는다", () => {
    render(<App />);
    act(() => {
      useWizardStore.getState().start({
        bridge: new MockWizardBridge({ tokenDelayMs: 0 }),
      });
    });
    expect(screen.getByTestId("wizard-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("wizard-cancel"));

    expect(screen.queryByTestId("wizard-overlay")).toBeNull();
    expect(useWizardStore.getState().isOpen).toBe(false);
  });
});
