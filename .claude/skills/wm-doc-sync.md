# Skill: /wm-doc-sync

Sync documentation after completing a development milestone in sap-wm-mcp.

## When to use
- After adding a new tool
- After a new phase is complete (Phase 0 RAP service done, Phase 1 MCP tools done)
- Before committing and pushing to GitHub

---

## What to update

### 1. README.md — Tools table

Keep the tools table current:

```markdown
## Tools

| # | Tool | Type | Status |
|---|---|---|---|
| 1 | `get_bin_status` | Read | ✅ Live |
| 2 | `get_stock_for_material` | Read | ✅ Live |
| ... | ... | ... | ... |
```

### 2. README.md — Installation section

Always document both install methods:

**Option A (npx — for end users):**
```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "env": {
        "SAP_URL": "https://YOUR_HOST:44300",
        "SAP_USER": "YOUR_USER",
        "SAP_PASSWORD": "YOUR_PASSWORD",
        "SAP_CLIENT": "100",
        "SAP_INSECURE": "true"
      }
    }
  }
}
```

**Option B (clone — for developers):**
```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "node",
      "args": ["/path/to/sap-wm-mcp/index.js"],
      "env": { "...": "..." }
    }
  }
}
```

### 3. CHANGELOG.md

Add entry at the top:

```markdown
## [0.x.0] — YYYY-MM-DD

### Added
- Tool: `get_bin_status` — query classic WM storage bins via custom RAP service
- Phase 0 complete: ZWM_MCP RAP service live on 172.0.0.21

### Notes
- Requires custom RAP service ZSB_WMMcpService_OData4_UI published in target system
```

### 4. ROADMAP.md

Mark completed items with ✅, update next steps.

### 5. CLAUDE.md (this project)

Update the **Current Project State** section with:
- Which RAP entities are live
- Which MCP tools are complete and tested
- Any API/URL discoveries

---

## Commit message convention

```
feat: add get_bin_status tool — queries WMStorageBin via RAP service
fix: pad warehouse number to 4 chars in OData filter
docs: update README — Phase 0 RAP service complete
chore: update CHANGELOG for v0.2.0
```

---

## Before pushing to GitHub

- [ ] `.env` is in `.gitignore` — never commit credentials
- [ ] `rap/` folder has ABAP source files for documentation (optional but useful)
- [ ] README clearly states: *"Requires custom RAP service — see `/rap` folder for ABAP objects"*
- [ ] CLAUDE.md updated with current state
