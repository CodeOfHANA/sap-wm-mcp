import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getQuantFragmentation({ warehouse, storageType, threshold = 3, top = 200 }) {
  const filters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `TotalStock gt 0`
  ];
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const groups = {};
  for (const r of rows) {
    const mat = r.Material?.trimStart?.() ?? r.Material;
    const key = `${r.StorageType}|${r.StorageBin}|${mat}`;
    if (!groups[key]) {
      groups[key] = {
        storageType: r.StorageType,
        bin:         r.StorageBin,
        material:    mat,
        plant:       r.Plant,
        uom:         r.UnitOfMeasure,
        quantCount:  0,
        totalStock:  0,
        lastMove:    null
      };
    }
    groups[key].quantCount++;
    groups[key].totalStock += parseFloat(r.TotalStock ?? 0);
    const lastMove = r.LastMovementDate;
    if (lastMove && (!groups[key].lastMove || lastMove > groups[key].lastMove)) {
      groups[key].lastMove = lastMove;
    }
  }

  const today      = new Date();
  const fragmented = Object.values(groups)
    .filter(g => g.quantCount >= threshold)
    .sort((a, b) => b.quantCount - a.quantCount)
    .map(g => ({
      ...g,
      daysSinceLastMove: g.lastMove
        ? Math.floor((today - new Date(g.lastMove)) / 86400000)
        : null,
      consolidationPriority: g.quantCount >= 10 ? 'HIGH'
        : g.quantCount >= 5                      ? 'MEDIUM'
        : 'LOW'
    }));

  const byType = {};
  for (const r of fragmented) {
    if (!byType[r.storageType]) byType[r.storageType] = { fragmentedCombos: 0, totalExcessQuants: 0 };
    byType[r.storageType].fragmentedCombos++;
    byType[r.storageType].totalExcessQuants += (r.quantCount - 1);
  }

  return {
    warehouse,
    threshold,
    fragmentedCount: fragmented.length,
    truncated: rows.length === top,
    filters: { storageType: storageType ?? 'all' },
    note: `Shows bin+material combinations with >= ${threshold} quants. Ideal is 1 quant per material per bin. Consolidation TOs reduce quants and improve TO creation performance.`,
    byStorageType: byType,
    fragmented
  };
}
