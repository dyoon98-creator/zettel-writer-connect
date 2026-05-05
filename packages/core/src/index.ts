// index.ts — Default re-export of `@ai-manuscript-studio/core`.
//
// Phase D부터 패키지에는 두 진입점(`./browser`, `./node`)이 있다.
// 이 파일은 둘을 합친 default 표면이며, 내부 테스트와 옵시디언 플러그인 (Node 환경)
// 가 그대로 import 할 수 있도록 유지된다. Tauri 데스크톱 렌더러는 package.json의
// `exports` 맵을 통해 자동으로 `./browser`로 라우팅된다.

export * from "./node";
