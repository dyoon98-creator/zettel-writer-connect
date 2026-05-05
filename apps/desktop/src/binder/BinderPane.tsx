// BinderPane.tsx — Phase D 실 구현.
//
// - 트리 뷰 (BinderNode 재귀)
// - 클릭 / Cmd+클릭 / Shift+클릭 다중 선택
// - 폴더 펼침/접힘 (caret)
// - 우클릭 컨텍스트 메뉴
// - dnd-kit 기반 드래그-드롭 (sibling 또는 자식으로 drop)
// - 키보드: ↑↓← → Enter

import {
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import type { BinderNode, ProjectMeta } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../state/projectStore";
import { findBinderNode, descendantIds } from "../state/binderQueries";
import { BinderContextMenu } from "./BinderContextMenu";
import { renameNodePrompt } from "./binderActions";

const SHORTCUT_EXTS = new Set([".md", ".markdown", ".txt"]);
function isShortcutPath(p: string): boolean {
  const dot = p.lastIndexOf(".");
  if (dot < 0) return false;
  return SHORTCUT_EXTS.has(p.slice(dot).toLowerCase());
}

interface FlatRow {
  node: BinderNode;
  depth: number;
  parentId: string | null;
  index: number;
}

function flatten(
  nodes: BinderNode[],
  expanded: Set<string>,
  depth = 0,
  parentId: string | null = null,
  out: FlatRow[] = [],
): FlatRow[] {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    out.push({ node: n, depth, parentId, index: i });
    if (n.type === "folder" && expanded.has(n.id)) {
      flatten(n.children, expanded, depth + 1, n.id, out);
    }
  }
  return out;
}

export function BinderPane(): JSX.Element {
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const selectedIds = useProjectStore((s) => s.selectedNodeIds);
  const expanded = useProjectStore((s) => s.expandedFolderIds);
  const toggleSelection = useProjectStore((s) => s.toggleSelection);
  const toggleFolder = useProjectStore((s) => s.toggleFolder);
  const setExpanded = useProjectStore((s) => s.setExpanded);
  const moveNode = useProjectStore((s) => s.moveNode);
  const addAttachmentByPath = useProjectStore((s) => s.addAttachmentByPath);
  const convertNodeToShortcut = useProjectStore((s) => s.convertNodeToShortcut);

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  // 인라인 이름 변경 — Tauri WebView 에서 window.prompt 가 동작하지 않으므로
  // 행 안에 textbox 를 띄워 직접 편집한다. F2 또는 컨텍스트 메뉴 "이름 변경" 으로 진입.
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);

  // 외부 파일 드래그가 트리 위로 올라왔을 때 현재 hover 중인 nodeId. null 이면
  // 빈 영역 hover (= root drop). undefined 면 외부 파일 드래그가 없음.
  const [extDragOver, setExtDragOver] = useState<string | null | undefined>(
    undefined,
  );

  /** OS 절대 경로 배열을 target node 에 분기 처리.
   *  - .md/.txt/.markdown → 타깃 노드 자체를 외부 파일 shortcut 으로 *변환* (write-through 라이브 뷰).
   *  - 그 외 → 기존 attachment 흐름 (vault 안 .attachments/ 로 binary 복사). */
  const dropPathsAt = useCallback(
    async (paths: string[], targetNodeId: string | null): Promise<void> => {
      if (!binder || paths.length === 0) return;
      // target 결정. shortcut 변환은 *타깃 노드 자체* 를 변환 → parent 추론 불필요.
      // attachment 는 기존 동작대로 폴더면 자식, document 면 같은 부모, null 이면 root.
      const target = targetNodeId ? findBinderNode(binder, targetNodeId) : null;
      let attachmentParentId: string | null = null;
      if (target) {
        if (target.type === "folder") {
          attachmentParentId = target.id;
        } else {
          const findParent = (
            nodes: BinderNode[],
            id: string,
            parent: string | null = null,
          ): string | null => {
            for (const n of nodes) {
              if (n.id === id) return parent;
              if (n.type === "folder") {
                const r = findParent(n.children, id, n.id);
                if (r !== null || n.children.some((c) => c.id === id)) {
                  return n.children.some((c) => c.id === id) ? n.id : r;
                }
              }
            }
            return null;
          };
          attachmentParentId = findParent(binder.root, target.id);
        }
      }

      for (const p of paths) {
        try {
          if (isShortcutPath(p) && targetNodeId) {
            // 타깃 노드 자체를 shortcut 으로 변환. 여러 .md 가 들어오면 첫 파일만 변환,
            // 나머지는 attachment 로 떨어뜨려 사용자가 트리에서 따로 처리하게 둔다.
            await convertNodeToShortcut(targetNodeId, p);
          } else {
            await addAttachmentByPath(attachmentParentId, p);
          }
        } catch {
          /* notice 는 store 가 띄움 */
        }
      }
    },
    [binder, addAttachmentByPath, convertNodeToShortcut],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const flat: FlatRow[] = useMemo(() => {
    if (!binder) return [];
    return flatten(binder.root, expanded);
  }, [binder, expanded]);

  const onRowMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>, nodeId: string): void => {
      // 좌클릭만 선택. 우클릭은 onContextMenu에서 처리.
      if (e.button !== 0) return;
      const mode = e.metaKey || e.ctrlKey
        ? "additive"
        : e.shiftKey
        ? "range"
        : "single";
      toggleSelection(nodeId, mode);
    },
    [toggleSelection],
  );

  const onRowContext = useCallback(
    (e: MouseEvent<HTMLDivElement>, nodeId: string): void => {
      e.preventDefault();
      e.stopPropagation();
      // 우클릭만으로 단일 선택까지 강제하면 사용감이 자연스럽다.
      if (!selectedIds.includes(nodeId)) {
        toggleSelection(nodeId, "single");
      }
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId });
    },
    [selectedIds, toggleSelection],
  );

  const onCaretClick = useCallback(
    (e: MouseEvent, nodeId: string): void => {
      e.stopPropagation();
      toggleFolder(nodeId);
    },
    [toggleFolder],
  );

  // ----- keyboard navigation -----
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (!binder || flat.length === 0) return;
      const last = selectedIds[selectedIds.length - 1] ?? flat[0].node.id;
      const i = flat.findIndex((r) => r.node.id === last);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const j = Math.min(flat.length - 1, i + 1);
        toggleSelection(flat[j].node.id, e.shiftKey ? "range" : "single");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const j = Math.max(0, i - 1);
        toggleSelection(flat[j].node.id, e.shiftKey ? "range" : "single");
      } else if (e.key === "ArrowRight") {
        const cur = flat[i]?.node;
        if (cur && cur.type === "folder") {
          e.preventDefault();
          setExpanded(cur.id, true);
        }
      } else if (e.key === "ArrowLeft") {
        const cur = flat[i]?.node;
        if (cur && cur.type === "folder" && expanded.has(cur.id)) {
          e.preventDefault();
          setExpanded(cur.id, false);
        }
      } else if (e.key === "F2") {
        const cur = flat[i]?.node;
        if (cur) {
          e.preventDefault();
          setRenamingNodeId(cur.id);
        }
      } else if (e.key === "Enter") {
        // 단일 선택으로 강제 (선택된 장면을 에디터가 그리도록).
        const cur = flat[i]?.node;
        if (cur && cur.type === "document") {
          e.preventDefault();
          toggleSelection(cur.id, "single");
        }
      } else if (
        (e.key === "Delete" || (e.key === "Backspace" && e.metaKey)) &&
        selectedIds.length > 0
      ) {
        // Delete (Win) / Cmd+Backspace (Mac) — 선택된 노드 삭제 (한 번 누르면 즉시).
        e.preventDefault();
        const ps = useProjectStore.getState();
        const targets = [...selectedIds];
        void (async () => {
          for (const id of targets) {
            try {
              await ps.deleteNode(id, true);
            } catch {
              /* skip */
            }
          }
        })();
      }
    },
    [binder, flat, expanded, selectedIds, toggleSelection, setExpanded],
  );

  // ----- dnd-kit sensors -----
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent): Promise<void> => {
      const { active, over } = event;
      if (!over || !binder) return;
      const draggedId = String(active.id);
      const overId = String(over.id);
      if (draggedId === overId) return;

      // overId 형식:
      //   "node:<id>"          — 장면(또는 폴더)에 직접 떨어뜨림 (그 노드의 형제로 간주)
      //   "folder-into:<id>"   — 폴더의 안으로 떨어뜨림 (자식으로)
      //   "root"               — 루트 끝에 추가
      let newParentId: string | null = null;
      let index = 0;

      if (overId === "root") {
        newParentId = null;
        index = binder.root.length;
      } else if (overId.startsWith("folder-into:")) {
        newParentId = overId.slice("folder-into:".length);
        const parent = findBinderNode(binder, newParentId);
        index = parent && parent.type === "folder" ? parent.children.length : 0;
      } else if (overId.startsWith("node:")) {
        const targetId = overId.slice("node:".length);
        // 자기 자신/자손은 거부
        const draggedNode = findBinderNode(binder, draggedId);
        if (draggedNode) {
          const banned = new Set(descendantIds(draggedNode));
          if (banned.has(targetId)) return;
        }
        // target의 부모와 위치를 찾아서 그 자리에 형제로 끼워넣기
        const found = locateRow(binder.root, targetId);
        if (!found) return;
        newParentId = found.parentId;
        index = found.index;
      } else {
        return;
      }

      try {
        await moveNode(draggedId, newParentId, index);
      } catch (e) {
        // moveNode가 store 내부에서 notice를 띄움.
      }
    },
    [binder, moveNode],
  );

  // Tauri webview native drag-drop 구독. dragDropEnabled=true 이면 HTML5 dataTransfer 이벤트는
  // 도착하지 않고 대신 webview 가 paths + position 을 emit 한다.
  // payload.position 단위/origin 은 플랫폼별로 다르다 — macOS 에서는 window *outer*
  // top-left (title bar 포함) 기준 physical pixels 인 케이스가 있어 단순 dpr 나누기만으로는
  // viewport 좌표와 어긋난다 (사용자가 hover 한 노드보다 *아래* 노드가 hit 되는 회귀).
  // 따라서 webview innerPosition / outerPosition 의 차로 title-bar offset 을 동적으로 보정.
  useEffect(() => {
    const win = getCurrentWebviewWindow();
    let unlisten: (() => void) | null = null;
    let mounted = true;
    // dpr + title bar offset (CSS px) — drag 시작 시 한 번 측정해 캐시.
    let dpr = window.devicePixelRatio || 1;
    let titleBarOffsetCss = 0;
    let geomReady = false;

    const refreshGeom = async (): Promise<void> => {
      try {
        const scale = await win.scaleFactor();
        const inner = await win.innerPosition();
        const outer = await win.outerPosition();
        dpr = scale || 1;
        // physical → CSS px. inner.y - outer.y 가 title bar 높이 (physical).
        titleBarOffsetCss = (inner.y - outer.y) / dpr;
        geomReady = true;
        // eslint-disable-next-line no-console
        console.debug("[BinderPane geom]", { dpr, titleBarOffsetCss });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[BinderPane geom] fail, using fallback", e);
        dpr = window.devicePixelRatio || 1;
        titleBarOffsetCss = 0;
        geomReady = true;
      }
    };
    void refreshGeom();

    const toCssCoords = (p: { x: number; y: number }): { x: number; y: number } => {
      // Tauri payload.position 이 outer-frame top-left 기준이라 가정하고
      // 우선 dpr 로 CSS px 변환 후 title bar offset 을 *빼* viewport 좌표로 맞춘다.
      return { x: p.x / dpr, y: p.y / dpr - titleBarOffsetCss };
    };

    void (async () => {
      const u = await win.onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type !== "over") {
          // eslint-disable-next-line no-console
          console.debug("[BinderPane drag]", payload);
        }

        if (payload.type === "leave") {
          setExtDragOver(undefined);
          return;
        }

        // enter 시 한번 더 geom 갱신 — 윈도우 이동/리사이즈 후 정확도 유지.
        if (payload.type === "enter" && !geomReady) {
          // 비동기지만 fire-and-forget — 다음 over/drop 이벤트부터 반영.
          void refreshGeom();
        }

        const css = toCssCoords(payload.position);

        const container = containerRef.current;
        if (!container) {
          if (payload.type === "drop") setExtDragOver(undefined);
          return;
        }
        const rect = container.getBoundingClientRect();
        const inside =
          css.x >= rect.left &&
          css.x <= rect.right &&
          css.y >= rect.top &&
          css.y <= rect.bottom;
        if (!inside) {
          if (payload.type === "drop") setExtDragOver(undefined);
          return;
        }

        const stack = document.elementsFromPoint(css.x, css.y) as HTMLElement[];
        const row = stack.find((el) => el.classList?.contains("binder-row"));
        const targetId = row?.getAttribute("data-node-id") ?? null;

        if (payload.type === "enter" || payload.type === "over") {
          setExtDragOver(targetId);
        } else if (payload.type === "drop") {
          setExtDragOver(undefined);
          // eslint-disable-next-line no-console
          console.info("[BinderPane drop]", {
            paths: payload.paths,
            position: payload.position,
            css,
            titleBarOffsetCss,
            dpr,
            targetId,
          });
          void dropPathsAt(payload.paths, targetId);
        }
      });
      if (!mounted) {
        u();
      } else {
        unlisten = u;
        // eslint-disable-next-line no-console
        console.debug("[BinderPane] drag-drop listener registered");
      }
    })();

    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [dropPathsAt]);

  if (!meta || !binder) {
    return (
      <>
        <div className="pane-header">바인더</div>
        <div className="pane-body">
          <div className="pane-empty">프로젝트가 열려 있지 않습니다.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pane-header">바인더</div>
      <div
        className={
          "pane-body binder-body" +
          (extDragOver !== undefined ? " binder-body--ext-drag" : "")
        }
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <RootDropTarget />
          {flat.map((row) => (
            <BinderRow
              key={row.node.id}
              row={row}
              meta={meta}
              selectedIds={selectedIds}
              expanded={expanded}
              renaming={renamingNodeId === row.node.id}
              extDragOverId={extDragOver}
              onRowMouseDown={onRowMouseDown}
              onRowContext={onRowContext}
              onCaretClick={onCaretClick}
              onRenameRequest={() => setRenamingNodeId(row.node.id)}
              onRenameDone={() => setRenamingNodeId(null)}
            />
          ))}
        </DndContext>
        {flat.length === 0 && (
          <div className="binder-empty">
            <p className="pane-hint">
              비어 있는 프로젝트입니다.
              <br />
              우클릭하거나 Cmd+N으로 첫 장면을 추가해보세요.
            </p>
          </div>
        )}
      </div>
      {ctxMenu && (
        <BinderContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          nodeId={ctxMenu.nodeId}
          onClose={() => setCtxMenu(null)}
          onStartRename={(id) => setRenamingNodeId(id)}
        />
      )}
    </>
  );
}

// ---- Tree icons (lucide-style line SVG) -------------------------------------

function FolderIcon({ open }: { open: boolean }): JSX.Element {
  // 펼침 / 접힘 두 상태로 fold flap 위치를 살짝 바꿔 시각적 단서 제공.
  return (
    <span className="binder-icon" aria-hidden>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {open ? (
          <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
        ) : (
          <path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        )}
      </svg>
    </span>
  );
}

function DocumentIcon(): JSX.Element {
  return (
    <span className="binder-icon" aria-hidden>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    </span>
  );
}

// ---- BinderRow --------------------------------------------------------------

interface BinderRowProps {
  row: FlatRow;
  meta: ProjectMeta;
  selectedIds: string[];
  expanded: Set<string>;
  renaming: boolean;
  /** 외부 파일 드래그 hover 중인 node id (현재 행과 같으면 highlight). undefined = 외부 드래그 없음. */
  extDragOverId: string | null | undefined;
  onRowMouseDown: (e: MouseEvent<HTMLDivElement>, id: string) => void;
  onRowContext: (e: MouseEvent<HTMLDivElement>, id: string) => void;
  onCaretClick: (e: MouseEvent, id: string) => void;
  onRenameRequest: () => void;
  onRenameDone: () => void;
}

function BinderRow(props: BinderRowProps): JSX.Element {
  const { row, meta, selectedIds, expanded, renaming } = props;
  const { node, depth } = row;
  const isFolder = node.type === "folder";
  const isExpanded = isFolder && expanded.has(node.id);
  const isSelected = selectedIds.includes(node.id);

  const draggable = useDraggable({ id: node.id });
  const droppableSibling = useDroppable({ id: `node:${node.id}` });
  const droppableInto = useDroppable({
    id: isFolder ? `folder-into:${node.id}` : `__never__:${node.id}`,
    disabled: !isFolder,
  });

  const label = findBy(meta.customLabels, node.label);
  const status = findBy(meta.customStatuses, node.status);

  const transform = draggable.transform
    ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`
    : undefined;

  const extDragHover = props.extDragOverId === node.id;
  return (
    <div
      ref={(el) => {
        draggable.setNodeRef(el);
        droppableSibling.setNodeRef(el);
      }}
      className={[
        "binder-row",
        isSelected ? "binder-row--selected" : "",
        droppableSibling.isOver && !isFolder ? "binder-row--over-sibling" : "",
        extDragHover ? "binder-row--ext-drag-over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        paddingLeft: 8 + depth * 14,
        transform,
      }}
      onMouseDown={(e) => props.onRowMouseDown(e, node.id)}
      onContextMenu={(e) => props.onRowContext(e, node.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        props.onRenameRequest();
      }}
      data-testid={`binder-row-${node.id}`}
      data-node-id={node.id}
      {...(renaming ? {} : draggable.attributes)}
      {...(renaming ? {} : draggable.listeners)}
    >
      {isFolder ? (
        <button
          type="button"
          className="binder-caret"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => props.onCaretClick(e, node.id)}
          aria-label={isExpanded ? "접기" : "펼치기"}
        >
          {isExpanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="binder-caret binder-caret--leaf" aria-hidden />
      )}
      {isFolder ? (
        <FolderIcon open={isExpanded} />
      ) : (
        <DocumentIcon />
      )}
      <span
        className="binder-color-dot"
        style={{ background: label?.color ?? "#ccc" }}
        aria-hidden
      />
      {renaming ? (
        <RenameInput
          initial={node.title}
          onCommit={async (next) => {
            const trimmed = next.trim();
            if (trimmed && trimmed !== node.title) {
              await renameNodePrompt(node.id, trimmed);
            }
            props.onRenameDone();
          }}
          onCancel={props.onRenameDone}
        />
      ) : (
        <span className="binder-title" title={node.title}>
          {node.title || "(제목 없음)"}
        </span>
      )}
      {status && (
        <span
          className="binder-status-pill"
          style={{ background: status.color }}
          title={status.name}
        />
      )}
      {/* folder의 경우 자식 영역 위에 별도 droppable 영역을 띄워 "폴더 안으로
          drop" 의도를 구분한다. 행 우측 절반에 가벼운 강조. */}
      {isFolder && (
        <span
          ref={droppableInto.setNodeRef}
          className={
            "binder-into-target " +
            (droppableInto.isOver ? "binder-into-target--over" : "")
          }
          aria-hidden
        />
      )}
    </div>
  );
}

interface RenameInputProps {
  initial: string;
  onCommit: (next: string) => void | Promise<void>;
  onCancel: () => void;
}

function RenameInput({ initial, onCommit, onCancel }: RenameInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(initial);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = async (next: string): Promise<void> => {
    if (committedRef.current) return;
    committedRef.current = true;
    await onCommit(next);
  };

  return (
    <input
      ref={inputRef}
      className="binder-rename-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          void commit(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          committedRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!committedRef.current) void commit(value);
      }}
    />
  );
}

function findBy<T extends { id: string }>(arr: T[], id: string): T | undefined {
  return arr.find((x) => x.id === id);
}

function locateRow(
  nodes: BinderNode[],
  id: string,
  parentId: string | null = null,
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { parentId, index: i };
    if (nodes[i].type === "folder") {
      const found = locateRow(
        (nodes[i] as { children: BinderNode[] }).children,
        id,
        nodes[i].id,
      );
      if (found) return found;
    }
  }
  return null;
}

// ---- 루트 끝 드롭 타겟 ------------------------------------------------------

function RootDropTarget(): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: "root" });
  return (
    <div
      ref={setNodeRef}
      className={
        "binder-root-drop " + (isOver ? "binder-root-drop--over" : "")
      }
      aria-hidden
    />
  );
}
