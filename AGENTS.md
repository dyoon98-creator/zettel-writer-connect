# Codex Project Notes

This repository is the canonical source tree for AI Manuscript Studio.

## Source Layout

- Monorepo root: `/Users/futurewave/Documents/dev/obsidian-plugins`
- AI Manuscript Studio plugin: `packages/obsidian-plugin`
- Shared AI Manuscript Studio core: `packages/core`
- Legacy Tauri app: `apps/desktop`

Zettel Connect's canonical source is `/Users/dongchanyoon/Documents/Work/Projects/13.zettel-connect` and must not be built or deployed from this repository.

The old path `/Users/futurewave/Documents/dev/ai-manuscript-studio` is not the working source path.

## Runtime Layout

- Each Obsidian vault keeps a real `.obsidian/plugins/<plugin-id>/` directory for its own `data.json` and `cache/` state.
- `main.js`, `manifest.json`, and `styles.css` inside that directory are symbolic links to this repository's built plugin artifacts.
- Build outputs are `main.js`, `manifest.json`, and `styles.css`.

Do not edit build outputs directly. Edit source files and run deploy.

## Commands

```bash
pnpm run deploy
pnpm deploy:ai-manuscript
pnpm --filter @ai-manuscript-studio/obsidian-plugin test
pnpm --filter @ai-manuscript-studio/core test
```

## Git

- Remote: `https://github.com/vibelabs-web/zettel-writer-connect.git`
- Main development branch for the Obsidian monolith: `feat/plugin-monolith`
