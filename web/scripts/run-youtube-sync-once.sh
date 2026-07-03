#!/bin/sh
set -eu

lock_dir="/tmp/syncpost-youtube-sync.lock"

if ! mkdir "$lock_dir" 2>/dev/null; then
  echo "YouTube sync already running; skipping this interval."
  exit 0
fi

cleanup() {
  rmdir "$lock_dir" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

curl -sS --fail --max-time 600 \
  -X POST \
  http://127.0.0.1:3000/api/sync/youtube

echo
