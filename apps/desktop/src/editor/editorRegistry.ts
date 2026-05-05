// editorRegistry.ts — 활성 Tiptap(ProseMirror) Editor 레지스트리.
//
// RichEditor 가 마운트될 때 자기 docId 로 editor 를 등록하고, 외부 코드(예: voiceRewriter,
// SelectionPopover, SnippetPanel, EditorToolbar)는 register/get 으로 editor 를 얻어
// 트랜잭션을 dispatch 한다.
//
// IME 안전 삽입: Tiptap/ProseMirror 는 한글 IME 조합 중에도 자체적으로 안전하게
// 처리하지만 외부 insert 는 조합을 강제 종료시킬 수 있다. 우리는 view.composing 을
// 보고 조합 중이면 큐에 쌓고 compositionend 직후 한 번에 flush 한다.

import type { Editor } from "@tiptap/react";

interface Entry {
  editor: Editor;
  composing: boolean;
  /** composition 중 도착한 텍스트. compositionend 시 한 번에 insert. */
  pending: string[];
  /** 외부 insert 후 store draft 를 갱신할 콜백. */
  flush: () => void;
}

const REGISTRY: Map<string, Entry> = new Map();
const SUBSCRIBERS: Set<() => void> = new Set();

function notify(): void {
  for (const cb of SUBSCRIBERS) {
    try {
      cb();
    } catch {
      /* swallow */
    }
  }
}

export function subscribe(cb: () => void): () => void {
  SUBSCRIBERS.add(cb);
  return () => SUBSCRIBERS.delete(cb);
}

export function register(
  docId: string,
  editor: Editor,
  flush: () => void,
): void {
  const dom = editor.view.dom;
  const entry: Entry = { editor, composing: false, pending: [], flush };
  REGISTRY.set(docId, entry);

  const onStart = (): void => {
    entry.composing = true;
  };
  const onEnd = (): void => {
    entry.composing = false;
    if (entry.pending.length > 0) {
      const joined = entry.pending.join("");
      entry.pending = [];
      requestAnimationFrame(() => {
        if (REGISTRY.get(docId) === entry) {
          dispatchInsert(entry.editor, joined);
          entry.flush();
        }
      });
    }
  };
  dom.addEventListener("compositionstart", onStart);
  dom.addEventListener("compositionend", onEnd);

  (entry as Entry & { _cleanup?: () => void })._cleanup = () => {
    dom.removeEventListener("compositionstart", onStart);
    dom.removeEventListener("compositionend", onEnd);
  };
  notify();
}

export function unregister(docId: string): void {
  const e = REGISTRY.get(docId);
  if (!e) return;
  const cleanup = (e as Entry & { _cleanup?: () => void })._cleanup;
  if (cleanup) cleanup();
  REGISTRY.delete(docId);
  notify();
}

export function get(docId: string): Editor | null {
  return REGISTRY.get(docId)?.editor ?? null;
}

export function has(docId: string): boolean {
  return REGISTRY.has(docId);
}

export function getMostRecentId(): string | null {
  let last: string | null = null;
  for (const id of REGISTRY.keys()) last = id;
  return last;
}

export function size(): number {
  return REGISTRY.size;
}

/** 현재 cursor 위치에 plain text 를 삽입. ProseMirror 트랜잭션 사용. */
function dispatchInsert(editor: Editor, text: string): void {
  if (!text) return;
  const { from, to } = editor.state.selection;
  editor
    .chain()
    .focus()
    .insertContentAt({ from, to }, text)
    .run();
}

/**
 * 활성 에디터의 커서 위치(또는 selection 영역)에 텍스트를 삽입.
 * IME 조합 중이면 큐에 쌓고 compositionend 시 한 번에 flush.
 *
 * @returns true: 성공 / 큐잉됨, false: 등록된 editor 없음
 */
export function insertAtCursor(docId: string, text: string): boolean {
  const e = REGISTRY.get(docId);
  if (!e) return false;
  if (e.composing) {
    e.pending.push(text);
    return true;
  }
  dispatchInsert(e.editor, text);
  e.flush();
  return true;
}

/**
 * [from, to) 범위의 본문을 text 로 교체. SelectionPopover 의 "선택 영역에 적용"
 * / SnippetPanel 의 "이어 붙이기·교체" 가 사용한다.
 * IME 조합 중이면 즉시 적용하지 않고 false 반환.
 *
 * @returns true: 교체 완료, false: 등록된 editor 없음 / 조합 중 / 범위 invalid
 */
export function replaceRange(
  docId: string,
  from: number,
  to: number,
  text: string,
): boolean {
  const e = REGISTRY.get(docId);
  if (!e) return false;
  if (e.composing) return false;
  const docSize = e.editor.state.doc.content.size;
  if (from < 0 || to > docSize || from > to) return false;
  e.editor
    .chain()
    .focus()
    .insertContentAt({ from, to }, text)
    .run();
  e.flush();
  return true;
}

/** 테스트용 — 모든 등록 해제. */
export function _resetRegistry(): void {
  for (const id of [...REGISTRY.keys()]) unregister(id);
}
