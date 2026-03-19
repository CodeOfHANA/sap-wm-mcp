# Skill: /wm-rap-behavior

Add or modify behavior logic for the SAP Classic WM RAP service — actions, validations, FM wrappers.

## When to use
- Add a new action (CreateTransferOrder, ConfirmTransferOrder, ConfirmTransferOrderSU)
- Modify handler logic in an existing action
- Wrap a classic WM FM as a RAP action

---

## Classic WM function modules (the real ones)

Classic WM has no BAPIs for TO operations. Use only these:

| FM | Purpose | Commit behavior |
|---|---|---|
| `L_TO_CREATE_SINGLE` | Create single-item TO | Calls COMMIT WORK internally — **ILLEGAL in RAP handler** |
| `L_TO_CONFIRM` | Confirm TO by number | Does NOT commit — safe to call directly in handler |
| `L_TO_CONFIRM_SU` | Confirm all TOs on a storage unit | Does NOT commit — safe to call directly in handler |

**These do NOT exist:** `BAPI_WHSE_TO_CREATE_STOCK`, `BAPI_WHSE_TO_CONFIRM`

---

## Critical: COMMIT WORK is illegal in RAP action handlers

`L_TO_CREATE_SINGLE` internally calls `COMMIT WORK` and `CALL FUNCTION ... IN UPDATE TASK`.
Both are illegal inside a RAP action handler — they cause `BEHAVIOR_ILLEGAL_STATEMENT` at runtime.

### Solution: RFC wrapper with DESTINATION 'NONE'

Create an RFC-enabled function module (e.g. `ZWM_TO_CREATE`) that wraps `L_TO_CREATE_SINGLE`.
Call it from the RAP handler using `CALL FUNCTION 'ZWM_TO_CREATE' DESTINATION 'NONE'`.

`DESTINATION 'NONE'` creates a loopback RFC session. The COMMIT WORK in `ZWM_TO_CREATE`
runs in that separate session — it does NOT violate the RAP handler's LUW.

### ZWM_TO_CREATE FM structure (RFC-enabled, function group ZWM_MFG, package ZWM_MCP)

```abap
FUNCTION zwm_to_create
  IMPORTING
    VALUE(i_lgnum) TYPE ltak-lgnum
    VALUE(i_bwlvs) TYPE ltak-bwlvs
    VALUE(i_matnr) TYPE ltap-matnr
    VALUE(i_werks) TYPE ltap-werks
    VALUE(i_anfme) TYPE rl03tanfme        " MUST be TYPE rl03tanfme — not ltap-anfme
    VALUE(i_altme) TYPE ltap-altme DEFAULT space
    VALUE(i_vltyp) TYPE ltap-vltyp DEFAULT space
    VALUE(i_vlpla) TYPE ltap-vlpla DEFAULT space
    VALUE(i_vlenr) TYPE ltap-vlenr DEFAULT space
    VALUE(i_nltyp) TYPE ltap-nltyp DEFAULT space
    VALUE(i_nlpla) TYPE ltap-nlpla DEFAULT space
    VALUE(i_nlenr) TYPE ltap-nlenr DEFAULT space
  EXPORTING
    VALUE(e_tanum)   TYPE ltak-tanum
    VALUE(ev_subrc)  TYPE sy-subrc
    VALUE(ev_msg)    TYPE string.

  CALL FUNCTION 'L_TO_CREATE_SINGLE'
    EXPORTING
      i_lgnum       = i_lgnum
      i_bwlvs       = i_bwlvs
      i_matnr       = i_matnr
      i_werks       = i_werks
      i_anfme       = i_anfme
      i_altme       = i_altme
      i_vltyp       = i_vltyp
      i_vlpla       = i_vlpla
      i_vlenr       = i_vlenr
      i_nltyp       = i_nltyp
      i_nlpla       = i_nlpla
      i_nlenr       = i_nlenr
      i_commit_work = 'X'               " Commit happens here, isolated in RFC session
    IMPORTING
      e_tanum       = e_tanum
    EXCEPTIONS
      no_to_created       = 1
      bwlvs_wrong         = 2
      manual_to_forbidden = 3
      material_not_found  = 4
      vltyp_wrong         = 5
      vlpla_wrong         = 6
      nltyp_wrong         = 7
      nlpla_wrong         = 8
      lenum_wrong         = 9
      error_message       = 10           " Catches MESSAGE E raised inside the FM
      OTHERS              = 11.

  ev_subrc = sy-subrc.
  IF sy-subrc = 10.
    " Reconstruct MESSAGE E text from SY-MSG* fields
    MESSAGE ID sy-msgid TYPE 'S' NUMBER sy-msgno
      INTO ev_msg
      WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ELSEIF sy-subrc <> 0.
    ev_msg = SWITCH #( sy-subrc
      WHEN 1  THEN 'No TO created - check stock, movement type, and bin'
      WHEN 2  THEN 'Movement type invalid for this warehouse'
      WHEN 3  THEN 'Manual TO creation not allowed for this movement type'
      WHEN 4  THEN 'Material not found in warehouse master (check MLGN)'
      WHEN 5  THEN 'Source storage type invalid'
      WHEN 6  THEN 'Source bin invalid or no stock found'
      WHEN 7  THEN 'Destination storage type invalid'
      WHEN 8  THEN 'Destination bin invalid'
      WHEN 9  THEN 'Storage unit number invalid'
      ELSE         |TO creation failed (RC { sy-subrc })| ).
  ENDIF.
ENDFUNCTION.
```

---

## BDEF structure (correct pattern)

```abap
unmanaged implementation in class ZBP_R_WMTransferOrder unique;

define behavior for ZR_WMTransferOrder alias TransferOrder
{
  static action CreateTransferOrder parameter ZA_WMCreateTOParam result [1] $self;
  action ConfirmTransferOrder result [1] $self;
  static action ConfirmTransferOrderSU parameter ZA_WMConfirmTOSUParam result [1] $self;
}
```

- `unmanaged` — NOT `managed`
- No `strict(2)` without `lock master` + `authorization master`
- `static action` for creation (no input key needed)
- `action` (instance) for confirmation (input key = entity key fields)

---

## How to edit the CCIMP (local implementations)

Use `EditSource` with the CCIMP URL directly:

```
object_url: /sap/bc/adt/oo/classes/zbp_r_wmtransferorder/includes/implementations
```

Do NOT use `method:` parameter — it only works for global class methods, not local class methods.
`EditSource` handles lock/unlock internally.

---

## create_transfer_order handler (calls RFC wrapper)

```abap
METHOD create_transfer_order.
  DATA: lv_lgnum           TYPE ltak-lgnum,
        lv_bwlvs           TYPE ltak-bwlvs,
        lv_matnr           TYPE ltap-matnr,
        lv_werks           TYPE ltap-werks,
        lv_anfme           TYPE rl03tanfme,  " NOT ltap-anfme — use DDIC element
        lv_altme           TYPE ltap-altme,
        lv_vltyp           TYPE ltap-vltyp,
        lv_vlpla           TYPE ltap-vlpla,
        lv_vlenr           TYPE ltap-vlenr,
        lv_nltyp           TYPE ltap-nltyp,
        lv_nlpla           TYPE ltap-nlpla,
        lv_nlenr           TYPE ltap-nlenr,
        lv_tanum           TYPE ltak-tanum,
        lv_ev_subrc        TYPE sy-subrc,
        lv_ev_msg          TYPE string,
        lv_msg             TYPE string,
        lv_rfc_errtxt(255) TYPE c.          " C type required for MESSAGE clause

  LOOP AT keys INTO DATA(ls_key).
    DATA(ls_param) = ls_key-%param.
    lv_lgnum = ls_param-WarehouseNumber.
    lv_bwlvs = ls_param-MovementType.
    lv_matnr = ls_param-Material.
    lv_werks = ls_param-Plant.
    lv_anfme = ls_param-Quantity.
    lv_altme = ls_param-UnitOfMeasure.
    lv_vltyp = ls_param-SourceStorageType.
    lv_vlpla = ls_param-SourceBin.
    lv_vlenr = ls_param-SourceStorageUnit.
    lv_nltyp = ls_param-DestStorageType.
    lv_nlpla = ls_param-DestBin.
    lv_nlenr = ls_param-DestStorageUnit.
    CLEAR: lv_tanum, lv_ev_subrc, lv_ev_msg, lv_rfc_errtxt.

    " DESTINATION 'NONE' = loopback RFC session — isolates COMMIT WORK from RAP LUW
    CALL FUNCTION 'ZWM_TO_CREATE'
      DESTINATION 'NONE'
      EXPORTING
        i_lgnum = lv_lgnum
        i_bwlvs = lv_bwlvs
        i_matnr = lv_matnr
        i_werks = lv_werks
        i_anfme = lv_anfme
        i_altme = lv_altme
        i_vltyp = lv_vltyp
        i_vlpla = lv_vlpla
        i_vlenr = lv_vlenr
        i_nltyp = lv_nltyp
        i_nlpla = lv_nlpla
        i_nlenr = lv_nlenr
      IMPORTING
        e_tanum  = lv_tanum
        ev_subrc = lv_ev_subrc
        ev_msg   = lv_ev_msg
      EXCEPTIONS
        system_failure        = 1 MESSAGE lv_rfc_errtxt
        communication_failure = 2 MESSAGE lv_rfc_errtxt
        OTHERS                = 3.

    IF sy-subrc <> 0.
      lv_msg = |RFC call failed (RC { sy-subrc }): { lv_rfc_errtxt }|.
      APPEND VALUE #(
        %cid = ls_key-%cid
        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error text = lv_msg )
      ) TO reported-transferorder.
      APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
    ELSEIF lv_ev_subrc = 0.
      " RAP static action result does not expose entity field components by name.
      " Use ASSIGN COMPONENT dynamically — fields silently skipped if not found at runtime.
      DATA ls_res LIKE LINE OF result.
      ls_res-%cid = ls_key-%cid.
      ASSIGN COMPONENT 'WAREHOUSENUMBER'     OF STRUCTURE ls_res TO FIELD-SYMBOL(<f1>).
      IF sy-subrc = 0. <f1> = lv_lgnum. ENDIF.
      ASSIGN COMPONENT 'TRANSFERORDERNUMBER' OF STRUCTURE ls_res TO FIELD-SYMBOL(<f2>).
      IF sy-subrc = 0. <f2> = lv_tanum. ENDIF.
      APPEND ls_res TO result.
    ELSE.
      APPEND VALUE #(
        %cid = ls_key-%cid
        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error text = lv_ev_msg )
      ) TO reported-transferorder.
      APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

**Note:** The TO number does not come back in the OData action response (RAP static action result
limitation). The Node.js tool must do a follow-up `GET /WMTransferOrder?$orderby=TransferOrderNumber desc&$top=1`
to retrieve it. `$filter + $orderby` cannot be combined in this gateway config.

---

## confirm_transfer_order handler (calls L_TO_CONFIRM directly)

`L_TO_CONFIRM` does NOT commit — safe to call directly. Pass `i_commit_work = ' '` and
`i_squit = 'X'` (confirms entire TO at once without needing to build LTAP_CONF manually).

```abap
METHOD confirm_transfer_order.
  DATA: lt_ltap_conf TYPE STANDARD TABLE OF ltap_conf.

  LOOP AT keys INTO DATA(ls_key).
    CALL FUNCTION 'L_TO_CONFIRM'
      EXPORTING
        i_lgnum       = ls_key-%key-WarehouseNumber
        i_tanum       = ls_key-%key-TransferOrderNumber
        i_squit       = 'X'    " Full confirmation, no LTAP_CONF needed
        i_commit_work = ' '    " RAP saver handles the LUW
      TABLES
        t_ltap_conf   = lt_ltap_conf
      EXCEPTIONS
        to_confirmed    = 1
        to_doesnt_exist = 2
        foreign_lock    = 3
        nothing_to_do   = 4
        OTHERS          = 5.

    IF sy-subrc <> 0.
      APPEND VALUE #(
        %key = ls_key-%key
        %msg = new_message_with_text(
          severity = if_abap_behv_message=>severity-error
          text     = |TO confirmation failed (RC { sy-subrc })| )
      ) TO reported-transferorder.
      APPEND VALUE #( %key = ls_key-%key ) TO failed-transferorder.
    ELSE.
      APPEND VALUE #( %key = ls_key-%key ) TO result.
    ENDIF.
  ENDLOOP.
ENDMETHOD.
```

---

## Storage type gotchas

- **SU-managed types** (LPTYP set in LAGP, e.g. type 001): require `i_nlenr` (LENUM) when used as destination
- **Non-SU-managed types** (LPTYP blank in LAGP, e.g. type 003): no LENUM needed — use these for simple test scenarios
- Check LAGP.LPTYP to determine if a storage type is SU-managed

---

## Warehouse 102 test parameters (verified working)

```
movementType:  999          (manual relocation — confirmed from LTBK)
material:      TG0001
plant:         1010
sourceType:    999
sourceBin:     0000000017   (448 ST available)
destType:      003          (non-SU-managed — LPTYP blank)
destBin:       1-013        (or 1-014, 1-015, 1-016 — all empty)
```
