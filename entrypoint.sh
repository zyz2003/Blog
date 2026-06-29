#!/bin/sh
set -e

DATA_DIR="/anheyu/data"
DEFAULT_DIR="/anheyu/default-data"
ANHEYU_UID=1001
ANHEYU_GID=1001

mkdir -p "$DATA_DIR"

# Seed default files (runs as root before privilege drop)
if [ ! -f "$DATA_DIR/DefaultArticle.md" ] && [ -f "$DEFAULT_DIR/DefaultArticle.md" ]; then
  cp -f "$DEFAULT_DIR/DefaultArticle.md" "$DATA_DIR/DefaultArticle.md"
  echo "[entrypoint] Seeded DefaultArticle.md"
fi

if [ ! -f "$DATA_DIR/DefaultArticle.html" ] && [ -f "$DEFAULT_DIR/DefaultArticle.html" ]; then
  cp -f "$DEFAULT_DIR/DefaultArticle.html" "$DATA_DIR/DefaultArticle.html"
  echo "[entrypoint] Seeded DefaultArticle.html"
fi

if [ ! -f "$DATA_DIR/conf.ini" ] && [ -f "$DEFAULT_DIR/conf.ini" ]; then
  cp -f "$DEFAULT_DIR/conf.ini" "$DATA_DIR/conf.ini"
  echo "[entrypoint] Seeded conf.ini"
fi

# Try to drop privileges to non-root user.
# If chown fails (NFS, certain volume drivers), fall back to running as root.
if chown -R "$ANHEYU_UID:$ANHEYU_GID" "$DATA_DIR" 2>/dev/null && \
   chown -R "$ANHEYU_UID:$ANHEYU_GID" /anheyu/themes 2>/dev/null && \
   chown -R "$ANHEYU_UID:$ANHEYU_GID" /anheyu/frontend 2>/dev/null; then
  exec su-exec "$ANHEYU_UID:$ANHEYU_GID" "$@"
else
  echo "[entrypoint] chown failed (volume may not support it), running as root"
  exec "$@"
fi
