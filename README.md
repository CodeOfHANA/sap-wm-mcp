# SAP EWM MCP Server — Build Journal

> **Author:** Noman Mohamed Hanif · Senior SAP Technology Consultant
> **GitHub:** [CodeOfHANA](https://github.com/CodeOfHANA) · **LinkedIn:** [noman-mohamed-hanif](https://www.linkedin.com/in/noman-mohamed-hanif-9b280b1a/)

---

## What is this?

An **MCP (Model Context Protocol) server** that connects AI agents directly to **SAP Extended Warehouse Management** — using only standard, SAP-released OData V4 APIs. No custom objects. No Z-programs. Works on any customer S/4HANA system out of the box.

The goal: replace transactions like `LX03`, `LS24`, and `LT10` with a single natural language conversation.

```
"Show me all empty bins in warehouse 1710"
"Where is material PUMP-001 stocked?"
"Create a transfer order from storage type Y011 to Y020"
```

---

## Why MCP?

MCP (Model Context Protocol) is an open standard by Anthropic. Any AI agent — Claude, Joule, Cursor — can connect to the same server via one protocol. Build once, serve any agent.

- **Today:** Claude Code (local, stdio transport)
- **Tomorrow:** SAP Joule Studio (BTP CF, SSE transport)
- **SAP's own ABAP MCP server** was announced but not yet shipped — community builds now

---

## Architecture

### Phase 1 — Local (current)
```
Claude Code  ──stdio──►  MCP Server (Node.js, local)
                                    │
                          Standard SAP OData V4
                                    │
                         S/4HANA EWM (On-Premise)
```

### Phase 2 — BTP Cloud Foundry (next)
```
Joule / Claude  ──SSE──►  MCP Server (BTP CF)
                                    │
                           Cloud Connector
                                    │
                         S/4HANA OData V4 APIs
```

---

## Project Structure

```
sap-ewm-mcp/
├── README.md
├── CHANGELOG.md            ← milestone-by-milestone build log
├── ROADMAP.md              ← Phase 1 → 2 → 3 plan
├── CONTRIBUTING.md
├── LICENSE
├── .env.example            ← copy to .env and fill in your credentials
├── .gitignore
├── package.json
│
├── src/                    ← all source code (Week 02+)
│   ├── index.js            ← MCP server entry point, transport setup
│   ├── tools/              ← one file per EWM tool
│   │   ├── binStatus.js
│   │   ├── stockByMaterial.js
│   │   ├── emptyBins.js
│   │   ├── binUtilization.js
│   │   └── transferOrder.js
│   └── lib/
│       └── s4hClient.js    ← shared S/4HANA HTTP client (OData + CSRF)
│
├── deploy/                 ← deployment manifests (Phase 2+)
│   └── phase2-btp/
│       ├── manifest.yml    ← CF push config
│       └── xs-security.json
│
├── docs/                   ← architecture diagrams, API references
│   └── architecture.md
│
└── scripts/
    └── run-vsp.sh          ← vibing-steampunk ABAP MCP wrapper
```

> **Milestones** are tracked via git tags (`v0.1.0-week01`, `v1.0.0-phase1`) and documented in [CHANGELOG.md](./CHANGELOG.md). No week-N folders — the commit history and tags are the build journal.

---

## Week 01 — Prerequisites & Setup

### 1. Runtime

| Requirement | Version | Notes |
|---|---|---|
| Node.js | v20+ | [nodejs.org](https://nodejs.org) |
| npm | v10+ | bundled with Node.js |
| bash | any | Git Bash on Windows works fine |

Verify:
```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

---

### 2. SAP System Access

You need an S/4HANA system (on-premise or private cloud) with:

| Item | Your system |
|---|---|
| Host | your IP/hostname |
| HTTPS port | usually `44300` |
| Client | your client |
| User | a user with developer + EWM display access |

Verify connectivity:
```bash
curl -sk -o /dev/null -w "%{http_code}" \
  --user YOUR_USER:YOUR_PASSWORD \
  "https://YOUR_HOST:44300/sap/bc/ping?sap-client=YOUR_CLIENT"
# Expected: 200
```

---

### 3. SAP OData V4 Services — BASIS Activation

Standard SAP EWM OData V4 services are **not active by default** on on-premise systems. Ask your BASIS team to publish the following service groups via **`/IWFND/V4_ADMIN`** → *Publish Service Groups*:

| Service Group | Used for |
|---|---|
| `API_WHSE_STORAGE_BIN_2` | Storage bin status, empty bins, utilization |
| `API_WHSE_PHYSSTOCKPROD` | Physical stock by material |
| `API_WAREHOUSE_ORDER_TASK_2` | Create transfer orders (write) |

> Reference: **SAP Note 2948977**

Verify each service is active in the browser:
```
https://YOUR_HOST:44300/sap/opu/odata4/sap/api_whse_storage_bin_2/srvd_a2x/sap/whsestoragebin2/0001/
```
Should return service metadata JSON — not a 404 or login loop.

---

### 4. ABAP MCP Servers

Two MCP servers are used together — one for live system access, one for ABAP knowledge.

#### 4a. vibing-steampunk (vsp) — required

Gives Claude Code live read/write/activate access to the S/4HANA system. This is what lets you create objects, run classes, and inspect the system directly from the conversation.

**Install vsp:**
```bash
# Download the latest vsp binary from the vibing-steampunk releases
# Place at: ~/.vsp/vsp.exe  (Windows) or  ~/.vsp/vsp  (Mac/Linux)
```

**Configure credentials — `.env`:**
```env
S4H_BASE_URL=https://YOUR_HOST:44300
S4H_CLIENT=YOUR_CLIENT
SAP_USER=YOUR_USER
SAP_PASSWORD=YOUR_PASSWORD
SAP_INSECURE=true
```
> `.env` is gitignored — never commit credentials.

**Configure MCP — `.mcp.json`:**
```json
{
  "mcpServers": {
    "abap-s4h": {
      "command": "bash",
      "args": ["scripts/run-vsp.sh"],
      "env": {
        "SAP_INSECURE": "true",
        "SAP_ALLOW_TRANSPORTABLE_EDITS": "true",
        "SAP_ALLOWED_PACKAGES": "Z*,$TMP,$*",
        "SAP_ALLOWED_TRANSPORTS": "YOUR_TRANSPORT_PREFIX*"
      }
    }
  }
}
```
> `.mcp.json` is gitignored — configure per system, never commit.

**Verify vsp is working:**
```bash
bash scripts/run-vsp.sh --version
```

---

#### 4b. ABAP Docs MCP by Marian Zeis — recommended

A community-built MCP server that gives Claude access to ABAP language documentation and best practices. No system connection needed — works purely as a knowledge layer on top of vsp.

Particularly useful when working with RAP, CDS, OData, or anything where you want Claude to reference official ABAP patterns rather than guessing.

```json
{
  "mcpServers": {
    "abap-docs": {
      "command": "npx",
      "args": ["mcp-remote@latest", "https://mcp-abap.marianzeis.de/mcp"]
    }
  }
}
```

No installation beyond `npx` (included with Node.js). Add alongside your vsp entry in `.mcp.json`.

> Built by [Marian Zeis](https://github.com/marianfoo) — SAP community contribution.

---

### 5. Node.js Dependencies

```bash
npm install @modelcontextprotocol/sdk node-fetch dotenv zod
```

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `node-fetch` | HTTP calls to SAP OData APIs |
| `dotenv` | Load `.env` credentials |
| `zod` | Tool parameter schema validation |

---

### 6. Claude Code MCP Registration

Once `.mcp.json` is in place, Claude Code picks up the MCP servers automatically on startup. To verify tools are loaded, open Claude Code in this directory and run:

```
/mcp
```

---

## EWM Tools — Roadmap

| # | Tool | API | Status |
|---|---|---|---|
| 1 | `get_bin_status` | `API_WHSE_STORAGE_BIN_2` | ✅ Week 01 |
| 2 | `get_stock_for_material` | `API_WHSE_PHYSSTOCKPROD` | ✅ Week 01 |
| 3 | `find_empty_bins` | `API_WHSE_STORAGE_BIN_2` | ✅ Week 01 |
| 4 | `get_bin_utilization` | `API_WHSE_STORAGE_BIN_2` | ✅ Week 01 |
| 5 | `create_transfer_order` | `API_WAREHOUSE_ORDER_TASK_2` | ✅ Week 01 |

Tools 1–4 are read-only OData GET requests.
Tool 5 is a write operation — requires CSRF token fetch before POST.

---

## Week 01 — What Was Built

- [x] Project scaffold and architecture design
- [x] `.env` + `.mcp.json` wired up with vibing-steampunk
- [x] All 5 EWM tools built (`binStatus`, `stockByMaterial`, `emptyBins`, `binUtilization`, `transferOrder`)
- [x] MCP server starts and tools registered (stdio transport)
- [x] API availability checked — system reachable, BASIS activation pending

---

## Follow the Journey

This build is documented publicly milestone by milestone.

- **[CHANGELOG.md](./CHANGELOG.md)** — what was built at each tag
- **[ROADMAP.md](./ROADMAP.md)** — the full Phase 1 → 2 → 3 plan
- **[LinkedIn](https://www.linkedin.com/in/noman-mohamed-hanif-9b280b1a/)** — post per working milestone
- **[GitHub Releases](https://github.com/CodeOfHANA/sap-ewm-mcp/releases)** — tagged snapshots with narrative

---

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [SAP Note 2948977 — OData V4 Service Activation](https://launchpad.support.sap.com/#/notes/2948977)
- [SAP EWM Standard APIs — API Hub](https://api.sap.com)
- [Vibing Steampunk — ABAP MCP Server by oisee](https://github.com/oisee/vibing-steampunk)
- [Marian Zeis — ABAP MCP Server](https://github.com/marianfoo/abap-mcp-server) · hosted at [mcp-abap.marianzeis.de](https://mcp-abap.marianzeis.de)
