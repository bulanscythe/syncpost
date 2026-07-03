#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"/..

node scripts/refresh-instagram-token.mjs
