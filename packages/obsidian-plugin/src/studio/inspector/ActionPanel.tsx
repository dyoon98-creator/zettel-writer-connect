// ActionPanel.tsx — Inspector 안의 AI 액션 + 무료 액션 묶음.
//
// Phase F: Phase D의 "Phase F 예정" 자리표시자 5개 버튼을 대체.
//   - Phase 2 빌트인 액션 (5개) 그대로 사용 (PHASE2_ACTIONS)
//   - 스킬팩 액션은 skillpackStore에서 로드된 것 + 라이선스 상태별 노출
//   - 무료 액션 (free)은 v1 ↔ v2 모델 차이 때문에 일부만 이식.
//
// 클릭 → ContextComposer (vault 사용) → 옵션으로 ConfirmModal → ResultPreviewModal
//   → 스트리밍 → 사용자 choice 처리 (save/insert/copy/discard).

import { useMemo, useState } from "react";
import {
  ContextComposer,
  PHASE2_ACTIONS,
  type LoadedSkillPack,
  type UnifiedAction,
} from "@ai-manuscript-studio/core";
import type { BinderDocument, BinderNode } from "@ai-manuscript-studio/core";

import { tauriVaultAdapter } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { createFrontmatterAdapter } from "../frontmatterAdapter";
import { useSettingsStore } from "../state/settingsStore";
import { useSkillpackStore } from "../state/skillpackStore";
import { useProjectStore } from "../state/projectStore";
import { ConfirmModal } from "../ai/ConfirmModal";
import {
  ResultPreviewModal,
  type PreviewChoice,
} from "../ai/ResultPreviewModal";

interface ActionPanelProps {
  node: BinderNode;
}

/** 단일 진행 상태. ConfirmModal이 닫히고 ResultPreviewModal로 진행. */
type FlowState =
  | { phase: "idle" }
  | { phase: "confirm"; action: UnifiedAction; prompt: string }
  | { phase: "preview"; action: UnifiedAction; prompt: string };

const SAVE_SECTION_KO: Record<string, string> = {
  feedback: "피드백",
  revising: "퇴고 메모",
  materials: "자료",
  draft: "초안",
  plan: "기획",
};

function buildFreeActions(): UnifiedAction[] {
  // v2 데이터 모델은 v1과 다르다 — reapplyTemplate / addCurrentAsSource 는
  // 직접 이식할 수 없다. 추후 Tauri-friendly 헬퍼를 따로 만든다.
  // 지금은 클립보드 export만 무료 액션으로 노출.
  return [
    {
      id: "free.export-clipboard",
      source: "free",
      label: "원고를 클립보드로 복사",
      status_show: [],
      saveTo: "feedback",
      promptTemplate: "",
      placeholders: [],
      license: { kind: "free" },
      handler: async () => {
        const { projectFolder, binder } = useProjectStore.getState();
        if (!projectFolder || !binder) {
          tauriNoticeAdapter.warn("프로젝트가 열려 있지 않습니다.");
          return;
        }
        // 모든 document를 순회하여 본문을 합친다.
        const out: string[] = [];
        const walk = async (nodes: BinderNode[]): Promise<void> => {
          for (const n of nodes) {
            if (n.type === "document") {
              try {
                const raw = await tauriVaultAdapter.readFile(
                  `${projectFolder}/${n.file}`,
                );
                // frontmatter 제거.
                const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
                out.push(`# ${n.title}\n\n${stripped}`);
              } catch {
                /* skip */
              }
            } else {
              await walk(n.children);
            }
          }
        };
        await walk(binder.root);
        const text = out.join("\n\n---\n\n");
        try {
          await navigator.clipboard.writeText(text);
          tauriNoticeAdapter.info("원고를 클립보드에 복사했습니다.");
        } catch (e) {
          tauriNoticeAdapter.error(
            `복사 실패: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      },
    },
  ];
}

function phase2AsUnified(): UnifiedAction[] {
  return PHASE2_ACTIONS.map((a) => ({
    id: a.id,
    source: "phase2",
    label: a.label,
    status_show: [],
    saveTo: a.saveTo as UnifiedAction["saveTo"],
    sectionAnchor: a.sectionAnchor,
    requiresUserInput: false,
    promptTemplate: a.promptTemplate,
    placeholders: a.placeholders,
    license: { kind: "free" },
  }));
}

function skillpackAsUnified(packs: LoadedSkillPack[]): UnifiedAction[] {
  const out: UnifiedAction[] = [];
  for (const pack of packs) {
    for (const action of pack.manifest.actions) {
      out.push({
        id: action.id,
        source: "skillpack",
        skillpackId: pack.manifest.id,
        skillpackVendor: pack.manifest.vendor,
        label: action.label,
        status_show: action.status_show,
        saveTo: action.save_to,
        sectionAnchor: action.section_anchor,
        requiresUserInput: action.requires_user_input ?? false,
        promptTemplate: pack.promptByActionId[action.id] ?? "",
        placeholders: action.placeholders ?? [],
        license: pack.license,
      });
    }
  }
  return out;
}

function adapterDisplayName(provider: string): string {
  if (provider === "claude-code") return "Claude Code CLI";
  if (provider === "mock") return "목업 어댑터";
  return "Codex CLI";
}

export function ActionPanel(props: ActionPanelProps): JSX.Element {
  const { node } = props;
  const settings = useSettingsStore((s) => s.settings);
  const packs = useSkillpackStore((s) => s.packs);
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const meta = useProjectStore((s) => s.meta);
  const ensureSceneLoaded = useProjectStore((s) => s.ensureSceneLoaded);

  const [flow, setFlow] = useState<FlowState>({ phase: "idle" });
  // ResultPipeline.PipelineSettings.confirmBeforeRun를 세션 단위로 비활성화.
  const [skipConfirmThisSession, setSkipConfirmThisSession] = useState(false);

  const actions = useMemo<UnifiedAction[]>(() => {
    const free = buildFreeActions();
    const phase2 = phase2AsUnified();
    const sp = skillpackAsUnified(packs);
    return [...free, ...phase2, ...sp];
  }, [packs]);

  // node.status (BinderNode 의 customStatus id) 또는 status_show=빈배열 → 항상 노출.
  const visible = useMemo(() => {
    return actions.filter(
      (a) =>
        a.status_show.length === 0 || a.status_show.includes(node.status as never),
    );
  }, [actions, node.status]);

  if (!projectFolder || !meta) return <div className="ins-ai-actions" />;

  const handleClick = async (a: UnifiedAction): Promise<void> => {
    if (a.handler) {
      await a.handler();
      return;
    }
    if (a.license.kind !== "ok" && a.license.kind !== "free") {
      const reason =
        "reason" in a.license ? a.license.reason : "라이선스가 필요합니다.";
      tauriNoticeAdapter.warn(`라이선스 필요: ${reason}`);
      return;
    }

    // mock 모드면 prompt만 만들고 백엔드 호출은 ResultPreviewModal에서 처리.
    // 여기서 ContextComposer를 직접 호출해 prompt를 합성한다.
    if (node.type !== "document") {
      tauriNoticeAdapter.warn("AI 액션은 장면(문서) 노드에서만 실행 가능합니다.");
      return;
    }

    await ensureSceneLoaded(node.id);
    const scenePath = `${projectFolder}/${(node as BinderDocument).file}`;
    const composer = new ContextComposer({
      vault: tauriVaultAdapter,
      notice: tauriNoticeAdapter,
      frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
      // wiki resolver: source notes는 vault 절대 경로 형식으로 들어 있다고 가정.
      resolveWiki: (target) => target,
    });

    let prompt: string;
    try {
      const composed = await composer.compose({
        projectPath: scenePath,
        projectTitle: node.title || meta.title,
        sectionAnchor: a.sectionAnchor,
        action: {
          id: a.id,
          promptTemplate: a.promptTemplate,
          placeholders: a.placeholders,
          saveTo: a.saveTo,
        },
        excludedFolders: settings.excludedFolders.split(",").map((s) => s.trim()),
      });
      prompt = composed.prompt;
    } catch (e) {
      tauriNoticeAdapter.error(
        `프롬프트 합성 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    if (settings.confirmBeforeRun && !skipConfirmThisSession) {
      setFlow({ phase: "confirm", action: a, prompt });
    } else {
      setFlow({ phase: "preview", action: a, prompt });
    }
  };

  const handlePreviewComplete = async (
    choice: PreviewChoice,
    fullText: string,
  ): Promise<void> => {
    const action = flow.phase === "preview" ? flow.action : null;
    setFlow({ phase: "idle" });
    if (!action) return;

    if (choice === "discard") {
      tauriNoticeAdapter.info("결과를 무시했습니다.");
      return;
    }
    if (choice === "copy") {
      try {
        await navigator.clipboard.writeText(fullText);
        tauriNoticeAdapter.info("결과를 클립보드에 복사했습니다.");
      } catch (e) {
        tauriNoticeAdapter.error(
          `복사 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    if (choice === "save") {
      // 저장 위치: 현재 장면과 같은 폴더의 `<scene>.feedback.md` 또는 비슷한 파일.
      // 단순화: 장면 파일 옆에 `<filename>.feedback.md` 파일을 만들고 H3 timestamp로 추가.
      if (node.type !== "document") return;
      const scenePath = `${projectFolder}/${(node as BinderDocument).file}`;
      const sectionLabel = SAVE_SECTION_KO[action.saveTo] ?? "피드백";
      const feedbackPath = scenePath.replace(/\.md$/i, ".feedback.md");
      const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
      const heading = `### ${stamp} — ${action.label}`;
      const block = `${heading}\n\n${fullText.trim()}\n\n`;
      try {
        let prev = "";
        try {
          prev = await tauriVaultAdapter.readFile(feedbackPath);
        } catch {
          prev = `# ${node.title} — AI ${sectionLabel}\n\n`;
        }
        await tauriVaultAdapter.writeFile(feedbackPath, prev + block);
        tauriNoticeAdapter.info(`${sectionLabel} 파일에 저장되었습니다.`);
      } catch (e) {
        tauriNoticeAdapter.error(
          `저장 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }
    if (choice === "insert") {
      // 현재 장면의 본문 마지막에 결과를 append.
      if (node.type !== "document") return;
      const id = node.id;
      const cache = useProjectStore.getState().sceneCache[id];
      if (!cache) {
        tauriNoticeAdapter.warn("장면이 로드되지 않아 삽입할 수 없습니다.");
        return;
      }
      const current = cache.draft ?? cache.body;
      const next = current.endsWith("\n") ? current + fullText : current + "\n\n" + fullText;
      useProjectStore.getState().setSceneDraft(id, next);
      await useProjectStore.getState().saveScene(id);
      tauriNoticeAdapter.info("결과를 본문에 삽입했습니다.");
    }
  };

  const adapterName = adapterDisplayName(settings.aiProvider);

  // 카테고리화: saveTo 를 기준으로 그룹화하여 인스펙터에서 시각적으로 구분.
  // 선택 텍스트 popover 와 다르게 **장면/원고 전체 단위로 동작** 한다는 점을
  // 명시한다.
  const groups: Array<{ key: string; label: string; items: UnifiedAction[] }> = [
    { key: "feedback", label: "🩺 피드백 — 첨삭·관점 평가", items: [] },
    { key: "draft", label: "📝 초안 — 새 글·뼈대 생성", items: [] },
    { key: "revising", label: "✏️ 퇴고 — 다듬기 메모", items: [] },
    { key: "plan", label: "📋 기획", items: [] },
    { key: "materials", label: "📚 자료", items: [] },
    { key: "other", label: "🔧 기타", items: [] },
  ];
  for (const a of visible) {
    const target = groups.find((g) => g.key === a.saveTo) ?? groups[groups.length - 1];
    target.items.push(a);
  }
  const nonEmptyGroups = groups.filter((g) => g.items.length > 0);

  return (
    <div className="section">
      <div className="section-label">장면 단위 AI 액션</div>
      <div className="pane-hint" style={{ marginBottom: 8, fontSize: 11 }}>
        지금 열려 있는 <b>장면 한 편</b>(또는 묶음)을 통째로 다루는 액션입니다.
        <br />
        문장·문단을 골라 다루려면 <b>본문에서 텍스트를 드래그</b>하면 떠오르는
        팝업 메뉴(진단서·어휘·이어쓰기·첫 문장·비유)를 사용하세요.
      </div>
      {nonEmptyGroups.map((g) => (
        <div key={g.key} className="ins-ai-group">
          <div className="ins-ai-group-title">{g.label}</div>
          <div className="ins-ai-actions" data-testid={`action-group-${g.key}`}>
            {g.items.map((a) => {
              const locked =
                a.license.kind !== "ok" && a.license.kind !== "free";
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`ins-ai-btn${locked ? " ins-ai-btn--locked" : ""}`}
                  onClick={() => void handleClick(a)}
                  data-testid={`action-${a.id}`}
                  data-source={a.source}
                  data-locked={locked ? "true" : "false"}
                  title={
                    locked
                      ? "라이선스 필요"
                      : a.source === "skillpack"
                        ? `${a.skillpackVendor ?? ""} · ${a.label}`
                        : a.label
                  }
                >
                  {locked && <span aria-hidden="true">🔒 </span>}
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {visible.length === 0 && (
        <div className="pane-hint">현재 상태에 표시할 액션이 없습니다.</div>
      )}

      {flow.phase === "confirm" && (
        <ConfirmModal
          actionLabel={flow.action.label}
          adapterName={adapterName}
          prompt={flow.prompt}
          onCancel={() => setFlow({ phase: "idle" })}
          onConfirm={(opts) => {
            if (opts.skipForSession) setSkipConfirmThisSession(true);
            setFlow({ phase: "preview", action: flow.action, prompt: flow.prompt });
          }}
        />
      )}

      {flow.phase === "preview" && (
        <ResultPreviewModal
          action={flow.action}
          prompt={flow.prompt}
          adapterName={adapterName}
          binaryPath={
            settings.aiProvider === "claude-code"
              ? settings.claudeCodePath
              : settings.codexPath
          }
          extraArgs={settings.codexExtraArgs}
          provider={settings.aiProvider}
          discardStreamTokens
          timeoutSecs={300}
          onComplete={(choice, fullText) =>
            void handlePreviewComplete(choice, fullText)
          }
        />
      )}
    </div>
  );
}
