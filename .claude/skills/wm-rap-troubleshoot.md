# Skill: /wm-rap-troubleshoot

Diagnose and fix common RAP issues in the SAP Classic WM MCP service.

Adapted from weiserman/rap-skills `rap-troubleshoot` for on-premise S/4H with classic WM.

## When to use
- Activation error on a CDS view, BDEF, or ABP class
- OData service returns HTTP 404 or 403
- BAPI call succeeds but no data is committed
- Runtime dump in a handler method

---

## Diagnostic tools (VSP)

| VSP Tool | When to use |
|---|---|
| `SyntaxCheck` | After every source edit — catch errors before activation |
| `GetInactiveObjects` | See what needs to be activated |
| `Activate` | Activate a specific object |
| `ListDumps` | See recent runtime errors (ST22) |
| `GetDump` | Read full dump details |
| `SetBreakpoint` | Set a user breakpoint in ABP handler |
| `DebuggerListen` | Start debugger session for the next call |
| `ListTraces` | Check performance traces |

---

## Problem 1 — CDS view activation error

**Symptom:** `SyntaxCheck` or `Activate` returns error on a CDS view.

**Common causes:**

| Error message | Fix |
|---|---|
| `Field 'MANDT' must be selected` | Remove MANDT from key fields or add `@ClientHandling.algorithm: #SESSION_VARIABLE` |
| `Association target not found` | Activate the target view first, then the source |
| `provider contract transactional_query requires key` | All key fields from the interface view must appear in the projection |
| `LGPLA_LTR does not exist` | Check field name in the actual LGPLA table on this system: `SELECT * FROM dd03l WHERE tabname = 'LGPLA'` |

**Verify classic WM field names on the system:**
```abap
SELECT fieldname, rollname FROM dd03l
  WHERE tabname = 'LGPLA'
  ORDER BY position
  INTO TABLE @DATA(lt_fields).
```

---

## Problem 2 — BDEF activation error

**Symptom:** Behavior definition fails to activate.

**Common causes:**

| Error | Fix |
|---|---|
| `Implementation class not found` | Create ZBP_R_WM{Entity} — class must exist before BDEF activates |
| `Action parameter type not found` | Create the DDIC structure first and activate it |
| `strict(2) violation` | BDEF declares operation not implemented in ABP class — add the missing method |
| `Entity does not have a key` | All key fields must be present in the interface CDS view |

---

## Problem 3 — OData service returns 404

**Symptom:** `curl` against the service URL returns HTTP 404.

**Diagnosis steps:**
1. Check if service binding is published: open `/IWFND/V4_ADMIN` → look for `ZSB_WMMcpService_OData4_UI`
2. If not listed: in ADT, open the service binding → click "Publish"
3. If listed but still 404: check the URL path is correct

**Correct URL pattern:**
```
https://{host}:{port}/sap/opu/odata4/sap/{service_binding_name_lowercase}/srvd/sap/{service_def_name_lowercase}/0001/{EntitySet}
```

Example:
```
https://172.0.0.21:44300/sap/opu/odata4/sap/zsb_wmmcpservice_odata4_ui/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin
```

---

## Problem 4 — OData returns 403 Forbidden

**Symptom:** Service URL reachable but returns 403.

**Causes:**
1. User NOMANH missing authorization for the service → check `SU53` after failed call
2. `@AccessControl.authorizationCheck: #NOT_REQUIRED` missing on CDS view → add it
3. Service not assigned to user role → for dev/test, add `S_SERVICE` authorization directly

---

## Problem 5 — TO created in SAP but not committed / not visible

**Symptom:** `L_TO_CREATE_SINGLE` runs without error but the TO does not appear in the system.

**Cause:** `BAPI_WHSE_TO_CREATE_STOCK` and `BAPI_WHSE_TO_CONFIRM` do NOT exist as standard SAP classic WM BAPIs — do not use them. The correct FMs are `L_TO_CREATE_SINGLE` and `L_TO_CONFIRM`.

`L_TO_CREATE_SINGLE` internally calls `COMMIT WORK` — this is illegal inside a RAP action handler (`BEHAVIOR_ILLEGAL_STATEMENT`).

**Fix:** Wrap `L_TO_CREATE_SINGLE` in an RFC-enabled Z function module and call it via `DESTINATION 'NONE'` loopback. The COMMIT runs in the isolated RFC session.

`L_TO_CONFIRM` does NOT commit — call it directly from the RAP handler with `i_commit_work = ' '`. The RAP saver handles the LUW.

See lessons learned entry #1 for the full code pattern.

---

## Problem 6 — Runtime dump in handler method

**Symptom:** Action call returns HTTP 500, dump recorded in SM21/ST22.

**Steps:**
1. Use `ListDumps` to find the dump
2. Use `GetDump` to read exception class, program, line number
3. Common exceptions:

| Exception | Cause | Fix |
|---|---|---|
| `CX_SY_ITAB_LINE_NOT_FOUND` | `keys[ 1 ]` on empty keys table | Use `READ TABLE keys INDEX 1 INTO ...` with `sy-subrc` check |
| `CX_SY_CONVERSION_NO_NUMBER` | String to number conversion failed | Validate input parameter before converting |
| `BAPI_WHSE_TO_CREATE_STOCK` dumps | BAPI itself has a runtime error | Check SM21, usually missing customizing |

---

## Problem 7 — MCP tool returns empty result

**Symptom:** Claude calls the MCP tool but gets empty array or no records.

**Diagnosis:**
1. Run the OData URL directly in the browser / curl — does it return data?
2. Check the `$filter` expression in the Node.js tool — is the field name correct?
3. Classic WM field: warehouse numbers in LGPLA are 4-char left-padded (e.g. `0001` not `1`) — check padding

**Example fix in Node.js tool:**
```js
// Wrong — WM warehouse numbers are padded
const warehouseId = params.warehouseId;

// Correct — pad to 4 characters
const warehouseId = params.warehouseId.padStart(4, '0');
```

---

## Problem 8 — Empty bin logic wrong

**Symptom:** `find_empty_bins` returns bins that actually have stock, or misses empty bins.

**Root cause:** `LGPLA.LGPLA_LTR = 'X'` is set by WM posting transactions but may lag in some configurations.

**More reliable approach** — count LQUA records:

```abap
" In CDS view: derive IsEmpty from LQUA count
define view entity ZR_WMStorageBin
  as select from lgpla as bin
    left outer join lqua as stock
      on  stock.lgnum = bin.lgnum
      and stock.lgtyp = bin.lgtyp
      and stock.lgpla = bin.lgpla
{
  key bin.lgnum as WarehouseNumber,
  key bin.lgtyp as StorageType,
  key bin.lgpla as StorageBin,
      -- bin is empty if no LQUA record exists
      case stock.lqnum
        when null then cast( 'true'  as abap.char(5) )
                  else cast( 'false' as abap.char(5) )
      end       as IsEmpty
}
```

---

## Problem 9 — SAP table/field name pitfalls (confirmed via live ADT queries)

When using `GetTableContents` or `RunQuery` to investigate WM data, use these correct names:

| Common mistake | Actual correct name | Notes |
|---|---|---|
| Table `LGPLA` (bin master) | Table `LAGP` | `LGPLA` is a **field name** (storage bin), not a table |
| `LQUA.LGMNG` (stock qty) | `LQUA.GESME` | GESME = total stock; EINME = in-transfer qty |
| `LTAK.AUART` (movement type) | `LTAK.BWLVS` | AUART doesn't exist in LTAK |
| `LTAK.STATUS` | No direct status field | Confirmed = LTAP.NISTM = LTAP.NSOLM per item |
| `LTBK.TBSTA` or `LTBK.STATUS` | `LTBK.STATU` | STATU: `' '`=open, `'B'`=partial, `'T'`=TO created, `'E'`=complete |
| `LAGP.KZINV` as boolean | `LAGP.KZINV` as string code | `' '`=normal, `'PZ'`=cycle count lock, `'ST'`=posted, `'PN'`=difference posting |
| `LAGP.KZLER` as boolean | Works — but value is `'X'`/`' '` in ABAP | In OData: `IsEmpty eq true` |

**LQUA EINME vs GESME:**
- `GESME` = total physical stock at the bin (what's actually there)
- `EINME` = quantity currently in transfer TO (reserved — being moved in or out)
- Available stock = GESME − EINME

**LTAK has no STATUS column:** To determine if a TO is confirmed, join LTAP and check that `NISTM = NSOLM` for all items. If NISTM = 0, the TO is unconfirmed.

---

## Quick diagnostic checklist

```
□ SyntaxCheck passes on all modified objects?
□ All objects activated (GetInactiveObjects = empty)?
□ Service binding published in /IWFND/V4_ADMIN (or CCCATEGORY=C for auto-exposure)?
□ OData URL uses /iwbep/all/srvd/sap/ pattern (not service-binding URL)?
□ OData URL returns HTTP 200 with test data?
□ L_TO_CREATE_SINGLE called via ZWM_TO_CREATE RFC wrapper (not directly)?
□ L_TO_CONFIRM called with i_commit_work = ' ' (RAP saver handles LUW)?
□ esc() applied to all string OData filter parameters?
□ data.value ?? [] used (never bare data.value)?
□ truncated: rows.length === top added to paginated responses?
□ Node.js tool field names match CDS view property names (camelCase)?
```
