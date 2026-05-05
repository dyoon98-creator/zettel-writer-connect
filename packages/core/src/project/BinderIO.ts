// BinderIO — binder.json 의 read/write + tree 조작 순수 함수.
//
// 모든 tree 변형(addNode/removeNode/moveNode)은 immutable 하다. 입력 tree 를
// 변경하지 않고 새 tree 를 반환한다.

import { VaultAdapter } from "../adapters/VaultAdapter";
import {
  BINDER_SCHEMA,
  BinderDocument,
  BinderFolder,
  BinderNode,
  BinderTree,
  isBinderTree,
} from "./schema";

const BINDER_JSON = "binder.json";

function binderJsonPath(projectFolder: string): string {
  const folder = projectFolder.replace(/\/+$/, "");
  return `${folder}/${BINDER_JSON}`;
}

function cloneNode(node: BinderNode): BinderNode {
  if (node.type === "folder") {
    return {
      ...node,
      customMetadata: node.customMetadata
        ? { ...node.customMetadata }
        : undefined,
      children: node.children.map(cloneNode),
    };
  }
  return {
    ...node,
    customMetadata: node.customMetadata
      ? { ...node.customMetadata }
      : undefined,
  };
}

function cloneTree(tree: BinderTree): BinderTree {
  return {
    schema: tree.schema,
    root: tree.root.map(cloneNode),
  };
}

/** Depth-first walk; visitor 가 false 를 반환하면 중단. */
function walkInternal(
  nodes: BinderNode[],
  fn: (node: BinderNode, parent: BinderNode | null) => boolean | void,
  parent: BinderNode | null = null,
): boolean {
  for (const node of nodes) {
    const cont = fn(node, parent);
    if (cont === false) return false;
    if (node.type === "folder") {
      const childCont = walkInternal(node.children, fn, node);
      if (!childCont) return false;
    }
  }
  return true;
}

function findNodeInternal(
  nodes: BinderNode[],
  id: string,
): { node: BinderNode; parent: BinderNode | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) return { node, parent: null, index: i };
    if (node.type === "folder") {
      const found = findInChildren(node, id);
      if (found) return found;
    }
  }
  return null;
}

function findInChildren(
  parent: BinderFolder,
  id: string,
): { node: BinderNode; parent: BinderNode | null; index: number } | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.id === id) return { node: child, parent, index: i };
    if (child.type === "folder") {
      const found = findInChildren(child, id);
      if (found) return found;
    }
  }
  return null;
}

/** id 컬렉션을 모음 (cycle 방지·중복 검사용). */
function collectIds(nodes: BinderNode[], out: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    out.add(n.id);
    if (n.type === "folder") collectIds(n.children, out);
  }
  return out;
}

export const BinderIO = {
  /** binder.json 을 읽고 BinderTree 로 반환. */
  async read(
    vault: VaultAdapter,
    projectFolder: string,
  ): Promise<BinderTree> {
    const path = binderJsonPath(projectFolder);
    const raw = await vault.readFile(path);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `BinderIO.read: JSON 파싱 실패 (${path}): ${(err as Error).message}`,
      );
    }
    if (!isBinderTree(parsed)) {
      throw new Error(`BinderIO.read: binder.json 스키마 위반 (${path})`);
    }
    return parsed;
  },

  async write(
    vault: VaultAdapter,
    projectFolder: string,
    tree: BinderTree,
  ): Promise<void> {
    const path = binderJsonPath(projectFolder);
    const json = JSON.stringify(tree, null, 2) + "\n";
    await vault.writeFile(path, json);
  },

  /** 빈 binder tree 를 만들어 반환. */
  empty(): BinderTree {
    return { schema: BINDER_SCHEMA, root: [] };
  },

  /** 노드 검색 (id 매칭). 없으면 null. */
  findNode(tree: BinderTree, id: string): BinderNode | null {
    const found = findNodeInternal(tree.root, id);
    return found ? found.node : null;
  },

  /** 노드의 부모를 반환 (root 노드면 null). */
  findParent(tree: BinderTree, id: string): BinderNode | null {
    const found = findNodeInternal(tree.root, id);
    return found ? found.parent : null;
  },

  /** 루트→노드 경로의 id 배열 (자기 자신 포함). 없으면 빈 배열. */
  pathToId(tree: BinderTree, id: string): string[] {
    const path: string[] = [];
    let result: string[] | null = null;
    function recurse(nodes: BinderNode[], stack: string[]): void {
      if (result !== null) return;
      for (const n of nodes) {
        const next = [...stack, n.id];
        if (n.id === id) {
          result = next;
          return;
        }
        if (n.type === "folder") {
          recurse(n.children, next);
        }
        if (result !== null) return;
      }
    }
    recurse(tree.root, path);
    return result ?? [];
  },

  /** Depth-first iterator. visitor 가 false 반환 시 중단. */
  walk(
    tree: BinderTree,
    fn: (node: BinderNode, parent: BinderNode | null) => boolean | void,
  ): void {
    walkInternal(tree.root, fn);
  },

  /** 새 노드 추가. parentId === null 이면 root 에 추가. */
  addNode(
    tree: BinderTree,
    parentId: string | null,
    node: BinderNode,
    index?: number,
  ): BinderTree {
    if (collectIds(tree.root).has(node.id)) {
      throw new Error(`BinderIO.addNode: 이미 존재하는 id: ${node.id}`);
    }
    const next = cloneTree(tree);
    const cloned = cloneNode(node);
    if (parentId === null) {
      const insertAt = index === undefined ? next.root.length : index;
      next.root.splice(insertAt, 0, cloned);
      return next;
    }
    const found = findNodeInternal(next.root, parentId);
    if (!found) {
      throw new Error(`BinderIO.addNode: parentId를 찾을 수 없음: ${parentId}`);
    }
    if (found.node.type !== "folder") {
      throw new Error(
        `BinderIO.addNode: parent는 folder 여야 합니다 (id=${parentId})`,
      );
    }
    const insertAt =
      index === undefined ? found.node.children.length : index;
    found.node.children.splice(insertAt, 0, cloned);
    return next;
  },

  /** id 로 노드를 제거. children 도 함께 사라진다. */
  removeNode(tree: BinderTree, id: string): BinderTree {
    const next = cloneTree(tree);
    const found = findNodeInternal(next.root, id);
    if (!found) {
      throw new Error(`BinderIO.removeNode: id를 찾을 수 없음: ${id}`);
    }
    if (found.parent === null) {
      next.root.splice(found.index, 1);
    } else if (found.parent.type === "folder") {
      found.parent.children.splice(found.index, 1);
    }
    return next;
  },

  /**
   * 노드를 다른 위치로 이동.
   * - newParentId === null 이면 root 로 이동
   * - 자기 자신/자손에게는 이동 불가
   */
  moveNode(
    tree: BinderTree,
    id: string,
    newParentId: string | null,
    index: number,
  ): BinderTree {
    if (id === newParentId) {
      throw new Error("BinderIO.moveNode: 자기 자신을 부모로 지정할 수 없음");
    }
    const next = cloneTree(tree);
    const found = findNodeInternal(next.root, id);
    if (!found) {
      throw new Error(`BinderIO.moveNode: id를 찾을 수 없음: ${id}`);
    }

    // 자손 검사
    if (found.node.type === "folder" && newParentId) {
      const descendants = collectIds(found.node.children);
      if (descendants.has(newParentId)) {
        throw new Error(
          `BinderIO.moveNode: 자손을 부모로 지정할 수 없음: ${newParentId}`,
        );
      }
    }

    // 떼어내기
    let detached: BinderNode;
    if (found.parent === null) {
      detached = next.root.splice(found.index, 1)[0];
    } else if (found.parent.type === "folder") {
      detached = found.parent.children.splice(found.index, 1)[0];
    } else {
      throw new Error("BinderIO.moveNode: 부모 타입 오류");
    }

    // 다시 끼워넣기
    if (newParentId === null) {
      const at = Math.max(0, Math.min(index, next.root.length));
      next.root.splice(at, 0, detached);
    } else {
      const newParent = findNodeInternal(next.root, newParentId);
      if (!newParent) {
        throw new Error(
          `BinderIO.moveNode: newParentId를 찾을 수 없음: ${newParentId}`,
        );
      }
      if (newParent.node.type !== "folder") {
        throw new Error(
          `BinderIO.moveNode: 새 부모는 folder 여야 합니다 (id=${newParentId})`,
        );
      }
      const at = Math.max(
        0,
        Math.min(index, newParent.node.children.length),
      );
      newParent.node.children.splice(at, 0, detached);
    }
    return next;
  },

  /** 특정 id 노드를 변경한 새 tree 반환. patch 는 부분 객체. */
  updateNode(
    tree: BinderTree,
    id: string,
    patch: Partial<Omit<BinderNode, "id" | "type" | "children">>,
  ): BinderTree {
    const next = cloneTree(tree);
    const found = findNodeInternal(next.root, id);
    if (!found) {
      throw new Error(`BinderIO.updateNode: id를 찾을 수 없음: ${id}`);
    }
    Object.assign(found.node, patch);
    return next;
  },

  /** 같은 id 가 있으면 throw. tree 에 들어 있는 모든 id 를 반환. */
  allIds(tree: BinderTree): string[] {
    return [...collectIds(tree.root)];
  },

  /** 새 unique id 생성 — `<timestamp>-<random>` 형태. */
  assignNewId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
    return `${ts}-${rand}`;
  },

  /** 노드를 만들 때 helper. */
  newDocument(input: {
    id?: string;
    title: string;
    file: string;
    label: string;
    status: string;
    synopsis?: string;
    wordCount?: number;
    customMetadata?: Record<string, string>;
  }): BinderDocument {
    return {
      id: input.id ?? BinderIO.assignNewId(),
      type: "document",
      title: input.title,
      file: input.file,
      label: input.label,
      status: input.status,
      synopsis: input.synopsis ?? "",
      wordCount: input.wordCount,
      customMetadata: input.customMetadata
        ? { ...input.customMetadata }
        : undefined,
    };
  },

  newFolder(input: {
    id?: string;
    title: string;
    label: string;
    status: string;
    synopsis?: string;
    children?: BinderNode[];
    customMetadata?: Record<string, string>;
  }): BinderFolder {
    return {
      id: input.id ?? BinderIO.assignNewId(),
      type: "folder",
      title: input.title,
      label: input.label,
      status: input.status,
      synopsis: input.synopsis ?? "",
      children: input.children ?? [],
      customMetadata: input.customMetadata
        ? { ...input.customMetadata }
        : undefined,
    };
  },
};
