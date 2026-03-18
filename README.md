# sap-wm-mcp

[![npm version](https://img.shields.io/npm/v/sap-wm-mcp)](https://www.npmjs.com/package/sap-wm-mcp)
[![npm downloads](https://img.shields.io/npm/dm/sap-wm-mcp)](https://www.npmjs.com/package/sap-wm-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

**MCP server for SAP Classic Warehouse Management (LE-WM)**

Connect AI agents — Claude, Copilot, or any MCP-compatible client — directly to your SAP S/4HANA or ECC classic WM system. Query bin status, find empty storage locations, check stock levels, create and confirm transfer orders — all through natural language.

> **EWM has standard OData APIs. Classic WM doesn't. So I built one.**
>
> This project ships a custom RAP OData V4 service that exposes classic WM operations as a proper API — and wraps it in an MCP server so AI agents can drive it. Large portions of the SAP install base are still on classic WM. This fills the gap.

---

## Contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [MCP Client Setup](#mcp-client-setup)
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
        ├── LGPLA  (Storage Bin Master)
        ├── LQUA   (Quants / Stock per Bin)
        ├── LTBK   (Transfer Order Header)
        ├── LTAP   (Transfer Order Items)
        └── FMs    L_TO_CREATE_SINGLE · L_TO_CONFIRM · L_TO_CONFIRM_SU
```

Unlike EWM, classic WM has no standard OData APIs. This package ships a complete **custom RAP OData V4 service** (`ZSD_WMMCPSERVICE`) that must be installed in your SAP system first. The MCP server then calls that service. See [ABAP Service Installation](#abap-service-installation) for a one-step abapGit install.

---

## Prerequisites

| Requirement | Details |
|---|---|
| SAP S/4HANA or ECC | Classic Warehouse Management (LE-WM) active |
| SAP user | Basic Auth credentials with read access to WM tables + RFC execute on `L_TO_CREATE_SINGLE` / `L_TO_CONFIRM` |
| Node.js ≥ 20 | [nodejs.org](https://nodejs.org) |
| abapGit | Required to install the RAP service — [abapgit.org](https://abapgit.org) |
| RAP service installed | `ZSD_WMMCPSERVICE` deployed in your SAP system (see below) |

> **EWM systems:** If your system has EWM (`/SCWM/` package present), use [sap-ewm-mcp](https://github.com/CodeOfHANA/sap-ewm-mcp) instead — it uses standard SAP APIs and requires no custom ABAP.

---

## Quick Start

### Step 1 — Install the ABAP service

See [ABAP Service Installation](#abap-service-installation). This is a one-time step per SAP system.

### Step 2 — Create your `.env` file

```env
SAP_URL=https://your-sap-host:44300
SAP_CLIENT=100
SAP_USER=YOUR_USER
SAP_PASSWORD=YOUR_PASSWORD
SAP_INSECURE=true
```

> `SAP_INSECURE=true` disables TLS certificate validation — required for most on-premise systems with self-signed certificates.

### Step 3 — Run

```bash
# No install required
npx sap-wm-mcp

# Or install globally
npm install -g sap-wm-mcp
sap-wm-mcp
```

The server starts in stdio mode, ready to accept MCP connections.

---

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SAP_URL` | ✅ | Full URL of your SAP system — e.g. `https://172.0.0.21:44300` |
| `SAP_CLIENT` | ✅ | SAP client number — e.g. `100` |
| `SAP_USER` | ✅ | SAP username |
| `SAP_PASSWORD` | ✅ | SAP password |
| `SAP_INSECURE` | optional | Set `true` to skip TLS certificate validation (on-premise / self-signed certs) |

The `.env` file is loaded from the **current working directory** when the server starts. Place it in the folder where you run `npx sap-wm-mcp` or `sap-wm-mcp`.

---

## MCP Client Setup

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "cwd": "/path/to/folder/with/.env"
    }
  }
}
```

Config file locations:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "sap-wm-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["sap-wm-mcp"],
      "cwd": "/path/to/folder/with/.env"
    }
  }
}
```

### Other MCP clients

Any MCP-compatible client using **stdio transport** works. Point `command` at `npx sap-wm-mcp` (or the global binary) with `cwd` set to the directory containing your `.env`.

---

## Tools Reference

Seven tools are available once the server is running.

---

### `get_bin_status`

Query storage bins in a classic WM warehouse. Returns empty/blocked status, capacity, weight, and last movement date.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number — e.g. `102` |
| `storageType` | string | | Filter by storage type — e.g. `001` |
| `bin` | string | | Filter by specific bin number — e.g. `1-013` |
| `top` | number | | Max records to return (default: `20`) |

**Example prompt:** *"Show me all bins in storage type 003 of warehouse 102"*

---

### `get_stock_for_material`

Get physical WM stock for a material — which bins hold it and how much.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `material` | string | | Material number — e.g. `TG0001` |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max records (default: `20`) |

**Example prompt:** *"Where is material TG0001 stored in warehouse 102?"*

---

### `find_empty_bins`

Find all empty storage bins, optionally filtered by storage type.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max records (default: `50`) |

**Example prompt:** *"Find me 10 empty bins in storage type 003"*

---

### `get_bin_utilization`

Get bin utilization statistics — occupied vs. empty vs. blocked, grouped by storage type.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageType` | string | | Filter by storage type |
| `top` | number | | Max bins to analyze (default: `100`) |

**Example prompt:** *"What is the utilization of warehouse 102?"*

---

### `create_transfer_order`

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
| `sourceStorageUnit` | string | | Source storage unit (LENUM) — required for SU-managed types |
| `destType` | string | ✅ | Destination storage type |
| `destBin` | string | ✅ | Destination bin |
| `destStorageUnit` | string | | Destination storage unit (LENUM) — for SU-managed destination types |

> **Note on SU-managed storage types:** Storage types with `LPTYP` set in table `LAGP` (e.g. type `001`) are storage-unit managed and require a `destStorageUnit` (LENUM) when used as the TO destination. Storage types with `LPTYP` blank (e.g. type `003`) do not.

**Example prompt:** *"Move 10 ST of TG0001 from bin 0000000017 (type 999) to bin 1-013 (type 003) in warehouse 102, movement type 999"*

---

### `confirm_transfer_order`

Confirm an open Transfer Order by number — marks it as physically executed. Equivalent to transaction **LT12**.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `transferOrderNumber` | string | ✅ | Transfer order number — e.g. `0000000652` |

**Example prompt:** *"Confirm transfer order 652 in warehouse 102"*

---

### `confirm_transfer_order_su`

Confirm all open Transfer Orders on a storage unit in one call — useful for SU-managed warehouses. Uses `L_TO_CONFIRM_SU` internally.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `warehouse` | string | ✅ | Warehouse number |
| `storageUnit` | string | ✅ | Storage unit number (LENUM) |

**Example prompt:** *"Confirm all transfer orders on storage unit 00000000001000000017"*

---

## ABAP Service Installation

The MCP server calls a **custom RAP OData V4 service** (`ZSD_WMMCPSERVICE`) that must exist in your SAP system. Install it in three steps using abapGit — no transport file, no BASIS involvement.

### Prerequisites

- abapGit installed in your SAP system ([abapgit.org](https://abapgit.org) — free, open source, one-time install)
- Package `ZWM_MCP` does not yet exist in the system
- Internet access from your SAP application server (for GitHub clone), or use abapGit offline mode

### Install steps

1. In SAP GUI, run report `ZABAPGIT` (or transaction `/n/ZABAPGIT`)
2. Click **New Online Repo**
3. Enter URL: `https://github.com/CodeOfHANA/sap-wm-mcp`
4. Package: `ZWM_MCP` (will be created automatically)
5. Click **Pull** — all RAP objects are created and activated

### Publish the service binding

After Pull, the service binding `ZSB_WMMCPSERVICE_ODATA4_UI` must be published:

**Option A — ADT (Eclipse):**
Navigate to `ZSB_WMMCPSERVICE_ODATA4_UI` in Project Explorer → right-click → **Publish Local Service Endpoint**

**Option B — SAP GUI:**
Run `/IWFND/V4_ADMIN` → **Add Service Group** → search `ZSD_WMMCPSERVICE` → assign to system alias `LOCAL`

**Option C — Auto-exposure (no action needed):**
On systems where the client `CCCATEGORY = C` (customizing client), the service is automatically reachable via `/IWBEP/ALL` without explicit publication. This is the most common case for development/sandbox systems.

### Verify the service

```
GET https://<your-host>:44300/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin?$top=3
Authorization: Basic <base64>
sap-client: 100
```

Expect HTTP 200 with bin data.

### What gets installed

| Object | Type | Description |
|---|---|---|
| `ZWM_MCP` | Package | Container for all objects |
| `ZR_WMSTORAGBIN` | CDS View | Interface view over LGPLA (bin master) |
| `ZC_WMSTORAGBIN` | CDS View | Projection view for WMStorageBin entity |
| `ZR_WMWAREHOUSESTOCK` | CDS View | Interface view over LQUA (stock per bin) |
| `ZC_WMWAREHOUSESTOCK` | CDS View | Projection view for WMWarehouseStock entity |
| `ZR_WMTRANSFERORDER` | CDS View | Interface view over LTBK + LTAP |
| `ZC_WMTRANSFERORDER` | CDS View | Projection view for WMTransferOrder entity |
| `ZR_WMTRANSFERORDER` | BDEF | Behavior definition — defines actions |
| `ZBP_R_WMTRANSFERORDER` | Class | RAP behavior implementation |
| `ZWM_MFG` | Function Group | Contains RFC wrapper FM |
| `ZWM_TO_CREATE` | Function Module | RFC-enabled wrapper for `L_TO_CREATE_SINGLE` |
| `ZA_WMCREATETOPARAM` | Structure | Parameter type for CreateTransferOrder action |
| `ZA_WMCONFIRMTOSU` | Structure | Parameter type for ConfirmTransferOrderSU action |
| `ZSD_WMMCPSERVICE` | Service Def | OData V4 service definition |
| `ZSB_WMMCPSERVICE_ODATA4_UI` | Service Binding | OData V4 UI binding |

---

## Custom RAP Service — Architecture

Classic WM has no standard OData APIs. This project builds one using **ABAP RESTful Application Programming Model (RAP)**.

### Entity sets

| OData Entity | Source Table | Operations |
|---|---|---|
| `WMStorageBin` | `LGPLA` | Read, Filter |
| `WMWarehouseStock` | `LQUA` | Read, Filter |
| `WMTransferOrder` | `LTBK` + `LTAP` | Read + Actions |

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
/sap/opu/odata4/iwbep/all/srvd/sap/{service_name}/{version}/{entity_set}
```

For this service:
```
/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin
/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock
/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrder
```

---

## Classic WM Tables

Reference for the SAP standard tables behind this service.

| Table | Description | Key Fields |
|---|---|---|
| `LGPLA` | Storage Bin Master | `LGNUM`, `LGTYP`, `LGPLA` — capacity, block flags |
| `LQUA` | Quants (Stock per Bin) | `LGNUM`, `LGTYP`, `LGPLA`, `LQNUM`, `MATNR`, `LGMNG` |
| `LTBK` | Transfer Order Header | `LGNUM`, `TANUM`, `TBNUM`, `AUART`, `BDATU` |
| `LTAP` | Transfer Order Items | `LGNUM`, `TANUM`, `TAPOS`, `MATNR`, `VLTYP`, `VLPLA`, `NLTYP`, `NLPLA` |
| `LAGP` | Storage Type Master | `LGNUM`, `LGTYP`, `LPTYP` — `LPTYP` indicates SU management |
| `MLGN` | Material WM Extension | `MATNR`, `LGNUM`, `LGBKZ` |

---

## Development

### Run locally

```bash
git clone https://github.com/CodeOfHANA/sap-wm-mcp.git
cd sap-wm-mcp
npm install
cp .env.example .env       # fill in your SAP connection details
node index.js
```

### Project structure

```
sap-wm-mcp/
├── index.js                      ← MCP server — all 7 tools registered
├── lib/
│   └── s4hClient.js              ← s4hGet + s4hPost (OData V4 HTTP client)
├── tools/
│   ├── binStatus.js              ← get_bin_status
│   ├── stockByMaterial.js        ← get_stock_for_material
│   ├── emptyBins.js              ← find_empty_bins
│   ├── binUtilization.js         ← get_bin_utilization
│   ├── createTransferOrder.js    ← create_transfer_order
│   ├── confirmTransferOrder.js   ← confirm_transfer_order
│   └── confirmTransferOrderSU.js ← confirm_transfer_order_su
├── abap/
│   └── src/                      ← All ABAP objects as abapGit files
├── .env.example
└── package.json
```

### Adding a new tool

1. Create `tools/myTool.js` — export an async function
2. Import and register it in `index.js` using `server.tool(name, description, schema, handler)`
3. If you need a new RAP entity or action, add the CDS view + behavior to `abap/src/` and deploy via abapGit

### Companion project

[sap-ewm-mcp](https://github.com/CodeOfHANA/sap-ewm-mcp) — the same MCP interface for SAP Extended Warehouse Management. Uses only standard SAP OData APIs, no custom ABAP required.

Running both side-by-side shows the contrast directly: same tools, same questions to Claude — EWM uses plug-and-play APIs, WM required building the socket first.

---

## Roadmap

| Phase | Status | Description |
|---|---|---|
| Phase 0 — RAP Service | ✅ Complete | Custom OData V4 service over classic WM tables |
| Phase 1 — Local MCP | ✅ Complete | All 7 tools working, published to npm |
| Phase 2 — BTP CF | 🔜 Planned | Deploy to SAP BTP Cloud Foundry with SSE transport + XSUAA + Cloud Connector |
| Phase 3 — Joule Agent | 💡 Future | Native Joule Studio agent using the same RAP service |

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Noman Mohamed Hanif](https://github.com/CodeOfHANA) · Senior SAP Technology Consultant @ RELACON IT Consulting GmbH, Hamburg
