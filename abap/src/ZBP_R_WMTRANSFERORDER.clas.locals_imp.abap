CLASS lhc_TransferOrder DEFINITION INHERITING FROM cl_abap_behavior_handler.
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

CLASS lsc_ZR_WMTransferOrder DEFINITION INHERITING FROM cl_abap_behavior_saver.
  PROTECTED SECTION.
    METHODS save REDEFINITION.
ENDCLASS.

CLASS lhc_TransferOrder IMPLEMENTATION.

  METHOD read.
    LOOP AT keys INTO DATA(ls_key).
      APPEND VALUE #(
        %key  = ls_key-%key
        %fail = VALUE #( cause = if_abap_behv=>cause-not_found )
      ) TO failed-transferorder.
    ENDLOOP.
  ENDMETHOD.

  METHOD create_transfer_order.
    DATA: lv_lgnum          TYPE ltak-lgnum,
          lv_bwlvs          TYPE ltak-bwlvs,
          lv_matnr          TYPE ltap-matnr,
          lv_werks          TYPE ltap-werks,
          lv_anfme          TYPE rl03tanfme,
          lv_altme          TYPE ltap-altme,
          lv_vltyp          TYPE ltap-vltyp,
          lv_vlpla          TYPE ltap-vlpla,
          lv_vlenr          TYPE ltap-vlenr,
          lv_nltyp          TYPE ltap-nltyp,
          lv_nlpla          TYPE ltap-nlpla,
          lv_nlenr          TYPE ltap-nlenr,
          lv_tanum          TYPE ltak-tanum,
          lv_ev_subrc       TYPE sy-subrc,
          lv_ev_msg         TYPE string,
          lv_msg            TYPE string,
          lv_rfc_errtxt(255) TYPE c.

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

      " Call RFC wrapper in a separate session (DESTINATION 'NONE' loopback).
      " This isolates L_TO_CREATE_SINGLE's COMMIT WORK from the RAP LUW.
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
        " RFC transport error
        lv_msg = |RFC call failed (RC { sy-subrc }): { lv_rfc_errtxt }|.
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = lv_msg )
        ) TO reported-transferorder.
        APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
      ELSEIF lv_ev_subrc = 0.
        " TO created successfully — set key fields dynamically
        DATA ls_res LIKE LINE OF result.
        ls_res-%cid = ls_key-%cid.
        ASSIGN COMPONENT 'WAREHOUSENUMBER' OF STRUCTURE ls_res TO FIELD-SYMBOL(<f_lgnum>).
        IF sy-subrc = 0. <f_lgnum> = lv_lgnum. ENDIF.
        ASSIGN COMPONENT 'TRANSFERORDERNUMBER' OF STRUCTURE ls_res TO FIELD-SYMBOL(<f_tanum>).
        IF sy-subrc = 0. <f_tanum> = lv_tanum. ENDIF.
        APPEND ls_res TO result.
      ELSE.
        " Business error returned by ZWM_TO_CREATE
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = lv_ev_msg )
        ) TO reported-transferorder.
        APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD confirm_transfer_order.
    DATA: lt_ltap_conf TYPE STANDARD TABLE OF ltap_conf.

    LOOP AT keys INTO DATA(ls_key).
      CALL FUNCTION 'L_TO_CONFIRM'
        EXPORTING
          i_lgnum         = ls_key-%key-WarehouseNumber
          i_tanum         = ls_key-%key-TransferOrderNumber
          i_squit         = 'X'
          i_commit_work   = ' '
        TABLES
          t_ltap_conf     = lt_ltap_conf
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

  METHOD confirm_transfer_order_su.
    DATA: lt_ltap_conf TYPE STANDARD TABLE OF ltap_conf.

    LOOP AT keys INTO DATA(ls_key).
      DATA(ls_param) = ls_key-%param.

      CALL FUNCTION 'L_TO_CONFIRM_SU'
        EXPORTING
          i_lenum         = ls_param-StorageUnit
          i_squit         = 'X'
          i_commit_work   = ' '
        TABLES
          t_ltap_conf     = lt_ltap_conf
        EXCEPTIONS
          su_confirmed    = 1
          su_doesnt_exist = 2
          foreign_lock    = 3
          nothing_to_do   = 4
          OTHERS          = 5.

      IF sy-subrc <> 0.
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = |SU confirmation failed (RC { sy-subrc })| )
        ) TO reported-transferorder.
        APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
      ELSE.
        APPEND VALUE #( %cid = ls_key-%cid ) TO result.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.

CLASS lsc_ZR_WMTransferOrder IMPLEMENTATION.
  METHOD save.
    " RAP framework commits the LUW automatically after this method returns.
    " FMs called with I_COMMIT_WORK = ' ' — no explicit COMMIT needed here.
  ENDMETHOD.
ENDCLASS.
