// EditorToolbar.tsx — Tiptap 리치 에디터 위 툴바.
//
// 버튼 클릭 → editor.chain().toggleX().run() 으로 즉시 반영.
// active 상태(editor.isActive)에 따라 버튼 강조.

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

import * as editorRegistry from "./editorRegistry";

export interface EditorToolbarProps {
  docId: string;
}

export function EditorToolbar({ docId }: EditorToolbarProps): JSX.Element {
  const [, force] = useState(0);

  // 에디터 등록/언등록과 selection 변화 감지하여 active 상태 갱신.
  useEffect(() => {
    const unsub = editorRegistry.subscribe(() => force((n) => n + 1));
    return unsub;
  }, []);

  // selection 의 마지막 *비어있지 않은* range 를 항상 ref 에 유지 (font-size select 의 OS dropdown
  // 이 열리면서 editor 가 blur 되어 selection 이 풀리는 케이스를 위해).
  const capturedRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const editor = editorRegistry.get(docId);
    if (!editor) return;
    const handler = (): void => {
      const sel = editor.state.selection;
      if (!sel.empty) {
        capturedRangeRef.current = { from: sel.from, to: sel.to };
      }
      force((n) => n + 1);
    };
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  });

  const editor = editorRegistry.get(docId);

  const cmd = (apply: (e: Editor) => void): void => {
    if (!editor) return;
    apply(editor);
    editor.commands.focus();
  };

  const isActive = (name: string, attrs?: Record<string, unknown>): boolean => {
    if (!editor) return false;
    return editor.isActive(name, attrs);
  };

  const insertLink = (): void => {
    if (!editor) return;
    const url = window.prompt("링크 URL 을 입력하세요", "https://");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  // 현재 selection 의 fontSize attribute 확인. textStyle mark 의 attrs 참조.
  const currentFontSize = (): string => {
    if (!editor) return "";
    const attrs = editor.getAttributes("textStyle");
    return (attrs?.fontSize as string) ?? "";
  };
  // setFontSize: capturedRangeRef 가 살아 있는 마지막 selection 을 가지고 있다고 가정.
  // OS dropdown 이 열린 동안 editor 가 blur 되어도 ref 의 마지막 range 로 복원한다.
  const setFontSize = (size: string): void => {
    if (!editor) return;
    const range = capturedRangeRef.current;
    const sel = editor.state.selection;
    const from = range?.from ?? sel.from;
    const to = range?.to ?? sel.to;
    if (from === to) {
      // 빈 selection — fontSize 는 의미 없음. 무시.
      return;
    }
    if (size === "") {
      editor.chain().setTextSelection({ from, to }).unsetFontSize().run();
    } else {
      editor.chain().setTextSelection({ from, to }).setFontSize(size).run();
    }
    // 복원된 selection 유지하기 위해 focus 는 setTextSelection 이후에 따로.
    editor.commands.focus();
  };

  return (
    <div className="ed-toolbar" role="toolbar" aria-label="에디터 툴바">
      <ToolbarBtn
        label="굵게 (Cmd+B)"
        active={isActive("bold")}
        onClick={() => cmd((e) => e.chain().focus().toggleBold().run())}
      >
        <b>B</b>
      </ToolbarBtn>
      <ToolbarBtn
        label="기울임 (Cmd+I)"
        active={isActive("italic")}
        onClick={() => cmd((e) => e.chain().focus().toggleItalic().run())}
      >
        <i>I</i>
      </ToolbarBtn>
      <ToolbarBtn
        label="취소선"
        active={isActive("strike")}
        onClick={() => cmd((e) => e.chain().focus().toggleStrike().run())}
      >
        <span style={{ textDecoration: "line-through" }}>S</span>
      </ToolbarBtn>
      <ToolbarBtn
        label="인라인 코드"
        active={isActive("code")}
        onClick={() => cmd((e) => e.chain().focus().toggleCode().run())}
      >
        <code>{"<>"}</code>
      </ToolbarBtn>

      <span className="ed-toolbar-sep" aria-hidden />

      <ToolbarBtn
        label="제목 1 — 문단 전체를 큰 제목 블록으로 (단어만 키우려면 옆 '크기' select 사용)"
        active={isActive("heading", { level: 1 })}
        onClick={() =>
          cmd((e) => e.chain().focus().toggleHeading({ level: 1 }).run())
        }
      >
        H1
      </ToolbarBtn>
      <ToolbarBtn
        label="제목 2 — 문단 전체"
        active={isActive("heading", { level: 2 })}
        onClick={() =>
          cmd((e) => e.chain().focus().toggleHeading({ level: 2 }).run())
        }
      >
        H2
      </ToolbarBtn>
      <ToolbarBtn
        label="제목 3 — 문단 전체"
        active={isActive("heading", { level: 3 })}
        onClick={() =>
          cmd((e) => e.chain().focus().toggleHeading({ level: 3 }).run())
        }
      >
        H3
      </ToolbarBtn>

      <span className="ed-toolbar-sep" aria-hidden />

      <ToolbarBtn
        label="글머리 기호"
        active={isActive("bulletList")}
        onClick={() => cmd((e) => e.chain().focus().toggleBulletList().run())}
      >
        ＊
      </ToolbarBtn>
      <ToolbarBtn
        label="번호 매기기"
        active={isActive("orderedList")}
        onClick={() => cmd((e) => e.chain().focus().toggleOrderedList().run())}
      >
        1.
      </ToolbarBtn>
      <ToolbarBtn
        label="인용"
        active={isActive("blockquote")}
        onClick={() => cmd((e) => e.chain().focus().toggleBlockquote().run())}
      >
        ❝
      </ToolbarBtn>
      <ToolbarBtn label="링크" active={isActive("link")} onClick={insertLink}>
        🔗
      </ToolbarBtn>

      <span className="ed-toolbar-sep" aria-hidden />

      <select
        className="ed-toolbar-select"
        title="폰트 크기 (선택 영역)"
        value={currentFontSize()}
        onChange={(e) => setFontSize(e.target.value)}
      >
        <option value="">크기</option>
        <option value="12px">12</option>
        <option value="13px">13</option>
        <option value="14px">14</option>
        <option value="15px">15</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="20px">20</option>
        <option value="24px">24</option>
        <option value="32px">32</option>
        <option value="40px">40</option>
        <option value="48px">48</option>
      </select>

      <span className="ed-toolbar-sep" aria-hidden />

      <ToolbarBtn
        label="되돌리기 (Cmd+Z)"
        onClick={() => cmd((e) => e.chain().focus().undo().run())}
      >
        ↶
      </ToolbarBtn>
      <ToolbarBtn
        label="다시 (Cmd+Shift+Z)"
        onClick={() => cmd((e) => e.chain().focus().redo().run())}
      >
        ↷
      </ToolbarBtn>
    </div>
  );
}

interface ToolbarBtnProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}

function ToolbarBtn({ label, onClick, active, children }: ToolbarBtnProps): JSX.Element {
  return (
    <button
      type="button"
      className={"ed-toolbar-btn" + (active ? " ed-toolbar-btn--active" : "")}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
