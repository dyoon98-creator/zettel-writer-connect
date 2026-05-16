# Obsidian Plugins Layout

This repository is the canonical source tree for Futurewave Obsidian plugins.

## Source

```text
/Users/futurewave/Documents/dev/obsidian-plugins/
├─ packages/obsidian-plugin/   # ai-manuscript-studio community plugin
├─ packages/zettel-connect/    # zettel-connect community plugin
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

For this machine, vault plugin folders are symlinked to:

```text
~/.local/obsidian-plugins/ai-manuscript-studio/
~/.local/obsidian-plugins/zettel-connect/
```

Do not edit files under `~/.local/obsidian-plugins/` by hand. They are deploy
outputs.

## Commands

From `/Users/futurewave/Documents/dev/obsidian-plugins`:

```bash
pnpm run deploy
```

Builds and deploys both plugins.

```bash
pnpm deploy:ai-manuscript
pnpm deploy:zettel
```

Builds and deploys only one plugin.

After deploy, reload Obsidian's community plugins or restart Obsidian.
