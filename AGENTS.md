# Codex Project Notes

This repository is the canonical source tree for Futurewave Obsidian plugins.

## Source Layout

- Monorepo root: `/Users/futurewave/Documents/dev/obsidian-plugins`
- AI Manuscript Studio plugin: `packages/obsidian-plugin`
- Zettel Connect plugin: `packages/zettel-connect`
- Shared AI Manuscript Studio core: `packages/core`
- Legacy Tauri app: `apps/desktop`

The old path `/Users/futurewave/Documents/dev/ai-manuscript-studio` is not the working source path.

## Runtime Layout

- Shared plugin install root: `/Users/futurewave/.local/obsidian-plugins`
- Obsidian vault plugin folders are symlinks to that shared install root.
- Build outputs are `main.js`, `manifest.json`, and `styles.css`.

Do not edit build outputs directly. Edit source files and run deploy.

## Commands

```bash
pnpm run deploy
pnpm deploy:ai-manuscript
pnpm deploy:zettel
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/core test
pnpm --filter zettel-connect build
```

## Git

- Remote: `https://github.com/vibelabs-web/zettel-writer-connect.git`
- Main development branch for the Obsidian monolith: `feat/plugin-monolith`
