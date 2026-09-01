// @TASK P3-T9 — 미완료 컨셉 마법사 세션 재진입 토스트
//
// vault 경로가 설정되면 listSessions() 를 호출해 미완료 세션 N개를 토스트로 표시.
// "이어하기" → loadFromSession, "버리기" → archiveSession + 토스트 dismiss.

import { useEffect, useState } from "react";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../../state/projectStore";
import { getVaultBasePath } from "../../vaultAdapter";
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
// 옵시디언에서는 vault 루트를 «언제나» 알 수 있다 — plugin 이 마운트될 때
// 정해진다(`getVaultBasePath()`). 반면 projectStore.vaultPath 는 Tauri 시절의
// 값이라 `loadProject()` 를 한 번도 거치지 않으면 비어 있다. 그 상태에서
// 마법사를 끝내면 「vault 경로를 알 수 없어 프로젝트를 만들 수 없습니다」로
// 막혔다 — 인터뷰를 4/4 로 다 끝내고 장 9개까지 뽑아 놓은 뒤였다
// (2026-08-31 대표 보고). 스토어가 비면 plugin 에게 직접 묻는다.
  const storeVaultPath = useProjectStore((s) => s.vaultPath);
  const vaultPath = storeVaultPath ?? getVaultBasePath() ?? "";
  const loadFromSession = useConceptWizardStore((s) => s.loadFromSession);

  const [pendingSessions, setPendingSessions] = useState<ConceptDraftSession[]>([]);
  // 나머지를 펼쳐 볼지. 기본은 접어 둔다 — 아래 주석 참고.
  const [expanded, setExpanded] = useState(false);

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

  // 미완 세션을 «전부» 띄우지 않는다.
  //
  // 전에는 남아 있는 세션 수만큼 알림이 쌓였다. 실제로 다섯 개가 겹쳐 컨셉
  // 마법사 화면 절반을 가렸고, 정작 눌러야 할 「다음」이 그 뒤에 숨었다
  // (2026-09-01 실측 화면). 이어서 할 것은 보통 «마지막에 하던 것» 하나다.
  // 하나만 띄우고 나머지는 접는다 — 필요하면 펼칠 수 있게 남겨 둔다.
  const [latest, ...rest] = pendingSessions;

  return (
    <div style={CONTAINER_STYLE} aria-label="재진입 가능한 마법사 세션">
      <SessionToast
        key={latest.id}
        session={latest}
        onResume={() => handleResume(latest)}
        onDismiss={() => handleDismiss(latest)}
      />

      {rest.length > 0 && !expanded && (
        <button
          type="button"
          className="wizard-resume-more"
          data-testid="concept-resume-more"
          onClick={() => setExpanded(true)}
        >
          이어서 할 것이 {rest.length}개 더 있습니다 — 보기
        </button>
      )}

      {expanded &&
        rest.map((s) => (
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
