// electronBridge.ts — 옵시디언 desktop 은 Electron renderer 에서 동작하므로
// `window.require` 또는 globalThis 의 `require` 가 Node 모듈에 접근 가능하다.
// 모바일 / 브라우저 환경에서는 `require` 가 없어 안전하게 null 을 반환한다.
//
// 모든 Node-only / Electron-only 어댑터는 이 헬퍼를 거쳐 모듈을 불러온다.

type RequireFn = (moduleName: string) => unknown;

function getRequire(): RequireFn | null {
  // 1) window.require — Electron preload 기본
  const w = globalThis as unknown as { require?: RequireFn };
  if (typeof w.require === "function") return w.require;
  // 2) Electron renderer 의 일부 컨텍스트에선 globalThis.require 가 노출됨
  if (typeof (globalThis as { require?: unknown }).require === "function") {
    return (globalThis as { require: RequireFn }).require;
  }
  return null;
}

export function electronAvailable(): boolean {
  return getRequire() !== null;
}

export function electronRequire<T = unknown>(moduleName: string): T | null {
  const req = getRequire();
  if (!req) return null;
  try {
    return req(moduleName) as T;
  } catch {
    return null;
  }
}
