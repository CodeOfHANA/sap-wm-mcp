# Skill: /wm-rap-testing

Write ABAP Unit tests for the SAP Classic WM RAP service.

Adapted from weiserman/rap-skills `rap-testing` for on-premise S/4H with classic WM.

## When to use
- Write a test class for a new RAP action (CreateTransferOrder, ConfirmTransferOrder)
- Verify a CDS view returns correct WM data
- Regression test before activating major changes

## Test class structure

```abap
CLASS zcl_wm_mcp_test DEFINITION PUBLIC
  FOR TESTING
  RISK LEVEL HARMLESS
  DURATION SHORT.

  PRIVATE SECTION.
    CLASS-DATA: go_env TYPE REF TO if_botd_txbufdbl_bo_test_env.

    CLASS-METHODS:
      class_setup,
      class_teardown.

    METHODS:
      setup,
      teardown,

      " Test methods — one per scenario
      test_read_storage_bin  FOR TESTING,
      test_create_to_success FOR TESTING,
      test_create_to_missing_material FOR TESTING.

ENDCLASS.

CLASS zcl_wm_mcp_test IMPLEMENTATION.

  METHOD class_setup.
    " Create test environment with test doubles for the BO
    go_env = cl_botd_txbufdbl_bo_test_env=>create(
               i_root_bdef_name = 'ZR_WMTRANSFERORDER' ).
  ENDMETHOD.

  METHOD class_teardown.
    go_env->destroy( ).
  ENDMETHOD.

  METHOD setup.
    go_env->clear_doubles( ).
  ENDMETHOD.

  METHOD teardown.
    " Always rollback to prevent test data leaking between tests
    ROLLBACK ENTITIES.
  ENDMETHOD.

  METHOD test_read_storage_bin.
    " Read a known storage bin from the system
    SELECT SINGLE lgnum, lgtyp, lgpla
      FROM lgpla
      WHERE lgnum = '1000'
      INTO @DATA(ls_bin).

    IF sy-subrc <> 0.
      cl_abap_unit_assert=>fail( msg = 'No test data found in LGPLA for warehouse 1000' ).
      RETURN.
    ENDIF.

    " Query via CDS view
    SELECT SINGLE WarehouseNumber, StorageType, StorageBin
      FROM zr_wmstoragbin
      WHERE WarehouseNumber = @ls_bin-lgnum
        AND StorageType     = @ls_bin-lgtyp
        AND StorageBin      = @ls_bin-lgpla
      INTO @DATA(ls_result).

    cl_abap_unit_assert=>assert_subrc(
      act = sy-subrc
      exp = 0
      msg = 'CDS view ZR_WMStorageBin did not return bin data' ).

    cl_abap_unit_assert=>assert_equals(
      act = ls_result-warehouseNumber
      exp = ls_bin-lgnum ).
  ENDMETHOD.

  METHOD test_create_to_success.
    " This test calls the BAPI via the RAP action
    " It is a HARMLESS test — real data is created then rolled back

    " Prerequisite: get a real bin and material that exists in test system
    SELECT SINGLE lgnum, lgtyp, lgpla
      FROM lgpla
      WHERE lgnum    = '1000'
        AND lgpla_ltr = 'X'  " empty bin
      INTO @DATA(ls_empty_bin).

    IF sy-subrc <> 0.
      cl_abap_unit_assert=>skip( 'No empty bin found in warehouse 1000 — skip test' ).
      RETURN.
    ENDIF.

    " Run the static action via EML
    MODIFY ENTITIES OF zr_wmtransferorder
      ENTITY wmtransferorder
      EXECUTE createtransferorder
        FROM VALUE #( (
          %param = VALUE #(
            lgnum = ls_empty_bin-lgnum
            matnr = 'TESTMAT'  " must exist in test system
            werks = '1000'
            anfme = '1'
            einme = 'ST'
            nltyp = ls_empty_bin-lgtyp
            nlpla = ls_empty_bin-lgpla )
        ) )
      RESULT DATA(lt_result)
      REPORTED DATA(lt_reported)
      FAILED  DATA(lt_failed).

    cl_abap_unit_assert=>assert_initial(
      act = lt_failed
      msg = 'CreateTransferOrder action returned FAILED' ).

    cl_abap_unit_assert=>assert_not_initial(
      act = lt_result
      msg = 'CreateTransferOrder did not return a result' ).
  ENDMETHOD.

  METHOD test_create_to_missing_material.
    " Negative test — material does not exist
    MODIFY ENTITIES OF zr_wmtransferorder
      ENTITY wmtransferorder
      EXECUTE createtransferorder
        FROM VALUE #( (
          %param = VALUE #(
            lgnum = '1000'
            matnr = 'MATERIAL_DOES_NOT_EXIST_XYZ'
            werks = '1000'
            anfme = '1'
            einme = 'ST'
            nltyp = '001'
            nlpla = '01-01-01' )
        ) )
      RESULT DATA(lt_result)
      REPORTED DATA(lt_reported)
      FAILED  DATA(lt_failed).

    " Expect failure
    cl_abap_unit_assert=>assert_not_initial(
      act = lt_reported
      msg = 'Expected error for non-existent material but got none' ).
  ENDMETHOD.

ENDCLASS.
```

## Running tests via VSP

```
Use VSP tool: RunUnitTests
  class: ZCL_WM_MCP_TEST
  method: * (all methods)
```

## Key rules

- **Always `ROLLBACK ENTITIES` in teardown** — prevents test TO data polluting the WM system
- **Skip gracefully if no test data** — use `cl_abap_unit_assert=>skip( )` when prereqs don't exist
- **Do not hardcode material numbers** — select a real material from the system in `class_setup` and store in a class attribute
- **BAPI-based actions are integration tests** — they hit real WM tables. Mark as `RISK LEVEL HARMLESS` only if rollback cleans up properly
- **Avoid `COMMIT ENTITIES` in tests** unless specifically testing `on save` determinations
