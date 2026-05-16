// SelectionPopover.tsx — 에디터에서 텍스트가 선택되었을 때 떠오르는 액션 메뉴.
//
// 트리거: MarkdownEditor 의 selection update listener 가 비어있지 않은 selection 을
// 감지하면 anchor 좌표 + 선택 텍스트 + range 를 넘긴다. 사용자가 선택을 풀거나 ESC 를
// 누르면 onClose 가 호출된다.
//
// 메뉴 항목 클릭 → ResultPreviewModal 을 띄워 AI 를 호출. 결과는 사용자가 모달에서
// 고른 choice 에 따라 동작한다:
//   - "현재 위치에 삽입": editorRegistry.replaceRange 로 선택 영역을 결과로 교체
//     (선택 영역이 사라진 상태면 insertAtCursor 로 fallback).
//   - "복사": 클립보드 복사
//   - "저장": 클립보드 복사 (피드백 파일 저장은 ActionPanel 흐름에서만 처리)
//   - "무시": 아무 것도 안 함

import { useEffect, useRef, useState } from "react";
import type { UnifiedAction } from "@ai-manuscript-studio/core";

import { ResultPreviewModal, type PreviewChoice } from "../ai/ResultPreviewModal";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";
import * as editorRegistry from "./editorRegistry";
import { SnippetPanel } from "./SnippetPanel";

import {
  SELECTION_ACTIONS,
  buildSelectionPrompt,
  type SelectionActionDef,
} from "./selectionPrompts";

export interface SelectionPopoverProps {
  /** 선택 시점의 활성 에디터 docId. 본문 반영 시 editorRegistry 에 사용. */
  docId: string;
  /** 선택된 텍스트 — 빈 문자열이면 popover 가 떠오르지 않는다. */
  selection: string;
  /** 선택 영역의 절대 오프셋. replaceRange 에 사용. */
  selectionRange: { from: number; to: number } | null;
  /** 선택 영역의 화면 좌표.
   *  y = 선택 top, bottomY = 선택 bottom. 위쪽 공간이 부족할 때 아래쪽으로 뒤집기 위해 둘 다 보유. */
  anchor: { x: number; y: number; bottomY: number } | null;
  /** popover 가 닫혀야 할 때 (ESC, 모달 종료 후) 호출. */
  onClose: () => void;
}

interface ActiveModalState {
  action: SelectionActionDef;
  prompt: string;
  /** AI 호출 시점에 캡처한 선택 영역 — 모달이 떠있는 동안 사용자가 본문을 수정해도
   *  결과를 정확히 그 위치에 적용할 수 있도록 보존. */
  capturedRange: { from: number; to: number };
}

export function SelectionPopover(props: SelectionPopoverProps): JSX.Element | null {
  const { docId, selection, selectionRange, anchor, onClose } = props;
  const settings = useSettingsStore((s) => s.settings);
  const [active, setActive] = useState<ActiveModalState | null>(null);
  // 2-step UX: 처음에는 작은 ✨ 트리거만, 사용자가 클릭하면 풀 메뉴로 확장.
  // selection 이 바뀌면 항상 트리거 단계로 리셋해 텍스트 선택 본연의 동작을 가리지 않는다.
  const [expanded, setExpanded] = useState(false);
  const selKey = `${selectionRange?.from ?? -1}:${selectionRange?.to ?? -1}`;
  useEffect(() => {
    setExpanded(false);
  }, [selKey]);

  // ESC → 풀 메뉴면 트리거로 돌아가고, 트리거면 닫기. 모달이 떠 있으면 모달 자체가 ESC 처리.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || active) return;
      if (expanded) setExpanded(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, expanded, onClose]);

  // 모달이 활성 상태면 popover 자체는 안 보이지만 모달은 계속 떠있어야 한다.
  if (active) {
    return renderModal(active, docId, settings, () => {
      setActive(null);
      setExpanded(false);
      onClose();
    });
  }

  if (!selection || !anchor || !selectionRange) return null;

  if (!expanded) {
    return (
      <PopoverTrigger
        anchor={anchor}
        onActivate={() => setExpanded(true)}
      />
    );
  }

  return (
    <PopoverShell
      anchor={anchor}
      selection={selection}
      onAction={(a) => void handleAction(a)}
    />
  );

  async function handleAction(action: SelectionActionDef): Promise<void> {
    console.log("[SelectionPopover] click", {
      id: action.id,
      provider: settings.aiProvider,
      binaryPath:
        settings.aiProvider === "claude-code"
          ? settings.claudeCodePath
          : settings.codexPath,
      hasRange: !!selectionRange,
      hasAnchor: !!anchor,
      selectionLen: selection.length,
    });
    if (settings.aiProvider === "mock") {
      tauriNoticeAdapter.warn("AI 공급자가 mock 으로 설정되어 있습니다. 설정 ⚙ 에서 Codex 또는 Claude Code 로 바꾸세요.");
      console.warn("[SelectionPopover] BLOCKED: provider=mock");
      return;
    }
    const binaryPath =
      settings.aiProvider === "claude-code"
        ? settings.claudeCodePath
        : settings.codexPath;
    if (!binaryPath.trim()) {
      tauriNoticeAdapter.error(
        `[${settings.aiProvider}] CLI 경로가 비어 있습니다. 우상단 ⚙ 설정에서 경로 입력 필요.`,
      );
      console.warn("[SelectionPopover] BLOCKED: binaryPath empty for", settings.aiProvider);
      return;
    }
    if (!selectionRange || !anchor) {
      console.warn("[SelectionPopover] BLOCKED: missing range/anchor", {
        selectionRange,
        anchor,
      });
      return;
    }
    const prompt = buildSelectionPrompt(action, selection);
    console.log("[SelectionPopover] prompt built", { len: prompt.length, head: prompt.slice(0, 120) });
    setActive({ action, prompt, capturedRange: selectionRange });
  };
}

interface PopoverTriggerProps {
  anchor: { x: number; y: number; bottomY: number };
  onActivate: () => void;
}

/** 선택 직후 잠시 떠 있는 작은 ✨ 트리거. 사용자가 클릭해야 풀 메뉴가 열린다.
 *  텍스트 선택의 본연의 동작 (드래그 확장, 더블클릭 단어 선택, 컨텍스트 메뉴) 를 침해하지 않기 위함. */
function PopoverTrigger({ anchor, onActivate }: PopoverTriggerProps): JSX.Element {
  // selection 의 우상단 외곽에 작게 띄움. 위쪽 공간이 부족하면 아래쪽으로.
  const above = anchor.y >= 40;
  const top = above ? Math.max(8, anchor.y - 32) : Math.min(window.innerHeight - 32, anchor.bottomY + 8);
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(window.innerWidth - 40, anchor.x)),
    top,
    zIndex: 100,
  };
  return (
    <button
      type="button"
      className="selection-popover-trigger"
      style={style}
      title="AI 코치 메뉴 열기"
      data-testid="selection-popover-trigger"
      // ProseMirror selection 이 풀리지 않게 mousedown 시 preventDefault.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onActivate}
    >
      <span aria-hidden>✨</span>
    </button>
  );
}

interface PopoverShellProps {
  anchor: { x: number; y: number; bottomY: number };
  selection: string;
  onAction: (action: SelectionActionDef) => void;
}

function PopoverShell({ anchor, selection, onAction }: PopoverShellProps): JSX.Element {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // 클릭 anchor 기준 가용 공간이 더 큰 쪽으로 배치. 메뉴 길이는 가용 공간으로 clamp.
  const availableAbove = Math.max(0, anchor.y - 16);
  const availableBelow = Math.max(0, window.innerHeight - anchor.bottomY - 16);
  const placement: "above" | "below" =
    availableBelow >= availableAbove ? "below" : "above";
  const maxHeight = Math.max(160, placement === "below" ? availableBelow : availableAbove);

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(window.innerWidth - 280, anchor.x)),
    zIndex: 100,
    maxHeight: `${maxHeight}px`,
    ...(placement === "above"
      ? { top: Math.max(8, anchor.y - 8), transform: "translateY(-100%)" }
      : { top: Math.min(window.innerHeight - 16, anchor.bottomY + 8), transform: "none" }),
  };

  return (
    <div
      ref={popoverRef}
      className="selection-popover"
      style={style}
      role="menu"
      data-testid="selection-popover"
      onMouseDown={(e) => e.preventDefault() /* 선택 유지 */}
    >
      <div className="selection-popover-hint">
        선택 {selection.length.toLocaleString()}자
      </div>
      {SELECTION_ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          className="selection-popover-btn"
          onClick={() => onAction(a)}
          title={a.description}
          data-testid={`selection-action-${a.id}`}
        >
          <span className="selection-popover-icon" aria-hidden>
            {a.icon}
          </span>
          <span className="selection-popover-label">
            <span className="selection-popover-label-main">{a.label}</span>
            <span className="selection-popover-label-sub">{a.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function renderModal(
  active: ActiveModalState,
  docId: string,
  settings: ReturnType<typeof useSettingsStore.getState>["settings"],
  onDone: () => void,
): JSX.Element {
  // SelectionPopover 의 두 액션을 ResultPreviewModal 에 넘기기 위해 UnifiedAction 형태로 어댑팅.
  const adaptedAction: UnifiedAction = {
    id: `selection.${active.action.id}`,
    source: "free",
    label: active.action.label,
    status_show: [],
    saveTo: active.action.saveTo,
    promptTemplate: "",
    placeholders: [],
    license: { kind: "free" },
  };
  const adapterName =
    settings.aiProvider === "claude-code"
      ? "Claude Code CLI"
      : settings.aiProvider === "mock"
        ? "목업 어댑터"
        : "Codex CLI";
  const binaryPath =
    settings.aiProvider === "claude-code"
      ? settings.claudeCodePath
      : settings.codexPath;

  return (
    <ResultPreviewModal
      action={adaptedAction}
      prompt={active.prompt}
      adapterName={adapterName}
      binaryPath={binaryPath}
      extraArgs={settings.codexExtraArgs}
      provider={settings.aiProvider}
      timeoutSecs={300}
      discardStreamTokens
      renderTopPanel={({ fullText, phase }) => (
        <SnippetPanel
          fullText={fullText}
          phase={phase}
          action={active.action}
          docId={docId}
          capturedRange={active.capturedRange}
          onAfterInsert={onDone}
        />
      )}
      onComplete={(choice: PreviewChoice, fullText: string) =>
        void handleComplete(
          choice,
          fullText,
          docId,
          active.capturedRange,
          active.action,
          onDone,
        )
      }
    />
  );
}

async function handleComplete(
  choice: PreviewChoice,
  fullText: string,
  docId: string,
  capturedRange: { from: number; to: number },
  action: SelectionActionDef,
  onDone: () => void,
): Promise<void> {
  try {
    if (choice === "discard") {
      tauriNoticeAdapter.info("결과를 무시했습니다.");
      return;
    }
    const trimmed = fullText.trim();
    if (!trimmed) {
      tauriNoticeAdapter.warn("AI 결과가 비어 있어 적용하지 않았습니다.");
      return;
    }
    if (choice === "insert") {
      // 액션이 본문에 들어갈 부분만 추출 가능하면 (어휘 코치의 §4 개선 문단 등)
      // 그 부분만 선택 영역에 반영. 추출 실패 시 fullText 전체를 fallback 으로 삽입.
      let toInsert = trimmed;
      if (action.extractInsertable) {
        const extracted = action.extractInsertable(trimmed);
        if (extracted) {
          toInsert = extracted;
        }
        // extracted === null 이면 fullText 전체로 fallback (위 toInsert = trimmed 그대로).
      }

      const ok = editorRegistry.replaceRange(
        docId,
        capturedRange.from,
        capturedRange.to,
        toInsert,
      );
      if (!ok) {
        const fallback = editorRegistry.insertAtCursor(docId, toInsert);
        if (!fallback) {
          await navigator.clipboard.writeText(toInsert);
          tauriNoticeAdapter.warn(
            "에디터가 활성 상태가 아니어서 본문에 반영하지 못했습니다. 결과를 클립보드에 복사했습니다.",
          );
          return;
        }
        tauriNoticeAdapter.info("결과를 커서 위치에 삽입했습니다.");
        return;
      }
      tauriNoticeAdapter.info("선택 영역을 AI 결과로 교체했습니다.");
      return;
    }
    if (choice === "copy" || choice === "save") {
      try {
        // 복사는 사용자가 분석 전체를 보고 싶을 수 있으므로 항상 fullText 전체를 복사.
        await navigator.clipboard.writeText(trimmed);
        tauriNoticeAdapter.info("결과를 클립보드에 복사했습니다.");
      } catch (e) {
        tauriNoticeAdapter.error(
          `복사 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  } finally {
    onDone();
  }
}
