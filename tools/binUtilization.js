import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMStorageBin`;

export async function getBinUtilization({ warehouse, storageType, top = 100 }) {
  const filters = [`WarehouseNumber eq '${esc(warehouse)}'`];
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);

  const bins  = data.value ?? [];    // was: data.value — crashed on null
  const total = bins.length;
  const empty           = bins.filter(b => b.IsEmpty).length;
  const full            = bins.filter(b => b.IsFull).length;
  const occupied        = total - empty;
  const blockedPutaway  = bins.filter(b => b.PutawayBlock).length;
  const blockedRemoval  = bins.filter(b => b.RemovalBlock).length;

  const byType = {};
  for (const b of bins) {
    const t = b.StorageType;
    if (!byType[t]) byType[t] = { total: 0, empty: 0, occupied: 0 };
    byType[t].total++;
    if (b.IsEmpty) byType[t].empty++;
    else           byType[t].occupied++;
  }

  return {
    warehouse,
    storageType: storageType ?? 'all',
    truncated: bins.length === top,
    summary: {
      totalBins:        total,
      emptyBins:        empty,
      occupiedBins:     occupied,
      fullBins:         full,
      blockedForPutaway: blockedPutaway,
      blockedForRemoval: blockedRemoval,
      utilizationPct:   total > 0 ? Math.round((occupied / total) * 100) : 0
    },
    byStorageType: Object.entries(byType).map(([type, stats]) => ({
      storageType:    type,
      ...stats,
      utilizationPct: stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0
    }))
  };
}
