import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE_STOCK  = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;
const BASE_HEADER = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrder`;
const BASE_ITEM   = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrderItem`;

export async function getReplenishmentNeeds({
  warehouse,
  storageType = 'P01',
  material,
  minimumQuantity = 0,
  targetQuantity,
  defaultReplenishQty = 50,
  top = 50
}) {
  // Step 1 + 2 in parallel: stock per bin + open TO headers
  const stockFilters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `StorageType eq '${esc(storageType)}'`
  ];
  if (material) stockFilters.push(`Material eq '${esc(material)}'`);

  const stockPath = `${BASE_STOCK}?$filter=${encodeURIComponent(stockFilters.join(' and '))}`
    + `&$top=${top * 10}`
    + `&$select=StorageType,StorageBin,Material,Plant,TotalStock,AvailableStock,PickQuantity,UnitOfMeasure`;

  const headerPath = `${BASE_HEADER}?$filter=${encodeURIComponent(
    `WarehouseNumber eq '${esc(warehouse)}' and IsConfirmed ne true`
  )}&$top=500&$select=TransferOrderNumber`;

  const [stockData, headerData] = await Promise.all([
    s4hGet(stockPath),
    s4hGet(headerPath)
  ]);

  const allStock    = stockData.value  ?? [];
  const openHeaders = headerData.value ?? [];

  // Aggregate stock by bin+material (multiple quants per bin collapse to one row)
  const stockMap = new Map();
  for (const row of allStock) {
    const mat = row.Material?.trimStart?.() ?? row.Material;
    const key = `${row.StorageBin}::${mat}`;
    if (!stockMap.has(key)) {
      stockMap.set(key, {
        storageType:    row.StorageType,
        bin:            row.StorageBin,
        material:       mat,
        plant:          row.Plant,
        totalStock:     0,
        availableStock: 0,
        pickQty:        0,
        uom:            row.UnitOfMeasure
      });
    }
    const e = stockMap.get(key);
    e.totalStock     += parseFloat(row.TotalStock     ?? 0);
    e.availableStock += parseFloat(row.AvailableStock ?? 0);
    e.pickQty        += parseFloat(row.PickQuantity   ?? 0);
  }

  // Filter: bins at or below the minimum threshold
  const lowBins = [...stockMap.values()].filter(e => e.totalStock <= minimumQuantity);

  if (lowBins.length === 0) {
    return {
      count:     0,
      truncated: false,
      warehouse,
      storageType,
      filters:   { material: material ?? 'all', minimumQuantity, targetQuantity: targetQuantity ?? null, defaultReplenishQty },
      summary:   { critical: 0, low: 0 },
      bins:      [],
      note:      `All bins in storage type ${storageType} are above minimum quantity (${minimumQuantity})`
    };
  }

  // Fetch open TO items targeting this type as destination (replenishment TOs in progress)
  const replenTOMap = new Map(); // 'bin::material' → TO number
  if (openHeaders.length > 0) {
    const toFilter = openHeaders
      .map(h => `TransferOrderNumber eq '${esc(h.TransferOrderNumber)}'`)
      .join(' or ');
    const itemFilters = [
      `WarehouseNumber eq '${esc(warehouse)}'`,
      `DestStorageType eq '${esc(storageType)}'`,
      `(${toFilter})`
    ];
    if (material) itemFilters.push(`Material eq '${esc(material)}'`);

    const itemPath = `${BASE_ITEM}?$filter=${encodeURIComponent(itemFilters.join(' and '))}`
      + `&$top=500&$select=TransferOrderNumber,DestBin,Material`;
    const itemData = await s4hGet(itemPath);

    for (const item of (itemData.value ?? [])) {
      const mat = item.Material?.trimStart?.() ?? item.Material;
      const key = `${item.DestBin}::${mat}`;
      if (!replenTOMap.has(key)) replenTOMap.set(key, item.TransferOrderNumber);
    }
  }

  // Build response — sorted critical first (most negative / lowest stock first)
  const bins = lowBins
    .sort((a, b) => a.totalStock - b.totalStock)
    .map(e => {
      const key              = `${e.bin}::${e.material}`;
      const urgency          = e.totalStock <= 0 ? 'critical' : 'low';
      const openTONumber     = replenTOMap.get(key) ?? null;
      const replenishmentQty = targetQuantity != null
        ? Math.max(0, targetQuantity - e.totalStock)
        : defaultReplenishQty;
      return {
        storageType:      e.storageType,
        bin:              e.bin,
        material:         e.material,
        plant:            e.plant,
        currentStock:     e.totalStock,
        availableStock:   e.availableStock,
        pickQty:          e.pickQty,
        replenishmentQty,
        uom:              e.uom,
        urgency,
        openReplenTO:     openTONumber !== null,
        openTONumber
      };
    });

  return {
    count:     bins.length,
    truncated: allStock.length >= top * 10,
    warehouse,
    storageType,
    filters:   { material: material ?? 'all', minimumQuantity, targetQuantity: targetQuantity ?? null, defaultReplenishQty },
    summary: {
      critical: bins.filter(b => b.urgency === 'critical').length,
      low:      bins.filter(b => b.urgency === 'low').length
    },
    bins
  };
}
