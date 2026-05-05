// PlanningResultModal.tsx — 기존 planning.md 를 읽어 결과 미리보기 + binder 시드.
//
// 작가가 이전에 마법사로 기획을 끝냈지만 binder 가 비어있을 때, 헤더의
// "기획 결과 보기" 버튼으로 이 모달을 열어:
//  - planning.md 본문 그대로 미리보기
//  - "이 기획대로 binder 시드" 액션 (PlanningMdWriter.parse → applySummaryToExistingProject)

import { useEffect, useState } from "react";
import { PlanningMdWriter, type WizardSummary } from "@ai-manuscript-studio/core";
import { tauriVaultAdapter, setVaultBasePath } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { createFrontmatterAdapter } from "../frontmatterAdapter";
import { useProjectStore } from "../state/projectStore";
import { applySummaryToExistingProject } from "./wizardSeed";

interface Props {
  onClose: () => void;
}

export function PlanningResultModal({ onClose }: Props): JSX.Element {
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const vaultPath = useProjectStore((s) => s.vaultPath);
  const loadProject = useProjectStore((s) => s.loadProject);

  const [body, setBody] = useState<string | null>(null);
  const [parsed, setParsed] = useState<WizardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!projectFolder) return;
    const path = `${projectFolder}/planning.md`;
    void (async () => {
      try {
        const text = await tauriVaultAdapter.readFile(path);
        setBody(text);
        const p = PlanningMdWriter.parse(text);
        setParsed(p);
        if (!p) {
          setError(
            "planning.md 가 있지만 마법사 형식으로 파싱하지 못했습니다. 본문은 그대로 보여드립니다.",
          );
        }
      } catch (e) {
        setError(
          `planning.md 를 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    })();
  }, [projectFolder]);

  const handleSeed = async (): Promise<void> => {
    if (!parsed || !projectFolder || !vaultPath) {
      tauriNoticeAdapter.error(
        "마법사 결과가 파싱되지 않아 시드할 수 없습니다.",
      );
      return;
    }
    setSeeding(true);
    setVaultBasePath(vaultPath);
    try {
      const r = await applySummaryToExistingProject(parsed, projectFolder, {
        vault: tauriVaultAdapter,
        notice: tauriNoticeAdapter,
        frontmatter: createFrontmatterAdapter(tauriVaultAdapter),
      });
      tauriNoticeAdapter.info(
        `binder 에 적용했습니다. 새 챕터 ${r.chaptersAdded}개${r.planningHasBinderEntry ? " · planning.md 노드 추가" : ""}.`,
        6000,
      );
      // 새로고침.
      try {
        await loadProject(vaultPath, projectFolder);
      } catch {
        /* ignore */
      }
      onClose();
    } catch (e) {
      tauriNoticeAdapter.error(
        `binder 시드 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSeeding(false);
    }
  };

  const chapterCount = parsed?.structureProposal?.length ?? 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !seeding) onClose();
      }}
    >
      <div
        style={{
          width: "min(880px, 100%)",
          maxHeight: "90vh",
          background: "var(--color-bg-pane, #fff)",
          borderRadius: 12,
          padding: 22,
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          fontSize: 14,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>기획 인터뷰 결과</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={seeding}
            style={{ fontSize: 13, padding: "4px 12px" }}
          >
            닫기
          </button>
        </header>

        {!body && !error && (
          <div style={{ padding: "32px 0", textAlign: "center", color: "#888" }}>
            planning.md 를 읽는 중…
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee",
              color: "#a33",
              padding: 10,
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {parsed && (
          <div
            style={{
              background: "var(--color-bg-input, #fafafa)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 12,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>최종 기획 요약</div>
            {parsed.targetReader && (
              <div>
                <strong>독자:</strong> {parsed.targetReader}
              </div>
            )}
            {parsed.coreMessage && (
              <div>
                <strong>핵심 메시지:</strong> {parsed.coreMessage}
              </div>
            )}
            {parsed.tone && (
              <div>
                <strong>톤:</strong> {parsed.tone}
              </div>
            )}
            {chapterCount > 0 && (
              <>
                <div style={{ marginTop: 8, fontWeight: 600 }}>
                  구조 제안 ({chapterCount}부)
                </div>
                <ol style={{ margin: "4px 0 0 18px", padding: 0 }}>
                  {parsed.structureProposal!.map((c) => (
                    <li key={c.id} style={{ marginBottom: 4 }}>
                      <strong>{c.title}</strong> — {c.synopsis}
                    </li>
                  ))}
                </ol>
              </>
            )}
            <div
              style={{
                marginTop: 12,
                padding: 8,
                background: "rgba(120, 90, 60, 0.08)",
                borderRadius: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12 }}>
                이 결과를 binder 에 적용하면 {chapterCount}부 구조가 챕터 폴더 + 첫
                장면으로 자동 생성됩니다.
              </span>
              <button
                type="button"
                className="header-new-manuscript-btn"
                onClick={() => void handleSeed()}
                disabled={seeding || chapterCount === 0}
                style={{ marginLeft: 12 }}
              >
                {seeding ? "적용 중…" : "binder 에 적용"}
              </button>
            </div>
          </div>
        )}

        {body && (
          <>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>planning.md 본문</div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "var(--color-bg-input, #fafafa)",
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                maxHeight: "50vh",
                overflowY: "auto",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              {body}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
