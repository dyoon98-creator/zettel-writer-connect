// fontSizeExtension.ts — Tiptap TextStyle 위에 inline fontSize 속성을 더한 mark 확장.
//
// Scrivener 처럼 사용자가 선택 영역의 폰트 크기를 직접 지정 (12/14/16/18/24 등).
// 마크다운 표준에 폰트 사이즈가 없으므로 저장 시 `<span style="font-size:18px">…</span>`
// HTML 로 보존된다. 옵시디언은 인라인 HTML 도 렌더하므로 호환 됨.
//
// 명령:
//   editor.chain().focus().setFontSize("18px").run()
//   editor.chain().focus().unsetFontSize().run()

import { Extension } from "@tiptap/react";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.fontSize ? element.style.fontSize : null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    type ChainFn = () => { setMark: (n: string, a: Record<string, unknown>) => { run: () => boolean } };
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: { chain: ChainFn }) => {
          return chain().setMark("textStyle", { fontSize: size }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }: { chain: ChainFn }) => {
          // TipTap v3.22 의 @tiptap/extension-text-style 에는 removeEmptyTextStyle() 명령이 없다.
          // setMark 으로 fontSize=null 만 마킹해도 비어 있는 textStyle mark 는 다음 변경 시 자동 정리된다.
          return chain().setMark("textStyle", { fontSize: null }).run();
        },
    };
  },
});
