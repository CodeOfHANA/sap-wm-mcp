import { s4hGet } from '../lib/s4hClient.js';

// ⚠️ Verify service path in browser before first use:
// https://<host>/sap/opu/odata4/sap/api_whse_storage_bin_2/srvd_a2x/sap/whsestoragebin2/0001/
const BASE = `/sap/opu/odata4/sap/api_whse_storage_bin_2/srvd_a2x/sap/whsestoragebin2/0001/StorageBin`;

export async function getBinStatus({ warehouse, storageType, emptyOnly, top = 20 }) {
  const filters = [`EWMWarehouse eq '${warehouse}'`];
  if (storageType) filters.push(`EWMStorageType eq '${storageType}'`);
  if (emptyOnly) filters.push(`EWMStorageBinIsEmpty eq true`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);

  return {
    count: data.value.length,
    warehouse,
    bins: data.value.map(b => ({
      bin: b.EWMStorageBin,
      storageType: b.EWMStorageType,
      empty: b.EWMStorageBinIsEmpty,
      blocked: b.EWMStorageBinIsBlocked,
    }))
  };
}
