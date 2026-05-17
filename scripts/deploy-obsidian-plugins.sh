#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_ROOT="${OBSIDIAN_PLUGIN_INSTALL_ROOT:-$HOME/.local/obsidian-plugins}"
VAULT_PLUGINS_DIR="${OBSIDIAN_VAULT_PLUGINS_DIR:-/Users/futurewave/Library/CloudStorage/GoogleDrive-futurewave@gmail.com/내 드라이브/03 Resources/옵시디언 볼트/futurewave/.obsidian/plugins}"

usage() {
  cat <<'EOF'
Usage:
  pnpm run deploy
  pnpm plugins:deploy
  pnpm deploy:ai-manuscript
  pnpm deploy:zettel

Environment overrides:
  OBSIDIAN_PLUGIN_INSTALL_ROOT=/path/to/shared/install/root
  OBSIDIAN_VAULT_PLUGINS_DIR=/path/to/vault/.obsidian/plugins
EOF
}

copy_plugin_files() {
  local plugin_id="$1"
  local package_dir="$2"
  local install_dir="$INSTALL_ROOT/$plugin_id"

  mkdir -p "$install_dir"
  cp "$ROOT_DIR/$package_dir/main.js" "$install_dir/main.js"
  cp "$ROOT_DIR/$package_dir/manifest.json" "$install_dir/manifest.json"

  if [[ -f "$ROOT_DIR/$package_dir/styles.css" ]]; then
    cp "$ROOT_DIR/$package_dir/styles.css" "$install_dir/styles.css"
  fi

  if [[ -d "$VAULT_PLUGINS_DIR" ]]; then
    ln -sfn "$install_dir" "$VAULT_PLUGINS_DIR/$plugin_id"
  fi

  echo "Deployed $plugin_id -> $install_dir"
}

build_ai_manuscript() {
  pnpm --dir "$ROOT_DIR" --filter @ai-manuscript-studio/core build
  pnpm --dir "$ROOT_DIR" --filter @ai-manuscript-studio/obsidian-plugin build
}

build_zettel_connect() {
  pnpm --dir "$ROOT_DIR" --filter zettel-connect build
}

deploy_ai_manuscript() {
  build_ai_manuscript
  copy_plugin_files "ai-manuscript-studio" "packages/obsidian-plugin"
}

deploy_zettel_connect() {
  build_zettel_connect
  copy_plugin_files "zettel-connect" "packages/zettel-connect"
}

case "${1:-all}" in
  all)
    deploy_ai_manuscript
    deploy_zettel_connect
    ;;
  ai-manuscript-studio|ai-manuscript)
    deploy_ai_manuscript
    ;;
  zettel-connect|zettel)
    deploy_zettel_connect
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
