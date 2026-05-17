// tauriShims/webviewWindow.ts — `@tauri-apps/api/webviewWindow` stub.
//
// desktop 의 BinderPane 이 외부 native drag-drop (Tauri webview 전용) 을 위해
// 사용. 옵시디언 환경에서는 HTML5 dataTransfer 가 정상 동작하므로 native
// drag-drop 구독 자체가 의미 없다. listen 호출은 빈 unlisten, 위치/dpr 함수는
// 합리적 기본값을 돌려준다.

export interface DragDropEvent {
  payload: {
    type: "enter" | "over" | "drop" | "leave" | string;
    paths: string[];
    position: { x: number; y: number };
  };
}

export interface WebviewWindow {
  scaleFactor: () => Promise<number>;
  innerPosition: () => Promise<{ x: number; y: number }>;
  outerPosition: () => Promise<{ x: number; y: number }>;
  listen: <T>(
    event: string,
    handler: (e: { payload: T }) => void,
  ) => Promise<() => void>;
  onDragDropEvent: (
    handler: (event: DragDropEvent) => void,
  ) => Promise<() => void>;
}

export function getCurrentWebviewWindow(): WebviewWindow {
  return {
    async scaleFactor() {
      return globalThis.devicePixelRatio || 1;
    },
    async innerPosition() {
      return { x: 0, y: 0 };
    },
    async outerPosition() {
      return { x: 0, y: 0 };
    },
    async listen<T>(
      _event: string,
      _handler: (e: { payload: T }) => void,
    ): Promise<() => void> {
      return () => {
        /* no-op */
      };
    },
    async onDragDropEvent(
      _handler: (event: DragDropEvent) => void,
    ): Promise<() => void> {
      // 옵시디언 환경에서는 HTML5 dataTransfer 가 동작하므로 native 구독 불필요.
      return () => {
        /* no-op */
      };
    },
  };
}
