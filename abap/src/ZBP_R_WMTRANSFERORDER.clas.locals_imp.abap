CLASS lcl_handler DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    METHODS:
      read FOR READ
        IMPORTING keys FOR READ TransferOrder RESULT result,
      create_transfer_order FOR MODIFY
        IMPORTING keys FOR ACTION TransferOrder~CreateTransferOrder RESULT result,
      confirm_transfer_order FOR MODIFY
        IMPORTING keys FOR ACTION TransferOrder~ConfirmTransferOrder RESULT result,
      confirm_transfer_order_su FOR MODIFY
        IMPORTING keys FOR ACTION TransferOrder~ConfirmTransferOrderSU RESULT result.
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
        ls_conf-nista = ls_ltap-nsola.
        ls_conf-nistm = ls_ltap-nsolm.
        ls_conf-altme = ls_ltap-altme.
        ls_conf-meins = ls_ltap-meins.
        APPEND ls_conf TO lt_ltap_conf.
      ENDLOOP.

      CALL FUNCTION 'L_TO_CONFIRM'
        EXPORTING
          i_lgnum  = ls_key-WarehouseNumber
          i_tanum  = ls_key-TransferOrderNumber
          i_squit  = 'X'
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

  METHOD confirm_transfer_order_su.
    LOOP AT keys INTO DATA(ls_key).
      DATA(ls_param) = ls_key-%param.
      DATA lt_ltap_conf TYPE TABLE OF ltap_conf.
      DATA lv_lgnum TYPE ltak-lgnum.
      DATA lv_tanum TYPE ltak-tanum.

      " Get open TO items for this storage unit
      SELECT lgnum, tanum, tapos, nltyp, nlpla, matnr, charg, werks,
             nsola, nsolm, altme, meins
        FROM ltap
        WHERE lenum = @ls_param-StorageUnit
          AND kzqui = @space
        INTO TABLE @DATA(lt_ltap).

      IF lt_ltap IS INITIAL.
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = 'No open transfer order items found for this storage unit' )
        ) TO reported-transferorder.
        CONTINUE.
      ENDIF.

      " Take warehouse and TO number from first item for the result
      READ TABLE lt_ltap INTO DATA(ls_first) INDEX 1.
      lv_lgnum = ls_first-lgnum.
      lv_tanum = ls_first-tanum.

      " Build confirmation table — actual = planned (no differences)
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
        ls_conf-nista = ls_ltap-nsola.
        ls_conf-nistm = ls_ltap-nsolm.
        ls_conf-altme = ls_ltap-altme.
        ls_conf-meins = ls_ltap-meins.
        APPEND ls_conf TO lt_ltap_conf.
      ENDLOOP.

      CALL FUNCTION 'L_TO_CONFIRM_SU'
        EXPORTING
          i_lenum = ls_param-StorageUnit
          i_squit = 'X'
        TABLES
          t_ltap_conf = lt_ltap_conf
        EXCEPTIONS
          OTHERS = 1.

      IF sy-subrc <> 0.
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = 'Storage unit TO confirmation failed' )
        ) TO reported-transferorder.
        CONTINUE.
      ENDIF.

      APPEND VALUE #(
        %cid_ref            = ls_key-%cid
        WarehouseNumber     = lv_lgnum
        TransferOrderNumber = lv_tanum
      ) TO result.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.

CLASS lcl_saver IMPLEMENTATION.
  METHOD save_modified.
    " L_TO_CREATE_SINGLE, L_TO_CONFIRM, L_TO_CONFIRM_SU all commit internally
  ENDMETHOD.
ENDCLASS.
