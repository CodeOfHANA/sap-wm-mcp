import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

const INTERIM_CAUSE = {
  '999': 'SU/GI interim — GI posted before TO confirmation; confirm open TO or create reversal',
  '998': 'GR interim — goods receipt without putaway TO; check open TRs and create putaway',
  '902': 'GR staging (WE-ZONE) — putaway TO not yet created or confirmed; check GR monitor',
};

export async function getInterimZoneAnomalies({
  warehouse,
  interimTypes = ['999', '998', '902'],
  minDaysStranded = 0,
  material,
  top = 100
}) {
  const typeFilter = interimTypes.map(t => `StorageType eq '${esc(t)}'`).join(' or ');
  const filters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `(${typeFilter})`
  ];
  if (material) filters.push(`Material eq '${esc(material)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top * 3}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const today = new Date();

  const stranded = rows
    .filter(r => parseFloat(r.TotalStock ?? 0) > 0)
    .map(r => {
      const daysSinceMove = r.LastMovementDate
        ? Math.floor((today - new Date(r.LastMovementDate)) / 86400000)
        : null;
      const ageFlag = daysSinceMove === null ? 'unknown'
        : daysSinceMove === 0               ? 'same-day'
        : daysSinceMove === 1               ? 'overnight'
        :                                     'multi-day';
      return {
        storageType:  r.StorageType,
        bin:          r.StorageBin,
        material:     r.Material?.trimStart?.() ?? r.Material,
        plant:        r.Plant,
        qty:          parseFloat(r.TotalStock ?? 0),
        uom:          r.UnitOfMeasure,
        lastMove:     r.LastMovementDate ?? 'unknown',
        daysSinceMove,
        ageFlag,
        likelyCause:  INTERIM_CAUSE[r.StorageType] ?? 'Positive stock in interim zone — investigate movement chain'
      };
    })
    .filter(r => (r.daysSinceMove ?? 0) >= minDaysStranded)
    .sort((a, b) => (b.daysSinceMove ?? 0) - (a.daysSinceMove ?? 0));

  const byType = {};
  for (const r of stranded) {
    if (!byType[r.storageType]) byType[r.storageType] = { count: 0, totalQty: 0 };
    byType[r.storageType].count++;
    byType[r.storageType].totalQty += r.qty;
  }

  return {
    count: stranded.length,
    truncated: rows.length === top * 3,
    warehouse,
    filters: {
      interimTypes,
      minDaysStranded,
      material: material ?? 'all'
    },
    summary: {
      multiDay:  stranded.filter(r => r.ageFlag === 'multi-day').length,
      overnight: stranded.filter(r => r.ageFlag === 'overnight').length,
      sameDay:   stranded.filter(r => r.ageFlag === 'same-day').length,
    },
    byStorageType: byType,
    stranded
  };
}
