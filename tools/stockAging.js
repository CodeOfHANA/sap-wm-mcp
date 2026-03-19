import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getStockAging({ warehouse, storageType, material, daysSinceLastMove = 90, top = 100 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (storageType) filters.push(`StorageType eq '${storageType}'`);
  if (material)    filters.push(`Material eq '${material}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - daysSinceLastMove);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const aged = rows
    .filter(r => {
      const lastMove = r.LastMovementDate;
      return !lastMove || lastMove < cutoffStr;
    })
    .map(r => {
      const daysSinceMove = r.LastMovementDate
        ? Math.floor((today - new Date(r.LastMovementDate)) / 86400000)
        : null;
      return {
        storageType:  r.StorageType,
        bin:          r.StorageBin,
        material:     r.Material?.trimStart?.() ?? r.Material,
        plant:        r.Plant,
        totalStock:   parseFloat(r.TotalStock ?? 0),
        uom:          r.UnitOfMeasure,
        lastMove:     r.LastMovementDate ?? 'never',
        daysSinceMove,
        ageBand:      daysSinceMove === null ? 'never moved'
                    : daysSinceMove > 365    ? '>1 year'
                    : daysSinceMove > 180    ? '6-12 months'
                    : '>3 months'
      };
    })
    .sort((a, b) =>
      a.daysSinceMove === null ? -1
      : b.daysSinceMove === null ? 1
      : b.daysSinceMove - a.daysSinceMove
    );

  // Age band summary
  const bands = { 'never moved': 0, '>1 year': 0, '6-12 months': 0, '>3 months': 0 };
  for (const r of aged) bands[r.ageBand]++;

  return {
    count: aged.length,
    warehouse,
    filters: { storageType: storageType ?? 'all', material: material ?? 'all', daysSinceLastMove },
    ageBandSummary: bands,
    stock: aged
  };
}
