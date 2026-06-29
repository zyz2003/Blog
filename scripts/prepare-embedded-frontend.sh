#!/bin/bash
set -euo pipefail

PROJECT_NAME="anheyu-app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="${FRONTEND_DIR:-$PROJECT_ROOT/frontend}"
EMBEDDED_ROOT="${EMBEDDED_ROOT:-$PROJECT_ROOT/internal/frontend/embedded_assets/runtime}"
SOURCE_DIR="$FRONTEND_DIR/.next/standalone"
STATIC_DIR="$FRONTEND_DIR/.next/static"
PUBLIC_DIR="$FRONTEND_DIR/public"
EMBEDDED_FRONTEND_DIR="$EMBEDDED_ROOT/frontend"
MANIFEST_FILE="$EMBEDDED_ROOT/manifest.json"
VERSION_VALUE="${VERSION:-$(git -C "$PROJECT_ROOT" describe --tags --always --dirty 2>/dev/null || echo unknown)}"
COMMIT_VALUE="${COMMIT:-$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)}"
DATE_VALUE="${BUILD_DATE:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"

if [ ! -f "$SOURCE_DIR/server.js" ]; then
  echo "[ERROR] missing standalone entry: $SOURCE_DIR/server.js" >&2
  exit 1
fi

if [ ! -d "$STATIC_DIR" ]; then
  echo "[ERROR] missing static assets: $STATIC_DIR" >&2
  exit 1
fi

if [ ! -d "$PUBLIC_DIR" ]; then
  echo "[ERROR] missing public assets: $PUBLIC_DIR" >&2
  exit 1
fi

rm -rf "$EMBEDDED_ROOT"
mkdir -p "$EMBEDDED_FRONTEND_DIR"
mkdir -p "$EMBEDDED_FRONTEND_DIR/.next/static"
mkdir -p "$EMBEDDED_FRONTEND_DIR/public"

cp -a "$SOURCE_DIR/." "$EMBEDDED_FRONTEND_DIR/"
cp -a "$STATIC_DIR/." "$EMBEDDED_FRONTEND_DIR/.next/static/"
cp -a "$PUBLIC_DIR/." "$EMBEDDED_FRONTEND_DIR/public/"

cat > "$MANIFEST_FILE" <<EOF
{
  "project": "$PROJECT_NAME",
  "version": "$VERSION_VALUE",
  "commit": "$COMMIT_VALUE",
  "build_date": "$DATE_VALUE",
  "source_frontend_dir": "$FRONTEND_DIR"
}
EOF

echo "[INFO] embedded frontend prepared for $PROJECT_NAME"
echo "[INFO] manifest: $MANIFEST_FILE"