// WizardSidebar.tsx — 단계 진행 표시 + 클릭으로 단계 이동.

import { STAGE_DESCRIPTION_KO, STAGE_LABEL_KO, WIZARD_STAGES, type WizardStageId } from "@ai-manuscript-studio/core";

import { useWizardStore } from "./wizardStore";

// 「건너뛴 단계」는 `status` 가 아니라 `skippedReason` 으로 구분한다.
// (`StageStatus` 를 넓히면 레거시 Tauri 앱의 같은 화면이 함께 깨진다 — 그쪽은
//  폐기 예정이라 손대지 않는다. 자세한 판정은 core `wizard/types.ts` 주석.)
function statusGlyph(
  status: "pending" | "active" | "complete",
  skipped: boolean,
): string {
  if (skipped) return "◎";
  if (status === "complete") return "●";
  if (status === "active") return "◐";
  return "○";
}

function statusLabel(
  status: "pending" | "active" | "complete",
  skipped: boolean,
): string {
  if (skipped) return "이어받음";
  if (status === "complete") return "완료";
  if (status === "active") return "진행 중";
  return "대기";
}

export function WizardSidebar(): JSX.Element {
  const engine = useWizardStore((s) => s.engineRef);
  const phase = useWizardStore((s) => s.phase);
  // rev 를 구독해 메시지 변경 시 리렌더.
  useWizardStore((s) => s.rev);
  const revisitStage = useWizardStore((s) => s.revisitStage);

  const progress = engine?.getProgress() ?? {
    complete: 0,
    total: WIZARD_STAGES.length,
  };

  return (
    <aside className="wizard-sidebar" data-testid="wizard-sidebar">
      <header className="wizard-sidebar-header">
        <h2>기획 인터뷰</h2>
        <p className="wizard-sidebar-subtitle">
          핵심만 빠르게 — {WIZARD_STAGES.length}단계로 정리합니다.
        </p>
      </header>

      <div className="wizard-progress" aria-label="진척도">
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-bar-fill"
            style={{ width: `${(progress.complete / progress.total) * 100}%` }}
          />
        </div>
        <span className="wizard-progress-text">
          {progress.complete} / {progress.total}
        </span>
      </div>

      <ol className="wizard-stages" role="list">
        {WIZARD_STAGES.map((stage: WizardStageId, idx) => {
          const outcome =
            engine?.session.stages[stage] ?? { stage, status: "pending" as const };
          const skipped = Boolean(
            (outcome as { skippedReason?: string }).skippedReason,
          );
          const active = outcome.status === "active";
          const complete = outcome.status === "complete";
          const disabled = phase === "seeding";

          return (
            <li
              key={stage}
              className={
                "wizard-stage " +
                (active ? "wizard-stage--active " : "") +
                (complete ? "wizard-stage--complete " : "")
              }
              data-testid={`wizard-stage-${stage}`}
            >
              <button
                type="button"
                className="wizard-stage-btn"
                disabled={disabled}
                // 건너뛴 단계도 눌러서 되돌아갈 수 있다 — 이어받은 구조가 마음에
                // 안 들면 그 자리에서 다시 고를 수 있어야 한다.
                onClick={() => revisitStage(stage)}
                aria-label={`${idx + 1}단계 ${STAGE_LABEL_KO[stage]} (${statusLabel(outcome.status, skipped)})`}
              >
                <span className="wizard-stage-glyph" aria-hidden>
                  {statusGlyph(outcome.status, skipped)}
                </span>
                <span className="wizard-stage-num">{idx + 1}</span>
                <span className="wizard-stage-name">
                  <span className="wizard-stage-label">{STAGE_LABEL_KO[stage]}</span>
                  <span className="wizard-stage-desc">
                    {STAGE_DESCRIPTION_KO[stage]}
                  </span>
                </span>
              </button>
              {outcome.status === "complete" && outcome.summary && (
                <p
                  className="wizard-stage-summary"
                  title={outcome.summary}
                  data-skipped={skipped ? "true" : undefined}
                >
                  {skipped ? "이어받음 — " : ""}
                  {outcome.summary}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
