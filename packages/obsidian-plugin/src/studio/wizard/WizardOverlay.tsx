// WizardOverlay.tsx — 마법사 인터뷰의 풀스크린 오버레이.
//
// 구조:
//   <overlay-backdrop>
//     <overlay-window>
//       <header> 제목 / 진행 / 취소 </header>
//       <body> WizardSidebar | WizardChat </body>
//       (awaiting-seed 일 때) <seed-prompt> 동의 / 거부
//     </overlay-window>
//   </overlay-backdrop>
//
// 외부에서는 <WizardOverlay /> 를 항상 렌더해두고, store.isOpen 으로 가시성을 제어.

import { useEffect, useState } from "react";
import {
  type Genre,
  type WizardSummary,
  GENRE_LABEL_KO,
} from "@ai-manuscript-studio/core";

import { tauriNoticeAdapter } from "../noticeAdapter";
import { useProjectStore } from "../state/projectStore";
import {
  setVaultBasePath,
  tauriVaultAdapter,
} from "../vaultAdapter";
import { createFrontmatterAdapter } from "../frontmatterAdapter";
import { seedProjectFromSummary, applySummaryToExistingProject } from "./wizardSeed";
import { WizardChat } from "./WizardChat";
import { WizardSidebar } from "./WizardSidebar";
import { useWizardStore, getActiveBridgeInfo } from "./wizardStore";

function BridgeBadge(): JSX.Element {
  // rev 변경 시 다시 평가.
  useWizardStore((s) => s.rev);
  const info = getActiveBridgeInfo();
  const isCli = info.kind !== "mock";
  return (
    <span
      title={
        isCli
          ? `${info.kind === "codex-cli" ? "Codex CLI" : "Claude Code CLI"} 사용 중\n경로: ${info.binaryPath ?? ""}`
          : `Mock 모드 — ${info.reason ?? ""}`
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        marginRight: 10,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        background: isCli ? "rgba(40, 140, 80, 0.12)" : "rgba(180, 80, 50, 0.15)",
        color: isCli ? "#1f7a4a" : "#a04030",
        border: `1px solid ${isCli ? "rgba(40, 140, 80, 0.4)" : "rgba(180, 80, 50, 0.4)"}`,
      }}
    >
      <span style={{ fontSize: 9 }}>●</span>
      {isCli
        ? info.kind === "codex-cli"
          ? "Codex CLI"
          : "Claude Code CLI"
        : "Mock 모드"}
    </span>
  );
}

const GENRE_OPTIONS: { id: Genre; label: string }[] = (
  Object.entries(GENRE_LABEL_KO) as [Genre, string][]
).map(([id, label]) => ({ id, label }));

interface SeedPromptProps {
  summary: WizardSummary;
  onAccept: () => Promise<void>;
  onDecline: () => void;
  isSeeding: boolean;
}

function SeedPrompt({ summary, onAccept, onDecline, isSeeding }: SeedPromptProps): JSX.Element {
  return (
    <div className="wizard-seed-prompt" data-testid="wizard-seed-prompt">
      <h3>모든 단계가 끝났습니다</h3>
      <p>
        binder를 자동으로 시드할까요? 아래 {summary.structureProposal.length}개의
        장이 만들어집니다.
      </p>
      <ul className="wizard-seed-structure">
        {summary.structureProposal.map((c, i) => (
          <li key={c.id}>
            <strong>{i + 1}. {c.title}</strong>
            {c.synopsis ? <> — <span>{c.synopsis}</span></> : null}
          </li>
        ))}
      </ul>
      <div className="wizard-seed-actions">
        <button
          type="button"
          className="wizard-seed-accept"
          onClick={() => void onAccept()}
          disabled={isSeeding}
          data-testid="wizard-seed-accept"
        >
          {isSeeding ? "프로젝트 생성 중…" : "지금 binder 만들고 원고실 열기"}
        </button>
        <button
          type="button"
          className="wizard-seed-decline"
          onClick={onDecline}
          disabled={isSeeding}
          data-testid="wizard-seed-decline"
        >
          건너뛰기 — 파일 만들지 않음
        </button>
      </div>
    </div>
  );
}

export interface WizardOverlayProps {
  /** 테스트에서 vault 경로를 강제 주입할 때. 기본은 projectStore.vaultPath. */
  vaultPathOverride?: string | null;
  /** 테스트용 onSeed 훅. 기본은 seedProjectFromSummary. */
  seedFn?: (summary: WizardSummary) => Promise<{
    vaultPath: string;
    projectFolder: string;
    projectSlug: string;
  }>;
  /** 시드 후 자동으로 projectStore.loadProject 를 호출할지 (기본 true). */
  autoOpenAfterSeed?: boolean;
}

export function WizardOverlay({
  vaultPathOverride,
  seedFn,
  autoOpenAfterSeed = true,
}: WizardOverlayProps = {}): JSX.Element | null {
  const isOpen = useWizardStore((s) => s.isOpen);
  const phase = useWizardStore((s) => s.phase);
  const summary = useWizardStore((s) => s.summary);
  const engine = useWizardStore((s) => s.engineRef);
  const close = useWizardStore((s) => s.close);
  const declineSeed = useWizardStore((s) => s.declineSeed);
  const acceptSeed = useWizardStore((s) => s.acceptSeed);
  // rev 구독.
  useWizardStore((s) => s.rev);

  const projectVaultPath = useProjectStore((s) => s.vaultPath);
  const loadProject = useProjectStore((s) => s.loadProject);

  const vaultPath = vaultPathOverride ?? projectVaultPath ?? null;

  const [titleDraft, setTitleDraft] = useState("");
  const [genreDraft, setGenreDraft] = useState<Genre>("investment-strategy-memo");

  // engine 이 새로 만들어졌을 때 draft 초기화.
  useEffect(() => {
    if (!engine) {
      setTitleDraft("");
      setGenreDraft("investment-strategy-memo");
      return;
    }
    setTitleDraft(engine.session.draftTitle ?? "");
    setGenreDraft(engine.session.draftGenre ?? "investment-strategy-memo");
  }, [engine]);

  if (!isOpen) return null;

  const handleAccept = async (): Promise<void> => {
    if (!summary) return;
    if (!vaultPath) {
      tauriNoticeAdapter.error(
        "vault 경로를 알 수 없어 프로젝트를 만들 수 없습니다. 옵시디언에서 한 번 열고 다시 시도해주세요.",
      );
      return;
    }
    setVaultBasePath(vaultPath);

    // start({ targetProjectFolder }) 였으면 기존 프로젝트에 시드. 아니면 새 프로젝트.
    const targetFolder = useWizardStore.getState().targetProjectFolder;

    const seed =
      seedFn ??
      (async (s) => {
        if (targetFolder) {
          const r = await applySummaryToExistingProject(s, targetFolder, {
            vault: tauriVaultAdapter,
            notice: tauriNoticeAdapter,
            frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
          });
          tauriNoticeAdapter.info(
            `기획 결과를 적용했습니다. 새 챕터 ${r.chaptersAdded}개${r.planningWritten ? ", planning.md 갱신됨" : ""}.`,
          );
          const slug = targetFolder.split("/").pop() ?? targetFolder;
          return { vaultPath, projectFolder: targetFolder, projectSlug: slug };
        }
        return seedProjectFromSummary(s, {
          vault: tauriVaultAdapter,
          notice: tauriNoticeAdapter,
          frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
          vaultPath,
        });
      });

    const resultRef: {
      current:
        | { vaultPath: string; projectFolder: string; projectSlug: string }
        | null;
    } = { current: null };
    await acceptSeed(async (s) => {
      resultRef.current = await seed(s);
    });

    const result = resultRef.current;
    if (result && autoOpenAfterSeed) {
      try {
        await loadProject(result.vaultPath, result.projectFolder);
      } catch (e) {
        tauriNoticeAdapter.error(
          `프로젝트를 열 수 없습니다: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  };

  const titleEditable = phase === "interviewing";
  // 안내가 떠야 하는 조건: awaiting-seed 또는 seeding (둘 다에서 prompt 보이는 게
  // 자연스럽다 — seeding 일 때는 버튼 disabled).
  const showSeedPrompt =
    (phase === "awaiting-seed" || phase === "seeding") && summary;
  const isSeeding: boolean = phase === "seeding";

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true" data-testid="wizard-overlay">
      <div className="wizard-overlay-window">
        <header className="wizard-overlay-header">
          <h1>새 원고 마법사</h1>
          <div className="wizard-overlay-meta">
            <input
              type="text"
              className="wizard-overlay-title"
              placeholder="원고 가제 (예: AI 시대의 작가)"
              value={titleDraft}
              data-testid="wizard-title-input"
              disabled={!titleEditable}
              onChange={(e) => {
                const v = e.target.value;
                setTitleDraft(v);
                engine?.setDraftTitle(v);
              }}
            />
            <select
              className="wizard-overlay-genre"
              value={genreDraft}
              data-testid="wizard-genre-select"
              disabled={!titleEditable}
              onChange={(e) => {
                const g = e.target.value as Genre;
                setGenreDraft(g);
                engine?.setDraftGenre(g);
              }}
            >
              {GENRE_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="wizard-overlay-spacer" />
          <BridgeBadge />
          <button
            type="button"
            className="wizard-overlay-cancel"
            onClick={close}
            data-testid="wizard-cancel"
          >
            취소
          </button>
        </header>

        <div className="wizard-overlay-body">
          <WizardSidebar />
          <WizardChat />
        </div>

        {showSeedPrompt && summary && (
          <SeedPrompt
            summary={summary}
            isSeeding={isSeeding}
            onAccept={handleAccept}
            onDecline={declineSeed}
          />
        )}
      </div>
    </div>
  );
}
