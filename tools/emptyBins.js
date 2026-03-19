import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin`;

export async function findEmptyBins({ warehouse, storageType, top = 50 }) {
  const filters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `IsEmpty eq true`
  ];
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const bins = data.value ?? [];

  return {
    count:     bins.length,
    truncated: bins.length === top,
    warehouse,
    storageType: storageType ?? 'all',
    emptyBins: bins.map(b => ({
      bin:               b.StorageBin,
      storageType:       b.StorageType,
      storageSection:    b.StorageSection,
      binType:           b.StorageBinType,
      blockedPutaway:    b.PutawayBlock,
      blockedRemoval:    b.RemovalBlock,
      remainingCapacity: b.RemainingCapacity,
      lastMovement:      b.LastMovementDate
    }))
  };
}
