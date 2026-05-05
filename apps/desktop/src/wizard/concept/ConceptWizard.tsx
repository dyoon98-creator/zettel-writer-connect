// @TASK P3-T10 — 컨셉 마법사 모달 컨테이너
//
// 구조:
//   풀스크린 백드롭 (클릭 차단)
//     윈도우 (헤더 + body)
//       헤더: 진행 표시 + "임시로 닫기 (Cmd+.)" + "취소"
//       body: session.stage 에 따라 Step1~Step5 swap
//
// 백드롭 클릭 → 무시 (사양: "실수로 컨텍스트 잃지 않게")
// Cmd+. (또는 Ctrl+.) → pauseForBinder / resumeFromBinder 토글
// 취소 → window.confirm 후 store.close() (세션 JSON 은 유지)

import { useEffect } from "react";
import { useConceptWizardStore } from "../../state/conceptWizardStore";
import { Step1Seed } from "./Step1Seed";
import { Step2Concept } from "./Step2Concept";
import { Step3Synopsis } from "./Step3Synopsis";
import { Step4Outline } from "./Step4Outline";
import { Step5Commit } from "./Step5Commit";

// ─── 스타일 상수 ──────────────────────────────────────────────────────────────

const BACKDROP_STYLE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  zIndex: 8000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const WINDOW_STYLE: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 10,
  width: "min(92vw, 960px)",
  height: "min(92vh, 780px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
};

const HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 20px",
  borderBottom: "1px solid #e0dcd4",
  flexShrink: 0,
  background: "#faf9f7",
};

const TITLE_STYLE: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: "#2b2620",
  marginRight: "auto",
};

const PROGRESS_STYLE: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const BODY_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  minHeight: 0,
};

const PAUSE_BTN_STYLE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 5,
  border: "1px solid #c8c4bd",
  background: "#fff",
  color: "#2b2620",
  fontSize: 12,
  cursor: "pointer",
};

const CANCEL_BTN_STYLE: React.CSSProperties = {
  padding: "5px 12px",
  borderRadius: 5,
  border: "1px solid #c8c4bd",
  background: "#fff",
  color: "#786f63",
  fontSize: 12,
  cursor: "pointer",
};

// ─── 진행 도트 ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, number> = {
  // session === null → Step1
  seed: 1,
  concept: 2,
  synopsis: 3,
  outline: 4,
  done: 5,
};

function stepNumber(sessionStage: string | null): number {
  if (!sessionStage) return 1;
  return STAGE_LABELS[sessionStage] ?? 1;
}

function ProgressDots({ current }: { current: number }): JSX.Element {
  return (
    <div style={PROGRESS_STYLE} aria-label={`${current}/5단계`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: n <= current ? "#1f7a4a" : "#d5d0c9",
            transition: "background 0.2s",
          }}
          aria-hidden="true"
        />
      ))}
      <span
        style={{ fontSize: 12, color: "#786f63", marginLeft: 4 }}
      >
        {current}/5
      </span>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function ConceptWizard(): JSX.Element | null {
  const isOpen = useConceptWizardStore((s) => s.isOpen);
  const pausedForBinder = useConceptWizardStore((s) => s.pausedForBinder);
  const session = useConceptWizardStore((s) => s.session);
  const pauseForBinder = useConceptWizardStore((s) => s.pauseForBinder);
  const resumeFromBinder = useConceptWizardStore((s) => s.resumeFromBinder);
  const goStage = useConceptWizardStore((s) => s.goStage);
  const close = useConceptWizardStore((s) => s.close);

  // ── Cmd+. 핸들러 ──────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!((e.metaKey || e.ctrlKey) && e.key === ".")) return;
      // input/textarea 안에서 편집 중이면 무시.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (isOpen && !pausedForBinder) {
        pauseForBinder();
      } else if (pausedForBinder) {
        resumeFromBinder();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pausedForBinder, pauseForBinder, resumeFromBinder]);

  if (!isOpen) return null;

  // ── 취소 ──────────────────────────────────────────────────────────────────
  function handleCancel(): void {
    const confirmed = window.confirm(
      "진행 중인 마법사를 취소하시겠습니까? (저장된 임시 세션은 유지됩니다.)",
    );
    if (confirmed) close();
  }

  // ── Step swap ─────────────────────────────────────────────────────────────
  const stage = session?.stage ?? null;
  const current = stepNumber(stage);

  function renderStep(): JSX.Element {
    // session === null → Step1Seed (store.start 가 session 생성)
    if (!session) {
      return (
        <Step1Seed
          onAdvance={() => {
            // session.stage 는 store.start 가 "concept" 으로 설정 — 자동 전이.
          }}
        />
      );
    }

    switch (session.stage) {
      case "concept":
        return (
          <Step2Concept
            onAdvance={() => goStage("synopsis")}
            onBack={() => {
              // Step1로 복귀: session 을 null 로 초기화할 수 없으므로
              // 사용자가 시드를 다시 입력하는 UX 는 scope 밖. goStage "concept" 유지.
            }}
          />
        );
      case "synopsis":
        return (
          <Step3Synopsis
            onAdvance={() => goStage("outline")}
            onBack={() => goStage("concept")}
          />
        );
      case "outline":
        return (
          <Step4Outline
            onAdvance={() => goStage("done")}
            onBack={() => goStage("synopsis")}
          />
        );
      case "done":
        return (
          <Step5Commit
            onComplete={() => close()}
            onBack={() => goStage("outline")}
          />
        );
      default:
        return <Step1Seed />;
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={BACKDROP_STYLE}
      role="presentation"
      data-testid="concept-wizard-backdrop"
      onClick={(e) => {
        // 백드롭 자체 클릭만 차단 — 이벤트 버블링으로 백드롭에 도달한 클릭도 막음.
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="컨셉 마법사"
        style={WINDOW_STYLE}
        data-testid="concept-wizard-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header style={HEADER_STYLE}>
          <span style={TITLE_STYLE}>컨셉 마법사</span>
          <ProgressDots current={current} />
          <button
            type="button"
            style={PAUSE_BTN_STYLE}
            onClick={pauseForBinder}
            data-testid="concept-wizard-pause-btn"
            title="임시로 닫기 (Cmd+.)"
          >
            임시로 닫기 (⌘.)
          </button>
          <button
            type="button"
            style={CANCEL_BTN_STYLE}
            onClick={handleCancel}
            data-testid="concept-wizard-cancel-btn"
          >
            취소
          </button>
        </header>

        {/* body — Step swap */}
        <div style={BODY_STYLE} data-testid="concept-wizard-body">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
