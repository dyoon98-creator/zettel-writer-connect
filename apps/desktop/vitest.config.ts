import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 테스트 환경은 Node지만 React 코드는 browser 컨디션에서 동작해야 한다.
    // package.json `exports.browser`를 통해 core가 browser.ts로 라우팅된다.
    conditions: ["browser", "import", "module", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
