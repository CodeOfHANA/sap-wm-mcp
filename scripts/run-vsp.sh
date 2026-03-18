#!/bin/bash
# Wrapper script: loads .env then runs vsp.exe
# Keeps credentials out of .mcp.json

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
ENV_FILE="$(cd "$SCRIPT_DIR/.." && pwd)/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "ERROR: .env file not found at $ENV_FILE" >&2
  exit 1
fi

exec "$HOME/.vsp/vsp.exe" "$@"
