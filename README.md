# sap-wm-mcp

[![npm version](https://img.shields.io/npm/v/sap-wm-mcp)](https://www.npmjs.com/package/sap-wm-mcp)
[![npm downloads](https://img.shields.io/npm/dm/sap-wm-mcp)](https://www.npmjs.com/package/sap-wm-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

**MCP server for SAP Classic Warehouse Management (LE-WM)**

Connect AI agents — Claude, Copilot, or any MCP-compatible client — directly to your SAP S/4HANA or ECC classic WM system. Query bin status, find empty storage locations, check stock levels, detect anomalies, create and confirm transfer orders — all through natural language.

> **EWM has standard OData APIs. Classic WM doesn't. So I built one.**
>
> This project ships a custom RAP OData V4 service that exposes classic WM operations as a proper API — and wraps it in an MCP server so AI agents can drive it. Large portions of the SAP install base are still on classic WM. This fills the gap.

The **npm package** ships 18 tools covering core operations, analytics, shift management, and anomaly detection. This repository contains the 9 open-sourced tool implementations — the ABAP RAP service source and additional tool source are available separately (see [ABAP Service Installation](#abap-service-installation)).

---

## Contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [MCP Client Setup](#mcp-client-setup)
  - [Option A — npx (Claude Desktop, Claude Code, Cursor)](#option-a--npx-recommended)
  - [Option B — Clone locally](#option-b--clone-locally-for-developers)
  - [Verify it's working](#verify-its-working)
  - [Example conversations](#example-conversations)
- [Tools Reference](#tools-reference)
- [ABAP Service Installation](#abap-service-installation)
- [Custom RAP Service — Architecture](#custom-rap-service--architecture)
- [Classic WM Tables](#classic-wm-tables)
- [Development](#development)
- [Roadmap](#roadmap)
- [License](#license)

---

## How it works

```
AI Agent (Claude / Copilot / any MCP client)
        │  MCP protocol (stdio)
        ▼
  sap-wm-mcp  ←  this package
        │  OData V4 (custom RAP service ZSD_WMMCPSERVICE)
        ▼
  SAP S/4HANA / ECC — Classic Warehouse Management
        │
        ├── LAGP   (Storage Bin Master)
        ├── LQUA   (Quants / Stock per Bin)
        ├── LTAK   (Transfer Order Header)
        ├── LTAP   (Transfer Order Items)
        ├── LTBK   (Transfer Requirement Header)
        ├── MARD   (IM Stock per Storage Location)
        └── FMs    L_TO_CREATE_SINGLE · L_TO_CONFIRM · L_TO_CONFIRM_SU
```

Unlike EWM, classic WM has no standard OData APIs. This package requires a **custom RAP OData V4 service** (`ZSD_WMMCPSERVICE`) installed in your SAP system. The MCP server calls that service. See [ABAP Service Installation](#abap-service-installation).

---

## Prerequisites

| Requirement | Details |
|---|---|
| SAP S/4HANA or ECC | Classic Warehouse Management (LE-WM) active |
| SAP user | Basic Auth credentials with read access to WM tables + RFC execute on `L_TO_CREATE_SINGLE` / `L_TO_CONFIRM` |
| Node.js ≥ 20 | [nodejs.org](https://nodejs.org) |
| RAP service installed | `ZSD_WMMCPSERVICE` deployed in your SAP system (see below) |

> **EWM systems:** If your system has EWM (`/SCWM/` package present), use [sap-ewm-mcp](https://github.com/CodeOfHANA/sap-ewm-mcp) instead — it uses standard SAP APIs and requires no custom ABAP.

---

## Quick Start

### Step 1 — Install the ABAP service (one-time per SAP system)

The MCP server calls a custom RAP OData V4 service that must exist in your SAP system. See [ABAP Service Installation](#abap-service-installation).

### Step 2 — Configure your MCP client

Add the server to your MCP client config with your SAP credentials inline. See [MCP Client Setup](#mcp-client-setup) for Claude Desktop, Claude Code, and Cursor.

No separate install or `.env` file needed — credentials go directly in the config.

### Step 3 — Ask a warehouse question

```
"Show me all empty bins in warehouse 102"
"Where is material TG0001 stored?"
"What is the utilization of warehouse 102?"
"Show me all open transfer orders"
"Create a TO to move TG0001 from bin 0000000017 to bin 1-013"
```

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SAP_URL` | ✅ | Full URL of your SAP system — e.g. `https://172.0.0.21:44300` |
| `SAP_CLIENT` | ✅ | SAP client number — e.g. `100` |
| `SAP_USER` | ✅ | SAP username |
| `SAP_PASSWORD` | ✅ | SAP password |
| `SAP_INSECURE` | optional | Set `true` to skip TLS certificate validation (on-premise / self-signed certs) |

---

## MCP Client Setup

Two installation options — choose based on your use case.

| Option | When to use |
|---|---|
| **A — npx (recommended)** | Just want to use it. No cloning, no install step. Credentials go inline in the config. |
| **B — Clone locally** | Want to modify tools, extend the service, or contribute. |

---

### Option A — npx (recommended)

No cloning or install required. Credentials are passed as environment variables directly in your MCP client config.

#### Claude Desktop

**Step 1 — Find your config file:**

| OS | Path |
|---|---|
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

**Step 2 — Add the server entry:**

```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "env": {
        "SAP_URL": "https://your-sap-host:44300",
        "SAP_CLIENT": "100",
        "SAP_USER": "your-user",
        "SAP_PASSWORD": "your-password",
        "SAP_INSECURE": "true"
      }
    }
  }
}
```

**Step 3 — Restart Claude Desktop.**

The sap-wm-mcp tools appear automatically in the tools panel. You'll see a hammer icon — click it to confirm the WM tools are loaded.

> **Note:** If you already have other MCP servers configured, add `sap-wm-mcp` as an additional entry inside `"mcpServers"` — do not replace the whole file.

---

#### Claude Code

**Step 1 — Create `.mcp.json` in your project root** (or add to an existing one):

```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "env": {
        "SAP_URL": "https://your-sap-host:44300",
        "SAP_CLIENT": "100",
        "SAP_USER": "your-user",
        "SAP_PASSWORD": "your-password",
        "SAP_INSECURE": "true"
      }
    }
  }
}
```

**Step 2 — Verify the tools are loaded:**

```
/mcp
```

> **`.mcp.json` is project-scoped.** Add it to `.gitignore` — it contains credentials.

---

#### Cursor, Windsurf, and other MCP clients

Any MCP client that supports **stdio transport** works. Use the same `env` block approach.

```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "env": {
        "SAP_URL": "https://your-sap-host:44300",
        "SAP_CLIENT": "100",
        "SAP_USER": "your-user",
        "SAP_PASSWORD": "your-password",
        "SAP_INSECURE": "true"
      }
    }
  }
}
```

---

### Option B — Clone locally (for developers)

```bash
git clone https://github.com/CodeOfHANA/sap-wm-mcp.git
cd sap-wm-mcp
npm install
cp .env.example .env    # fill in your SAP credentials
node index.js
```

Then point your MCP client at the local file:

**Claude Desktop:**
```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/sap-wm-mcp/index.js"]
    }
  }
}
```

---

### Verify it's working

```
"Show me the status of bins in warehouse 102"
"How many empty bins are in storage type 003?"
"Where is material TG0001 stored?"
"What is the overall utilization of warehouse 102?"
```

For write operations:
```
"Move 10 ST of TG0001 from bin 0000000017 to bin 1-013 in warehouse 102, movement type 999, plant 1010"
"Confirm transfer order 652 in warehouse 102"
```

---

### Example conversations

**Inventory queries**
```
"Give me a full picture of warehouse 102 — utilization, empty bins, and where the stock is"
"Which bins in storage type 003 still have capacity?"
"How much stock of TG0001 do we have, and in which bins?"
```

**Transfer order operations**
```
"Create a transfer order to move 5 ST of TG0001 from bin 0000000017 (type 999)
 to bin 1-014 (type 003), warehouse 102, movement type 999, plant 1010"
"Confirm transfer order number 0000000654 in warehouse 102"
"Confirm all transfer orders on storage unit 00000000001000000017"
```

**Analytics and shift management**
```
"Run a shift health check for warehouse 102 — open TOs, negative stock, GR area, anomalies"
"Which bins haven't moved stock in over 90 days?"
"Are there any negative quants I need to investigate?"
"Which materials have more WM stock than IM stock?"
"Find bins due for cycle counting"
"Are there any fragmented quants that need consolidation TOs?"
```

---

## Tools Reference

The npm package ships **18 tools** across four capability areas. The 9 tools below are open-sourced in this repository. Analytics, shift management, and anomaly detection tools are available in the published package.

---

### Core Operations

#### `get_bin_status`

Query storage bins in a classic WM warehouse. Returns empty/blocked status, capacity, weight, and last movement date.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number — e.g. `102` |
| `storageType` | string | | Filter by storage type — e.g. `001` |
| `bin` | string | | Filter by specific bin number — e.g. `1-013` |
| `top` | number | | Max records to return (default: `20`) |

---

#### `get_stock_for_material`

Get physical WM stock for a material — which bins hold it and how much.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `material` | string | | Material number — e.g. `TG0001` |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max records (default: `20`) |

---

#### `find_empty_bins`

Find all empty storage bins, optionally filtered by storage type.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max records (default: `50`) |

---

#### `get_bin_utilization`

Get bin utilization statistics — occupied vs. empty vs. blocked, grouped by storage type.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max bins to analyze (default: `100`) |

---

#### `get_stock_by_type`

List all stock grouped by storage type — useful for understanding what is in each zone.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by specific storage type |
| `top` | number | | Max records (default: `100`) |

---

#### `get_open_transfer_orders`

List open (unconfirmed) Transfer Orders with their items, age, and bin details.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by source or destination storage type |
| `material` | string | | Filter by material |
| `top` | number | | Max TO headers (default: `50`) |

---

### Write Operations

#### `create_transfer_order`

Create a classic WM Transfer Order — moves stock from a source bin to a destination bin. Equivalent to transaction **LT01**.

Internally calls `L_TO_CREATE_SINGLE` via an RFC-enabled wrapper, isolated from the RAP LUW using `DESTINATION 'NONE'`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `movementType` | string | ✅ | WM movement type — e.g. `999` (manual relocation) |
| `material` | string | ✅ | Material number |
| `plant` | string | ✅ | Plant — e.g. `1010` |
| `quantity` | number | ✅ | Quantity to move |
| `unitOfMeasure` | string | ✅ | Unit of measure — e.g. `ST`, `KG` |
| `sourceType` | string | | Source storage type |
| `sourceBin` | string | | Source bin |
| `sourceStorageUnit` | string | | Source storage unit (LENUM) — required for SU-managed source types |
| `destType` | string | ✅ | Destination storage type |
| `destBin` | string | ✅ | Destination bin |
| `destStorageUnit` | string | | Destination storage unit (LENUM) — for SU-managed destination types |

> **Note on SU-managed storage types:** Storage types with `LPTYP` set in `LAGP` (e.g. type `001`) require a `destStorageUnit` (LENUM) when used as the TO destination. Storage types with `LPTYP` blank (e.g. type `003`) do not.

---

#### `confirm_transfer_order`

Confirm an open Transfer Order by number — marks it as physically executed. Equivalent to transaction **LT12**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `transferOrderNumber` | string | ✅ | Transfer order number — e.g. `0000000652` |

---

#### `confirm_transfer_order_su`

Confirm all open Transfer Orders on a storage unit in one call — useful for SU-managed warehouses.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageUnit` | string | ✅ | Storage unit number (LENUM) |

---

### Additional Tools (npm package)

The following tools are available in the published npm package and fully functional via `npx sap-wm-mcp`:

| Tool | Description |
|---|---|
| `get_transfer_requirements` | Open TRs — the demand side before a TO is created, flagged by age |
| `get_wm_im_variance` | Compare WM stock (LQUA) vs IM stock (MARD) — surfaces reconciliation discrepancies |
| `get_cycle_count_candidates` | Bins due for cycle counting, ordered by ABC class and days since last count |
| `get_stock_aging` | Stock not moved in N days — surface slow movers and forgotten inventory |
| `get_negative_stock_report` | All negative quants with likely cause diagnosis |
| `get_goods_receipt_monitor` | GR staging area status and open inbound TRs — start-of-shift inbound check |
| `get_quant_fragmentation` | Bin+material combinations with excessive quant count — consolidation candidates |
| `get_unresolved_su_negatives` | Persistent negative quants in SU zones older than a configurable age |
| `get_inventory_anomalies` | Bins stuck in mid-inventory state — empty bins with locks, open count docs, orphaned lock codes |

---

## ABAP Service Installation

The MCP server calls a **custom RAP OData V4 service** (`ZSD_WMMCPSERVICE`) that must be installed in your SAP system.

The ABAP source is not included in this public repository. To obtain the ABAP package for installation in your system, open an issue or reach out via [GitHub](https://github.com/CodeOfHANA/sap-wm-mcp/issues).

### What gets installed

| Object | Type | Description |
|---|---|---|
| `ZWM_MCP` | Package | Container for all objects |
| `ZR_WMSTORAGBIN` | CDS View | Interface view over LAGP (bin master) |
| `ZC_WMSTORAGBIN` | CDS View | Projection view for WMStorageBin entity |
| `ZR_WMWAREHOUSESTOCK` | CDS View | Interface view over LQUA (stock per bin) |
| `ZC_WMWAREHOUSESTOCK` | CDS View | Projection view for WMWarehouseStock entity |
| `ZR_WMTRANSFERORDER` | CDS View | Interface view over LTAK (TO headers) |
| `ZR_WMTRANSFERORDERITEM` | CDS View | View over LTAP (TO items) |
| `ZR_WMTRANSFERREQUIREMENT` | CDS View | View over LTBK + LTBP (transfer requirements) |
| `ZR_WMIMSTOCK` | CDS View | View over MARD + MARA (IM stock for variance) |
| `ZR_WMCYCLECOUNTBIN` | CDS View | View over LAGP (cycle count indicators) |
| `ZR_WMTRANSFERORDER` | BDEF | Behavior definition — defines actions |
| `ZBP_R_WMTRANSFERORDER` | Class | RAP behavior implementation |
| `ZWM_MFG` | Function Group | Contains RFC wrapper FM |
| `ZWM_TO_CREATE` | Function Module | RFC-enabled wrapper for `L_TO_CREATE_SINGLE` |
| `ZA_WMCREATETOPARAM` | Structure | Parameter type for CreateTransferOrder action |
| `ZA_WMCONFIRMTOSU` | Structure | Parameter type for ConfirmTransferOrderSU action |
| `ZSD_WMMCPSERVICE` | Service Def | OData V4 service definition (7 entity sets) |
| `ZSB_WMMCPSERVICE_ODATA4_UI` | Service Binding | OData V4 UI binding |

### Verify the service

Once installed, verify the service is reachable:

```
GET https://<your-host>:44300/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin?$top=3
Authorization: Basic <base64>
sap-client: 100
```

Expect HTTP 200 with bin data.

---

## Custom RAP Service — Architecture

Classic WM has no standard OData APIs. This project builds one using **ABAP RESTful Application Programming Model (RAP)**.

### Entity sets

| OData Entity | Source Table(s) | Operations |
|---|---|---|
| `WMStorageBin` | `LAGP` | Read, Filter |
| `WMWarehouseStock` | `LQUA` | Read, Filter |
| `WMTransferOrder` | `LTAK` | Read + Actions |
| `WMTransferOrderItem` | `LTAP` | Read |
| `WMTransferRequirement` | `LTBK` + `LTBP` | Read |
| `WMIMStock` | `MARD` + `MARA` | Read |
| `WMCycleCountBin` | `LAGP` | Read |

### Actions

| Action | FM Internally | Pattern |
|---|---|---|
| `CreateTransferOrder` | `L_TO_CREATE_SINGLE` | Called via RFC wrapper `ZWM_TO_CREATE` with `DESTINATION 'NONE'` |
| `ConfirmTransferOrder` | `L_TO_CONFIRM` | Called directly — no COMMIT needed |
| `ConfirmTransferOrderSU` | `L_TO_CONFIRM_SU` | Called directly — no COMMIT needed |

### Why the RFC wrapper?

`L_TO_CREATE_SINGLE` internally calls `COMMIT WORK` and `CALL FUNCTION ... IN UPDATE TASK`. Both are illegal inside a RAP action handler — they cause a `BEHAVIOR_ILLEGAL_STATEMENT` runtime error.

The solution: an RFC-enabled wrapper FM (`ZWM_TO_CREATE`) called via `DESTINATION 'NONE'`. This creates a loopback RFC session. The `COMMIT WORK` runs in that isolated session — it does not touch the RAP handler's LUW.

`L_TO_CONFIRM` does not commit and can be called directly from the RAP handler.

### Service URL pattern

```
/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/{EntitySet}
```

---

## Classic WM Tables

| Table | Description | Key Fields |
|---|---|---|
| `LAGP` | Storage Bin Master | `LGNUM`, `LGTYP`, `LGPLA` — capacity, `LPTYP` (SU management), `KZINV` (inventory lock), `KZLER` (empty flag) |
| `LQUA` | Quants (Stock per Bin) | `LGNUM`, `LGTYP`, `LGPLA`, `LQNUM`, `MATNR` — `GESME` (total stock), `EINME` (in-transfer qty), `BDATU` (last movement date) |
| `LTAK` | Transfer Order Header | `LGNUM`, `TANUM` — `BWLVS` (movement type), `BDATU` (creation date). No STATUS field — derive from LTAP |
| `LTAP` | Transfer Order Items | `LGNUM`, `TANUM`, `TAPOS` — `NSOLM` (planned qty), `NISTM` (confirmed qty), `VLTYP`/`VLPLA` (source), `NLTYP`/`NLPLA` (destination) |
| `LTBK` | Transfer Requirement Header | `LGNUM`, `TBNUM` — `STATU` (`' '`=open, `'B'`=partial, `'T'`=TO created, `'E'`=complete) |
| `LTBP` | Transfer Requirement Items | `LGNUM`, `TBNUM`, `TBPOS` — material, qty, source bin |
| `MARD` | IM Stock per Storage Location | `MATNR`, `WERKS`, `LGORT` — `LABST` (unrestricted stock) |

> **Common naming traps:** `LGPLA` is a *field name* (bin number), not a table — the bin master table is `LAGP`. The stock quantity field in LQUA is `GESME`, not `LGMNG`.

---

## Development

### Run locally

```bash
git clone https://github.com/CodeOfHANA/sap-wm-mcp.git
cd sap-wm-mcp
npm install
cp .env.example .env
node index.js
```

### Project structure

```
sap-wm-mcp/
├── index.js                          ← MCP server — all tools registered
├── lib/
│   ├── s4hClient.js                  ← s4hGet + s4hPost (OData V4 HTTP client)
│   └── sanitize.js                   ← esc() — OData filter injection prevention
├── tools/
│   ├── binStatus.js                  ← get_bin_status
│   ├── stockByMaterial.js            ← get_stock_for_material
│   ├── emptyBins.js                  ← find_empty_bins
│   ├── binUtilization.js             ← get_bin_utilization
│   ├── stockByType.js                ← get_stock_by_type
│   ├── openTransferOrders.js         ← get_open_transfer_orders
│   ├── createTransferOrder.js        ← create_transfer_order
│   ├── confirmTransferOrder.js       ← confirm_transfer_order
│   └── confirmTransferOrderSU.js     ← confirm_transfer_order_su
├── .env.example
└── package.json
```

### Adding a new tool

1. Create `tools/myTool.js` — always `import { esc } from '../lib/sanitize.js'` and use `esc()` on every string OData filter param
2. Always use `data.value ?? []` (never bare `data.value`)
3. Always return `truncated: rows.length === top` on paginated responses
4. Import and register in `index.js` using `server.tool(name, description, schema, handler)`

### Companion project

[sap-ewm-mcp](https://github.com/CodeOfHANA/sap-ewm-mcp) — the same MCP interface for SAP Extended Warehouse Management. Uses only standard SAP OData APIs, no custom ABAP required.

Running both side-by-side shows the contrast directly: same tools, same questions — EWM uses plug-and-play APIs, WM required building the socket first.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 0 — RAP Service | ✅ Complete | Custom OData V4 service with 7 entity sets over classic WM tables |
| Phase 1 — Local MCP | ✅ Complete | 18 tools working, security hardened, published to npm |
| Phase 2 — BTP CF | 🔜 Planned | Deploy to SAP BTP Cloud Foundry with SSE transport + XSUAA + Cloud Connector |
| Phase 3 — Joule Agent | 💡 Future | Native Joule Studio agent using the same RAP service |

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Noman Mohamed Hanif](https://github.com/CodeOfHANA) · Senior SAP Technology Consultant @ RELACON IT Consulting GmbH, Hamburg
