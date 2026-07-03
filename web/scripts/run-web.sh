#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

exec ./node_modules/.bin/next start \
  --hostname "${SYNCPOST_HOST:-127.0.0.1}" \
  --port "${PORT:-3000}"
