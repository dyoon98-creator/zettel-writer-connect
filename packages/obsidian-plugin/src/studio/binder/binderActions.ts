// binderActions.ts — 컨텍스트 메뉴/단축키가 부르는 사용자 의도 단위 헬퍼.
//
// projectStore의 mutation들은 raw하다 (그냥 BinderIO 호출). 여기서는
// 사용자에게 보이는 흐름(확인 모달, 새 장면 자동 선택, 부모 결정 등)을
// 한곳에 모은다. 컴포넌트가 직접 store를 부르지 않고 이쪽을 거치도록.

import { useProjectStore } from "../state/projectStore";
import { findBinderNode, findParentOf } from "../state/binderQueries";

/** 선택된 노드를 기준으로 새 장면 추가. 폴더면 자식으로, 장면이면 형제로. */
export async function addSceneNearSelection(): Promise<string | null> {
  const state = useProjectStore.getState();
  const { binder, selectedNodeIds } = state;
  if (!binder) return null;

  const parentId = resolveParentForNewSibling(selectedNodeIds);
  return await state.addScene(parentId, "새 장면");
}

/** 폴더 추가도 동일 규칙. */
export async function addFolderNearSelection(): Promise<string | null> {
  const state = useProjectStore.getState();
  const { binder, selectedNodeIds } = state;
  if (!binder) return null;
  const parentId = resolveParentForNewSibling(selectedNodeIds);
  return await state.addFolder(parentId, "새 폴더");
}

/** 명시적으로 특정 폴더 안에 새 장면 추가. 우클릭한 폴더 기준. */
export async function addSceneInsideFolder(
  folderId: string,
): Promise<string | null> {
  const state = useProjectStore.getState();
  if (!state.binder) return null;
  const id = await state.addScene(folderId, "새 장면");
  // 새 폴더가 접혀 있으면 펼침.
  if (id) state.setExpanded(folderId, true);
  return id;
}

/** 명시적으로 특정 폴더 안에 새 폴더 추가. */
export async function addFolderInsideFolder(
  folderId: string,
): Promise<string | null> {
  const state = useProjectStore.getState();
  if (!state.binder) return null;
  const id = await state.addFolder(folderId, "새 폴더");
  if (id) state.setExpanded(folderId, true);
  return id;
}

/** 폴더의 자식이면 그 폴더, 그렇지 않으면 root(null). */
function resolveParentForNewSibling(selectedIds: string[]): string | null {
  const state = useProjectStore.getState();
  const binder = state.binder;
  if (!binder || selectedIds.length === 0) return null;
  const last = selectedIds[selectedIds.length - 1];
  const node = findBinderNode(binder, last);
  if (!node) return null;
  if (node.type === "folder") return node.id;
  // sibling으로 추가
  const parent = findParentOf(binder, last);
  return parent ? parent.id : null;
}

export interface DeleteOptions {
  confirm: (msg: string) => Promise<boolean>;
}

export async function deleteSelectedNode(
  id: string,
  opts: DeleteOptions,
): Promise<void> {
  const state = useProjectStore.getState();
  const binder = state.binder;
  if (!binder) return;
  const node = findBinderNode(binder, id);
  if (!node) return;

  const isFolder = node.type === "folder";
  const hasChildren = isFolder && node.children.length > 0;
  const msg = hasChildren
    ? `"${node.title}" 폴더와 하위 ${countChildren(node)}개 항목을 삭제할까요?\n파일도 함께 삭제됩니다.`
    : `"${node.title}"을(를) 삭제할까요?\n파일도 함께 삭제됩니다.`;

  const ok = await opts.confirm(msg);
  if (!ok) return;

  await state.deleteNode(id, true);
}

function countChildren(node: ReturnType<typeof findBinderNode>): number {
  if (!node || node.type !== "folder") return 0;
  let total = 0;
  const walk = (children: typeof node.children): void => {
    for (const c of children) {
      total += 1;
      if (c.type === "folder") walk(c.children);
    }
  };
  walk(node.children);
  return total;
}

export async function renameNodePrompt(id: string, title: string): Promise<void> {
  if (!title.trim()) return;
  await useProjectStore.getState().renameNode(id, title.trim());
}
