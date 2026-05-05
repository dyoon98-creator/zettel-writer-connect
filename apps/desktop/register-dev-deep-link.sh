#!/usr/bin/env bash
# register-dev-deep-link.sh
#
# 첫 빌드 후 dev 빌드된 앱 번들을 ai-manuscript-studio:// 스킴 핸들러로 등록.
# Phase H에서 정식 packaged app으로 대체될 임시 스크립트.
#
# Usage:
#   ./register-dev-deep-link.sh                # auto-detect
#   ./register-dev-deep-link.sh /path/to/app   # 특정 .app 강제 지정 (macOS)
#
# Linux: ~/.local/share/applications/ai-manuscript-studio-dev.desktop 생성 + update-desktop-database
# macOS: lsregister로 dev .app 등록
# Windows: 안내만 출력 (HKCR 수동 또는 PowerShell 권한 필요)

set -euo pipefail

SCHEME="ai-manuscript-studio"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)" in
  Darwin)
    APP_PATH="${1:-}"
    if [[ -z "$APP_PATH" ]]; then
      # Tauri 2 dev build 출력 경로(가능성).
      CANDIDATES=(
        "$SCRIPT_DIR/src-tauri/target/debug/bundle/macos/AI 원고실.app"
        "$SCRIPT_DIR/src-tauri/target/debug/AI 원고실.app"
      )
      for c in "${CANDIDATES[@]}"; do
        if [[ -d "$c" ]]; then APP_PATH="$c"; break; fi
      done
    fi
    if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
      echo "[X] dev 앱 번들을 찾지 못했습니다. 먼저 'pnpm tauri:dev' 또는 'pnpm tauri:build'를 한 번 실행해주세요."
      echo "    수동 지정: $0 \"/full/path/to/AI 원고실.app\""
      exit 1
    fi
    LSREG="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"
    "$LSREG" -f "$APP_PATH"
    echo "[OK] $SCHEME:// 핸들러로 등록되었습니다: $APP_PATH"
    echo "     테스트: open \"ai-manuscript-studio://open?vault=/tmp/vault&project=demo\""
    ;;

  Linux)
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    DESKTOP_FILE="$DESKTOP_DIR/ai-manuscript-studio-dev.desktop"
    BIN_PATH="${1:-$SCRIPT_DIR/src-tauri/target/debug/ai-manuscript-studio}"
    if [[ ! -x "$BIN_PATH" ]]; then
      echo "[!] $BIN_PATH 가 없습니다. 'pnpm tauri:dev' 한 번 실행 후 다시 시도하세요."
      echo "    그래도 .desktop 파일은 작성합니다."
    fi
    cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=AI 원고실 (dev)
Exec=$BIN_PATH %u
MimeType=x-scheme-handler/$SCHEME;
Categories=Office;
Terminal=false
NoDisplay=false
EOF
    if command -v update-desktop-database >/dev/null 2>&1; then
      update-desktop-database "$DESKTOP_DIR" || true
    fi
    if command -v xdg-mime >/dev/null 2>&1; then
      xdg-mime default ai-manuscript-studio-dev.desktop x-scheme-handler/$SCHEME || true
    fi
    echo "[OK] $DESKTOP_FILE 작성됨."
    ;;

  *)
    echo "[!] Windows에서는 PowerShell로 HKCR/HKCU\\Software\\Classes\\$SCHEME 키를 직접 등록하세요."
    echo "    예시:"
    echo "    New-Item -Path \"HKCU:\\Software\\Classes\\$SCHEME\" -Force"
    echo "    Set-ItemProperty -Path \"HKCU:\\Software\\Classes\\$SCHEME\" -Name \"URL Protocol\" -Value \"\""
    echo "    New-Item -Path \"HKCU:\\Software\\Classes\\$SCHEME\\shell\\open\\command\" -Force"
    echo "    Set-ItemProperty -Path \"HKCU:\\Software\\Classes\\$SCHEME\\shell\\open\\command\" -Name \"(default)\" -Value '\"C:\\path\\to\\ai-manuscript-studio.exe\" \"%1\"'"
    ;;
esac
