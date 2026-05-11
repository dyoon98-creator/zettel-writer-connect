// @TASK P3-T9 — 미완료 컨셉 마법사 세션 재진입 토스트
//
// vault 경로가 설정되면 listSessions() 를 호출해 미완료 세션 N개를 토스트로 표시.
// "이어하기" → loadFromSession, "버리기" → archiveSession + 토스트 dismiss.

import { useEffect, useState } from "react";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../../state/projectStore";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { listSessions, archiveSession } from "./conceptSessionPersist";

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const CONTAINER_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  zIndex: 9999,
  pointerEvents: "none",
};

const TOAST_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e0dcd4",
  borderRadius: 8,
  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
  padding: "12px 16px",
  maxWidth: 340,
  fontSize: 13,
  color: "#2b2620",
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const SEED_PREVIEW_STYLE: React.CSSProperties = {
  color: "#786f63",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const RESUME_BTN_STYLE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 5,
  border: "none",
  background: "#1f7a4a",
  color: "#fff",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

const DISMISS_BTN_STYLE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 5,
  border: "1px solid #e0dcd4",
  background: "#fff",
  color: "#786f63",
  fontSize: 12,
  cursor: "pointer",
};

// ─── 개별 토스트 ──────────────────────────────────────────────────────────────

interface SessionToastProps {
  session: ConceptDraftSession;
  onResume: () => void;
  onDismiss: () => void;
}

const STAGE_LABEL_KO: Record<string, string> = {
  seed: "시드 입력 중",
  memo: "메모 정리 중",
  concept: "컨셉 다듬는 중",
  synopsis: "시놉시스 작성 중",
  treatment: "트리트먼트 작성 중",
  outline: "목차 작성 중", // legacy
};

function SessionToast({ session, onResume, onDismiss }: SessionToastProps): JSX.Element {
  const seedPreview = session.seed.slice(0, 60) + (session.seed.length > 60 ? "…" : "");
  const stageLabel = STAGE_LABEL_KO[session.stage] ?? session.stage;
  return (
    <div
      style={TOAST_STYLE}
      role="alert"
      aria-live="polite"
      data-testid="concept-resume-toast"
    >
      <div>이전 마법사를 이어서 진행하시겠습니까? <span style={{ color: "#1f7a4a", fontWeight: 600 }}>({stageLabel})</span></div>
      <div style={SEED_PREVIEW_STYLE} title={session.seed}>{seedPreview}</div>
      <div style={ACTIONS_STYLE}>
        <button
          type="button"
          style={DISMISS_BTN_STYLE}
          onClick={onDismiss}
          data-testid="concept-toast-dismiss"
        >
          버리기
        </button>
        <button
          type="button"
          style={RESUME_BTN_STYLE}
          onClick={onResume}
          data-testid="concept-toast-resume"
        >
          이어하기
        </button>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function ConceptResumeToast(): JSX.Element | null {
  const vaultPath = useProjectStore((s) => s.vaultPath);
  const loadFromSession = useConceptWizardStore((s) => s.loadFromSession);

  const [pendingSessions, setPendingSessions] = useState<ConceptDraftSession[]>([]);

  useEffect(() => {
    if (!vaultPath) {
      setPendingSessions([]);
      return;
    }
    let cancelled = false;
    void listSessions().then((sessions) => {
      if (!cancelled) setPendingSessions(sessions);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultPath]);

  if (pendingSessions.length === 0) return null;

  function handleResume(s: ConceptDraftSession): void {
    loadFromSession(s);
    setPendingSessions((prev) => prev.filter((x) => x.id !== s.id));
  }

  function handleDismiss(s: ConceptDraftSession): void {
    void archiveSession(s.id);
    setPendingSessions((prev) => prev.filter((x) => x.id !== s.id));
  }

  return (
    <div style={CONTAINER_STYLE} aria-label="재진입 가능한 마법사 세션">
      {pendingSessions.map((s) => (
        <SessionToast
          key={s.id}
          session={s}
          onResume={() => handleResume(s)}
          onDismiss={() => handleDismiss(s)}
        />
      ))}
    </div>
  );
}
