// SnapshotsPanel.tsx — 장면별 스냅샷 (인-앱 버전 히스토리).
//
// 안전 원칙:
//   - 새 스냅샷은 사용자가 명시적으로 트리거 ("지금 스냅샷" 버튼).
//   - 복원 직전에 현재 본문을 자동 스냅샷으로 동결 (안전망 — 라벨 "복원 직전 자동").
//   - 삭제는 확인 후 진행.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  diffLines,
  SnapshotIO,
  type DiffLine,
  type SnapshotMeta,
  type BinderDocument,
} from "@ai-manuscript-studio/core";

import { tauriVaultAdapter } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useProjectStore } from "../state/projectStore";

interface SnapshotsPanelProps {
  node: BinderDocument;
}

function formatStamp(iso: string): string {
  // "2026-05-05T14-30-22Z" → "2026-05-05 14:30"
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[1]} ${m[2]}:${m[3]}`;
}

export function SnapshotsPanel(props: SnapshotsPanelProps): JSX.Element {
  const { node } = props;
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const sceneCache = useProjectStore((s) => s.sceneCache);
  const ensureSceneLoaded = useProjectStore((s) => s.ensureSceneLoaded);
  const setSceneDraft = useProjectStore((s) => s.setSceneDraft);
  const saveScene = useProjectStore((s) => s.saveScene);

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [diffOpen, setDiffOpen] = useState<string | null>(null); // takenAt
  const [diffData, setDiffData] = useState<{
    snapshotBody: string;
    currentBody: string;
    lines: DiffLine[];
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!projectFolder) return;
    setLoading(true);
    try {
      const list = await SnapshotIO.list(tauriVaultAdapter, projectFolder, node.id);
      setSnapshots(list);
    } catch (e) {
      tauriNoticeAdapter.error(
        `스냅샷 목록 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  }, [projectFolder, node.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cache = sceneCache[node.id];
  const currentBody = cache?.draft ?? cache?.body ?? "";

  const handleTake = async (): Promise<void> => {
    if (!projectFolder) return;
    await ensureSceneLoaded(node.id);
    const live = useProjectStore.getState().sceneCache[node.id];
    const body = live?.draft ?? live?.body ?? "";
    try {
      await SnapshotIO.take(tauriVaultAdapter, {
        projectFolder,
        sceneId: node.id,
        body,
        label: labelDraft.trim(),
      });
      setLabelDraft("");
      tauriNoticeAdapter.info("스냅샷이 만들어졌습니다.");
      await refresh();
    } catch (e) {
      tauriNoticeAdapter.error(
        `스냅샷 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleRestore = async (snap: SnapshotMeta): Promise<void> => {
    if (!projectFolder) return;
    const stamp = formatStamp(snap.takenAt);
    const ok = window.confirm(
      `${stamp} 스냅샷으로 본문을 되돌립니다. 현재 본문은 "복원 직전 자동" 라벨로 먼저 동결됩니다. 계속할까요?`,
    );
    if (!ok) return;

    try {
      // 1. 안전망: 현재 본문 자동 스냅샷.
      await ensureSceneLoaded(node.id);
      const live = useProjectStore.getState().sceneCache[node.id];
      const before = live?.draft ?? live?.body ?? "";
      await SnapshotIO.take(tauriVaultAdapter, {
        projectFolder,
        sceneId: node.id,
        body: before,
        label: "복원 직전 자동",
      });

      // 2. 스냅샷 본문 읽기.
      const full = await SnapshotIO.read(
        tauriVaultAdapter,
        projectFolder,
        node.id,
        snap.takenAt,
      );
      if (!full || full.body === undefined) {
        tauriNoticeAdapter.error("스냅샷 본문을 읽을 수 없습니다.");
        return;
      }

      // 3. draft 로 주입 + 저장.
      setSceneDraft(node.id, full.body);
      await saveScene(node.id);
      tauriNoticeAdapter.info(`${stamp} 스냅샷으로 복원했습니다.`);
      await refresh();
    } catch (e) {
      tauriNoticeAdapter.error(
        `복원 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleDelete = async (snap: SnapshotMeta): Promise<void> => {
    if (!projectFolder) return;
    const ok = window.confirm(
      `${formatStamp(snap.takenAt)} 스냅샷을 삭제합니다. 되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    try {
      await SnapshotIO.remove(
        tauriVaultAdapter,
        projectFolder,
        node.id,
        snap.takenAt,
      );
      await refresh();
    } catch (e) {
      tauriNoticeAdapter.error(
        `삭제 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleLabelChange = async (
    snap: SnapshotMeta,
    label: string,
  ): Promise<void> => {
    if (!projectFolder) return;
    if (label === snap.label) return;
    try {
      await SnapshotIO.setLabel(
        tauriVaultAdapter,
        projectFolder,
        node.id,
        snap.takenAt,
        label,
      );
      await refresh();
    } catch (e) {
      tauriNoticeAdapter.error(
        `라벨 갱신 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const handleOpenDiff = async (snap: SnapshotMeta): Promise<void> => {
    if (!projectFolder) return;
    try {
      await ensureSceneLoaded(node.id);
      const live = useProjectStore.getState().sceneCache[node.id];
      const cur = live?.draft ?? live?.body ?? "";
      const full = await SnapshotIO.read(
        tauriVaultAdapter,
        projectFolder,
        node.id,
        snap.takenAt,
      );
      if (!full || full.body === undefined) {
        tauriNoticeAdapter.error("스냅샷 본문을 읽을 수 없습니다.");
        return;
      }
      const lines = diffLines(full.body, cur);
      setDiffData({ snapshotBody: full.body, currentBody: cur, lines });
      setDiffOpen(snap.takenAt);
    } catch (e) {
      tauriNoticeAdapter.error(
        `비교 로드 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const closeDiff = (): void => {
    setDiffOpen(null);
    setDiffData(null);
  };

  return (
    <div className="section">
      <div className="section-label">스냅샷 ({snapshots.length})</div>
      <div className="pane-hint" style={{ marginBottom: 6, fontSize: 11 }}>
        장면 본문의 시점 동결. 복원 시 현재 본문은 자동 스냅샷으로 보존됩니다.
      </div>

      {/* 새 스냅샷 — 라벨 입력 + 버튼 */}
      <div className="snapshots-take">
        <input
          className="snapshots-label-input"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          placeholder="라벨 (선택, 예: 1차 퇴고 전)"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleTake();
          }}
        />
        <button
          type="button"
          className="snapshots-take-btn"
          onClick={() => void handleTake()}
          disabled={!projectFolder}
          data-testid="snapshots-take"
        >
          + 지금 스냅샷
        </button>
      </div>

      {loading && <div className="pane-hint">불러오는 중…</div>}

      {!loading && snapshots.length === 0 && (
        <div className="pane-hint">아직 스냅샷이 없습니다.</div>
      )}

      <ul className="snapshots-list">
        {snapshots.map((s) => (
          <SnapshotRow
            key={s.takenAt}
            snap={s}
            currentChars={currentBody.length}
            onLabelChange={(v) => void handleLabelChange(s, v)}
            onRestore={() => void handleRestore(s)}
            onDiff={() => void handleOpenDiff(s)}
            onDelete={() => void handleDelete(s)}
          />
        ))}
      </ul>

      {diffOpen && diffData && (
        <DiffModal
          stampLabel={formatStamp(diffOpen)}
          lines={diffData.lines}
          onClose={closeDiff}
        />
      )}
    </div>
  );
}

interface SnapshotRowProps {
  snap: SnapshotMeta;
  currentChars: number;
  onLabelChange: (label: string) => void;
  onRestore: () => void;
  onDiff: () => void;
  onDelete: () => void;
}

function SnapshotRow(props: SnapshotRowProps): JSX.Element {
  const { snap } = props;
  const [labelDraft, setLabelDraft] = useState(snap.label);
  useEffect(() => setLabelDraft(snap.label), [snap.takenAt, snap.label]);

  const delta = props.currentChars - snap.charCount;
  const deltaSign = delta > 0 ? "+" : delta < 0 ? "" : "±";

  return (
    <li className="snapshots-row">
      <div className="snapshots-row-head">
        <span className="snapshots-stamp">{formatStamp(snap.takenAt)}</span>
        <span className="snapshots-meta">
          {snap.charCount.toLocaleString()}자
          <span
            className={
              delta > 0
                ? "snapshots-delta snapshots-delta--add"
                : delta < 0
                  ? "snapshots-delta snapshots-delta--rm"
                  : "snapshots-delta"
            }
          >
            ({deltaSign}{Math.abs(delta).toLocaleString()})
          </span>
        </span>
      </div>
      <input
        className="snapshots-row-label"
        value={labelDraft}
        onChange={(e) => setLabelDraft(e.target.value)}
        onBlur={() => props.onLabelChange(labelDraft)}
        placeholder="라벨 없음"
      />
      <div className="snapshots-row-actions">
        <button type="button" onClick={props.onDiff} title="현재와 비교">
          비교
        </button>
        <button type="button" onClick={props.onRestore} title="이 시점으로 복원">
          복원
        </button>
        <button
          type="button"
          className="snapshots-row-delete"
          onClick={props.onDelete}
          title="스냅샷 삭제"
        >
          ×
        </button>
      </div>
    </li>
  );
}

interface DiffModalProps {
  stampLabel: string;
  lines: DiffLine[];
  onClose: () => void;
}

function DiffModal(props: DiffModalProps): JSX.Element {
  const { lines } = props;

  // 변경되지 않은 긴 구간은 접어서 보여주기 — 위/아래 2 라인만 컨텍스트.
  const collapsed = useMemo(() => collapseEqualRuns(lines, 2), [lines]);

  const stats = useMemo(() => {
    let add = 0;
    let rm = 0;
    for (const l of lines) {
      if (l.op === "add") add++;
      else if (l.op === "remove") rm++;
    }
    return { add, rm };
  }, [lines]);

  return (
    <div
      className="snapshots-diff-overlay"
      role="dialog"
      onClick={props.onClose}
    >
      <div
        className="snapshots-diff-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="snapshots-diff-header">
          <span className="snapshots-diff-title">
            {props.stampLabel} ↔ 현재
          </span>
          <span className="snapshots-diff-stats">
            <span className="snapshots-delta--add">+{stats.add}</span>
            {" · "}
            <span className="snapshots-delta--rm">−{stats.rm}</span>
          </span>
          <button
            type="button"
            className="snapshots-diff-close"
            onClick={props.onClose}
          >
            ×
          </button>
        </div>
        <div className="snapshots-diff-body">
          {collapsed.map((entry, i) =>
            entry.kind === "fold" ? (
              <div key={i} className="snapshots-diff-fold">
                ⋯ {entry.count}줄 동일
              </div>
            ) : (
              <div
                key={i}
                className={`snapshots-diff-line snapshots-diff-line--${entry.op}`}
              >
                <span className="snapshots-diff-marker">
                  {entry.op === "add" ? "+" : entry.op === "remove" ? "−" : " "}
                </span>
                <span className="snapshots-diff-text">{entry.text || " "}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

type CollapsedEntry =
  | { kind: "line"; op: DiffLine["op"]; text: string }
  | { kind: "fold"; count: number };

function collapseEqualRuns(lines: DiffLine[], context: number): CollapsedEntry[] {
  const out: CollapsedEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    if (cur.op !== "equal") {
      out.push({ kind: "line", op: cur.op, text: cur.text });
      i++;
      continue;
    }
    // equal run.
    let j = i;
    while (j < lines.length && lines[j].op === "equal") j++;
    const runLen = j - i;
    const before = i; // run start
    const after = j;  // first non-equal index after run
    const hasPrev = i > 0;
    const hasNext = j < lines.length;
    const head = hasPrev ? Math.min(context, runLen) : 0;
    const tail = hasNext ? Math.min(context, runLen) : 0;
    if (head + tail >= runLen) {
      // 전부 노출.
      for (let k = before; k < after; k++) {
        out.push({ kind: "line", op: "equal", text: lines[k].text });
      }
    } else {
      for (let k = before; k < before + head; k++) {
        out.push({ kind: "line", op: "equal", text: lines[k].text });
      }
      out.push({ kind: "fold", count: runLen - head - tail });
      for (let k = after - tail; k < after; k++) {
        out.push({ kind: "line", op: "equal", text: lines[k].text });
      }
    }
    i = j;
  }
  return out;
}
