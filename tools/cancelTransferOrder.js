import { s4hPost } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function cancelTransferOrder({ warehouse, transferOrderNumber }) {
  // Instance action — key goes in the URL path, not the body
  const path = `${BASE}/WMTransferOrder(WarehouseNumber='${encodeURIComponent(esc(warehouse))}',TransferOrderNumber='${encodeURIComponent(esc(transferOrderNumber))}')/${NS}.CancelTransferOrder`;

  await s4hPost(path, {});

  return {
    success:        true,
    toNumber:       transferOrderNumber,
    message:        'Transfer order cancelled successfully',
    previousStatus: 'open',
    newStatus:      'cancelled'
  };
}
