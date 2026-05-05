import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tauri 권장 설정 — devUrl(5173) 고정, HMR 포트 분리, env 격리.
// https://tauri.app/v2/guides/develop/vite-config
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    // `@ai-manuscript-studio/core`는 package.json `exports` 맵의 `browser`
    // 조건을 통해 `src/browser.ts`로 자동 라우팅된다 (Vite는 기본적으로
    // browser condition을 적용). 더 이상 alias로 우회할 필요가 없다.
    conditions: ["browser", "import", "module", "default"],
  },
  // 사용자 친화: localhost 외부에서도 접속 가능 (Tauri가 https 라우팅 안 함)
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      port: 5174,
    },
    watch: {
      // Rust 소스는 Cargo가 보고 있으므로 Vite 워처에서 제외.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: ["es2022", "chrome105", "safari13"],
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: "dist",
    emptyOutDir: true,
  },
}));
