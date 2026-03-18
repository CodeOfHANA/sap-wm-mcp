FUNCTION zwm_to_create
  IMPORTING
    VALUE(i_lgnum) TYPE ltak-lgnum
    VALUE(i_bwlvs) TYPE ltak-bwlvs
    VALUE(i_matnr) TYPE ltap-matnr
    VALUE(i_werks) TYPE ltap-werks
    VALUE(i_anfme) TYPE rl03tanfme
    VALUE(i_altme) TYPE ltap-altme DEFAULT space
    VALUE(i_vltyp) TYPE ltap-vltyp DEFAULT space
    VALUE(i_vlpla) TYPE ltap-vlpla DEFAULT space
    VALUE(i_vlenr) TYPE ltap-vlenr DEFAULT space
    VALUE(i_nltyp) TYPE ltap-nltyp DEFAULT space
    VALUE(i_nlpla) TYPE ltap-nlpla DEFAULT space
    VALUE(i_nlenr) TYPE ltap-nlenr DEFAULT space
  EXPORTING
    VALUE(e_tanum) TYPE ltak-tanum
    VALUE(ev_subrc) TYPE sy-subrc
    VALUE(ev_msg) TYPE string.

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
      i_commit_work = 'X'
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
      error_message       = 10
      OTHERS              = 11.

  ev_subrc = sy-subrc.
  IF sy-subrc = 10.
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
