#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_PLUGINS_DIR="${OBSIDIAN_VAULT_PLUGINS_DIR:-}"

usage() {
  cat <<'EOF'
Usage:
  pnpm run deploy
  pnpm plugins:deploy
  pnpm deploy:ai-manuscript

Required environment:
  OBSIDIAN_VAULT_PLUGINS_DIR=/path/to/vault/.obsidian/plugins
EOF
}

link_plugin_bundle() {
  local plugin_id="$1"
  local package_dir="$2"
  local plugin_dir="$VAULT_PLUGINS_DIR/$plugin_id"
  local asset source destination temporary

  if [[ -L "$plugin_dir" ]]; then
    echo "Refusing to replace plugin-directory symlink: $plugin_dir" >&2
    echo "Migrate it once to a real directory that keeps data.json/cache, then rerun deploy." >&2
    return 2
  fi
  mkdir -p "$plugin_dir"

  for asset in main.js manifest.json styles.css; do
    source="$ROOT_DIR/$package_dir/$asset"
    destination="$plugin_dir/$asset"
    [[ -f "$source" ]] || continue

    if [[ -e "$destination" && ! -L "$destination" ]]; then
      echo "Refusing to replace regular bundle file: $destination" >&2
      echo "Migrate it once to a symbolic link before rerunning deploy." >&2
      return 2
    fi
    temporary="$plugin_dir/.$asset.link-$$"
    rm -f "$temporary"
    ln -s "$source" "$temporary"
    mv -f "$temporary" "$destination"
  done

  echo "Linked $plugin_id bundle -> $plugin_dir"
}

build_ai_manuscript() {
  pnpm --dir "$ROOT_DIR" --filter @ai-manuscript-studio/core build
  pnpm --dir "$ROOT_DIR" --filter @ai-manuscript-studio/obsidian-plugin build
}

deploy_ai_manuscript() {
  if [[ -z "$VAULT_PLUGINS_DIR" ]]; then
    echo "OBSIDIAN_VAULT_PLUGINS_DIR is required." >&2
    exit 2
  fi
  build_ai_manuscript
  link_plugin_bundle "ai-manuscript-studio" "packages/obsidian-plugin"
}

case "${1:-all}" in
  all)
    deploy_ai_manuscript
    ;;
  ai-manuscript-studio|ai-manuscript)
    deploy_ai_manuscript
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
