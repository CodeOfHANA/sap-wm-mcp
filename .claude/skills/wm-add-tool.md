# Skill: /wm-add-tool

Scaffold a new MCP tool for the SAP Classic WM MCP server.

Same pattern as `sap-ewm-mcp` — adapted for the custom RAP OData V4 service.

## When to use
- Add a new warehouse capability to the MCP server
- After the corresponding RAP entity/action is live and the OData URL returns data

## Prerequisites

Before running this skill:
1. The RAP entity or action is activated and published (`/wm-check-service` passes)
2. The OData URL returns expected data when called directly via curl

---

## Step 1 — Identify the tool parameters

| Parameter | Decision |
|---|---|
| Tool name | `snake_case` verb + noun — e.g. `get_bin_status`, `create_transfer_order` |
| Input schema | What does Claude need to pass? (warehouse, material, bin, etc.) |
| OData entity | Which RAP entity set serves this data? |
| HTTP method | GET (read) or POST (action via `$batch` or action URL) |
| Output shape | What fields does Claude need in the response? |

---

## Step 2 — Create the tool file

Create `tools/{toolName}.js`. Use this template:

### Read tool template

```js
// tools/myTool.js
import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';   // ← REQUIRED — OData filter injection prevention

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getMyTool({ warehouse, storageType, top = 100 }) {
  const filters = [`WarehouseNumber eq '${esc(warehouse)}'`];
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data  = await s4hGet(path);
  const rows  = data.value ?? [];   // always use ?? [] — data.value can be null

  const results = rows.map(r => ({
    storageType: r.StorageType,
    bin:         r.StorageBin,
    material:    r.Material?.trimStart?.() ?? r.Material,   // MATNR has leading spaces
    totalStock:  parseFloat(r.TotalStock ?? 0),
    uom:         r.UnitOfMeasure
  }));

  return {
    warehouse,
    filters: { storageType: storageType ?? 'all' },
    truncated: rows.length === top,   // ← ALWAYS include — tells Claude if results are capped
    count: results.length,
    results
  };
}
```

**Correct OData base URL:**
```
/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/{EntitySet}
```
NOT the service-binding URL (`/sap/opu/odata4/sap/zsb_...`) — the system uses `/iwbep/all` auto-exposure.

### Write tool template (action call)

```js
// tools/createTransferOrder.js
import { s4hGet, s4hPost } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function createTransferOrder({ warehouse, movementType, material, plant,
    quantity, unitOfMeasure, sourceType, sourceBin, destType, destBin }) {

  // Pre-snapshot latest TO number to handle race condition if action returns no TO number
  const beforeSnap = await s4hGet(
    `${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1&$select=TransferOrderNumber`
  );
  const lastBefore = beforeSnap?.value?.[0]?.TransferOrderNumber ?? null;

  // Static action — POST to entity set with namespace-qualified action name
  const path = `${BASE}/WMTransferOrder/${NS}.CreateTransferOrder`;
  const data = await s4hPost(path, {
    WarehouseNumber: warehouse,
    MovementType:    movementType,
    Material:        material,
    Plant:           plant,
    Quantity:        String(quantity),
    UnitOfMeasure:   unitOfMeasure,
    SourceStorageType: sourceType ?? '',
    SourceBin:       sourceBin ?? '',
    DestStorageType: destType,
    DestBin:         destBin
  });

  // Resolve TO number — action result may not carry entity field components (RAP limitation)
  let transferOrderNumber = data?.value?.[0]?.TransferOrderNumber ?? null;
  if (!transferOrderNumber) {
    const afterSnap = await s4hGet(
      `${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1&$select=TransferOrderNumber`
    );
    const latestAfter = afterSnap?.value?.[0]?.TransferOrderNumber ?? null;
    if (latestAfter && latestAfter !== lastBefore) {
      transferOrderNumber = latestAfter;
    }
  }

  return {
    success: transferOrderNumber !== null,
    warehouse,
    transferOrderNumber,
    warning: transferOrderNumber ? undefined : 'TO may have been created but number could not be resolved — check LT21'
  };
}
```

---

## Step 3 — Register in index.js

```js
// In index.js — import
import { binStatusTool } from './tools/binStatus.js';
import { createTransferOrderTool } from './tools/createTransferOrder.js';

// In the tools array / server.setRequestHandler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    binStatusTool,
    createTransferOrderTool,
    // ... other tools
  ].map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tools = [binStatusTool, createTransferOrderTool];
  const tool = tools.find(t => t.name === request.params.name);
  if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
  return tool.execute(request.params.arguments);
});
```

---

## WM-specific gotchas in Node.js tools

| Issue | Fix |
|---|---|
| **OData filter injection** | Always `import { esc } from '../lib/sanitize.js'` and wrap every string param: `'${esc(warehouse)}'` |
| **data.value crash** | Always use `data.value ?? []` — never `data.value` bare. Returns null on empty result sets. |
| **Paginated results** | Always return `truncated: rows.length === top` so Claude knows when results are capped |
| Material leading spaces | `r.Material?.trimStart?.() ?? r.Material` — MATNR in LQUA has leading spaces |
| Warehouse number format | Classic WM warehouse numbers are 3 chars (`102`), not 4-padded — do NOT pad unless your system uses 4-char numbers |
| OData URL | Use `/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/` — NOT the service binding URL |
| Action namespace | Static actions: POST to `/{EntitySet}/{NS}.{ActionName}` where NS = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001` |
| Action result | RAP static action `result [1] $self` does not expose entity field components — do a follow-up GET to retrieve created entity key |
| CSRF on POST | `s4hPost` in `lib/s4hClient.js` handles CSRF fetch + 403 retry automatically — cached per session |
| $filter + $orderby | Cannot be combined in this OData config — use separately in different requests |
| TLS self-signed cert | Controlled by `SAP_INSECURE=true` env var — never hardcode `rejectUnauthorized: false` |
