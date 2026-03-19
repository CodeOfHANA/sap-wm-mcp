# Skill: /wm-check-service

Verify the custom RAP OData V4 service for sap-wm-mcp is published and reachable.

## When to use
- After activating or publishing the service binding in ADT
- Before starting to build MCP tools (Phase 1)
- When a tool returns 404 or empty results

---

## Step 1 — Check service metadata

```bash
curl -u NOMANH:PASSWORD \
  -k \
  "https://172.0.0.21:44300/sap/opu/odata4/sap/zsb_wmmcpservice_odata4_ui/srvd/sap/zsd_wmmcpservice/0001/$metadata"
```

**Expected:** HTTP 200 with XML metadata listing `WMStorageBin`, `WMWarehouseStock`, `WMTransferOrder` entity sets.
**If 404:** Service binding not published — see Step 2.
**If 403:** Authorization issue — see Step 3.

---

## Step 2 — Publish the service binding

If metadata returns 404:

1. Open ADT in Eclipse
2. Find service binding `ZSB_WMMcpService_OData4_UI` in package `ZWM_MCP`
3. Click **Publish** button in the service binding editor
4. Or publish via `/IWFND/V4_ADMIN`:
   - Transaction: `/n/IWFND/V4_ADMIN`
   - Add service group: search for `ZSB_WMMCPSERVICE_ODATA4_UI`
   - Assign to system alias `LOCAL`

Retry the metadata request.

---

## Step 3 — Check authorization

If metadata returns 403:

```bash
# Check what authorization is missing
# After a failed call, run SU53 in SAP GUI as NOMANH
```

For development: add authorization object `S_SERVICE` with:
- `SRV_NAME = ZSB_WMMCPSERVICE_ODATA4_UI`
- `SRV_TYPE = HT`

---

## Step 4 — Smoke test each entity set

Run these after metadata confirms:

```bash
BASE="https://172.0.0.21:44300/sap/opu/odata4/sap/zsb_wmmcpservice_odata4_ui/srvd/sap/zsd_wmmcpservice/0001"
AUTH="NOMANH:PASSWORD"

# Storage bins — expect bin records
curl -u $AUTH -k "$BASE/WMStorageBin?\$top=3"

# Warehouse stock (quants) — expect stock records
curl -u $AUTH -k "$BASE/WMWarehouseStock?\$top=3"

# Transfer orders — may be empty if no open TOs
curl -u $AUTH -k "$BASE/WMTransferOrder?\$top=3"
```

**Expected for each:** HTTP 200 with `{"@odata.context": "...", "value": [...]}`
**If value is empty array:** Entity set works but no data in system — OK for now.
**If HTTP 500:** Runtime error — use `ListDumps` in VSP to find the dump.

---

## Step 5 — Check filter capability

MCP tools use `$filter` — verify it works:

```bash
# Filter bins by warehouse number
curl -u NOMANH:PASSWORD -k \
  "$BASE/WMStorageBin?\$filter=WarehouseNumber%20eq%20'0001'&\$top=5"

# Filter stock by material
curl -u NOMANH:PASSWORD -k \
  "$BASE/WMWarehouseStock?\$filter=Material%20eq%20'TESTMAT'&\$top=5"
```

**If filter fails with 400/501:** The CDS view may be missing `@Search.searchable` or the field is not filterable.
**Fix:** Add `@ObjectModel.filter.enabled: true` on the field in the CDS projection view.

---

## Service URL reference

| Entity set | URL suffix |
|---|---|
| Metadata | `/$metadata` |
| Storage bins | `/WMStorageBin` |
| Warehouse stock | `/WMWarehouseStock` |
| Transfer orders | `/WMTransferOrder` |
| Transfer order items | `/WMTransferOrderItem` |

Base URL pattern:
```
https://172.0.0.21:44300/sap/opu/odata4/sap/zsb_wmmcpservice_odata4_ui/srvd/sap/zsd_wmmcpservice/0001
```

Note: `zsb_wmmcpservice_odata4_ui` is the **service binding name in lowercase**.
Note: `zsd_wmmcpservice` is the **service definition name in lowercase**.

---

## Expected output when everything is working

```
✅ GET /$metadata         → 200 OK, XML with entity types
✅ GET /WMStorageBin      → 200 OK, bin records
✅ GET /WMWarehouseStock  → 200 OK, quant records (or empty array)
✅ GET /WMTransferOrder   → 200 OK (may be empty if no open TOs)
✅ $filter works          → 200 OK with filtered results
```

When all checks pass — the RAP service is ready. Run `/wm-add-tool` to start building MCP tools.
