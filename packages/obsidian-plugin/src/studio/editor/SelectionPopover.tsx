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
import {
  getCached,
  makeKey,
  setCached,
} from "../ai/selectionResultCache";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "../state/settingsStore";
import * as editorRegistry from "./editorRegistry";
import { SnippetPanel } from "./SnippetPanel";

import {
  SELECTION_ACTIONS,
  buildSelectionPrompt,
  extractRefinedBlock,
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
   *  x = selection 우측 끝, selectionLeft = selection 좌측 시작.
   *  y = 선택 top, bottomY = 선택 bottom (위/아래 placement 결정용).
   *  editorLeft/editorRight = editor DOM 의 viewport 기준 좌/우 edge (clamp 한계). */
  anchor: {
    x: number;
    y: number;
    bottomY: number;
    editorLeft: number;
    editorRight: number;
    selectionLeft: number;
  } | null;
  /** popover 가 닫혀야 할 때 (ESC, 모달 종료 후) 호출. */
  onClose: () => void;
}

interface ActiveModalState {
  action: SelectionActionDef;
  prompt: string;
  /** AI 호출 시점에 캡처한 선택 영역 — 모달이 떠있는 동안 사용자가 본문을 수정해도
   *  결과를 정확히 그 위치에 적용할 수 있도록 보존. */
  capturedRange: { from: number; to: number };
  /** 캐시 hit 시점에 채워진 이전 결과. 없으면 모달은 idle 상태로 시작. */
  cachedFullText: string | null;
  /** 캐시 갱신 시 사용할 key. */
  cacheKey: string;
  /** 캡처된 선택 텍스트 (캐시 갱신 시 그대로 보관, 이미 알려진 값). */
  capturedSelection: string;
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
    // 캐시: action.id 만으로 매칭. selection 이 달라도 같은 메뉴 항목이면
    // 이전 결과 그대로 보여줌. 사용자가 '다시 분석' 누를 때만 새 호출.
    const cacheKey = makeKey(action.id);
    const cached = getCached(cacheKey);
    setActive({
      action,
      prompt,
      capturedRange: selectionRange,
      cachedFullText: cached?.fullText ?? null,
      cacheKey,
      capturedSelection: selection,
    });
  };
}

interface PopoverTriggerProps {
  anchor: {
    x: number;
    y: number;
    bottomY: number;
    editorLeft: number;
    editorRight: number;
    selectionLeft: number;
  };
  onActivate: () => void;
}

/** 선택 직후 잠시 떠 있는 작은 ✨ 트리거. 사용자가 클릭해야 풀 메뉴가 열린다.
 *  텍스트 선택의 본연의 동작 (드래그 확장, 더블클릭 단어 선택, 컨텍스트 메뉴) 를 침해하지 않기 위함. */
function PopoverTrigger({ anchor, onActivate }: PopoverTriggerProps): JSX.Element {
  // 위치 정책: selection 의 우측 끝(anchor.x) 옆에 trigger 를 둠.
  // selection 의 viewport rect 는 본문 column 안에 반드시 존재 (DOM Selection
  // API). editor.right - TRIGGER_WIDTH 로 캡해 본문을 절대 벗어나지 않게.
  const TRIGGER_WIDTH = 64;
  const desiredLeft = anchor.x + 4;
  const maxLeft = Math.max(
    Math.max(8, anchor.editorLeft),
    anchor.editorRight - TRIGGER_WIDTH - 8,
  );
  const left = Math.max(
    Math.max(8, anchor.editorLeft),
    Math.min(maxLeft, desiredLeft),
  );
  const above = anchor.y >= 40;
  const top = above
    ? Math.max(8, anchor.y - 36)
    : Math.min(window.innerHeight - 36, anchor.bottomY + 8);
  const style: React.CSSProperties = {
    position: "fixed",
    left,
    top,
    zIndex: 1000,
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
      <SparklesIcon />
      <span>AI</span>
    </button>);
}

/** ✨ 유니코드 글리프가 옵시디언 Inter 폰트에 없는 환경 대비 inline SVG. */
function SparklesIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

interface PopoverShellProps {
  anchor: {
    x: number;
    y: number;
    bottomY: number;
    editorLeft: number;
    editorRight: number;
    selectionLeft: number;
  };
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

  // popover 메뉴 width ~ 280px.
  // 위치 정책: selection 의 좌측 시작점(selectionLeft) 에서 펼친다. selection 은
  // 본문 column 안에 반드시 존재하므로 메뉴도 본문 안에 들어간다. 메뉴의 우측이
  // editor.right 를 넘으면 그만큼 왼쪽으로 당김.
  const POPOVER_WIDTH = 280;
  const desiredLeft = anchor.selectionLeft;
  // editor.right 를 넘지 않도록 right edge - width 로 캡.
  const maxLeft = Math.max(
    Math.max(8, anchor.editorLeft),
    anchor.editorRight - POPOVER_WIDTH - 8,
  );
  const left = Math.max(
    Math.max(8, anchor.editorLeft),
    Math.min(maxLeft, desiredLeft),
  );
  // eslint-disable-next-line no-console
  console.log("[PopoverShell] position", {
    selectionLeft: anchor.selectionLeft,
    editorLeft: anchor.editorLeft,
    editorRight: anchor.editorRight,
    desiredLeft,
    maxLeft,
    finalLeft: left,
    POPOVER_WIDTH,
  });

  const style: React.CSSProperties = {
    position: "fixed",
    left,
    zIndex: 1000,
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
      // 자동 호출 금지 — 사용자가 모달 안 "분석 시작" 또는 "다시 분석" 클릭 시만.
      autoStart={false}
      // 캐시 hit 면 이전 결과로 시작.
      initialFullText={active.cachedFullText ?? undefined}
      onResultReceived={(fullText, durationMs) => {
        const preview = active.capturedSelection.slice(0, 80).replace(/\s+/g, " ");
        setCached(active.cacheKey, {
          fullText,
          durationMs,
          timestampMs: Date.now(),
          selectionPreview: preview,
        });
      }}
      renderTopPanel={({ fullText, phase }) => {
        // SnippetPanel 은 결과 (done) 일 때만 의미. idle/streaming/error 는 null.
        if (phase !== "done") return null;
        return (
          <SnippetPanel
            fullText={fullText}
            phase={phase}
            action={active.action}
            docId={docId}
            capturedRange={active.capturedRange}
            onAfterInsert={onDone}
          />
        );
      }}
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
      // 본문 삽입 텍스트 결정 (우선순위):
      //  1) 액션 전용 extractInsertable (어휘 코치의 §4 개선 문단 등)
      //  2) <<<REFINED>>>...<<<END>>> 표준 블록 (모든 액션 prompt 에 강제됨)
      //  3) fullText 전체 (위 둘 다 못 찾으면)
      let toInsert: string | null = null;
      if (action.extractInsertable) {
        toInsert = action.extractInsertable(trimmed);
      }
      if (!toInsert) {
        toInsert = extractRefinedBlock(trimmed);
      }
      if (!toInsert) {
        toInsert = trimmed;
        tauriNoticeAdapter.warn(
          "AI 가 '<<<REFINED>>>' 블록을 안 보내 전체 응답을 삽입합니다. 결과를 확인하세요.",
          5000,
        );
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
