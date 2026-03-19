import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getStockByType({ warehouse, storageType, bin, top = 100 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (storageType) filters.push(`StorageType eq '${storageType}'`);
  if (bin)         filters.push(`StorageBin eq '${bin}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows  = data.value ?? [];

  // Group by storage type for summary
  const byType = {};
  for (const r of rows) {
    const t = r.StorageType ?? '?';
    if (!byType[t]) byType[t] = { storageType: t, binCount: 0, totalQty: 0, materials: new Set() };
    byType[t].binCount++;
    byType[t].totalQty += parseFloat(r.TotalStock ?? 0);
    byType[t].materials.add((r.Material ?? r.Matnr ?? '').trimStart());
  }

  const summary = Object.values(byType).map(s => ({
    storageType:   s.storageType,
    occupiedBins:  s.binCount,
    totalQty:      s.totalQty,
    uniqueMaterials: s.materials.size
  }));

  return {
    count: rows.length,
    warehouse,
    filters: { storageType: storageType ?? 'all', bin: bin ?? 'all' },
    summary,
    stock: rows.map(r => ({
      storageType: r.StorageType,
      bin:         r.StorageBin,
      material:    r.Material?.trimStart?.() ?? r.Material,
      plant:       r.Plant,
      quantity:    parseFloat(r.TotalStock ?? 0),
      uom:         r.UnitOfMeasure
    }))
  };
}
