import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMCycleCountBin`;

const DEFAULT_EXCLUDE = ['999', '998', '902'];

export async function getCycleCountCandidates({
  warehouse, storageType, daysSinceLastCount = 180, excludeTypes = DEFAULT_EXCLUDE, top = 100
}) {
  const filters = [`WarehouseNumber eq '${esc(warehouse)}'`];
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);
  filters.push(`IsInventoryActive eq ''`);
  filters.push(`IsEmpty ne true`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const today   = new Date();
  const cutoff  = new Date(today);
  cutoff.setDate(cutoff.getDate() - daysSinceLastCount);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const candidates = rows
    .filter(r => {
      if (excludeTypes.includes(r.StorageType)) return false;
      const lastCount = r.LastInventoryDate;
      return !lastCount || lastCount < cutoffStr;
    })
    .map(r => ({
      storageType:       r.StorageType,
      bin:               r.StorageBin,
      lastCountDate:     r.LastInventoryDate ?? 'never',
      daysSinceCount:    r.LastInventoryDate
        ? Math.floor((today - new Date(r.LastInventoryDate)) / 86400000)
        : null,
      quantCount:        parseInt(r.QuantCount ?? 0),
      usedCapacity:      parseFloat(r.UsedCapacity      ?? 0),
      remainingCapacity: parseFloat(r.RemainingCapacity ?? 0)
    }))
    .sort((a, b) =>
      a.daysSinceCount === null ? -1
      : b.daysSinceCount === null ? 1
      : b.daysSinceCount - a.daysSinceCount
    );

  const byType = {};
  for (const c of candidates) byType[c.storageType] = (byType[c.storageType] ?? 0) + 1;

  return {
    count:    candidates.length,
    truncated: rows.length === top,
    warehouse,
    filters:  { storageType: storageType ?? 'all', daysSinceLastCount, excludedTypes: excludeTypes },
    byStorageType: byType,
    candidates
  };
}
