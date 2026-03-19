# Skill: /wm-rap-scaffold

Scaffold the complete RAP Business Object stack for the SAP Classic WM MCP service.

## When to use
Run this skill when starting from scratch or adding a new transactional entity to the RAP service for `sap-wm-mcp`.

## Critical rules (learned from live S/4H 757 development)

| Rule | Wrong | Correct |
|---|---|---|
| Interface view for transactional entity | `define view entity` | **`define root view entity`** |
| Implementation mode | `managed` | **`unmanaged`** |
| BAPIs for WM TOs | `BAPI_WHSE_TO_CREATE_STOCK` / `BAPI_WHSE_TO_CONFIRM` | **`L_TO_CREATE_SINGLE`** / **`L_TO_CONFIRM`** |
| Storage unit confirm | — | **`L_TO_CONFIRM_SU`** |
| BP class locals | EditSource / WriteSource | **`ImportFromFile` with `.clas.locals_imp.abap`** |
| Composition root annotation | `@ObjectModel.compositionRoot: true` | **NOT for RAP** — use `define root view entity` |
| `strict(2)` | Required | **Optional** — if used, requires `lock master` + `authorization master` |

## What this builds

For a transactional entity (e.g. WMTransferOrder):

1. **Abstract entity** `ZA_WM{Action}Param` — action input parameter type
2. **CDS interface view** `ZR_WM{Entity}` — `define root view entity` over classic WM table
3. **CDS projection view** `ZC_WM{Entity}` — `as select from` with UI annotations
4. **Behavior definition** `ZR_WM{Entity}` — unmanaged, declares actions
5. **BP class global** `ZBP_R_WM{Entity}` — empty ABSTRACT FINAL shell
6. **BP class locals_imp** — handler + saver, written via `ImportFromFile`
7. **Service definition** `ZSD_WMMcpService` — expose the interface view (with BDEF)

For read-only entities (WMStorageBin, WMWarehouseStock): no BDEF needed. Just CDS views exposed in service.

## Step 1 — Abstract entity for action parameters

```cds
@EndUserText.label: 'WM Create Transfer Order Parameters'
define abstract entity ZA_WMCreateTOParam {
  WarehouseNumber   : abap.char(3);
  MovementType      : abap.char(3);
  Material          : abap.char(40);
  Plant             : abap.char(4);
  Quantity          : abap.dec(13,3);
  UnitOfMeasure     : abap.char(3);
  SourceStorageType : abap.char(3);
  SourceBin         : abap.char(10);
  DestStorageType   : abap.char(3);
  DestBin           : abap.char(10);
}
```

Use `WriteSource` with `object_type=DDLS`.

## Step 2 — Interface CDS view (MUST use `define root view entity`)

```cds
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Transfer Order'
define root view entity ZR_WMTransferOrder
  as select from ltak
{
  key lgnum     as WarehouseNumber,
  key tanum     as TransferOrderNumber,
      bwlvs     as MovementType,
      kquit     as IsConfirmed,
      bdatu     as CreatedDate,
      bzeit     as CreatedTime,
      bname     as CreatedBy,
      trart     as ShipmentType,
      tbnum     as TransferReqNumber,
      noitm     as NumberOfItems
}
```

**`define root view entity` is mandatory** for transactional RAP entities on ABAP 757. Using `define view entity` causes "not part of a composition hierarchy" errors on the BP class.

## Step 3 — Projection CDS view

For read-only projection (MCP server pattern — no Fiori transactional UI needed):

```cds
@EndUserText.label: 'WM Transfer Order'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define view entity ZC_WMTransferOrder
  as select from ZR_WMTransferOrder
{
  key WarehouseNumber,
  key TransferOrderNumber,
      MovementType,
      IsConfirmed,
      CreatedDate,
      CreatedTime,
      CreatedBy,
      NumberOfItems
}
```

Note: Use `as select from` (not `as projection on`) unless you're also building a Fiori UI with a separate projection BDEF.

## Step 4 — Behavior definition (unmanaged, no strict)

```abap
unmanaged implementation in class ZBP_R_WMTransferOrder unique;

define behavior for ZR_WMTransferOrder alias TransferOrder
{
  static action CreateTransferOrder parameter ZA_WMCreateTOParam result [1] $self;
  action ConfirmTransferOrder result [1] $self;
}
```

Key points:
- `unmanaged` — the implementation class handles everything
- No `strict(2)` — avoids mandatory lock/authorization boilerplate (add later if needed)
- `static action` — no entity key needed for creation
- `action` (instance) — operates on an existing TO by key

If you add `strict(2)`, you MUST also add `lock master` and `authorization master ( global )` to the behavior block, AND implement the corresponding handler methods.

## Step 5 — BP class global shell

```abap
CLASS zbp_r_wmtransferorder DEFINITION
  PUBLIC
  ABSTRACT
  FINAL
  FOR BEHAVIOR OF zr_wmtransferorder.
ENDCLASS.

CLASS zbp_r_wmtransferorder IMPLEMENTATION.
ENDCLASS.
```

Use `WriteSource` with `object_type=CLAS`. This only writes the global class — local handler goes in the next step.

## Step 6 — BP class locals_imp (CRITICAL: use ImportFromFile)

**You CANNOT write class local implementations via `WriteSource` or `EditSource`.**
The only working method is `ImportFromFile` with an abapGit-format file.

1. Write the handler code to a local file named exactly: `{CLASSNAME}.clas.locals_imp.abap`
   (e.g. `ZBP_R_WMTRANSFERORDER.clas.locals_imp.abap`)

2. Import it:
   ```
   ImportFromFile(
     file_path    = "/tmp/ZBP_R_WMTRANSFERORDER.clas.locals_imp.abap",
     package_name = "ZWM_MCP",
     transport    = "S4HK..."
   )
   ```

Handler template:

```abap
CLASS lcl_handler DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      read FOR READ
        IMPORTING keys FOR READ TransferOrder RESULT result,
      create_transfer_order FOR MODIFY
        IMPORTING keys FOR ACTION TransferOrder~CreateTransferOrder RESULT result,
      confirm_transfer_order FOR MODIFY
        IMPORTING keys FOR ACTION TransferOrder~ConfirmTransferOrder RESULT result.
ENDCLASS.

CLASS lcl_saver DEFINITION INHERITING FROM cl_abap_behavior_saver.
  PROTECTED SECTION.
    METHODS save_modified REDEFINITION.
ENDCLASS.

CLASS lcl_handler IMPLEMENTATION.

  METHOD read.
    LOOP AT keys INTO DATA(ls_key).
      SELECT SINGLE lgnum, tanum, bwlvs, kquit, bdatu, bzeit, bname, trart, tbnum, noitm
        FROM ltak
        WHERE lgnum = @ls_key-WarehouseNumber
          AND tanum = @ls_key-TransferOrderNumber
        INTO @DATA(ls_ltak).
      IF sy-subrc = 0.
        APPEND VALUE #(
          WarehouseNumber     = ls_ltak-lgnum
          TransferOrderNumber = ls_ltak-tanum
          MovementType        = ls_ltak-bwlvs
          IsConfirmed         = ls_ltak-kquit
          CreatedDate         = ls_ltak-bdatu
          CreatedTime         = ls_ltak-bzeit
          CreatedBy           = ls_ltak-bname
          ShipmentType        = ls_ltak-trart
          TransferReqNumber   = ls_ltak-tbnum
          NumberOfItems       = ls_ltak-noitm
        ) TO result.
      ELSE.
        APPEND VALUE #(
          %key  = ls_key
          %fail = VALUE #( cause = if_abap_behv=>cause-not_found )
        ) TO failed-transferorder.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD create_transfer_order.
    LOOP AT keys INTO DATA(ls_key).
      DATA(ls_param) = ls_key-%param.
      DATA lv_tanum  TYPE ltak-tanum.
      DATA ls_ltap   TYPE ltap.

      CALL FUNCTION 'L_TO_CREATE_SINGLE'
        EXPORTING
          i_lgnum = ls_param-WarehouseNumber
          i_bwlvs = ls_param-MovementType
          i_matnr = ls_param-Material
          i_werks = ls_param-Plant
          i_anfme = ls_param-Quantity
          i_altme = ls_param-UnitOfMeasure
          i_vltyp = ls_param-SourceStorageType
          i_vlpla = ls_param-SourceBin
          i_nltyp = ls_param-DestStorageType
          i_nlpla = ls_param-DestBin
        IMPORTING
          e_tanum = lv_tanum
          e_ltap  = ls_ltap
        EXCEPTIONS
          OTHERS  = 1.

      IF sy-subrc <> 0.
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = 'Transfer order creation failed' )
        ) TO reported-transferorder.
        CONTINUE.
      ENDIF.

      APPEND VALUE #(
        %cid_ref            = ls_key-%cid
        WarehouseNumber     = ls_param-WarehouseNumber
        TransferOrderNumber = lv_tanum
      ) TO result.
    ENDLOOP.
  ENDMETHOD.

  METHOD confirm_transfer_order.
    LOOP AT keys INTO DATA(ls_key).
      DATA lt_ltap_conf TYPE TABLE OF ltap_conf.

      SELECT lgnum, tanum, tapos, nltyp, nlpla, matnr, charg, werks,
             nsola, nsolm, altme, meins
        FROM ltap
        WHERE lgnum = @ls_key-WarehouseNumber
          AND tanum = @ls_key-TransferOrderNumber
          AND kzqui = @space
        INTO TABLE @DATA(lt_ltap).

      LOOP AT lt_ltap INTO DATA(ls_ltap).
        DATA ls_conf TYPE ltap_conf.
        ls_conf-lgnum = ls_ltap-lgnum.
        ls_conf-tanum = ls_ltap-tanum.
        ls_conf-tapos = ls_ltap-tapos.
        ls_conf-nltyp = ls_ltap-nltyp.
        ls_conf-nlpla = ls_ltap-nlpla.
        ls_conf-matnr = ls_ltap-matnr.
        ls_conf-charg = ls_ltap-charg.
        ls_conf-werks = ls_ltap-werks.
        ls_conf-nista = ls_ltap-nsola.   " actual = planned (no difference)
        ls_conf-nistm = ls_ltap-nsolm.
        ls_conf-altme = ls_ltap-altme.
        ls_conf-meins = ls_ltap-meins.
        APPEND ls_conf TO lt_ltap_conf.
      ENDLOOP.

      CALL FUNCTION 'L_TO_CONFIRM'
        EXPORTING
          i_lgnum  = ls_key-WarehouseNumber
          i_tanum  = ls_key-TransferOrderNumber
          i_squit  = 'X'   " full confirmation
        TABLES
          t_ltap_conf = lt_ltap_conf
        EXCEPTIONS
          OTHERS = 1.

      IF sy-subrc <> 0.
        APPEND VALUE #(
          %key = VALUE #( WarehouseNumber     = ls_key-WarehouseNumber
                          TransferOrderNumber = ls_key-TransferOrderNumber )
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = 'Transfer order confirmation failed' )
        ) TO reported-transferorder.
        CONTINUE.
      ENDIF.

      APPEND VALUE #(
        %key_in             = ls_key
        WarehouseNumber     = ls_key-WarehouseNumber
        TransferOrderNumber = ls_key-TransferOrderNumber
      ) TO result.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.

CLASS lcl_saver IMPLEMENTATION.
  METHOD save_modified.
    " L_TO_CREATE_SINGLE and L_TO_CONFIRM both call COMMIT_WORK internally
    " Nothing to do here
  ENDMETHOD.
ENDCLASS.
```

## Step 7 — Service definition (expose interface view, not projection)

For MCP server pattern, expose the interface view (`ZR_`) which carries the BDEF actions.
The projection view (`ZC_`) is a read-only layer and does not need to be in the service.

```abap
@EndUserText.label: 'WM MCP Service Definition'
define service ZSD_WMMcpService {
  expose ZC_WMStoragBin      as WMStorageBin;
  expose ZC_WMWarehouseStock as WMWarehouseStock;
  expose ZR_WMTransferOrder  as WMTransferOrder;   " interface view — carries the BDEF actions
}
```

## Activation order

1. Abstract entity (`ZA_WM{Action}Param`) — `WriteSource DDLS`
2. Interface CDS view (`ZR_WM{Entity}`) — `WriteSource DDLS`
3. Behavior definition (`ZR_WM{Entity}`) — `WriteSource BDEF` then `Activate`
4. BP class global shell (`ZBP_R_WM{Entity}`) — `WriteSource CLAS`
5. BP class locals_imp — `ImportFromFile .clas.locals_imp.abap`
6. Projection CDS view (`ZC_WM{Entity}`) — `WriteSource DDLS` (after BDEF is active)
7. Service definition (`ZSD_WMMcpService`) — `WriteSource SRVD`

## Classic WM function modules (correct list)

| FM | Function group | Purpose |
|---|---|---|
| `L_TO_CREATE_SINGLE` | L03B | Create single-item TO (equiv. LT01) |
| `L_TO_CREATE_MULTIPLE` | L03B | Create multi-item TO |
| `L_TO_CONFIRM` | L03B | Confirm TO (equiv. LT12) — uses `LTAP_CONF` table |
| `L_TO_CONFIRM_SU` | L03B | Confirm TO for storage unit management |

**`BAPI_WHSE_TO_CREATE_STOCK` and `BAPI_WHSE_TO_CONFIRM` do not exist** for classic WM. Always use the `L_TO_*` function modules.

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| "not part of a composition hierarchy" | Interface view uses `define view entity` | Change to `define root view entity` |
| "is not a root entity" | Using `lock master` without root view entity | Fix the CDS first, then add lock master |
| "strict requires lock master or lock dependent" | `strict(2)` without lock declaration | Add `lock master` + `authorization master ( global )` to behavior block |
| "Transactional Projection View must be part of a BO" | Projection view with `as projection on` before BDEF exists | Create BDEF first, or use `as select from` |
| EditSource: "old_string not found" | Class includes are separate files; EditSource only targets main source | Use `ImportFromFile` with `.clas.locals_imp.abap` |
