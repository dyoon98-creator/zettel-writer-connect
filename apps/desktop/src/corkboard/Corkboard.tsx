// Corkboard.tsx — 폴더 선택 시 자식들을 카드 격자로.
//
// - 카드: 제목 + (앞면) 한 줄 요약 + 메타 / (뒷면) 시놉시스 textarea
// - flip 토글 — 모든 카드 일괄 또는 카드별 (Cmd-Click)
// - 라벨/상태 필터 — toolbar 칩 클릭으로 비매칭 카드 dim
// - 카드 클릭 → 단일 선택
// - 드래그-드롭으로 자식 순서 변경 (dnd-kit)

import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type {
  BinderDocument,
  BinderFolder,
  BinderNode,
} from "@ai-manuscript-studio/core";
import { countChars } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../state/projectStore";

export interface CorkboardProps {
  folder: BinderFolder;
}

type Side = "front" | "back";

export function Corkboard(props: CorkboardProps): JSX.Element {
  const { folder } = props;
  const moveNode = useProjectStore((s) => s.moveNode);
  const toggleSelection = useProjectStore((s) => s.toggleSelection);
  const meta = useProjectStore((s) => s.meta)!;

  const order = folder.children;

  // ---- Filter state (label / status) -------------------------------------
  // null = "모두 표시", non-null Set = 활성 id 만.
  const [labelFilter, setLabelFilter] = useState<Set<string> | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<string> | null>(null);

  // 폴더가 바뀌면 필터 초기화.
  useEffect(() => {
    setLabelFilter(null);
    setStatusFilter(null);
  }, [folder.id]);

  // ---- Flip state --------------------------------------------------------
  // global side 가 우선. perCard 가 있으면 그 카드만 override.
  const [globalSide, setGlobalSide] = useState<Side>("front");
  const [perCard, setPerCard] = useState<Record<string, Side>>({});

  // 폴더가 바뀌면 perCard 초기화 — 다른 폴더 노드 id 가 섞이는 걸 방지.
  useEffect(() => {
    setPerCard({});
  }, [folder.id]);

  const flipAll = (): void => {
    setGlobalSide((s) => (s === "front" ? "back" : "front"));
    setPerCard({});
  };

  const flipOne = (id: string): void => {
    setPerCard((prev) => {
      const next = { ...prev };
      const current = next[id] ?? globalSide;
      const flipped: Side = current === "front" ? "back" : "front";
      // global 과 같아지면 entry 제거 (메모리 절약).
      if (flipped === globalSide) delete next[id];
      else next[id] = flipped;
      return next;
    });
  };

  // ---- DnD ---------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (e: DragEndEvent): Promise<void> => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const newIdx = order.findIndex((n) => n.id === over.id);
    if (newIdx === -1) return;
    try {
      await moveNode(String(active.id), folder.id, newIdx);
    } catch {
      // store가 notice를 띄움.
    }
  };

  // ---- 활성 라벨/상태 통계 (toolbar 칩에 표시되는 카운트) ----------------
  const labelCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of order) c.set(n.label, (c.get(n.label) ?? 0) + 1);
    return c;
  }, [order]);

  const statusCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of order) c.set(n.status, (c.get(n.status) ?? 0) + 1);
    return c;
  }, [order]);

  const isCardActive = (n: BinderNode): boolean => {
    if (labelFilter && !labelFilter.has(n.label)) return false;
    if (statusFilter && !statusFilter.has(n.status)) return false;
    return true;
  };

  const toggleLabelFilter = (id: string): void => {
    setLabelFilter((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? null : next;
    });
  };
  const toggleStatusFilter = (id: string): void => {
    setStatusFilter((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? null : next;
    });
  };

  const anyFilterActive = labelFilter !== null || statusFilter !== null;

  if (order.length === 0) {
    return (
      <div className="corkboard-empty">
        <p className="pane-hint">
          이 폴더는 비어 있습니다.
          <br />
          우클릭으로 첫 장면을 추가해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="corkboard-root">
      {/* Toolbar — flip 토글 + 라벨/상태 필터 */}
      <div className="corkboard-toolbar">
        <div className="corkboard-toolbar-section">
          <button
            type="button"
            className="corkboard-flip-btn"
            onClick={flipAll}
            title="모든 카드 앞/뒤 뒤집기 (개별 카드는 카드 우상단 ↻ 버튼)"
            data-testid="corkboard-flip-all"
          >
            {globalSide === "front" ? "↻ 시놉시스 보기" : "↻ 앞면으로"}
          </button>
        </div>

        <div className="corkboard-toolbar-section">
          <span className="corkboard-toolbar-label">라벨</span>
          {meta.customLabels
            .filter((l) => (labelCounts.get(l.id) ?? 0) > 0)
            .map((l) => {
              const active = labelFilter ? labelFilter.has(l.id) : true;
              return (
                <button
                  key={l.id}
                  type="button"
                  className={
                    "corkboard-chip" +
                    (active ? " corkboard-chip--active" : " corkboard-chip--dim")
                  }
                  onClick={() => toggleLabelFilter(l.id)}
                  title={`${l.name} (${labelCounts.get(l.id) ?? 0}개)`}
                >
                  <span
                    className="corkboard-chip-dot"
                    style={{ background: l.color }}
                  />
                  {l.name}
                  <span className="corkboard-chip-count">
                    {labelCounts.get(l.id) ?? 0}
                  </span>
                </button>
              );
            })}
        </div>

        <div className="corkboard-toolbar-section">
          <span className="corkboard-toolbar-label">상태</span>
          {meta.customStatuses
            .filter((s) => (statusCounts.get(s.id) ?? 0) > 0)
            .map((s) => {
              const active = statusFilter ? statusFilter.has(s.id) : true;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={
                    "corkboard-chip" +
                    (active ? " corkboard-chip--active" : " corkboard-chip--dim")
                  }
                  onClick={() => toggleStatusFilter(s.id)}
                  title={`${s.name} (${statusCounts.get(s.id) ?? 0}개)`}
                >
                  <span
                    className="corkboard-chip-dot"
                    style={{ background: s.color }}
                  />
                  {s.name}
                  <span className="corkboard-chip-count">
                    {statusCounts.get(s.id) ?? 0}
                  </span>
                </button>
              );
            })}
        </div>

        {anyFilterActive && (
          <button
            type="button"
            className="corkboard-filter-clear"
            onClick={() => {
              setLabelFilter(null);
              setStatusFilter(null);
            }}
            title="필터 초기화"
          >
            ×
          </button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order.map((n) => n.id)} strategy={rectSortingStrategy}>
          <div className="corkboard-grid">
            {order.map((n) => {
              const side = perCard[n.id] ?? globalSide;
              const active = isCardActive(n);
              return (
                <CorkCard
                  key={n.id}
                  node={n}
                  side={side}
                  dimmed={!active}
                  onClick={() => toggleSelection(n.id, "single")}
                  onFlip={() => flipOne(n.id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface CorkCardProps {
  node: BinderNode;
  side: Side;
  dimmed: boolean;
  onClick: () => void;
  onFlip: () => void;
}

function CorkCard(props: CorkCardProps): JSX.Element {
  const { node, side, dimmed } = props;
  const meta = useProjectStore((s) => s.meta)!;
  const updateNodeSynopsis = useProjectStore((s) => s.updateNodeSynopsis);

  const sortable = useSortable({ id: node.id });
  const [synopsis, setSynopsis] = useState(node.synopsis);

  // 외부에서 synopsis 가 갱신되면 (e.g. 다른 위치에서 편집) sync.
  useEffect(() => {
    setSynopsis(node.synopsis);
  }, [node.id, node.synopsis]);

  const sceneCache = useProjectStore((s) => s.sceneCache);
  let wordCount: number | null = null;
  if (node.type === "document") {
    const cache = sceneCache[node.id];
    if (cache) {
      const live = cache.draft ?? cache.body;
      wordCount = countChars(live);
    } else {
      wordCount = (node as BinderDocument).wordCount ?? 0;
    }
  }

  const status = meta.customStatuses.find((s) => s.id === node.status);
  const label = meta.customLabels.find((l) => l.id === node.label);

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    borderColor: status?.color ?? "var(--color-border)",
  };

  // 앞면 한 줄 요약 — 시놉시스 첫 줄(없으면 "(시놉시스 없음)").
  const oneLine = (node.synopsis || "").split(/\r?\n/)[0].trim();

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={
        "cork-card" +
        (sortable.isDragging ? " cork-card--dragging" : "") +
        (dimmed ? " cork-card--dimmed" : "") +
        (side === "back" ? " cork-card--back" : " cork-card--front")
      }
      data-testid={`cork-card-${node.id}`}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={props.onClick}
    >
      <div className="cork-card-head">
        <span
          className="binder-color-dot"
          style={{ background: label?.color ?? "#ccc" }}
        />
        <span className="cork-card-title" title={node.title}>
          {node.title || "(제목 없음)"}
        </span>
        <button
          type="button"
          className="cork-card-flip"
          onClick={(e) => {
            e.stopPropagation();
            props.onFlip();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          title={side === "front" ? "시놉시스로 뒤집기" : "앞면으로"}
          aria-label="카드 뒤집기"
        >
          ↻
        </button>
      </div>

      {side === "back" ? (
        <textarea
          className="cork-card-synopsis"
          value={synopsis}
          onChange={(e) => setSynopsis(e.target.value)}
          onBlur={() => {
            if (synopsis !== node.synopsis) {
              void updateNodeSynopsis(node.id, synopsis);
            }
          }}
          // 카드 자체가 클릭/드래그 핸들러를 가지므로 텍스트 영역에서 차단.
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder="시놉시스…"
          rows={6}
        />
      ) : (
        <div
          className="cork-card-front-body"
          // 앞면은 빠른 훑어보기 — 클릭/드래그 그대로 카드에 전달.
          title={node.synopsis || "(시놉시스 없음)"}
        >
          {oneLine ? (
            <span className="cork-card-oneline">{oneLine}</span>
          ) : (
            <span className="cork-card-oneline cork-card-oneline--empty">
              (시놉시스 없음)
            </span>
          )}
        </div>
      )}

      <div className="cork-card-foot">
        <span className="cork-card-meta">
          {node.type === "folder" ? "폴더" : status?.name ?? ""}
        </span>
        {wordCount !== null && (
          <span className="cork-card-meta">{wordCount.toLocaleString()}자</span>
        )}
      </div>
    </div>
  );
}
