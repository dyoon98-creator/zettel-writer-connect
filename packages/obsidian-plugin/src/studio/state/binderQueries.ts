// binderQueries.ts — projectStore 외부에서도 쓰는 작은 트리 헬퍼.
// BinderIO에 같은 헬퍼가 있지만, 여기서는 React 렌더 사이클에서 쓰기 좋게
// 추가 메모이제이션 없이 단순 깊이 우선 검색 한 번만 한다.

import type { BinderNode, BinderTree } from "@ai-manuscript-studio/core";

export function findBinderNode(
  tree: BinderTree,
  id: string,
): BinderNode | null {
  function recurse(nodes: BinderNode[]): BinderNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.type === "folder") {
        const found = recurse(n.children);
        if (found) return found;
      }
    }
    return null;
  }
  return recurse(tree.root);
}

export function findParentOf(
  tree: BinderTree,
  id: string,
): BinderNode | null {
  function recurse(nodes: BinderNode[], parent: BinderNode | null): BinderNode | null {
    for (const n of nodes) {
      if (n.id === id) return parent;
      if (n.type === "folder") {
        const found = recurse(n.children, n);
        if (found) return found;
      }
    }
    return null;
  }
  return recurse(tree.root, null);
}

/** 깊이 우선 순서 (visible 순)로 모든 노드 id를 평탄화. */
export function flattenIds(tree: BinderTree): string[] {
  const out: string[] = [];
  const walk = (nodes: BinderNode[]): void => {
    for (const n of nodes) {
      out.push(n.id);
      if (n.type === "folder") walk(n.children);
    }
  };
  walk(tree.root);
  return out;
}

/** 자손까지 포함한 모든 id (자기 자신 포함). */
export function descendantIds(node: BinderNode): string[] {
  const out: string[] = [node.id];
  if (node.type === "folder") {
    for (const c of node.children) {
      out.push(...descendantIds(c));
    }
  }
  return out;
}

/**
 * 폴더 노드의 모든 후손 document 들을 깊이 우선(visible) 순서로 수집.
 * 폴더는 결과에 포함하지 않는다. 자기 자신이 document 면 그 한 개만.
 *
 * 사용처: EditorPane 의 폴더 단일 선택 시 자동 Scrivenings — 후손 장면을 차례로
 * 한 통합 에디터에 보여주기 위함.
 */
export function descendantDocuments(
  node: BinderNode,
): Extract<BinderNode, { type: "document" }>[] {
  const out: Extract<BinderNode, { type: "document" }>[] = [];
  const walk = (n: BinderNode): void => {
    if (n.type === "document") {
      out.push(n);
      return;
    }
    for (const c of n.children) walk(c);
  };
  walk(node);
  return out;
}
