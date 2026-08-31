// ContinuityPanel.tsx — 연속성 감시자 (Continuity Guardian).
//
// 작가가 명시적으로 트리거하는 점검:
//   - 현재 장면 본문 + binder 의 다른 장면들 (제목, 시놉시스, 본문 발췌) 을 모아
//     LLM 에 "모순 점검" 프롬프트를 보낸다.
//   - 결과는 inspector 안에 인라인 마크다운으로 표시.
//   - 자동 백그라운드 호출 없음 (CLAUDE.md 의 "AI 는 사용자 액션이 있을 때만" 원칙).
//
// 의도적 단순화:
//   - 결과는 디스크에 저장하지 않음 (세션 캐시).
//   - 인물/장소 시트 없이도 동작 — LLM 이 본문에서 직접 묘사 추출.
//
// ── 판정 박제 (aiwait-mouse-7f4c1a08 · 2026-08-31) ──────────────────────────
//
// 물음 2. 이 화면은 이미 마우스로 누를 수 있는 「취소」 버튼이 있다. 공용 대기
//         표시로 통일하는가, 그냥 두는가. 「일관성」은 이유가 못 된다.
// 답    . 통일한다. 사용자가 «실제로» 잃던 것이 셋이다.
//   (1) 살아 있다는 증거 — 이 점검은 이 앱에서 가장 오래 걸린다(4분). 그 4분
//       동안 화면은 「편집자가 본문을 읽고 있습니다…」 한 줄에서 멈춰 있었다.
//       10초가 지났는지 3분이 지났는지 알 방법이 없었다. 멈춘 것과 일하는 중을
//       구별할 수 없으면 사람은 앱을 끈다.
//   (2) 끝이 있다는 사실 — 「4분이 지나면 저절로 멈춥니다」를 아무 데서도 말하지
//       않았다. 끝을 모르는 기다림은 견딜 수 없다.
//   (3) 그만두는 법 — 같은 일에 이름이 둘이었다(여기는 「취소」, 마법사는
//       「그만두기」). 컴퓨터 용어를 모르는 사용자에게 낱말이 갈리면 「이 취소는
//       아까 그 그만두기와 다른 것인가」를 매번 다시 판단해야 한다.
//
// 한계 시간은 CONTINUITY_TIMEOUT_SECS 하나에서만 온다 — 화면 문면과 실제 호출이
// 따로 놀면 「4분」 이라고 써 놓고 다른 때에 멈추는 거짓말이 된다.

import { useCallback, useState } from "react";
import { marked } from "marked";
import type {
  BinderDocument,
  BinderNode,
  BinderTree,
} from "@ai-manuscript-studio/core";

import { tauriVaultAdapter } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useProjectStore } from "../state/projectStore";
import { useSettingsStore } from "../state/settingsStore";
import { startAiInvocation } from "../ai/streamingHandle";
import { AiWaitBar } from "../wizard/AiWaitBar";

interface ContinuityPanelProps {
  node: BinderDocument;
}

interface OtherSceneSummary {
  title: string;
  synopsis: string;
  excerpt: string;
}

/** binder 를 traverse 해서 현재 장면을 제외한 다른 document 들의 요약을 모음. */
async function collectOtherScenes(
  binder: BinderTree,
  projectFolder: string,
  excludeId: string,
  excerptCharCap = 600,
): Promise<OtherSceneSummary[]> {
  const out: OtherSceneSummary[] = [];
  const docs: BinderDocument[] = [];
  const walk = (n: BinderNode): void => {
    if (n.type === "document") {
      if (n.id !== excludeId) docs.push(n);
    } else {
      for (const c of n.children) walk(c);
    }
  };
  for (const r of binder.root) walk(r);

  // 너무 많은 장면이 있으면 첫 30개로 cap — 나머지는 LLM 컨텍스트 폭발 방지.
  const capped = docs.slice(0, 30);
  for (const d of capped) {
    let excerpt = "";
    try {
      const raw = await tauriVaultAdapter.readFile(`${projectFolder}/${d.file}`);
      const stripped = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
      excerpt = stripped.slice(0, excerptCharCap);
      if (stripped.length > excerptCharCap) excerpt += "…";
    } catch {
      excerpt = "";
    }
    out.push({
      title: d.title || "(제목 없음)",
      synopsis: d.synopsis || "",
      excerpt,
    });
  }
  return out;
}

const CURRENT_BODY_CAP = 6000;

/**
 * 이 점검이 저절로 멈추는 때(초). 실제 호출과 화면 문면이 이 하나를 함께 쓴다.
 * 다른 AI 호출(180초)보다 긴 이유 — 장면 30개를 함께 읽는다.
 */
const CONTINUITY_TIMEOUT_SECS = 240;

function buildPrompt(input: {
  currentTitle: string;
  currentBody: string;
  others: OtherSceneSummary[];
}): string {
  const cur = input.currentBody.length > CURRENT_BODY_CAP
    ? input.currentBody.slice(0, CURRENT_BODY_CAP) + "\n…(이하 생략)"
    : input.currentBody;

  const otherBlocks = input.others
    .map((o, i) => {
      const lines: string[] = [];
      lines.push(`### ${i + 1}. ${o.title}`);
      if (o.synopsis) lines.push(`시놉시스: ${o.synopsis}`);
      if (o.excerpt) lines.push(`본문 발췌:\n${o.excerpt}`);
      return lines.join("\n");
    })
    .join("\n\n");

  return [
    "당신은 한국어 소설/원고의 노련한 편집자입니다. 작가가 [현재 장면]을 작성/수정한 직후, 같은 원고의 다른 장면들과 비교해 **연속성(continuity) 모순**이 있는지 점검해주세요.",
    "",
    "점검 대상:",
    "- 인물의 외형/성격/말투 묘사",
    "- 시간/연도/계절/날짜 표시",
    "- 장소/공간 묘사",
    "- 이미 등장한 사물/소품의 위치·소유자",
    "- 인물 간 관계·감정선의 변화",
    "",
    "출력 형식 (한국어):",
    "- 모순이 발견되면 다음 형식으로 각 항목 한 블록씩 나열하세요.",
    "  ⚠ [모순 종류] — 현재 장면: \"...\" vs N. 장면 제목: \"...\"",
    "     ↳ 제안: ...",
    "- 모순이 0개면 \"이번 점검에서 모순이 발견되지 않았습니다.\" 한 줄만 출력하세요.",
    "- 추측이 강한 경우 \"가능성 있음:\" 으로 시작하고, 확실한 모순은 \"확인됨:\" 으로 시작하세요.",
    "- 본문을 직접 수정하지 마세요. 발견과 제안만 제공하세요.",
    "",
    "--- 자료 시작 ---",
    `# 현재 장면: ${input.currentTitle}`,
    "",
    cur,
    "",
    "# 다른 장면들",
    otherBlocks || "(다른 장면이 없습니다.)",
    "--- 자료 끝 ---",
  ].join("\n");
}

type Phase =
  | { kind: "idle" }
  | { kind: "running"; cancel: () => void }
  | { kind: "done"; text: string; durationMs: number; checkedAt: string }
  | { kind: "error"; message: string };

export function ContinuityPanel(props: ContinuityPanelProps): JSX.Element {
  const { node } = props;
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const binder = useProjectStore((s) => s.binder);
  const sceneCache = useProjectStore((s) => s.sceneCache);
  const ensureSceneLoaded = useProjectStore((s) => s.ensureSceneLoaded);
  const settings = useSettingsStore((s) => s.settings);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dismissed, setDismissed] = useState(false);

  const runCheck = useCallback(async () => {
    if (!projectFolder || !binder) return;
    setDismissed(false);
    await ensureSceneLoaded(node.id);
    const cache = useProjectStore.getState().sceneCache[node.id];
    const currentBody = cache?.draft ?? cache?.body ?? "";

    let others: OtherSceneSummary[] = [];
    try {
      others = await collectOtherScenes(binder, projectFolder, node.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: `다른 장면 수집 실패: ${msg}` });
      return;
    }

    const prompt = buildPrompt({
      currentTitle: node.title || "(제목 없음)",
      currentBody,
      others,
    });

    const binaryPath =
      settings.aiProvider === "claude-code"
        ? settings.claudeCodePath
        : settings.codexPath;

    const handle = startAiInvocation({
      provider: settings.aiProvider as "codex" | "claude-code" | "mock",
      binaryPath,
      extraArgs: settings.codexExtraArgs.split(/\s+/).filter((x) => x.length > 0),
      prompt,
      timeoutSecs: CONTINUITY_TIMEOUT_SECS,
    });

    setPhase({
      kind: "running",
      cancel: () => handle.cancel(),
    });

    try {
      // 스트림은 무시하고 fullText 만 받는다 — codex JSONL 노이즈 회피.
      // 단순히 done 까지 대기.
      const start = Date.now();
      // Drain tokens (백프레셔 회피).
      void (async () => {
        try {
          for await (const _t of handle.tokens()) { /* drop */ }
        } catch {
          /* swallow */
        }
      })();

      const result = await handle.done;
      const durationMs = result.durationMs ?? Date.now() - start;
      setPhase({
        kind: "done",
        text: result.fullText,
        durationMs,
        checkedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
    }
  }, [projectFolder, binder, node.id, node.title, ensureSceneLoaded, settings]);

  const handleCancel = (): void => {
    if (phase.kind === "running") {
      phase.cancel();
      setPhase({ kind: "idle" });
      tauriNoticeAdapter.info("연속성 점검을 그만뒀습니다.");
    }
  };

  // 「점검 중」은 이제 아래 AiWaitBar 가 말한다 — 결과 카드는 끝난 뒤에만.
  const showResult =
    !dismissed && (phase.kind === "done" || phase.kind === "error");

  return (
    <div className="section">
      <div className="section-label">연속성 감시자</div>
      <div className="pane-hint" style={{ marginBottom: 6, fontSize: 11 }}>
        현재 장면 + 다른 장면들의 묘사를 대조해 모순(인물 외형, 시간, 장소,
        사물, 관계)을 점검합니다. 결과는 세션 메모리에만 보관됩니다.
      </div>

      <div className="continuity-take">
        <button
          type="button"
          className="continuity-take-btn"
          onClick={() => void runCheck()}
          disabled={phase.kind === "running" || !projectFolder || !binder}
          data-testid="continuity-run"
        >
          {phase.kind === "running" ? "점검 중…" : "지금 점검"}
        </button>
      </div>

      {/* 기다리는 동안 — 무엇을 하는 중인지 + 몇 초째인지 + 언제 저절로
          멈추는지 + 그만두기. 마법사 네 화면과 같은 부품·같은 문면이다. */}
      {phase.kind === "running" && (
        <AiWaitBar
          label="편집자가 본문을 읽고 있습니다"
          onCancel={handleCancel}
          limitSecs={CONTINUITY_TIMEOUT_SECS}
          style={{ marginTop: 8 }}
          testId="continuity-wait-bar"
        />
      )}

      {showResult && (
        <div className="continuity-warnings">
          <ContinuityResult
            phase={phase}
            onDismiss={() => setDismissed(true)}
          />
        </div>
      )}
    </div>
  );
}

interface ContinuityResultProps {
  phase: Phase;
  onDismiss: () => void;
}

function ContinuityResult(props: ContinuityResultProps): JSX.Element | null {
  const { phase } = props;

  if (phase.kind === "error") {
    return (
      <div className="continuity-warning">
        <button
          className="continuity-warning-dismiss"
          onClick={props.onDismiss}
          aria-label="닫기"
        >
          ×
        </button>
        <div className="continuity-warning-head">오류</div>
        <div className="continuity-warning-body">{phase.message}</div>
      </div>
    );
  }

  if (phase.kind === "done") {
    let html = "";
    try {
      html = marked.parse(phase.text, { async: false }) as string;
    } catch {
      html = phase.text.replace(/[<>&]/g, (c) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
      );
    }
    const isClean = /모순이 발견되지 않았습니다/.test(phase.text);
    return (
      <div
        className={
          "continuity-warning" +
          (isClean ? " continuity-warning--info" : "")
        }
      >
        <button
          className="continuity-warning-dismiss"
          onClick={props.onDismiss}
          aria-label="닫기"
        >
          ×
        </button>
        <div className="continuity-warning-head">
          {isClean ? "모순 없음" : "검토 결과"}
        </div>
        <div
          className="continuity-warning-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="continuity-meta">
          {phase.checkedAt} · {(phase.durationMs / 1000).toFixed(1)}s
        </div>
      </div>
    );
  }

  return null;
}
