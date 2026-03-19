import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getNegativeStock({ warehouse, storageType, top = 100 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (storageType) filters.push(`StorageType eq '${storageType}'`);

  // Fetch all stock — OData may not support TotalStock lt 0 filter directly
  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top * 5}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const negative = rows
    .filter(r => parseFloat(r.TotalStock ?? 0) < 0)
    .map(r => ({
      storageType:  r.StorageType,
      bin:          r.StorageBin,
      material:     r.Material?.trimStart?.() ?? r.Material,
      plant:        r.Plant,
      totalStock:   parseFloat(r.TotalStock ?? 0),
      availStock:   parseFloat(r.AvailableStock ?? 0),
      uom:          r.UnitOfMeasure,
      lastMove:     r.LastMovementDate ?? 'unknown',
      likely_cause: r.StorageType === '999' || r.StorageType === '998'
        ? 'GI posted before TO confirmed — confirm open TO or check for missing movement'
        : 'Unexpected — investigate immediately'
    }))
    .sort((a, b) => a.totalStock - b.totalStock); // most negative first

  const byType = {};
  for (const r of negative) {
    if (!byType[r.storageType]) byType[r.storageType] = { count: 0, totalNegative: 0 };
    byType[r.storageType].count++;
    byType[r.storageType].totalNegative += r.totalStock;
  }

  return {
    count: negative.length,
    warehouse,
    filters: { storageType: storageType ?? 'all' },
    byStorageType: byType,
    negativeQuants: negative
  };
}
