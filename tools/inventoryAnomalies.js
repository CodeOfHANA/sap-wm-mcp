import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMCycleCountBin`;

// Interim/SU types never cycle-counted — exclude from anomaly checks
const EXCLUDE_TYPES = ['999', '998', '902'];

export async function getInventoryAnomalies({ warehouse, storageType, top = 300 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (storageType) filters.push(`StorageType eq '${storageType}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const anomalies = [];

  for (const r of rows) {
    if (EXCLUDE_TYPES.includes(r.StorageType)) continue;

    const isLocked = r.IsInventoryActive && r.IsInventoryActive !== '';
    const isEmpty  = r.IsEmpty === true;
    const hasDoc   = r.InventoryDocNumber && r.InventoryDocNumber.trim() !== '';
    const lastCounted = r.LastInventoryDate ?? null;

    // Anomaly Type 1: Inventory lock active on an empty bin
    // An empty bin should not remain inventory-locked — the count doc needs to be posted/cancelled
    if (isLocked && isEmpty) {
      anomalies.push({
        type:        'LOCK_ON_EMPTY_BIN',
        severity:    'MEDIUM',
        storageType: r.StorageType,
        bin:         r.StorageBin,
        lockCode:    r.IsInventoryActive,
        inventoryDoc: r.InventoryDocNumber?.trim() || null,
        lastCounted,
        quantCount:  r.QuantCount ?? 0,
        message:     `Bin is empty but inventory lock "${r.IsInventoryActive}" is still active. Open inventory document needs to be posted (zero count) or cancelled via LIIC/LICC.`
      });
    }

    // Anomaly Type 2: Inventory lock active with a doc but bin is occupied and has never been counted
    // Indicates a count was initiated but never completed
    if (isLocked && !isEmpty && hasDoc && !lastCounted) {
      anomalies.push({
        type:        'UNCOMPLETED_COUNT',
        severity:    'HIGH',
        storageType: r.StorageType,
        bin:         r.StorageBin,
        lockCode:    r.IsInventoryActive,
        inventoryDoc: r.InventoryDocNumber?.trim() || null,
        lastCounted: null,
        quantCount:  r.QuantCount ?? 0,
        message:     `Bin has an open inventory document (${r.InventoryDocNumber?.trim()}) that was never posted. Bin is blocked for stock movements until resolved.`
      });
    }

    // Anomaly Type 3: Inventory lock active without any document number
    // Lock exists but with no traceable document — orphaned lock
    if (isLocked && !hasDoc) {
      anomalies.push({
        type:        'ORPHANED_LOCK',
        severity:    'LOW',
        storageType: r.StorageType,
        bin:         r.StorageBin,
        lockCode:    r.IsInventoryActive,
        inventoryDoc: null,
        lastCounted,
        quantCount:  r.QuantCount ?? 0,
        message:     `Bin has inventory lock code "${r.IsInventoryActive}" but no inventory document number. Lock may be a remnant from an interrupted inventory process.`
      });
    }
  }

  // Sort: HIGH first, then MEDIUM, then LOW
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const byType = {};
  for (const a of anomalies) {
    if (!byType[a.type]) byType[a.type] = 0;
    byType[a.type]++;
  }

  return {
    warehouse,
    filters: { storageType: storageType ?? 'all (excluding 999/998/902)' },
    count: anomalies.length,
    summary: byType,
    note: 'Detects bins stuck in mid-inventory-process state: empty bins still locked, open count docs never posted, or orphaned lock codes. All anomalies block normal TO processing for the affected bins.',
    anomalies
  };
}
