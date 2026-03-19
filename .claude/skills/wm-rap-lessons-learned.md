# Skill: /wm-rap-lessons-learned

Reference guide of hard-won lessons from building the WM RAP service.
Consult this before starting any new RAP action or ABAP edit to avoid known pitfalls.

---

## 1. COMMIT WORK / UPDATE TASK is illegal in RAP action handlers

**Symptom:** Runtime error `BEHAVIOR_ILLEGAL_STATEMENT`

**Cause:** `L_TO_CREATE_SINGLE` internally calls `COMMIT WORK` and `CALL FUNCTION ... IN UPDATE TASK`.
Both are forbidden during the RAP INTERACT phase — even in unmanaged RAP.

**Fix:** Wrap the FM in an RFC-enabled Z function module. Call it with `DESTINATION 'NONE'`.
The COMMIT WORK runs in the loopback RFC session and does not touch the RAP LUW.

```abap
CALL FUNCTION 'ZWM_TO_CREATE'
  DESTINATION 'NONE'
  EXPORTING ...
  EXCEPTIONS
    system_failure        = 1 MESSAGE lv_rfc_errtxt  " lv_rfc_errtxt must be TYPE c, NOT string
    communication_failure = 2 MESSAGE lv_rfc_errtxt
    OTHERS                = 3.
```

**Do NOT confuse with `L_TO_CONFIRM`** — that FM does not commit and can be called directly.

---

## 2. LIKE is invalid in OO ABAP class methods

**Symptom:** Syntax error: `"LIKE" not allowed here`

**Cause:** `DATA lv_anfme LIKE rl03t-anfme` is invalid inside a CLASS ... IMPLEMENTATION block.
`LIKE` is only valid in function modules and subroutines.

**Fix:** Find the DDIC rollname (data element) and use `TYPE`:

```sql
SELECT SINGLE rollname FROM dd03l WHERE tabname = 'RL03T' AND fieldname = 'ANFME'
" → RL03TANFME
```

```abap
DATA lv_anfme TYPE rl03tanfme.   " correct
DATA lv_anfme LIKE rl03t-anfme.  " syntax error in OO context
```

---

## 3. MESSAGE clause in RFC EXCEPTIONS requires TYPE c, not string

**Symptom:** Syntax error: `"LV_MSG" must be a character-like field (data type C, N, D, or T)`

**Cause:** `EXCEPTIONS system_failure = 1 MESSAGE lv_msg` where `lv_msg TYPE string` fails.

**Fix:** Declare the error text variable as a fixed-length character type:

```abap
DATA lv_rfc_errtxt(255) TYPE c.   " correct
DATA lv_msg TYPE string.           " causes syntax error in MESSAGE clause
```

---

## 4. L_TO_CREATE_SINGLE — error_message exception

`L_TO_CREATE_SINGLE` can raise a `MESSAGE E` internally (e.g. for stock check failures)
without using the RAISING clause. This does NOT map to a named EXCEPTIONS entry automatically.

**Fix:** Always include `error_message = 10` in the EXCEPTIONS block and reconstruct the text:

```abap
EXCEPTIONS
  ...
  error_message = 10
  OTHERS        = 11.

IF sy-subrc = 10.
  MESSAGE ID sy-msgid TYPE 'S' NUMBER sy-msgno
    INTO ev_msg
    WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
ENDIF.
```

Without `error_message = 10`, the MESSAGE E propagates upward and may dump.

---

## 5. RAP static action result does not expose entity field components

**Symptom:** Syntax error: `No component exists with the name "WAREHOUSENUMBER"`
when trying to set entity fields in the result table via `VALUE #(WarehouseNumber = ...)`.

**Cause:** For `static action ... result [1] $self`, the RAP framework generates a result
table type whose line type exposes only `%cid` to the handler — no entity field names,
not with `VALUE #()`, not with `%key-XYZ`, not with field names directly.

**Fix (ABAP side):** Use `DATA ls_res LIKE LINE OF result` + `ASSIGN COMPONENT` dynamically.
The components don't exist at runtime either, so `sy-subrc <> 0` — the assignment silently
does nothing. The result row only carries `%cid`.

**Fix (Node.js side):** After the action POST, do a follow-up GET to retrieve the TO number:
```javascript
const latest = await s4hGet(`${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1`);
transferOrderNumber = latest?.value?.[0]?.TransferOrderNumber ?? null;
```

---

## 6. EditSource on CCIMP — use the include URL, not the class URL

**Symptom:** `EditSource` targets class URL but doesn't find local class method content,
OR returns URI-mapping error when `method:` param is used.

**Root cause:** The `method:` parameter only works for global class methods. Local class
methods (lhc_*, lcl_*) are in the CCIMP include.

**Fix:** Always target the CCIMP include URL directly:
```
object_url: /sap/bc/adt/oo/classes/zbp_r_wmtransferorder/includes/implementations
```
Do NOT include `method:` parameter. EditSource handles lock/unlock internally.

---

## 7. $filter and $orderby cannot be combined in this OData gateway config

**Symptom:** `"No duplicate custom query options allowed"` when combining `$filter` + `$orderby`

**Cause:** The CDS service binding does not have full `@Capabilities` annotations — the gateway
rejects certain query option combinations.

**Workaround:** Use them separately:
- `?$orderby=TransferOrderNumber desc&$top=1` — works (to get latest TO)
- `?$filter=WarehouseNumber eq '102'` — works (but returns all, needs paging)
- `?$filter=...&$orderby=...` — does NOT work in this system

---

## 8. ADT function group creation may be blocked by CUA

**Symptom:** `POST /sap/bc/adt/functions/groups` returns 404 with
`"System S4HCLNT100 is not part of Central User Administration"`

**Cause:** The ADT REST endpoint for creating function groups requires CUA authorization
in some system configurations. The VSP `EditSource` tool also cannot create new FMs.

**Fix:** Create the function group and function module manually in SE37, then use
`GetSource` to read it back and `EditSource` to modify the source.

---

## 9. SU-managed storage types require LENUM as TO destination

**Symptom:** `"No storage unit number available"` error from `L_TO_CREATE_SINGLE`

**Cause:** Storage types with `LPTYP` set in LAGP (e.g. type 001 with LPTYP=E1/E2)
require a storage unit number (`i_nlenr`) when used as the TO destination.

**Fix:** Either provide a valid LENUM, or use a non-SU-managed storage type as destination.
Check `LAGP.LPTYP` — blank = not SU-managed, value = SU-managed.
In warehouse 102, type 003 is not SU-managed and has many empty bins (1-011 through 1-023).

---

## 10. i_anfme type must match RL03TANFME, not ltap-anfme

`L_TO_CREATE_SINGLE` parameter `I_ANFME` is typed as `TYPE RL03TANFME` (a packed decimal
DDIC element), not as `LTAP-ANFME`. Passing a variable typed as `ltap-anfme` causes a
type conflict at the FM interface.

**Fix:** Always declare quantity variables with:
```abap
DATA lv_anfme TYPE rl03tanfme.
```

To find DDIC element names for any field: `SELECT rollname FROM dd03l WHERE tabname = 'X' AND fieldname = 'Y'`

---

## 11. SAP table and field names — confirmed correct names via live system

Several commonly assumed names are wrong. These were confirmed via direct ADT RunQuery against warehouse 102:

| What you might guess | Correct | Why |
|---|---|---|
| Table `LGPLA` (bin master) | Table **`LAGP`** | `LGPLA` is a field name (storage bin number), not a table name |
| `LQUA.LGMNG` (quant stock) | `LQUA.GESME` | GESME = total stock; EINME = in-transfer quantity |
| `LTAK.AUART` (movement type) | `LTAK.BWLVS` | BWLVS = WM movement type (numeric, e.g. 999) |
| `LTAK.STATUS` | No STATUS column | Confirmed status derived from LTAP: NISTM = NSOLM per item |
| `LTBK.TBSTA` or `LTBK.STATUS` | `LTBK.STATU` | STATU: `' '`=open, `'B'`=partial, `'T'`=TO created, `'E'`=complete |
| `LTAP.ANFME` / `LTAP.ENQME` | `LTAP.NSOLM` / `LTAP.NISTM` | NSOLM = planned qty, NISTM = confirmed qty (ANFME/ENQME don't exist) |
| `LAGP.KZINV` as a boolean | String code field | `' '`=normal, `'PZ'`=cycle count lock, `'ST'`=posted, `'PN'`=difference posting |

**LQUA stock fields:**
- `GESME` = total physical stock at the bin (what is there)
- `EINME` = quantity currently reserved by an open TO (in transfer — picked up but not placed)
- `BDATU` = date of last movement
- Available = GESME − EINME

---

## 12. LTAK has no confirmation status column — derive it from LTAP

Classic WM LTAK does not have a STATUS or confirmation flag field. To determine whether a TO is open vs. confirmed:

- **Unconfirmed:** At least one LTAP item has `NISTM = 0`
- **Confirmed:** All LTAP items have `NISTM = NSOLM` (confirmed qty = planned qty)
- **Partially confirmed:** Some items confirmed, others not

In Node.js tool patterns: fetch headers with a filter, fetch items for those TOs separately, join in memory and check `NISTM` vs `NSOLM` per item.

---

## 13. LTBK status 'T' and 'E' — confirmed meaning

Confirmed via direct LTBP query (checking ELIKZ field on TR items for status 'E' TRs):

| LTBK.STATU | Meaning | Actionable? |
|---|---|---|
| `' '` (space) | Open — no TO created yet | Yes — create TO |
| `'B'` | Partial — some items have TOs | Check items |
| `'T'` | TO created — waiting for confirmation | Confirm the TO |
| `'E'` | Complete (Erledigt) | No — already done |

TRs with STATU = 'T' for >7 days are overdue — the TO was created but never confirmed.
TRs with STATU = ' ' for >30 days are severely overdue — no TO was ever created.

---

## 14. OData filter injection — always use esc()

Any string parameter interpolated into an OData `$filter` string is an injection vector.
The OData v4 spec (§5.1.1.6.1) defines escaping as **doubling single quotes**.

```js
// lib/sanitize.js — always import this
import { esc } from '../lib/sanitize.js';

// WRONG — injection possible
`WarehouseNumber eq '${warehouse}'`

// CORRECT
`WarehouseNumber eq '${esc(warehouse)}'`
```

A value like `102' or '1' eq '1` would break a filter without esc(). The `esc()` function converts it to `102'' or ''1'' eq ''1` which is treated as a literal string by the OData engine.

**Rule:** Every string param gets `esc()`. Numbers and booleans do not need it.

---

## 15. Always include `truncated` flag in paginated tool responses

When a tool fetches a fixed `$top` limit, Claude has no way of knowing if there is more data unless the tool reports it.

```js
const rows = data.value ?? [];

return {
  truncated: rows.length === top,   // true = there is likely more data
  count: rows.length,
  results: rows.map(...)
};
```

Without this, Claude may present a partial result as complete — especially dangerous for negative stock or anomaly reports where missing records mean missed actions.

**Rule:** Every tool that uses `$top` must return `truncated: rows.length === top`.
