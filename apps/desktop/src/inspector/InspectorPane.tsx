// InspectorPane.tsx — 우측 패널.
// 선택 노드 1개일 때: 노드 메타 (synopsis, status, label, custom metadata, 파일경로, AI 액션 placeholder)
// 선택 0개 또는 다중 선택일 때: 프로젝트 메타 (제목, 장르, status, wordGoal, customStatuses/Labels, sourceNotes 개수)

import { useEffect, useState } from "react";
import type { BinderDocument, BinderNode } from "@ai-manuscript-studio/core";
import { countChars } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../state/projectStore";
import { findBinderNode } from "../state/binderQueries";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { SourceNotesPane } from "./SourceNotesPane";
import { ActionPanel } from "./ActionPanel";
import { SnapshotsPanel } from "./SnapshotsPanel";
import { ContinuityPanel } from "./ContinuityPanel";
import { ResearchPane } from "../research/ResearchPane";

type InspectorTab = "meta" | "research";

export function InspectorPane(): JSX.Element {
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const selectedIds = useProjectStore((s) => s.selectedNodeIds);
  const [tab, setTab] = useState<InspectorTab>("meta");

  if (!meta || !binder) {
    return (
      <>
        <div className="pane-header">인스펙터</div>
        <div className="pane-body">
          <div className="pane-empty">프로젝트가 열려 있지 않습니다.</div>
        </div>
      </>
    );
  }

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const node = singleId ? findBinderNode(binder, singleId) : null;

  return (
    <>
      <div className="pane-header">인스펙터</div>
      <div className="inspector-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "meta"}
          className={
            "inspector-tab" + (tab === "meta" ? " inspector-tab--active" : "")
          }
          onClick={() => setTab("meta")}
        >
          메타
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "research"}
          className={
            "inspector-tab" +
            (tab === "research" ? " inspector-tab--active" : "")
          }
          onClick={() => setTab("research")}
        >
          리서치
        </button>
      </div>
      {tab === "meta" ? (
        <div className="pane-body inspector-body">
          {node ? <NodeInspector node={node} /> : <ProjectInspector />}
        </div>
      ) : (
        <ResearchPane />
      )}
    </>
  );
}

// ---- NodeInspector ----------------------------------------------------------

function NodeInspector(props: { node: BinderNode }): JSX.Element {
  const { node } = props;
  const meta = useProjectStore((s) => s.meta)!;
  const projectFolder = useProjectStore((s) => s.projectFolder);
  const updateNodeSynopsis = useProjectStore((s) => s.updateNodeSynopsis);
  const updateNodeCustomMetadata = useProjectStore(
    (s) => s.updateNodeCustomMetadata,
  );
  const setNodeStatus = useProjectStore((s) => s.setNodeStatus);
  const setNodeLabel = useProjectStore((s) => s.setNodeLabel);
  const sceneCache = useProjectStore((s) => s.sceneCache);

  const [synopsisDraft, setSynopsisDraft] = useState(node.synopsis);
  useEffect(() => {
    setSynopsisDraft(node.synopsis);
  }, [node.id, node.synopsis]);

  const isDoc = node.type === "document";
  const cache = sceneCache[node.id];

  // 저장된 wordCount 는 마지막 저장 시점의 값 — 카운트 로직이 바뀌었거나
  // 미저장 편집이 있으면 옛 값이 남는다. 캐시된 본문(draft 우선, 없으면 body)에서
  // 즉시 재계산하여 항상 신선한 글자수를 보여준다.
  let wordCount = 0;
  if (isDoc) {
    if (cache) {
      const live = cache.draft ?? cache.body;
      wordCount = countChars(live);
    } else {
      wordCount = (node as BinderDocument).wordCount ?? 0;
    }
  }

  const filePath =
    isDoc && projectFolder
      ? `${projectFolder}/${(node as BinderDocument).file}`
      : null;

  const lastUpdated = cache?.frontmatter?.updated ?? "—";

  const handleSynopsisBlur = (): void => {
    if (synopsisDraft !== node.synopsis) {
      void updateNodeSynopsis(node.id, synopsisDraft);
    }
  };

  return (
    <>
      {/* Synopsis */}
      <div className="section">
        <div className="section-label">시놉시스</div>
        <textarea
          className="ins-textarea"
          value={synopsisDraft}
          onChange={(e) => setSynopsisDraft(e.target.value)}
          onBlur={handleSynopsisBlur}
          placeholder="이 장면(또는 폴더)의 한 문단 요약…"
          rows={4}
        />
      </div>

      {/* Status & Label */}
      <div className="section">
        <div className="section-label">상태</div>
        <select
          className="ins-select"
          value={node.status}
          onChange={(e) => void setNodeStatus(node.id, e.target.value)}
          data-testid="status-select"
        >
          {meta.customStatuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="section">
        <div className="section-label">라벨</div>
        <select
          className="ins-select"
          value={node.label}
          onChange={(e) => void setNodeLabel(node.id, e.target.value)}
          data-testid="label-select"
        >
          {meta.customLabels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Metadata */}
      <div className="section">
        <div className="section-label">메타데이터</div>
        <div className="ins-meta-row">
          <span>글자 수</span>
          <span className="ins-meta-value">{wordCount.toLocaleString()}자</span>
        </div>
        <div className="ins-meta-row">
          <span>마지막 수정</span>
          <span className="ins-meta-value">{lastUpdated}</span>
        </div>
        {filePath && (
          <div className="ins-meta-row ins-meta-row--path">
            <span>파일</span>
            <span className="ins-meta-value">
              <code>{filePath}</code>
              <button
                className="ins-copy-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(filePath).then(() => {
                    tauriNoticeAdapter.info("경로 복사됨");
                  });
                }}
                title="경로 복사"
              >
                복사
              </button>
            </span>
          </div>
        )}
      </div>

      {/* 참고 링크 — customMetadata.links 를 JSON 배열로 보관. */}
      <NodeLinksEditor
        nodeId={node.id}
        metadata={node.customMetadata ?? {}}
        onChange={(m) => void updateNodeCustomMetadata(node.id, m)}
      />

      {/* Custom metadata key-value editor */}
      <CustomMetadataEditor
        nodeId={node.id}
        metadata={node.customMetadata ?? {}}
        onChange={(m) => void updateNodeCustomMetadata(node.id, m)}
      />

      {/* AI Actions (Phase F) */}
      <ActionPanel node={node} />

      {/* Snapshots — document 노드만 */}
      {isDoc && <SnapshotsPanel node={node as BinderDocument} />}

      {/* Continuity Guardian — document 노드만 */}
      {isDoc && <ContinuityPanel node={node as BinderDocument} />}
    </>
  );
}

// ---- NodeLinksEditor --------------------------------------------------------

interface NodeLinksEditorProps {
  nodeId: string;
  metadata: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

function parseLinks(metadata: Record<string, string>): string[] {
  const raw = metadata.links;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // 파싱 실패 — 단순 줄바꿈/콤마 구분으로 시도.
  }
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function NodeLinksEditor({
  metadata,
  onChange,
}: NodeLinksEditorProps): JSX.Element {
  const links = parseLinks(metadata);
  const [draft, setDraft] = useState("");

  const setLinks = (next: string[]): void => {
    const dedup = Array.from(new Set(next.filter((u) => u.trim().length > 0)));
    onChange({ ...metadata, links: JSON.stringify(dedup) });
  };

  const handleAdd = (): void => {
    const u = draft.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      tauriNoticeAdapter.warn("URL 은 http:// 또는 https:// 로 시작해야 합니다.");
      return;
    }
    setLinks([...links, u]);
    setDraft("");
  };
  const handleRemove = (u: string): void => {
    setLinks(links.filter((x) => x !== u));
  };

  return (
    <div className="section">
      <div className="section-label">참고 링크</div>
      {links.length === 0 && (
        <div className="pane-hint">
          신뢰할 수 있는 자료의 URL 을 붙여 보관하세요. 리서치 결과는 자동으로
          여기에 모입니다.
        </div>
      )}
      {links.map((u) => (
        <div key={u} className="ins-link-row">
          <a
            href={u}
            target="_blank"
            rel="noreferrer noopener"
            className="ins-link-anchor"
          >
            {u.length > 80 ? `${u.slice(0, 80)}…` : u}
          </a>
          <button
            className="ins-kv-rm"
            onClick={() => handleRemove(u)}
            title="제거"
          >
            ×
          </button>
        </div>
      ))}
      <div className="ins-link-row">
        <input
          className="ins-link-input"
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button className="ins-kv-add" onClick={handleAdd}>
          +
        </button>
      </div>
    </div>
  );
}

// ---- ProjectInspector -------------------------------------------------------

function ProjectInspector(): JSX.Element {
  const meta = useProjectStore((s) => s.meta)!;

  const progress = meta.wordGoal > 0
    ? Math.min(100, Math.round((meta.currentWords / meta.wordGoal) * 100))
    : 0;

  return (
    <>
      <div className="section">
        <div className="section-label">프로젝트</div>
        <div className="ins-meta-row">
          <span>제목</span>
          <span className="ins-meta-value">{meta.title}</span>
        </div>
        <div className="ins-meta-row">
          <span>장르</span>
          <span className="ins-meta-value">{meta.genre}</span>
        </div>
        <div className="ins-meta-row">
          <span>상태</span>
          <span className="ins-meta-value">{meta.status}</span>
        </div>
        <div className="ins-meta-row">
          <span>목표</span>
          <span className="ins-meta-value">
            {meta.currentWords.toLocaleString()} / {meta.wordGoal.toLocaleString()}자 ({progress}%)
          </span>
        </div>
      </div>

      <div className="section">
        <div className="section-label">상태 정의</div>
        <div className="chip-row">
          {meta.customStatuses.map((s) => (
            <span key={s.id} className="chip">
              <span className="chip-dot" style={{ background: s.color }} />
              {s.name}
              {s.default && " (기본)"}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-label">라벨 정의</div>
        <div className="chip-row">
          {meta.customLabels.map((l) => (
            <span key={l.id} className="chip">
              <span className="chip-dot" style={{ background: l.color }} />
              {l.name}
              {l.default && " (기본)"}
            </span>
          ))}
        </div>
      </div>

      <SourceNotesPane sourceNotes={meta.sourceNotes} />
    </>
  );
}

// ---- CustomMetadataEditor ---------------------------------------------------

interface CustomMetadataEditorProps {
  nodeId: string;
  metadata: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

function CustomMetadataEditor(
  props: CustomMetadataEditorProps,
): JSX.Element {
  const { metadata, onChange } = props;
  const entries = Object.entries(metadata);

  const [draftKey, setDraftKey] = useState("");
  const [draftVal, setDraftVal] = useState("");

  const handleAdd = (): void => {
    const k = draftKey.trim();
    if (!k) return;
    onChange({ ...metadata, [k]: draftVal });
    setDraftKey("");
    setDraftVal("");
  };

  const handleRemove = (k: string): void => {
    const next = { ...metadata };
    delete next[k];
    onChange(next);
  };

  const handleEdit = (k: string, v: string): void => {
    onChange({ ...metadata, [k]: v });
  };

  return (
    <div className="section">
      <div className="section-label">커스텀 메타</div>
      {entries.length === 0 && (
        <div className="pane-hint">자유롭게 키-값을 추가할 수 있습니다.</div>
      )}
      {entries.map(([k, v]) => (
        <div key={k} className="ins-kv-row">
          <code className="ins-kv-key">{k}</code>
          <input
            className="ins-kv-val"
            value={v}
            onChange={(e) => handleEdit(k, e.target.value)}
          />
          <button
            className="ins-kv-rm"
            onClick={() => handleRemove(k)}
            title="제거"
          >
            ×
          </button>
        </div>
      ))}
      <div className="ins-kv-row">
        <input
          className="ins-kv-key"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          placeholder="키"
        />
        <input
          className="ins-kv-val"
          value={draftVal}
          onChange={(e) => setDraftVal(e.target.value)}
          placeholder="값"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <button className="ins-kv-add" onClick={handleAdd}>
          +
        </button>
      </div>
    </div>
  );
}
