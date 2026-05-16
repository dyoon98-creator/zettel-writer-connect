import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `.md?raw` import 를 fs.readFileSync 로 inline. Vite raw-query 흉내.
const mdRawPlugin = {
  name: "md-raw",
  setup(build) {
    build.onResolve({ filter: /\.md\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, "")),
      namespace: "md-raw",
    }));
    build.onLoad({ filter: /.*/, namespace: "md-raw" }, async (args) => ({
      contents: fs.readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

// Tauri 패키지를 옵시디언 stub 으로 alias.
const tauriAlias = {
  "@tauri-apps/api/core": path.resolve(
    __dirname,
    "src/studio/tauriShims/core.ts",
  ),
  "@tauri-apps/api/event": path.resolve(
    __dirname,
    "src/studio/tauriShims/event.ts",
  ),
  "@tauri-apps/api/webviewWindow": path.resolve(
    __dirname,
    "src/studio/tauriShims/webviewWindow.ts",
  ),
  "@tauri-apps/plugin-fs": path.resolve(
    __dirname,
    "src/studio/tauriShims/plugin-fs.ts",
  ),
  "@tauri-apps/plugin-dialog": path.resolve(
    __dirname,
    "src/studio/tauriShims/plugin-dialog.ts",
  ),
  "@tauri-apps/plugin-deep-link": path.resolve(
    __dirname,
    "src/studio/tauriShims/plugin-deep-link.ts",
  ),
};

const banner = `/*
AI 원고실 v2 — Obsidian monolith plugin (인덱서 + 작업실 view).
이 파일은 esbuild가 자동 생성한 빌드 산출물입니다. 직접 수정하지 마세요.
*/`;

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
  loader: {
    ".css": "text",
    ".md": "text",
  },
  jsx: "automatic",
  jsxDev: !prod,
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"],
  alias: tauriAlias,
  plugins: [mdRawPlugin],
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
