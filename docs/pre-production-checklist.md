# Pre-Production Checklist

Items that are acceptable for dev/demo but must be resolved before any production deployment.

---

## 1. ABAP Authorization Checks (CDS Access Control)

**Status:** Not implemented — all CDS views use `#NOT_REQUIRED`
**Priority:** HIGH — security gap
**Effort:** ~1 day ABAP work

### Problem

All 7 CDS views in `ZSD_WMMcpService` currently carry:

```abap
@AccessControl.authorizationCheck: #NOT_REQUIRED
```

This means any user with HTTP access to the OData service endpoint can read **all WM data** regardless of their SAP authorization objects. Standard WM authorizations (e.g. `L_LGNUM` for warehouse access) are completely bypassed.

### Fix Required

For each CDS view, create a corresponding DCLS (Data Control Language Source) object and switch the annotation to `#CHECK`.

**Objects to create:**

| CDS View | DCLS File | Authorization Object |
|---|---|---|
| `ZR_WMStoragBin` | `ZR_WMSTORAGBIN.dcls.asdcls` | `L_LGNUM` (warehouse number) |
| `ZC_WMStoragBin` | `ZC_WMSTORAGBIN.dcls.asdcls` | `L_LGNUM` |
| `ZR_WMWarehouseStock` | `ZR_WMWAREHOUSESTOCK.dcls.asdcls` | `L_LGNUM` + `M_MATE_WMB` |
| `ZC_WMWarehouseStock` | `ZC_WMWAREHOUSESTOCK.dcls.asdcls` | `L_LGNUM` + `M_MATE_WMB` |
| `ZR_WMTransferOrder` | `ZR_WMTRANSFERORDER.dcls.asdcls` | `L_LGNUM` |
| `ZR_WMTransferOrderItem` | `ZR_WMTRANSFERORDERITEM.dcls.asdcls` | `L_LGNUM` |
| `ZR_WMTransferRequirement` | `ZR_WMTRANSFERREQUIREMENT.dcls.asdcls` | `L_LGNUM` |
| `ZR_WMIMStock` | `ZR_WMIMSTOCK.dcls.asdcls` | `M_MATE_WMB` + `M_MSEG_WMB` |
| `ZR_WMCycleCountBin` | `ZR_WMCYCLECOUNTBIN.dcls.asdcls` | `L_LGNUM` + `L_TCODE` (LI01/LI02) |

**Example DCLS for warehouse-scoped access:**

```abap
@EndUserText.label: 'Access control for WM Storage Bin'
define role ZR_WMStoragBin {
  grant select on ZR_WMStoragBin
    where (WarehouseNumber) = aspect pfcg_auth(L_LGNUM, LGNUM, ACTVT='03');
}
```

**Steps:**
1. Create DCLS object via ADT (New → Other ABAP Repository Object → Access Control)
2. Write the role definition with appropriate `pfcg_auth` conditions
3. Change `@AccessControl.authorizationCheck: #NOT_REQUIRED` → `#CHECK` in the CDS view
4. Reactivate the CDS view
5. Export both files to `abap/src/` via abapGit sync

### Reference
- SAP Help: [CDS Access Control](https://help.sap.com/docs/abap-cloud/abap-rap/access-control)
- Auth object `L_LGNUM`: field `LGNUM` (warehouse number), `ACTVT` (03=display, 01=create, 02=change)
- Auth object `M_MATE_WMB`: material master WM authorization

---

## 2. Transport Strategy for Production

**Status:** All objects on transport S4HK902492 (dev/demo system)
**Priority:** MEDIUM
**Effort:** BASIS coordination

For a real customer installation via transport (not abapGit), ensure:
- All ABAP objects (CDS views, DCLS, behavior definitions, service binding) are on a released transport
- Service binding is published in the target system (`ZSB_WMMCPSERVICE_ODATA4_UI`)
- If using `/IWBEP/ALL` auto-exposure: target client must be `CCCATEGORY = C`
- If target client is not `CCCATEGORY = C`: explicit service publication required via `/IWFND/V4_ADMIN`

---

## 3. TLS Configuration

**Status:** `SAP_INSECURE=true` in `.env` (self-signed cert bypass)
**Priority:** MEDIUM
**Effort:** Infrastructure

For production:
- Remove `SAP_INSECURE=true`
- Install a proper TLS certificate on the S/4H system, or
- Add the system's CA certificate to the Node.js trust store (`NODE_EXTRA_CA_CERTS`)

---

## 4. Credential Management

**Status:** Basic auth credentials in `.env` file
**Priority:** HIGH for cloud deployment
**Effort:** Part of Phase 2 (BTP CF)

For Phase 2 (BTP CF deployment):
- Replace `.env` basic auth with XSUAA OAuth2 + Cloud Connector
- Service account with minimum required authorizations (read-only for analytics tools, write for TO tools)
- Credentials managed via BTP service bindings, not environment variables
