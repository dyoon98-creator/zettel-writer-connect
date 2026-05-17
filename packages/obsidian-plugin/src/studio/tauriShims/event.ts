// tauriShims/event.ts — `@tauri-apps/api/event` 의 옵시디언용 stub.
//
// desktop 의 listen / emit 은 Rust 백엔드의 이벤트 시스템을 가정한다.
// 옵시디언 환경에서는 streamingHandle / vault watch 가 모두 직접 콜백으로
// 처리되므로 listener 등록 시도는 안전한 no-op 으로 무시한다.

export type UnlistenFn = () => void;

export interface Event<T> {
  event: string;
  id: number;
  payload: T;
}

export async function listen<T>(
  _event: string,
  _handler: (e: Event<T>) => void,
): Promise<UnlistenFn> {
  return () => {
    /* no-op */
  };
}

export async function emit<T>(_event: string, _payload?: T): Promise<void> {
  /* no-op */
}
