import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE     = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;
const SU_TYPES = ['999', '998'];

export async function getUnresolvedSuNegatives({ warehouse, storageType, minAgeDays = 7, top = 500 }) {

  const types      = storageType ? [storageType] : SU_TYPES;
  const typeFilter = types.map(t => `StorageType eq '${esc(t)}'`).join(' or ');
  const filters    = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `(${typeFilter})`
  ];

  const data = await s4hGet(`${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`);
  const rows = data.value ?? [];

  const today = new Date();

  const negatives = rows
    .filter(r => parseFloat(r.TotalStock ?? 0) < 0)
    .map(r => {
      const qty      = parseFloat(r.TotalStock ?? 0);
      const lastMove = r.LastMovementDate ?? null;
      const daysSince = lastMove
        ? Math.floor((today - new Date(lastMove)) / 86400000)
        : null;
      return {
        storageType:     r.StorageType,
        bin:             r.StorageBin,
        material:        r.Material?.trimStart?.() ?? r.Material,
        plant:           r.Plant,
        negativeQty:     qty,
        uom:             r.UnitOfMeasure,
        lastMove,
        daysSince,
        severity:        Math.abs(qty) > 1000 ? 'CRITICAL'
          : Math.abs(qty) > 100               ? 'HIGH'
          : Math.abs(qty) > 10                ? 'MEDIUM'
          : 'LOW',
        recommendation: daysSince === null || daysSince > 30
          ? 'Investigate — no recent TO activity. May require inventory difference posting.'
          : daysSince > 7
          ? 'TO likely created but not confirmed — check open TOs for this bin/material.'
          : 'Recent GI — confirm the corresponding TO to clear.'
      };
    })
    .filter(r => r.daysSince === null || r.daysSince >= minAgeDays)
    .sort((a, b) => a.negativeQty - b.negativeQty);

  const summary = {
    total:      negatives.length,
    critical:   negatives.filter(r => r.severity === 'CRITICAL').length,
    high:       negatives.filter(r => r.severity === 'HIGH').length,
    medium:     negatives.filter(r => r.severity === 'MEDIUM').length,
    low:        negatives.filter(r => r.severity === 'LOW').length,
    oldestDays: negatives.reduce((max, r) => Math.max(max, r.daysSince ?? 0), 0)
  };

  return {
    warehouse,
    filters: { storageType: storageType ?? SU_TYPES.join('+'), minAgeDays },
    note: `Negative quants in SU zones (${types.join(', ')}) older than ${minAgeDays} days. Fresh negatives from today's GI are excluded as transient. Persistent negatives indicate unconfirmed TOs or data integrity issues.`,
    summary,
    negatives
  };
}
