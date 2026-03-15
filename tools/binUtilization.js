import { s4hGet } from '../lib/s4hClient.js';

// ⚠️ Verify service path in browser before first use:
// https://<host>/sap/opu/odata4/sap/api_whse_storage_bin_2/srvd_a2x/sap/whsestoragebin2/0001/
const BIN_BASE = `/sap/opu/odata4/sap/api_whse_storage_bin_2/srvd_a2x/sap/whsestoragebin2/0001/StorageBin`;
const STOCK_BASE = `/sap/opu/odata4/sap/api_whse_physstockprod/srvd_a2x/sap/whsephysicalstockproducts/0001/WarehousePhysicalStockProducts`;

export async function getBinUtilization({ warehouse, storageType, top = 100 }) {
  const binFilters = [`EWMWarehouse eq '${warehouse}'`];
  if (storageType) binFilters.push(`EWMStorageType eq '${storageType}'`);

  const [binData, stockData] = await Promise.all([
    s4hGet(`${BIN_BASE}?$filter=${encodeURIComponent(binFilters.join(' and '))}&$top=${top}`),
    s4hGet(`${STOCK_BASE}?$filter=${encodeURIComponent(`EWMWarehouse eq '${warehouse}'`)}&$top=${top}`)
  ]);

  const totalBins = binData.value.length;
  const emptyBins = binData.value.filter(b => b.EWMStorageBinIsEmpty).length;
  const occupiedBins = totalBins - emptyBins;
  const blockedBins = binData.value.filter(b => b.EWMStorageBinIsBlocked).length;
  const utilizationPct = totalBins > 0 ? Math.round((occupiedBins / totalBins) * 100) : 0;

  // Group stock by storage type
  const stockByType = {};
  for (const s of stockData.value) {
    const type = s.EWMStorageType || 'unknown';
    if (!stockByType[type]) stockByType[type] = { quantity: 0, unit: s.EWMBaseUnit };
    stockByType[type].quantity += parseFloat(s.EWMStockQuantityInBaseUnit || 0);
  }

  return {
    warehouse,
    storageType: storageType || 'all',
    summary: {
      totalBins,
      occupiedBins,
      emptyBins,
      blockedBins,
      utilizationPercent: utilizationPct,
    },
    stockByStorageType: stockByType
  };
}
