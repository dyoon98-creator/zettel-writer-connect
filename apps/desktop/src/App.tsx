// App.tsx — 최상위 컴포넌트.
// - mount 시 deep-link 리스너 + 글로벌 단축키 등록
// - 테마 변수를 body[data-theme]에 적용
// - 프로젝트가 로드되어 있지 않으면 안내 화면, 있으면 ScrivenerLayout 렌더

import { useEffect, useRef } from "react";
import { findManuscriptRoot } from "@ai-manuscript-studio/core";
import { onDeepLink, getInitialDeepLinks } from "./deepLink";
import { ScrivenerLayout } from "./layout/ScrivenerLayout";
import { ProjectSwitcher } from "./binder/ProjectSwitcher";
import { useProjectStore } from "./state/projectStore";
import { useApplyThemeToDocument } from "./theme/themeStore";
import { useGlobalShortcuts } from "./shortcuts";
import { WizardOverlay } from "./wizard/WizardOverlay";
import { useWizardStore } from "./wizard/wizardStore";
import { ConceptWizard } from "./wizard/concept/ConceptWizard";
import { ConceptResumeToast } from "./wizard/concept/ConceptResumeToast";
import { useConceptWizardStore } from "./state/conceptWizardStore";
import { SettingsPanel } from "./settings/SettingsPanel";
import { useSettingsBootstrap } from "./state/settingsStore";
import { useSkillpackStore } from "./state/skillpackStore";
import { VoicePane } from "./voice/VoicePane";
import { useVoiceStore } from "./voice/voiceStore";

export function App(): JSX.Element {
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const isLoading = useProjectStore((s) => s.isLoading);
  const error = useProjectStore((s) => s.error);
  const loadProject = useProjectStore((s) => s.loadProject);
  const startWizard = useWizardStore((s) => s.start);
  const wizardOpen = useWizardStore((s) => s.isOpen);
  const openConceptWizard = useConceptWizardStore((s) => s.openEmpty);
  const conceptWizardOpen = useConceptWizardStore((s) => s.isOpen);

  useApplyThemeToDocument();
  useGlobalShortcuts();
  useSettingsBootstrap();

  // 자동 마법사 진입 — "발동 키" 단위로 한 번씩 트리거.
  //
  // 두 케이스가 같은 useEffect 에서 처리된다:
  //   A) 프로젝트가 한 개도 로드되지 않은 빈 상태 (meta=null)
  //      → key = "__empty__". startWizard() 로 새 프로젝트 흐름.
  //   B) 옵시디언이 만든 빈 프로젝트가 막 들어옴 (meta+binder 있는데 manuscript-root
  //      의 자식이 0개) → key = `empty:<projectFolder>`. start({ targetProjectFolder })
  //      로 종료 시 그 폴더에 시드.
  //
  // 한 키로는 한 번만 fire — 사용자가 wizard 를 닫고 빈 상태에 머무르거나, 빈
  // 프로젝트를 그대로 두고 둘러봐도 다시 자동으로 띄우지 않는다.
  // 키가 바뀌면(예: 다른 빈 프로젝트가 새로 들어옴) 다시 자동 진입한다.
  const autoWizardLastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return; // 로드 결과 기다림.
    if (wizardOpen) return; // 이미 열려 있으면 양보.
    if (conceptWizardOpen) return; // ConceptWizard 가 이미 열려 있으면 양보.

    let key: string | null = null;
    let reason = "";
    if (!meta) {
      key = "__empty__";
      reason = "no project loaded";
    } else if (binder && projectFolder) {
      const root = findManuscriptRoot(binder);
      const childCount = root ? root.children.length : binder.root.length;
      if (childCount === 0) {
        key = `empty:${projectFolder}`;
        reason = root
          ? "manuscript-root has 0 children"
          : "binder.root is empty (legacy)";
      } else {
        reason = `binder has ${childCount} top-level node(s) — auto-wizard skipped`;
      }
    } else {
      reason = "binder/projectFolder not yet ready";
    }
    // eslint-disable-next-line no-console
    console.log("[auto-wizard]", {
      key,
      reason,
      lastFired: autoWizardLastKeyRef.current,
      hasMeta: !!meta,
      hasBinder: !!binder,
      projectFolder,
      wizardOpen,
      isLoading,
    });
    if (!key) return; // 채워진 프로젝트 — 자동 진입 대상 아님.
    if (autoWizardLastKeyRef.current === key) return; // 이 키로 이미 발동.

    const targetKey = key;
    const t = window.setTimeout(() => {
      // fire 직전 한 번 더 최신 상태로 검증 — async race 보호.
      const s = useProjectStore.getState();
      if (s.isLoading) return;
      if (useWizardStore.getState().isOpen) return;
      if (useConceptWizardStore.getState().isOpen) return;

      let liveKey: string | null = null;
      if (!s.meta) {
        liveKey = "__empty__";
      } else if (s.binder && s.projectFolder) {
        const r = findManuscriptRoot(s.binder);
        const c = r ? r.children.length : s.binder.root.length;
        if (c === 0) liveKey = `empty:${s.projectFolder}`;
      }
      if (!liveKey || liveKey !== targetKey) return;
      if (autoWizardLastKeyRef.current === liveKey) return;

      autoWizardLastKeyRef.current = liveKey;
      // 빈 상태 또는 빈 프로젝트(옵시디언이 NewProjectModal 로 막 만든 빈 폴더 포함)
      // 모두 새 ConceptWizard 흐름으로 진입.
      useConceptWizardStore.getState().openEmpty();
    }, 400);
    return () => window.clearTimeout(t);
  }, [meta, binder, projectFolder, isLoading, error, wizardOpen, conceptWizardOpen, startWizard]);

  const reloadSkillpacks = useSkillpackStore((s) => s.reload);
  // 프로젝트가 열린 직후 (vault 경로 설정됨) 스킬팩을 1회 로드.
  const vaultPath = useProjectStore((s) => s.vaultPath);
  useEffect(() => {
    if (vaultPath) void reloadSkillpacks();
  }, [vaultPath, reloadSkillpacks]);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      try {
        // 1) 이후 도착하는 URL listen (앱이 떠 있는 동안 옵시디언이 보내는 deep-link).
        const off = await onDeepLink((payload) => {
          void loadProject(payload.vault, payload.project);
        });
        if (cancelled) {
          off();
        } else {
          dispose = off;
        }

        // 2) cold-launch URL — Rust setup()의 emit이 lost 됐을 수 있으므로
        //    mount 후 plugin의 getCurrent()로 한 번 더 직접 가져와 처리한다.
        const initial = await getInitialDeepLinks();
        if (!cancelled && initial.length > 0) {
          const last = initial[initial.length - 1];
          void loadProject(last.vault, last.project);
        }
      } catch (e) {
        // Tauri 이벤트 시스템이 없는 환경(브라우저 단독)에서는 그냥 무시.
        // eslint-disable-next-line no-console
        console.warn("[App] deep-link listener를 등록할 수 없습니다.", e);
      }
    })();

    return () => {
      cancelled = true;
      if (dispose) dispose();
    };
  }, [loadProject]);

  const openVoice = useVoiceStore((s) => s.open);

  if (!meta) {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <button
            type="button"
            className="app-topbar-btn"
            onClick={openVoice}
            title="작가 본인의 글을 모아 AI 가 문체를 학습합니다"
          >
            내 문체 학습
          </button>
          <SettingsPanel />
        </div>
        <div className="app-empty">
          <h1>AI 원고실</h1>
          <p>원고실 앱이 시작되었습니다. 옵시디언에서 원고를 열거나, 마법사로 새 원고를 시작하세요.</p>
          {isLoading && <p>불러오는 중…</p>}
          {error && (
            <p
              style={{
                color: "#a33",
                background: "#fee",
                padding: "8px 12px",
                borderRadius: 6,
                fontFamily: "monospace",
                fontSize: 13,
                maxWidth: 720,
              }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            className="app-empty-cta"
            data-testid="app-empty-new-manuscript"
            onClick={() => openConceptWizard()}
          >
            새 원고 만들기
          </button>
        </div>
        <WizardOverlay />
        <ConceptWizard />
        <ConceptResumeToast />
        <VoicePane />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <ProjectSwitcher />
        <button
          type="button"
          className="app-topbar-btn"
          data-testid="topbar-open-concept-wizard"
          onClick={() => openConceptWizard()}
          title="컨셉 마법사를 다시 열어 새 원고 시드를 짭니다"
        >
          컨셉 마법사
        </button>
        <button
          type="button"
          className="app-topbar-btn"
          onClick={openVoice}
          title="작가 본인의 글을 모아 AI 가 문체를 학습합니다"
        >
          내 문체 학습
        </button>
        <SettingsPanel />
      </div>
      <ScrivenerLayout />
      <WizardOverlay />
      <ConceptWizard />
      <ConceptResumeToast />
      <VoicePane />
    </div>
  );
}
