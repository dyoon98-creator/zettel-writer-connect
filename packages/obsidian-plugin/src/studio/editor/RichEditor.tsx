// RichEditor.tsx — Tiptap 기반 리치 텍스트 에디터.
//
// 디자인 의도:
//   - 사용자에게는 굵게/기울임/제목/리스트 등이 시각적으로 즉시 반영되는 WYSIWYG.
//   - 디스크에는 마크다운(.md) 그대로 저장 → 옵시디언 호환 유지.
//   - 한국어 IME 안전: ProseMirror 가 자체적으로 처리.
//
// 흐름:
//   1) 마운트 시 props.body(또는 draft) → markdownToHtml → Tiptap 초기 콘텐츠.
//   2) onUpdate 마다 store 의 draft 갱신 (마크다운 텍스트로 환원하여 onChange 콜백).
//   3) 디바운스 1.5초 후 onSave.
//   4) editorRegistry 에 Editor 인스턴스 등록 → SelectionPopover / SnippetPanel /
//      voiceRewriter 가 활용.

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";

import { countChars } from "@ai-manuscript-studio/core";
import * as editorRegistry from "./editorRegistry";
import { SelectionPopover } from "./SelectionPopover";
import { EditorToolbar } from "./EditorToolbar";
import { FontSize } from "./fontSizeExtension";
import { htmlToMarkdown, markdownToHtml } from "./markdownConvert";

export interface RichEditorProps {
  docId: string;
  body: string;
  draft?: string | null;
  onChange: (next: string) => void;
  onSave: () => void;
  dark?: boolean;
  bodyFont?: "serif" | "sans";
  /** true 면 편집 차단 + toolbar/badge/selection popover 미노출 (Scrivenings view 모드용). */
  readOnly?: boolean;
}

const SAVE_DEBOUNCE_MS = 1500;

export function RichEditor(props: RichEditorProps): JSX.Element {
  const {
    docId,
    body,
    draft,
    onChange,
    onSave,
    dark = false,
    bodyFont = "serif",
    readOnly = false,
  } = props;
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const saveTimer = useRef<number | null>(null);

  // ref 항상 최신 콜백.
  useEffect(() => {
    onSaveRef.current = onSave;
    onChangeRef.current = onChange;
  });

  const initialMarkdown = draft ?? body;
  // memo 하지 않고 docId 변경 시 useEditor 재생성 (key 사용).

  const [wordCount, setWordCount] = useState(() => countChars(initialMarkdown));
  // 선택 텍스트 popover 상태.
  const [selectionPopover, setSelectionPopover] = useState<{
    text: string;
    range: { from: number; to: number };
    anchor: {
      x: number;
      y: number;
      bottomY: number;
      editorLeft: number;
      editorRight: number;
      selectionLeft: number;
    };
  } | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // history 는 default 활성, code/codeBlock 도 default.
        }),
        TextStyle,
        FontSize,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noreferrer noopener",
            target: "_blank",
          },
        }),
        Placeholder.configure({
          placeholder: "본문을 여기에…",
        }),
      ],
      content: markdownToHtml(initialMarkdown),
      autofocus: false,
      onUpdate: ({ editor }) => {
        const md = htmlToMarkdown(editor.getHTML());
        onChangeRef.current(md);
        setWordCount(countChars(md));
        scheduleSave();
      },
      onSelectionUpdate: ({ editor }) => {
        updateSelectionPopover(editor);
      },
      editorProps: {
        attributes: {
          class: "rich-editor-content",
          spellcheck: "true",
          lang: "ko",
          autocorrect: "off",
          autocapitalize: "off",
        },
        handleKeyDown(view, event) {
          // Cmd/Ctrl+S → 즉시 저장.
          if ((event.metaKey || event.ctrlKey) && event.key === "s") {
            event.preventDefault();
            if (saveTimer.current !== null) {
              window.clearTimeout(saveTimer.current);
              saveTimer.current = null;
            }
            onSaveRef.current();
            return true;
          }
          return false;
        },
      },
    },
    [docId],
  );

  function scheduleSave(): void {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      onSaveRef.current();
    }, SAVE_DEBOUNCE_MS);
  }

  function updateSelectionPopover(editor: Editor): void {
    const sel = editor.state.selection;
    if (sel.empty) {
      setSelectionPopover(null);
      return;
    }
    const text = editor.state.doc.textBetween(sel.from, sel.to, " ").trim();
    if (text.length === 0) {
      setSelectionPopover(null);
      return;
    }
    try {
      // 1) selection 의 실제 viewport rect — DOM Selection API.
      //    ProseMirror coordsAtPos 보다 정확하다 (browser 가 직접 계산한
      //    selection visible rect).  본문 column 안에 무조건 위치.
      const winSel = globalThis.getSelection?.();
      let selLeft = 0,
        selRight = 0,
        selTop = 0,
        selBottom = 0;
      let usedDomRange = false;
      if (winSel && winSel.rangeCount > 0) {
        const range = winSel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        // 빈 rect (0,0,0,0) 이면 fallback.
        if (rect.width > 0 || rect.height > 0) {
          selLeft = rect.left;
          selRight = rect.right;
          selTop = rect.top;
          selBottom = rect.bottom;
          usedDomRange = true;
        }
      }
      if (!usedDomRange) {
        // fallback — ProseMirror 좌표.
        const head = editor.view.coordsAtPos(sel.head);
        const anchorC = editor.view.coordsAtPos(sel.anchor);
        selLeft = Math.min(head.left, anchorC.left);
        selRight = Math.max(head.right, anchorC.right);
        selTop = Math.min(head.top, anchorC.top);
        selBottom = Math.max(head.bottom, anchorC.bottom);
      }

      // 2) editor DOM 의 viewport 기준 rect — popover clamp 한계.
      const editorRect = editor.view.dom.getBoundingClientRect();
      // 디버그: 사용자 보고에 따라 menu 가 사이드바에 떴는데 trigger 는 본문
      // 안. anchor 와 editor rect 값이 실제로 무엇인지 한 번 dump.
      // eslint-disable-next-line no-console
      console.log("[SelectionPopover] anchor calc", {
        selectionRect: {
          left: selLeft,
          right: selRight,
          top: selTop,
          bottom: selBottom,
        },
        editorRect: {
          left: editorRect.left,
          right: editorRect.right,
          top: editorRect.top,
          bottom: editorRect.bottom,
        },
        usedDomRange,
        winInner: { w: window.innerWidth, h: window.innerHeight },
      });
      setSelectionPopover({
        text,
        range: { from: sel.from, to: sel.to },
        anchor: {
          x: selRight,
          y: selTop,
          bottomY: selBottom,
          editorLeft: editorRect.left,
          editorRight: editorRect.right,
          // 선택 영역의 좌측 — 메뉴는 여기에서부터 펼치면 본문 안에 무조건.
          selectionLeft: selLeft,
        },
      });
    } catch {
      /* layout 미완성 — 무시 */
    }
  }

  // editorRegistry 등록 / 해제.
  useEffect(() => {
    if (!editor) return;
    editorRegistry.register(docId, editor, () => {
      const md = htmlToMarkdown(editor.getHTML());
      onChangeRef.current(md);
      setWordCount(countChars(md));
      scheduleSave();
    });
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      editorRegistry.unregister(docId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docId]);

  // 외부에서 body 가 통째로 바뀐 경우 (다른 장면 전환 등) 동기화.
  // useEditor 의 [docId] dep 으로 이미 새 인스턴스가 생기지만, 같은 docId 안에서
  // 외부 dispatch (voiceRewriter, SnippetPanel) 결과는 register 의 flush 가 처리.
  useEffect(() => {
    if (!editor) return;
    const desired = draft ?? body;
    const current = htmlToMarkdown(editor.getHTML());
    if (current === desired) return;
    // setContent 는 history 를 초기화하지 않게 emitUpdate=false 로.
    editor.commands.setContent(markdownToHtml(desired), { emitUpdate: false });
    setWordCount(countChars(desired));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, editor]);

  // 다크/폰트 클래스 변경.
  const themeClass = useMemo(() => {
    return [
      "rich-editor-host",
      dark ? "rich-editor-host--dark" : "rich-editor-host--light",
      bodyFont === "serif" ? "rich-editor-host--serif" : "rich-editor-host--sans",
    ].join(" ");
  }, [dark, bodyFont]);

  return (
    <div className={themeClass}>
      <EditorToolbar docId={docId} />
      <div className="rich-editor-scroll">
        <EditorContent
          editor={editor}
          className="rich-editor-cm"
          data-testid={`md-editor-${docId}`}
        />
      </div>
      <div className="md-editor-badge">{wordCount.toLocaleString()}자</div>
      <SelectionPopover
        docId={docId}
        selection={selectionPopover?.text ?? ""}
        selectionRange={selectionPopover?.range ?? null}
        anchor={selectionPopover?.anchor ?? null}
        onClose={() => setSelectionPopover(null)}
      />
    </div>
  );
}
