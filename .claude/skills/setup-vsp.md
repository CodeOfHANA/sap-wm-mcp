# Skill: /setup-vsp

Set up the VSP (vibing-steampunk) ABAP MCP server for a new SAP development project.
Copy this file to `.claude/skills/setup-vsp.md` in any project to make it available.

## What this does

1. Creates `scripts/run-vsp.sh` — wrapper that loads `.env` and launches `vsp.exe`
2. Creates/updates `.mcp.json` — registers VSP as an MCP server named `abap-{project}`
3. Verifies the connection to SAP via `GetConnectionInfo`

## Prerequisites (user must have these ready)

- `vsp.exe` installed at `~/.vsp/vsp.exe` (one-time install)
- Git Bash available (on Windows: `C:/Program Files/Git/usr/bin/bash.exe`)
- `.env` file with SAP connection details (see template below)
- Transport request created in the target SAP system

## Step 1 — Confirm .env exists

Check for `.env` in the project root. If missing, create it from this template:

```env
SAP_URL=https://{HOST}:{PORT}
SAP_USER={USER}
SAP_PASSWORD={PASSWORD}
SAP_CLIENT={CLIENT}
SAP_LANGUAGE=EN
SAP_INSECURE=true
SAP_ENABLE_TRANSPORTS=true
SAP_ALLOW_TRANSPORTABLE_EDITS=true
```

Common ports: HTTPS on-premise = 44300 (or 443 if reverse proxy).
`SAP_INSECURE=true` is required for self-signed certs (typical on-premise dev systems).

## Step 2 — Create scripts/run-vsp.sh

Create the `scripts/` directory if it doesn't exist, then write:

```bash
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
```

Make it executable: `chmod +x scripts/run-vsp.sh`

## Step 3 — Create/update .mcp.json

The MCP server name should be `abap-{project-short-name}` to avoid collisions.
The shell path is Windows-style Git Bash — adjust if on Linux/Mac.

```json
{
  "mcpServers": {
    "abap-{project}": {
      "command": "C:/Program Files/Git/usr/bin/bash.exe",
      "args": [
        "{ABSOLUTE_PATH_TO_PROJECT}/scripts/run-vsp.sh"
      ],
      "env": {
        "SAP_INSECURE": "true",
        "SAP_ALLOW_TRANSPORTABLE_EDITS": "true",
        "SAP_ALLOWED_PACKAGES": "Z*,$TMP,$*",
        "SAP_ALLOWED_TRANSPORTS": "{TRANSPORT_PREFIX}*"
      }
    }
  }
}
```

Replace:
- `{project}` — short name, e.g. `relacon-dev`, `wm-dev`
- `{ABSOLUTE_PATH_TO_PROJECT}` — full path with forward slashes, e.g. `C:/Users/.../my-project`
- `{TRANSPORT_PREFIX}` — system prefix for transport numbers, e.g. `S4HK`, `P01K`, `DEV`

If `.mcp.json` already exists with other MCP servers (e.g. `abap-docs`), merge the new entry — do not overwrite the whole file.

## Step 4 — Verify connection

After `.mcp.json` is saved, Claude Code will restart and load the new MCP server.
Then call `GetConnectionInfo` to verify the connection is working:

```
GetConnectionInfo()
→ Should return: systemId, client, user, release
```

If it fails, check:
1. `.env` credentials and URL are correct
2. `vsp.exe` is at `~/.vsp/vsp.exe`
3. The `scripts/run-vsp.sh` path in `.mcp.json` uses forward slashes and is absolute

## Step 5 — Add .env to .gitignore

```
echo ".env" >> .gitignore
```

Never commit `.env` — it contains SAP passwords.

## Optional: Claude Code settings permissions

If Claude Code prompts for permission every time a VSP tool is called, you can pre-approve them in `.claude/settings.json` (project level) or `~/.claude/settings.json` (global):

```json
{
  "permissions": {
    "allow": [
      "mcp__abap-{project}__GetSource",
      "mcp__abap-{project}__WriteSource",
      "mcp__abap-{project}__ImportFromFile",
      "mcp__abap-{project}__ExportToFile",
      "mcp__abap-{project}__Activate",
      "mcp__abap-{project}__SyntaxCheck",
      "mcp__abap-{project}__SearchObject",
      "mcp__abap-{project}__GetPackage",
      "mcp__abap-{project}__GetTable",
      "mcp__abap-{project}__GetSystemInfo",
      "mcp__abap-{project}__GetConnectionInfo",
      "mcp__abap-{project}__LockObject",
      "mcp__abap-{project}__UnlockObject",
      "mcp__abap-{project}__CallRFC",
      "mcp__abap-{project}__EditSource",
      "mcp__abap-{project}__RunATCCheck",
      "mcp__abap-{project}__RunUnitTests"
    ]
  }
}
```

Replace `{project}` with the actual MCP server name used in `.mcp.json`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| MCP server doesn't appear in Claude | `.mcp.json` path has backslashes or spaces not quoted | Use forward slashes; quote path in args |
| `vsp.exe` not found | Wrong path in `run-vsp.sh` | Check `~/.vsp/vsp.exe` exists |
| 401 Unauthorized | Wrong credentials in `.env` | Verify SAP_USER / SAP_PASSWORD |
| 403 on write operations | Transport not allowed | Check `SAP_ALLOWED_TRANSPORTS` pattern matches your transport number prefix |
| SSL error | Self-signed cert | Ensure `SAP_INSECURE=true` in `.env` |
| "no inactive version" on GetSource | Object is fully active, no edit lock | Use `LockObject` before `GetSource` on inactive include, or just `ImportFromFile` directly |

## Key VSP tools reference

| Tool | Purpose |
|---|---|
| `GetConnectionInfo` | Verify connection + get system info |
| `GetSystemInfo` | SAP release, kernel version |
| `SearchObject` | Find ABAP objects by name pattern |
| `GetSource` | Read source of program/class/CDS/BDEF |
| `WriteSource` | Write/update source (PROG, CLAS main, DDLS, BDEF, SRVD) |
| `ImportFromFile` | Import from abapGit file — **only way to write class includes** |
| `ExportToFile` | Export to abapGit file format |
| `EditSource` | Surgical find-replace in ABAP source (main source only, not class includes) |
| `Activate` | Activate an object by ADT URL |
| `LockObject` | Acquire edit lock (returns lock handle) |
| `UnlockObject` | Release edit lock |
| `CallRFC` | Call function module via RFC |
| `GetTable` | Read DDIC table structure |
| `GetPackage` | List all objects in a package |
| `SyntaxCheck` | Check syntax without saving |
| `RunATCCheck` | Run ABAP Test Cockpit checks |
| `ImportFromFile` for `.clas.locals_imp.abap` | **Write handler class local implementations** |
