import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

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
  },
  jsx: "automatic",
  jsxDev: !prod,
  resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"],
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
