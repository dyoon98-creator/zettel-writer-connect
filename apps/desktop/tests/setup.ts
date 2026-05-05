// 테스트 환경 셋업.
// - @testing-library/jest-dom matchers 등록
// - matchMedia / ResizeObserver 등 jsdom에 빠진 API 폴리필
// - Tauri @tauri-apps/api는 import만 해도 IPC를 시도하므로 vault/notice 어댑터를
//   테스트 안에서 mock한다. tests/mocks.ts 참고.

import "@testing-library/jest-dom/vitest";

// jsdom에 없는 ResizeObserver 폴리필 (CodeMirror가 사용).
class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserver;

if (typeof window !== "undefined" && !window.matchMedia) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// localStorage가 없을 가능성은 jsdom에서 거의 없지만 안전망.
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}
