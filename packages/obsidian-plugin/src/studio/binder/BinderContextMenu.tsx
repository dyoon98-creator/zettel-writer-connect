// BinderContextMenu.tsx — 우클릭 메뉴.
// 의도적으로 의존성 0. 외부 클릭/Esc로 닫힌다.

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../state/projectStore";
import { findBinderNode } from "../state/binderQueries";
import {
  addFolderInsideFolder,
  addFolderNearSelection,
  addSceneInsideFolder,
  addSceneNearSelection,
  renameNodePrompt,
} from "./binderActions";
import { tauriNoticeAdapter } from "../noticeAdapter";

export interface BinderContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
  /** "이름 변경" 클릭 — 부모가 인라인 rename 편집 모드로 전환. */
  onStartRename?: (nodeId: string) => void;
}

export function BinderContextMenu(props: BinderContextMenuProps): JSX.Element | null {
  const { x, y, nodeId, onClose, onStartRename } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const setNodeStatus = useProjectStore((s) => s.setNodeStatus);
  const setNodeLabel = useProjectStore((s) => s.setNodeLabel);

  const [submenu, setSubmenu] = useState<"label" | "status" | null>(null);
  // 두-단계 삭제 확인. window.confirm() 이 webview 환경에서 막혀
  // 작동 안 할 수 있으므로 inline 두 번 클릭 방식으로 처리.
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteNodeStore = useProjectStore((s) => s.deleteNode);

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!meta || !binder) return null;
  const node = findBinderNode(binder, nodeId);
  if (!node) return null;

  const handleAddScene = async (): Promise<void> => {
    onClose();
    await addSceneNearSelection();
  };
  const handleAddFolder = async (): Promise<void> => {
    onClose();
    await addFolderNearSelection();
  };
  const handleRename = (): void => {
    onClose();
    // Tauri WebView 에서는 window.prompt 가 차단/미동작. 인라인 편집 input 으로
    // 전환하기 위해 부모에게 노드 id 를 전달한다.
    if (onStartRename) {
      onStartRename(nodeId);
    } else {
      // 콜백이 없으면 prompt fallback (브라우저 dev 환경 등).
      const next = window.prompt("새 이름", node.title);
      if (next !== null) void renameNodePrompt(nodeId, next);
    }
  };
  const handleDelete = async (): Promise<void> => {
    if (!deleteArmed) {
      // 첫 번째 클릭 — armed 상태로 변경하고 메뉴 유지.
      setDeleteArmed(true);
      window.setTimeout(() => setDeleteArmed(false), 4000);
      return;
    }
    // 두 번째 클릭 — 즉시 삭제.
    onClose();
    try {
      await deleteNodeStore(nodeId, true);
    } catch (e) {
      tauriNoticeAdapter.error(
        `삭제 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const isFolder = node.type === "folder";
  const handleAddSceneInside = async (): Promise<void> => {
    onClose();
    if (!isFolder) return;
    await addSceneInsideFolder(nodeId);
  };
  const handleAddFolderInside = async (): Promise<void> => {
    onClose();
    if (!isFolder) return;
    await addFolderInsideFolder(nodeId);
  };

  // 화면 오른쪽 끝에 너무 가까우면 뒤집어준다 (상시 우측 240px 마진).
  const adjustedLeft = Math.min(x, window.innerWidth - 200);
  const adjustedTop = Math.min(y, window.innerHeight - 240);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: adjustedLeft, top: adjustedTop }}
      role="menu"
    >
      {isFolder && (
        <>
          <button className="ctx-item" onClick={handleAddSceneInside}>
            ↳ 이 폴더 안에 새 장면
          </button>
          <button className="ctx-item" onClick={handleAddFolderInside}>
            ↳ 이 폴더 안에 새 폴더
          </button>
          <div className="ctx-divider" />
        </>
      )}
      <button className="ctx-item" onClick={handleAddScene}>
        새 장면 (형제 위치)
      </button>
      <button className="ctx-item" onClick={handleAddFolder}>
        새 폴더 (형제 위치)
      </button>
      <div className="ctx-divider" />
      <button className="ctx-item" onClick={handleRename}>
        이름 변경
      </button>
      <button
        className="ctx-item"
        onMouseEnter={() => setSubmenu("label")}
        onMouseLeave={() => setSubmenu((s) => (s === "label" ? null : s))}
      >
        라벨 변경 ▸
        {submenu === "label" && (
          <div className="ctx-submenu">
            {meta.customLabels.map((l) => (
              <button
                key={l.id}
                className="ctx-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  onClose();
                  await setNodeLabel(nodeId, l.id);
                }}
              >
                <span className="chip-dot" style={{ background: l.color }} />
                {l.name}
              </button>
            ))}
          </div>
        )}
      </button>
      <button
        className="ctx-item"
        onMouseEnter={() => setSubmenu("status")}
        onMouseLeave={() => setSubmenu((s) => (s === "status" ? null : s))}
      >
        상태 변경 ▸
        {submenu === "status" && (
          <div className="ctx-submenu">
            {meta.customStatuses.map((s) => (
              <button
                key={s.id}
                className="ctx-item"
                onClick={async (e) => {
                  e.stopPropagation();
                  onClose();
                  await setNodeStatus(nodeId, s.id);
                }}
              >
                <span className="chip-dot" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </button>
      <div className="ctx-divider" />
      <button
        className="ctx-item ctx-item-danger"
        onClick={handleDelete}
        style={
          deleteArmed
            ? {
                background: "#a33",
                color: "#fff",
                fontWeight: 600,
              }
            : undefined
        }
      >
        {deleteArmed
          ? `정말 삭제? 한 번 더 클릭${
              node.type === "folder" && node.children.length > 0
                ? ` (하위 ${node.children.length}개 함께)`
                : ""
            }`
          : "삭제"}
      </button>
    </div>
  );
}
