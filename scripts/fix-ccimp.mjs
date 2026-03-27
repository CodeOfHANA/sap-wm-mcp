#!/usr/bin/env node
/**
 * One-time fix: write the corrected CCIMP source to ZBP_R_WMTRANSFERORDER
 * via ADT HTTP PUT, then activate the class.
 * Key fix: lv_anfme LIKE rl03t-anfme  (not TYPE p DECIMALS 3)
 */
import fetch from 'node-fetch';
import https from 'https';
import 'dotenv/config';

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE  = process.env.SAP_URL;
const AUTH  = Buffer.from(`${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`).toString('base64');
const CLIENT = process.env.SAP_CLIENT;

const CLASS_URL  = `${BASE}/sap/bc/adt/oo/classes/zbp_r_wmtransferorder`;
const CCIMP_URL  = `${CLASS_URL}/includes/implementations`;
const ACT_URL    = `${BASE}/sap/bc/adt/activation`;

const CCIMP_SOURCE = `CLASS lhc_TransferOrder DEFINITION INHERITING FROM cl_abap_behavior_handler.
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
    DATA: lv_lgnum TYPE ltak-lgnum,
          lv_bwlvs TYPE ltak-bwlvs,
          lv_matnr TYPE ltap-matnr,
          lv_werks TYPE ltap-werks,
          lv_anfme LIKE rl03t-anfme,
          lv_altme TYPE ltap-altme,
          lv_vltyp TYPE ltap-vltyp,
          lv_vlpla TYPE ltap-vlpla,
          lv_vlenr TYPE ltap-vlenr,
          lv_nltyp TYPE ltap-nltyp,
          lv_nlpla TYPE ltap-nlpla,
          lv_nlenr TYPE ltap-nlenr,
          lv_tanum TYPE ltak-tanum,
          lv_msg   TYPE string.

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
      CLEAR lv_tanum.

      CALL FUNCTION 'L_TO_CREATE_SINGLE'
        EXPORTING
          i_lgnum       = lv_lgnum
          i_bwlvs       = lv_bwlvs
          i_matnr       = lv_matnr
          i_werks       = lv_werks
          i_anfme       = lv_anfme
          i_altme       = lv_altme
          i_vltyp       = lv_vltyp
          i_vlpla       = lv_vlpla
          i_vlenr       = lv_vlenr
          i_nltyp       = lv_nltyp
          i_nlenr       = lv_nlenr
          i_nlpla       = lv_nlpla
          i_commit_work = ' '
        IMPORTING
          e_tanum       = lv_tanum
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
          OTHERS              = 10.

      IF sy-subrc <> 0.
        lv_msg = SWITCH #( sy-subrc
          WHEN 1  THEN 'No TO created — check stock, movement type, and bin'
          WHEN 2  THEN 'Movement type invalid for this warehouse'
          WHEN 3  THEN 'Manual TO creation not allowed for this movement type'
          WHEN 4  THEN 'Material not found in warehouse master (check MLGN)'
          WHEN 5  THEN 'Source storage type invalid'
          WHEN 6  THEN 'Source bin invalid or no stock found'
          WHEN 7  THEN 'Destination storage type invalid'
          WHEN 8  THEN 'Destination bin invalid'
          WHEN 9  THEN 'Storage unit number invalid'
          ELSE         'TO creation failed' ).
        APPEND VALUE #(
          %cid = ls_key-%cid
          %msg = new_message_with_text(
            severity = if_abap_behv_message=>severity-error
            text     = lv_msg )
        ) TO reported-transferorder.
        APPEND VALUE #( %cid = ls_key-%cid ) TO failed-transferorder.
      ELSE.
        APPEND VALUE #( %cid = ls_key-%cid ) TO result.
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
  ENDMETHOD.
ENDCLASS.`;

const HEADERS = {
  'Authorization': `Basic ${AUTH}`,
  'sap-client': CLIENT,
};

async function run() {
  // 1. Get CSRF token
  console.log('Fetching CSRF token...');
  const csrfRes = await fetch(CLASS_URL, {
    headers: { ...HEADERS, 'x-csrf-token': 'Fetch' },
    agent
  });
  const csrf = csrfRes.headers.get('x-csrf-token');
  const cookies = csrfRes.headers.raw?.()['set-cookie'] ?? csrfRes.headers.get('set-cookie');
  const cookieHeader = Array.isArray(cookies)
    ? cookies.map(c => c.split(';')[0]).join('; ')
    : (cookies ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');
  console.log(`CSRF: ${csrf}`);
  if (!csrf) throw new Error('No CSRF token');

  const authHeaders = {
    ...HEADERS,
    'x-csrf-token': csrf,
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
  };

  // 2. Lock the CCIMP include to get a lockHandle
  console.log('Locking CCIMP include...');
  const lockRes = await fetch(`${CCIMP_URL}?_action=LOCK&accessMode=MODIFY`, {
    method: 'POST',
    headers: { ...authHeaders, 'Accept': 'application/vnd.sap.as+xml' },
    agent
  });
  console.log(`Lock status: ${lockRes.status}`);
  if (!lockRes.ok) {
    const body = await lockRes.text();
    throw new Error(`Lock failed ${lockRes.status}: ${body.slice(0, 500)}`);
  }
  const lockXml = await lockRes.text();
  console.log(`Lock response: ${lockXml.slice(0, 300)}`);
  const lockMatch = lockXml.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/);
  const lockHandle = lockMatch?.[1];
  if (!lockHandle) throw new Error(`Could not extract lockHandle from: ${lockXml.slice(0, 300)}`);
  console.log(`lockHandle: ${lockHandle}`);

  // Merge any cookies from lock response into authHeaders
  const lockCookies = lockRes.headers.raw?.()['set-cookie'] ?? lockRes.headers.get('set-cookie');
  if (lockCookies) {
    const lockCookieHeader = Array.isArray(lockCookies)
      ? lockCookies.map(c => c.split(';')[0]).join('; ')
      : (lockCookies ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');
    if (lockCookieHeader) {
      authHeaders['Cookie'] = [authHeaders['Cookie'], lockCookieHeader].filter(Boolean).join('; ');
      console.log(`Merged lock cookies into session`);
    }
  }

  try {
    // 3. PUT CCIMP source (lockHandle as query param)
    console.log('Writing CCIMP source...');
    const putRes = await fetch(`${CCIMP_URL}?lockHandle=${encodeURIComponent(lockHandle)}`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/xml'
      },
      body: CCIMP_SOURCE,
      agent
    });
    console.log(`PUT status: ${putRes.status}`);
    if (!putRes.ok) {
      const body = await putRes.text();
      throw new Error(`PUT failed ${putRes.status}: ${body.slice(0, 500)}`);
    }
  } finally {
    // 4. Unlock regardless of PUT result
    console.log('Unlocking CCIMP include...');
    const unlockRes = await fetch(`${CCIMP_URL}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, {
      method: 'POST',
      headers: authHeaders,
      agent
    });
    console.log(`Unlock status: ${unlockRes.status}`);
  }

  // 5. Activate
  console.log('Activating class...');
  const actBody = `adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zbp_r_wmtransferorder" adtcore:name="ZBP_R_WMTRANSFERORDER"/></adtcore:objectReferences>`;
  const actRes = await fetch(ACT_URL, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><${actBody}`,
    agent
  });
  const actText = await actRes.text();
  console.log(`Activation status: ${actRes.status}`);
  if (actText) console.log(actText.slice(0, 500));

  if (actRes.ok) {
    console.log('\n✓ CCIMP updated and class activated. Now test create_transfer_order.');
  }
}

run().catch(console.error);
