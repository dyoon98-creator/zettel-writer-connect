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
  DEFAULT_DRAFT_GENRE,
  GENRE_LABEL_KO,
} from "@ai-manuscript-studio/core";

import { tauriNoticeAdapter } from "../noticeAdapter";
import { useProjectStore } from "../state/projectStore";
import {
  getVaultBasePath,
  setVaultBasePath,
  tauriVaultAdapter,
} from "../vaultAdapter";
import { createFrontmatterAdapter } from "../frontmatterAdapter";
import { seedProjectFromSummary, applySummaryToExistingProject } from "./wizardSeed";
import { draftChapters } from "./wizardDraft";
import { useSettingsStore } from "../state/settingsStore";
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
  onAccept: () => void;
  onDecline: () => void;
  isSeeding: boolean;
  /** 「초고까지」 — 시드 후 장마다 AI 로 본문을 쓴다. */
  onAcceptWithDraft: () => void;
  isDrafting: boolean;
  draftProgress: string | null;
  onCancelDraft: () => void;
}

function SeedPrompt({
  summary,
  onAccept,
  onDecline,
  isSeeding,
  onAcceptWithDraft,
  isDrafting,
  draftProgress,
  onCancelDraft,
}: SeedPromptProps): JSX.Element {
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
      {isDrafting && (
        <div className="wizard-seed-drafting" data-testid="wizard-seed-drafting">
          <span>초고를 쓰는 중입니다{draftProgress ? ` — ${draftProgress}` : "…"}</span>
          <button
            type="button"
            className="wizard-seed-cancel"
            onClick={onCancelDraft}
            data-testid="wizard-seed-draft-cancel"
          >
            중단
          </button>
        </div>
      )}
      <div className="wizard-seed-actions">
        <button
          type="button"
          className="wizard-seed-accept"
          onClick={() => void onAcceptWithDraft()}
          disabled={isSeeding || isDrafting}
          data-testid="wizard-seed-accept-draft"
        >
          {isSeeding
            ? "프로젝트 생성 중…"
            : isDrafting
              ? "초고 쓰는 중…"
              : "binder 만들고 초고까지 쓰기 (장마다 몇 분)"}
        </button>
        <button
          type="button"
          className="wizard-seed-decline"
          onClick={() => void onAccept()}
          disabled={isSeeding || isDrafting}
          data-testid="wizard-seed-accept"
        >
          {isSeeding ? "프로젝트 생성 중…" : "구조만 만들기"}
        </button>
        <button
          type="button"
          className="wizard-seed-decline"
          onClick={onDecline}
          disabled={isSeeding || isDrafting}
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
  const rev = useWizardStore((s) => s.rev);

  const projectVaultPath = useProjectStore((s) => s.vaultPath);
  const loadProject = useProjectStore((s) => s.loadProject);

// 옵시디언에서는 vault 루트를 «언제나» 알 수 있다 — plugin 이 마운트될 때
// 정해진다(`getVaultBasePath()`). 반면 projectStore.vaultPath 는 Tauri 시절의
// 값이라 `loadProject()` 를 한 번도 거치지 않으면 비어 있다. 그 상태에서
// 마법사를 끝내면 「vault 경로를 알 수 없어 프로젝트를 만들 수 없습니다」로
// 막혔다 — 인터뷰를 4/4 로 다 끝내고 장 9개까지 뽑아 놓은 뒤였다
// (2026-08-31 대표 보고). 스토어가 비면 plugin 에게 직접 묻는다.
  // vaultPath 는 옵시디언에서 «라벨»일 뿐이다 — 파일 입출력은 전부 vault
  // 상대경로로 가고 setVaultBasePath() 는 no-op 이다. 그러니 못 구해도 막지
  // 않는다. 빈 문자열로 진행한다.
  const vaultPath =
    vaultPathOverride ?? projectVaultPath ?? getVaultBasePath() ?? "";

  const [drafting, setDrafting] = useState<AbortController | null>(null);
  const [draftProgress, setDraftProgress] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  // 기본값은 여기서 «정하지» 않는다 — core 의 DEFAULT_DRAFT_GENRE 한 곳이 정본이다.
  // (예전엔 이 화면과 컨셉 마법사 1단계가 같은 값을 두 벌 하드코딩하고 있었다.)
  const [genreDraft, setGenreDraft] = useState<Genre>(DEFAULT_DRAFT_GENRE);

  // engine 이 새로 만들어졌을 때 draft 초기화.
  // rev 를 함께 보는 이유: 세션이 이미 있는 프로젝트의 저장물에서 장르·컨셉을
  // 늦게(비동기로) 이어받는 경우가 있어, engine 참조만으로는 다시 그리지 않는다.
  useEffect(() => {
    if (!engine) {
      setTitleDraft("");
      setGenreDraft(DEFAULT_DRAFT_GENRE);
      return;
    }
    setTitleDraft(engine.session.draftTitle ?? "");
    setGenreDraft(engine.session.draftGenre ?? DEFAULT_DRAFT_GENRE);
  }, [engine, rev]);

  if (!isOpen) return null;

  const handleAccept = async (withDraft = false): Promise<void> => {
    if (!summary) return;
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

    // 「초고까지」를 고르셨으면 이어서 장마다 본문을 쓴다. 여기서 멈추면
    // 빈 파일만 남는데, 그건 글이 아니다 (2026-08-31 대표 지시).
    if (result && withDraft) {
      await runDraft(result.projectFolder);
    }
  };

  /** 시드된 장들에 AI 로 본문을 채운다. 진행률은 notice 로 알린다. */
  const runDraft = async (projectFolder: string): Promise<void> => {
    const settings = useSettingsStore.getState().settings;
    const binaryPath =
      settings.aiProvider === "claude-code"
        ? settings.claudeCodePath
        : settings.codexPath;

    if (settings.aiProvider === "mock" || !binaryPath.trim()) {
      tauriNoticeAdapter.error(
        "AI 실행 경로가 없어 초고를 쓸 수 없습니다. 설정 → AI 호출 에서 경로를 넣으신 뒤, 헤더의 「기획 결과 보기」로 다시 시도하십시오.",
        9000,
      );
      return;
    }

    const controller = new AbortController();
    setDrafting(controller);
    tauriNoticeAdapter.info("초고를 쓰기 시작합니다. 장마다 몇 분씩 걸립니다.", 6000);

    try {
      const store = useProjectStore.getState();
      const r = await draftChapters(projectFolder, store.binder, {
        provider: settings.aiProvider === "claude-code" ? "claude-code" : "codex",
        binaryPath,
        extraArgs: settings.codexExtraArgs,
        setSceneDraft: (id, body) => useProjectStore.getState().setSceneDraft(id, body),
        saveScene: (id) => useProjectStore.getState().saveScene(id),
        readSceneBody: (id) => useProjectStore.getState().sceneCache?.[id]?.body ?? null,
        signal: controller.signal,
        onProgress: (pr) => setDraftProgress(pr.total ? `${pr.done}/${pr.total} — ${pr.current}` : null),
      });

      const parts = [`초고 ${r.written}장 작성`];
      if (r.skipped > 0) parts.push(`${r.skipped}장은 이미 본문이 있어 건너뜀`);
      if (r.failed > 0) parts.push(`${r.failed}장 실패 (${r.failedTitles.join(", ")})`);
      if (r.aborted) parts.push("중간에 취소됨");
      (r.failed > 0 ? tauriNoticeAdapter.warn : tauriNoticeAdapter.info)(
        parts.join(" · "),
        9000,
      );
    } catch (e) {
      tauriNoticeAdapter.error(
        `초고 쓰기 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setDrafting(null);
      setDraftProgress(null);
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
                const prev = engine?.session.draftGenre;
                setGenreDraft(g);
                engine?.setDraftGenre(g);
                // 종류는 «바꿀 수» 있어야 한다 — 그러나 컨셉·시놉시스·트리트먼트는
                // 앞 종류에 맞춰 쓰인 것이라 조용히 어긋난다. 막지 않고 알린다.
                if (engine?.session.conceptHandoff && prev && prev !== g) {
                  tauriNoticeAdapter.warn(
                    `문서 종류를 ${GENRE_LABEL_KO[prev]} → ${GENRE_LABEL_KO[g]} 로 바꿨습니다. ` +
                      `앞서 만든 컨셉·시놉시스·트리트먼트는 ${GENRE_LABEL_KO[prev]} 기준으로 쓰인 것이라 결이 어긋날 수 있습니다.`,
                    8000,
                  );
                }
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
            onAccept={() => void handleAccept(false)}
            onAcceptWithDraft={() => void handleAccept(true)}
            isDrafting={drafting !== null}
            draftProgress={draftProgress}
            onCancelDraft={() => drafting?.abort()}
            onDecline={declineSeed}
          />
        )}
      </div>
    </div>
  );
}
