import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE_HEADER = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrder`;
const BASE_ITEM   = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrderItem`;

export async function getOpenTransferOrders({ warehouse, storageType, bin, material, top = 50 }) {

  // Step 1 — Fetch open TO headers
  const headerFilters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `IsConfirmed ne true`
  ];
  const headerPath = `${BASE_HEADER}?$filter=${encodeURIComponent(headerFilters.join(' and '))}&$top=${top}&$select=WarehouseNumber,TransferOrderNumber,MovementType,CreatedDate,CreatedTime,CreatedBy,NumberOfItems`;
  const headerData = await s4hGet(headerPath);
  const headers    = headerData.value ?? [];

  if (headers.length === 0) {
    return {
      count: 0,
      truncated: false,
      warehouse,
      filters: { storageType: storageType ?? 'all', bin: bin ?? 'all', material: material ?? 'all' },
      orders: []
    };
  }

  // Step 2 — Fetch items scoped to the exact open TO numbers (avoids warehouse-wide scan)
  const toFilter = headers
    .map(h => `TransferOrderNumber eq '${esc(h.TransferOrderNumber)}'`)
    .join(' or ');

  const itemFilters = [`WarehouseNumber eq '${esc(warehouse)}'`, `(${toFilter})`];
  if (storageType) itemFilters.push(`(SourceStorageType eq '${esc(storageType)}' or DestStorageType eq '${esc(storageType)}')`);
  if (bin)         itemFilters.push(`(SourceBin eq '${esc(bin)}' or DestBin eq '${esc(bin)}')`);
  if (material)    itemFilters.push(`Material eq '${esc(material)}'`);

  const itemPath = `${BASE_ITEM}?$filter=${encodeURIComponent(itemFilters.join(' and '))}&$top=${top * 5}`;
  const itemData = await s4hGet(itemPath);
  const items    = itemData.value ?? [];

  // Step 3 — Join headers to items in memory
  const headerMap = Object.fromEntries(headers.map(h => [h.TransferOrderNumber, h]));
  const today     = new Date();

  const orders = items.map(item => {
    const hdr             = headerMap[item.TransferOrderNumber] ?? {};
    const reqQty          = parseFloat(item.RequiredQuantity)  || 0;
    const confQty         = parseFloat(item.ConfirmedQuantity) || 0;
    const daysSinceCreation = hdr.CreatedDate
      ? Math.floor((today - new Date(hdr.CreatedDate)) / 86400000)
      : null;
    return {
      toNumber:         item.TransferOrderNumber,
      toItem:           item.TransferOrderItem,
      status:           confQty > 0 && confQty < reqQty ? 'partial' : 'open',
      ageFlag:          daysSinceCreation > 1 ? '⚠ OVERDUE' : 'ok',
      daysSinceCreation,
      movementType:     hdr.MovementType,
      createdBy:        hdr.CreatedBy,
      createdDate:      hdr.CreatedDate,
      material:         item.Material?.trimStart?.() ?? item.Material,
      plant:            item.Plant,
      sourceType:       item.SourceStorageType,
      sourceBin:        item.SourceBin,
      destType:         item.DestStorageType,
      destBin:          item.DestBin,
      requiredQty:      reqQty,
      confirmedQty:     confQty,
      openQty:          reqQty - confQty,
      uom:              item.UnitOfMeasure,
      executedBy:       item.ConfirmedBy || null
    };
  });

  return {
    count:    orders.length,
    truncated: headers.length === top,
    warehouse,
    filters:  { storageType: storageType ?? 'all', bin: bin ?? 'all', material: material ?? 'all' },
    orders
  };
}
