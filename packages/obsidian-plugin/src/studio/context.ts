// context.ts — studio React tree 가 옵시디언 plugin 인스턴스에 접근할 수 있도록
// module-level singleton 으로 보관. ManuscriptStudioView 가 mount 시
// initStudioContext(plugin) 을 호출하고, shim 어댑터들은 getStudioContext()
// 로 plugin 을 꺼내 쓴다.
//
// React Context API 대신 module singleton 을 쓰는 이유:
// - 기존 desktop 코드가 `import { tauriVaultAdapter } from "../vaultAdapter"`
//   처럼 module-top-level singleton 을 가정한다. 옵시디언 plugin 도 한 vault 당
//   한 인스턴스라 singleton 가정이 깨지지 않는다.

import type AIManuscriptStudioPlugin from "../main";

let _plugin: AIManuscriptStudioPlugin | null = null;

export function initStudioContext(plugin: AIManuscriptStudioPlugin): void {
  _plugin = plugin;
}

export function disposeStudioContext(): void {
  _plugin = null;
}

export function getStudioPlugin(): AIManuscriptStudioPlugin {
  if (!_plugin) {
    throw new Error(
      "Studio context 가 초기화되지 않았습니다. ManuscriptStudioView 가 먼저 마운트되어야 합니다.",
    );
  }
  return _plugin;
}
