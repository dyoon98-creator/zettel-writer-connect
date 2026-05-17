// ConfirmModal.tsx — AI 액션 실행 전 확인 오버레이.
//
// settings.confirmBeforeRun 가 true 일 때 ResultPipeline 또는 ActionPanel 이
// onConfirm 응답을 받아 분기.
//
// 표시:
//   - 액션 라벨 + 어댑터 이름
//   - 합성된 prompt 의 처음 60줄 (긴 경우 잘라서 + "…(이하 생략)")
//   - "이번 세션은 다시 묻지 않기" 체크박스
//   - 버튼: 실행 / 취소

import { useState } from "react";

const MAX_PREVIEW_LINES = 60;

export interface ConfirmModalProps {
  actionLabel: string;
  adapterName: string;
  prompt: string;
  /** 사용자가 실행 → 콜백, optional skipForSession 플래그. */
  onConfirm: (opts: { skipForSession: boolean }) => void;
  onCancel: () => void;
}

function previewPrompt(prompt: string): string {
  const lines = prompt.split(/\r?\n/);
  if (lines.length <= MAX_PREVIEW_LINES) return prompt;
  return lines.slice(0, MAX_PREVIEW_LINES).join("\n") + "\n…(이하 생략)";
}

export function ConfirmModal(props: ConfirmModalProps): JSX.Element {
  const { actionLabel, adapterName, prompt, onConfirm, onCancel } = props;
  const [skipForSession, setSkipForSession] = useState(false);

  return (
    <div
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid="confirm-modal"
    >
      <div className="confirm-modal-window">
        <header className="confirm-modal-header">
          <h2>AI 액션 실행 확인</h2>
          <div className="confirm-modal-meta">
            <strong>{actionLabel}</strong>
            <span className="confirm-modal-sep"> · </span>
            <span>{adapterName}</span>
          </div>
        </header>
        <div className="confirm-modal-body">
          <div className="confirm-modal-label">아래 프롬프트가 AI에게 전송됩니다:</div>
          <pre
            className="confirm-modal-prompt"
            data-testid="confirm-modal-prompt"
          >
            {previewPrompt(prompt)}
          </pre>
        </div>
        <footer className="confirm-modal-footer">
          <label className="confirm-modal-skip">
            <input
              type="checkbox"
              checked={skipForSession}
              onChange={(e) => setSkipForSession(e.target.checked)}
              data-testid="confirm-modal-skip"
            />
            <span>이번 세션은 다시 묻지 않기</span>
          </label>
          <div className="confirm-modal-actions">
            <button
              type="button"
              className="confirm-modal-cancel"
              onClick={onCancel}
              data-testid="confirm-modal-cancel"
            >
              취소
            </button>
            <button
              type="button"
              className="confirm-modal-confirm"
              onClick={() => onConfirm({ skipForSession })}
              data-testid="confirm-modal-confirm"
            >
              실행
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
