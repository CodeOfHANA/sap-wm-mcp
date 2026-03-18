import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin`;

export async function getBinStatus({ warehouse, storageType, bin, top = 20 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (storageType) filters.push(`StorageType eq '${storageType}'`);
  if (bin) filters.push(`StorageBin eq '${bin}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);

  return {
    count: data.value.length,
    warehouse,
    bins: data.value.map(b => ({
      bin: b.StorageBin,
      storageType: b.StorageType,
      storageSection: b.StorageSection,
      binType: b.StorageBinType,
      empty: b.IsEmpty,
      full: b.IsFull,
      blockedPutaway: b.PutawayBlock,
      blockedRemoval: b.RemovalBlock,
      quants: b.NumberOfQuants,
      maxWeight: b.MaximumWeight,
      occupiedWeight: b.OccupiedWeight,
      weightUnit: b.WeightUnit,
      totalCapacity: b.TotalCapacity,
      remainingCapacity: b.RemainingCapacity,
      lastMovement: b.LastMovementDate,
      dynamic: b.IsDynamicBin
    }))
  };
}
