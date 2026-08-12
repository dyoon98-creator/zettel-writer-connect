# AI Manuscript Studio Layout

This repository is the canonical source tree for AI Manuscript Studio.

## Source

```text
/Users/futurewave/Documents/dev/obsidian-plugins/
├─ packages/obsidian-plugin/   # ai-manuscript-studio community plugin
├─ packages/core/              # shared AI Manuscript Studio business logic
└─ apps/desktop/               # legacy Tauri app, kept for reference
```

The old source path `/Users/futurewave/Documents/dev/ai-manuscript-studio/`
is no longer the canonical working directory.

## Obsidian Runtime

Obsidian loads built plugin files from:

```text
<vault>/.obsidian/plugins/<plugin-id>/
├─ main.js
├─ manifest.json
└─ styles.css
```

For local development, each vault keeps its plugin directory as a real
directory so `data.json` and `cache/` remain vault-specific. Only the three
bundle files (`main.js`, `manifest.json`, `styles.css`) are symbolic links to
the corresponding build artifacts in `packages/obsidian-plugin/`.

Do not edit those build artifacts by hand; edit source files and build.

## Commands

From `/Users/futurewave/Documents/dev/obsidian-plugins`:

```bash
pnpm run deploy
```

Builds and deploys AI Manuscript Studio.

```bash
pnpm deploy:ai-manuscript
```

Builds and deploys AI Manuscript Studio explicitly.

After deploy, reload Obsidian's community plugins or restart Obsidian.
