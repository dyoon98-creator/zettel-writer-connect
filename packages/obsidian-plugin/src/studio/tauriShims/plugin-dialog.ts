// tauriShims/plugin-dialog.ts — `@tauri-apps/plugin-dialog` 의 옵시디언용 stub.
//
// desktop 은 voice 폴더 선택 등에서 OS native file picker 를 띄운다.
// 옵시디언 환경에서는 vault 내부 폴더만 쓰도록 단순화 — 따라서 file picker
// 호출은 안내 메시지와 함께 null 반환.

export interface OpenDialogOptions {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export async function open(
  _opts?: OpenDialogOptions,
): Promise<string | string[] | null> {
  // 옵시디언 환경에서는 vault 내부 파일 선택은 Obsidian.SuggestModal /
  // vault picker 로 처리하므로 native dialog 는 호출 site 가 거의 없다.
  // 호출되면 안내 후 null. (사용자 흐름 차단 방지.)
  console.warn(
    "[tauriShims/plugin-dialog] open() 은 옵시디언 환경에서 미지원입니다.",
  );
  return null;
}
