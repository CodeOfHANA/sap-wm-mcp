#!/usr/bin/env node
/**
 * Creates ZWM_TO_CREATE as an RFC-enabled function module in ZWM_MFG function group.
 * Wraps L_TO_CREATE_SINGLE so it can be called safely from RAP via DESTINATION 'NONE'.
 *
 * The RFC isolation ensures COMMIT WORK in the FM session does not violate the RAP LUW.
 */
import fetch from 'node-fetch';
import https from 'https';
import 'dotenv/config';

const agent   = new https.Agent({ rejectUnauthorized: false });
const BASE    = process.env.SAP_URL;
const AUTH    = Buffer.from(`${process.env.SAP_USER}:${process.env.SAP_PASSWORD}`).toString('base64');
const CLIENT  = process.env.SAP_CLIENT;
const TRANSPORT = 'S4HK902492';

const FUGR_NAME = 'ZWM_MFG';
const FM_NAME   = 'ZWM_TO_CREATE';
const PKG_NAME  = 'ZWM_MCP';

const FUGR_URL = `${BASE}/sap/bc/adt/functions/groups/${FUGR_NAME}`;
const FM_URL   = `${FUGR_URL}/fmodules/${FM_NAME}`;
const FM_SRC_URL = `${FM_URL}/source/main`;

const HEADERS = {
  'Authorization': `Basic ${AUTH}`,
  'sap-client':    CLIENT,
};

const FM_SOURCE = `FUNCTION ZWM_TO_CREATE.
*"---------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     VALUE(I_LGNUM) TYPE  LTAK-LGNUM
*"     VALUE(I_BWLVS) TYPE  LTAK-BWLVS
*"     VALUE(I_MATNR) TYPE  LTAP-MATNR
*"     VALUE(I_WERKS) TYPE  LTAP-WERKS
*"     VALUE(I_ANFME) TYPE  RL03TANFME
*"     VALUE(I_ALTME) TYPE  LTAP-ALTME DEFAULT SPACE
*"     VALUE(I_VLTYP) TYPE  LTAP-VLTYP DEFAULT SPACE
*"     VALUE(I_VLPLA) TYPE  LTAP-VLPLA DEFAULT SPACE
*"     VALUE(I_VLENR) TYPE  LTAP-VLENR DEFAULT SPACE
*"     VALUE(I_NLTYP) TYPE  LTAP-NLTYP DEFAULT SPACE
*"     VALUE(I_NLPLA) TYPE  LTAP-NLPLA DEFAULT SPACE
*"     VALUE(I_NLENR) TYPE  LTAP-NLENR DEFAULT SPACE
*"  EXPORTING
*"     VALUE(E_TANUM) TYPE  LTAK-TANUM
*"     VALUE(EV_SUBRC) TYPE  SY-SUBRC
*"     VALUE(EV_MSG) TYPE  STRING
*"---------------------------------------------------------------------
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
ENDFUNCTION.`;

async function getCSRF() {
  const res = await fetch(FUGR_URL, {
    headers: { ...HEADERS, 'x-csrf-token': 'Fetch' },
    agent
  });
  const csrf = res.headers.get('x-csrf-token');
  const rawCookies = res.headers.raw?.()['set-cookie'] ?? res.headers.get('set-cookie');
  const cookieHeader = Array.isArray(rawCookies)
    ? rawCookies.map(c => c.split(';')[0]).join('; ')
    : (rawCookies ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');
  return { csrf, cookieHeader };
}

async function run() {
  // 1. CSRF token (fetch from a known URL — even 404 returns the token)
  console.log('Fetching CSRF token...');
  const initRes = await fetch(`${BASE}/sap/bc/adt/functions/groups`, {
    headers: { ...HEADERS, 'x-csrf-token': 'Fetch', 'Accept': 'application/xml' },
    agent
  });
  const csrf = initRes.headers.get('x-csrf-token');
  const rawCookies = initRes.headers.raw?.()['set-cookie'] ?? initRes.headers.get('set-cookie');
  const cookieHeader = Array.isArray(rawCookies)
    ? rawCookies.map(c => c.split(';')[0]).join('; ')
    : (rawCookies ?? '').split(',').map(c => c.trim().split(';')[0]).join('; ');
  console.log(`CSRF: ${csrf}`);
  if (!csrf) throw new Error('No CSRF token');

  const authHeaders = {
    ...HEADERS,
    'x-csrf-token': csrf,
    ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
  };

  // 2. Create function group ZWM_MFG (ignore 409 = already exists)
  console.log(`\nCreating function group ${FUGR_NAME}...`);
  const fugrXml = `<?xml version="1.0" encoding="utf-8"?>
<fgroup:abapFunctionGroup xmlns:fgroup="http://www.sap.com/adt/functions/fgroup"
                          xmlns:adtcore="http://www.sap.com/adt/core"
                          adtcore:description="WM MCP RFC Wrappers"
                          adtcore:language="EN"
                          adtcore:name="${FUGR_NAME}">
  <adtcore:packageRef adtcore:name="${PKG_NAME}"/>
</fgroup:abapFunctionGroup>`;

  const fugrRes = await fetch(`${BASE}/sap/bc/adt/functions/groups`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/vnd.sap.adt.functions.fgroup+xml; charset=utf-8',
      'Accept': 'application/xml',
      'sap-package': PKG_NAME,
      'sap-change-recording-mode': 'AUTO',
      'corrnr': TRANSPORT,
    },
    body: fugrXml,
    agent
  });
  console.log(`Function group create status: ${fugrRes.status}`);
  if (fugrRes.status !== 201 && fugrRes.status !== 409) {
    const body = await fugrRes.text();
    console.log(`Response: ${body.slice(0, 500)}`);
    if (fugrRes.status !== 200) throw new Error(`Function group create failed: ${fugrRes.status}`);
  } else if (fugrRes.status === 409) {
    console.log('Function group already exists — continuing.');
  } else {
    console.log('Function group created.');
  }

  // 3. Create function module ZWM_TO_CREATE (ignore 409)
  console.log(`\nCreating function module ${FM_NAME}...`);
  const fmXml = `<?xml version="1.0" encoding="utf-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodule"
                             xmlns:adtcore="http://www.sap.com/adt/core"
                             adtcore:description="Create WM TO via RFC (RAP-safe wrapper)"
                             adtcore:language="EN"
                             adtcore:name="${FM_NAME}"
                             fmodule:processingType="rfc">
</fmodule:abapFunctionModule>`;

  const fmRes = await fetch(`${FUGR_URL}/fmodules`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/vnd.sap.adt.functions.fmodule+xml; charset=utf-8',
      'Accept': 'application/xml',
      'corrnr': TRANSPORT,
    },
    body: fmXml,
    agent
  });
  console.log(`Function module create status: ${fmRes.status}`);
  const fmResBody = await fmRes.text();
  if (fmRes.status !== 201 && fmRes.status !== 409) {
    console.log(`Response: ${fmResBody.slice(0, 500)}`);
    if (fmRes.status !== 200) throw new Error(`Function module create failed: ${fmRes.status}`);
  } else if (fmRes.status === 409) {
    console.log('Function module already exists — continuing to source update.');
  } else {
    console.log('Function module created.');
  }

  // 4. Lock FM source
  console.log(`\nLocking FM source...`);
  const lockRes = await fetch(`${FM_SRC_URL}?_action=LOCK&accessMode=MODIFY`, {
    method: 'POST',
    headers: { ...authHeaders, 'Accept': 'application/vnd.sap.as+xml' },
    agent
  });
  console.log(`Lock status: ${lockRes.status}`);
  if (!lockRes.ok) {
    const body = await lockRes.text();
    throw new Error(`Lock failed: ${lockRes.status} — ${body.slice(0, 300)}`);
  }
  const lockXml = await lockRes.text();
  const lockHandle = lockXml.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/)?.[1];
  if (!lockHandle) throw new Error(`No lockHandle in: ${lockXml.slice(0, 300)}`);
  console.log(`lockHandle: ${lockHandle}`);

  try {
    // 5. PUT FM source
    console.log('\nWriting FM source...');
    const putRes = await fetch(`${FM_SRC_URL}?lockHandle=${encodeURIComponent(lockHandle)}&corrnr=${TRANSPORT}`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/xml',
      },
      body: FM_SOURCE,
      agent
    });
    console.log(`PUT status: ${putRes.status}`);
    if (!putRes.ok) {
      const body = await putRes.text();
      throw new Error(`PUT failed ${putRes.status}: ${body.slice(0, 500)}`);
    }
  } finally {
    // 6. Unlock
    console.log('Unlocking FM source...');
    const unlockRes = await fetch(`${FM_SRC_URL}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`, {
      method: 'POST',
      headers: authHeaders,
      agent
    });
    console.log(`Unlock status: ${unlockRes.status}`);
  }

  // 7. Activate
  console.log('\nActivating function module...');
  const actRes = await fetch(`${BASE}/sap/bc/adt/activation`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/xml' },
    body: `<?xml version="1.0" encoding="UTF-8"?><adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core"><adtcore:objectReference adtcore:uri="/sap/bc/adt/functions/groups/${FUGR_NAME}/fmodules/${FM_NAME}" adtcore:name="${FM_NAME}"/></adtcore:objectReferences>`,
    agent
  });
  const actText = await actRes.text();
  console.log(`Activation status: ${actRes.status}`);
  if (actText) console.log(actText.slice(0, 400));

  if (actRes.ok) {
    console.log(`\n✓ ${FM_NAME} created and activated in ${FUGR_NAME}.`);
    console.log('Next: update CCIMP to call ZWM_TO_CREATE DESTINATION \'NONE\' instead of L_TO_CREATE_SINGLE directly.');
  }
}

run().catch(console.error);
