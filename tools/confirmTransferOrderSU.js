import { s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function confirmTransferOrderSU({ warehouse, storageUnit }) {
  // Static action — called on the entity set (collection-bound)
  const path = `${BASE}/WMTransferOrder/${NS}.ConfirmTransferOrderSU`;

  const body = {
    StorageUnit: storageUnit
  };

  const data = await s4hPost(path, body);

  return {
    success: true,
    warehouse,
    storageUnit,
    transferOrderNumber: data?.value?.[0]?.TransferOrderNumber ?? data?.TransferOrderNumber ?? null,
    raw: data
  };
}
