// SnippetPanel.tsx — AI 결과에서 추출한 후보 문장들을 카드 그리드로 보여준다.
// 이어쓰기 코치는 5×2=최대 10개의 카드(다음 문장 / 이어서 2~3문장)를 띄운다.
//
// 각 카드 동작:
//  - "본문에 삽입": editorRegistry 로 선택 영역 끝(append) 또는 교체(replace) 후 토스트.
//  - "복사": 클립보드 복사.

import { useMemo } from "react";

import * as editorRegistry from "./editorRegistry";
import { tauriNoticeAdapter } from "../noticeAdapter";
import type { ResultSnippet, SelectionActionDef } from "./selectionPrompts";

export interface SnippetPanelProps {
  fullText: string;
  phase: "streaming" | "done" | "error";
  action: SelectionActionDef;
  docId: string;
  /** 액션 실행 시점에 캡처된 선택 영역. */
  capturedRange: { from: number; to: number };
  /** 카드 [이어 붙이기 / 적용] 성공 직후 호출 — SelectionPopover 가 이걸로 모달을 닫는다. */
  onAfterInsert?: () => void;
}

export function SnippetPanel(props: SnippetPanelProps): JSX.Element | null {
  const { fullText, phase, action, docId, capturedRange, onAfterInsert } = props;

  const snippets: ResultSnippet[] | null = useMemo(() => {
    if (phase !== "done" || !action.extractSnippets) return null;
    return action.extractSnippets(fullText);
  }, [fullText, phase, action]);

  if (phase !== "done") return null;
  if (!action.extractSnippets) return null;

  // done 인데 추출 실패 → 마커 누락 안내.
  if (!snippets || snippets.length === 0) {
    return (
      <div className="snippet-panel snippet-panel--empty">
        AI 결과에서 후보 문장 마커를 찾지 못했습니다. 아래 본문에서 직접 복사해
        붙여넣어 주세요.
      </div>
    );
  }

  const insertMode = action.snippetInsertMode ?? "replace";

  const handleInsert = async (snippet: ResultSnippet): Promise<void> => {
    const text = snippet.text.trim();
    if (!text) {
      tauriNoticeAdapter.warn("후보 문장이 비어 있어 삽입하지 않았습니다.");
      return;
    }
    let ok = false;
    if (insertMode === "append") {
      // 선택 영역 직후에 이어 붙임 — 작가의 원문은 보존, 다음 문장만 새로 추가.
      // 자연스러운 띄어쓰기를 위해 앞에 공백/개행이 없으면 한 칸 띄움.
      const docLen = await getDocLen(docId);
      const insertPos = Math.min(capturedRange.to, docLen);
      const padded = " " + text;
      ok = editorRegistry.replaceRange(docId, insertPos, insertPos, padded);
    } else {
      ok = editorRegistry.replaceRange(
        docId,
        capturedRange.from,
        capturedRange.to,
        text,
      );
    }
    if (!ok) {
      // 에디터가 사라졌거나 IME 조합 중 → 클립보드 fallback.
      try {
        await navigator.clipboard.writeText(text);
        tauriNoticeAdapter.warn(
          "에디터가 활성 상태가 아니어서 본문에 반영하지 못했습니다. 클립보드에 복사했습니다.",
        );
      } catch (e) {
        tauriNoticeAdapter.error(
          `복사 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    tauriNoticeAdapter.info(
      insertMode === "append"
        ? "선택 영역 끝에 이어 붙였습니다."
        : "선택 영역을 교체했습니다.",
    );
    // 본문에 정상 반영되면 모달 자동 닫기 — 작가가 곧바로 다음 문장 쓰기에 집중할 수 있도록.
    onAfterInsert?.();
  };

  const handleCopy = async (snippet: ResultSnippet): Promise<void> => {
    try {
      await navigator.clipboard.writeText(snippet.text.trim());
      tauriNoticeAdapter.info("후보 문장을 클립보드에 복사했습니다.");
    } catch (e) {
      tauriNoticeAdapter.error(
        `복사 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  return (
    <div className="snippet-panel" data-testid="snippet-panel">
      <div className="snippet-panel-title">
        후보 {snippets.length}개 — 카드 클릭으로 본문에 바로 적용
      </div>
      <div className="snippet-panel-grid">
        {snippets.map((s) => (
          <div key={s.id} className="snippet-card">
            <div className="snippet-card-title">{s.title}</div>
            <div className="snippet-card-body">{s.text}</div>
            <div className="snippet-card-actions">
              <button
                type="button"
                className="snippet-card-btn snippet-card-btn--primary"
                onClick={() => void handleInsert(s)}
              >
                {insertMode === "append" ? "이어 붙이기" : "선택 영역에 적용"}
              </button>
              <button
                type="button"
                className="snippet-card-btn"
                onClick={() => void handleCopy(s)}
              >
                복사
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 문서 길이 — capturedRange.to 가 그 사이 본문이 줄어들어 범위를 벗어났을 수 있어 clamp 용도.
async function getDocLen(docId: string): Promise<number> {
  const view = editorRegistry.get(docId);
  return view ? view.state.doc.content.size : Number.MAX_SAFE_INTEGER;
}
