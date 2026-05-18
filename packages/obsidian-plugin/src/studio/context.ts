// context.ts — studio React tree 가 옵시디언 plugin 인스턴스에 접근할 수 있도록
// module-level singleton 으로 보관. ManuscriptStudioView 가 mount 시
// initStudioContext(plugin) 을 호출하고, shim 어댑터들은 getStudioPlugin()
// 로 plugin 을 꺼내 쓴다.
//
// React Context API 대신 module singleton 을 쓰는 이유:
// - 기존 desktop 코드가 `import { tauriVaultAdapter } from "../vaultAdapter"`
//   처럼 module-top-level singleton 을 가정한다. 옵시디언 plugin 도 한 vault 당
//   한 인스턴스라 singleton 가정이 깨지지 않는다.
//
// Ref-counting: 여러 ManuscriptStudioView 탭이 동시에 열릴 수 있다.
// 한 탭을 닫아도 다른 탭이 살아 있는 한 _plugin 을 null 로 만들지 않는다.
// initStudioContext() 는 release 함수를 반환 — 해당 view 의 onClose 에서만 호출.

import type AIManuscriptStudioPlugin from "../main";

let _plugin: AIManuscriptStudioPlugin | null = null;
let _refCount = 0;

/**
 * ManuscriptStudioView.onOpen() 에서 호출. 반환된 release 함수를
 * onClose() 에서 호출하여 이 view 의 hold 를 해제한다.
 * 모든 view 가 닫히면 (_refCount === 0) _plugin 이 null 로 소거된다.
 */
export function initStudioContext(
  plugin: AIManuscriptStudioPlugin,
): () => void {
  _plugin = plugin;
  _refCount++;
  let released = false;
  return function releaseStudioContext(): void {
    if (released) return;
    released = true;
    _refCount = Math.max(0, _refCount - 1);
    if (_refCount === 0) {
      _plugin = null;
    }
  };
}

export function getStudioPlugin(): AIManuscriptStudioPlugin {
  if (!_plugin) {
    throw new Error(
      "Studio context 가 초기화되지 않았습니다. ManuscriptStudioView 가 먼저 마운트되어야 합니다.",
    );
  }
  return _plugin;
}

/** @internal 테스트 전용 — 프로덕션 코드에서 직접 호출 금지. */
export function _resetContextForTests(): void {
  _plugin = null;
  _refCount = 0;
}
