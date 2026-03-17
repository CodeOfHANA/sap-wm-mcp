import { s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function confirmTransferOrder({ warehouse, transferOrderNumber }) {
  // Instance action — key goes in the URL path, not the body
  const path = `${BASE}/WMTransferOrder(WarehouseNumber='${encodeURIComponent(warehouse)}',TransferOrderNumber='${encodeURIComponent(transferOrderNumber)}')/${NS}.ConfirmTransferOrder`;

  const data = await s4hPost(path, {});

  return {
    success: true,
    warehouse,
    transferOrderNumber,
    raw: data
  };
}
