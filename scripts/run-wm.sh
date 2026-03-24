#!/bin/bash
# Wrapper script: loads .env then runs the sap-wm-mcp MCP server via Git bash
# Keeps credentials out of .mcp.json

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "ERROR: .env file not found at $ENV_FILE" >&2
  exit 1
fi

exec node "$ROOT_DIR/index.js"
