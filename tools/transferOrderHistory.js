import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE_HEADER = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrder`;
const BASE_ITEM   = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferOrderItem`;

export async function getTransferOrderHistory({
  warehouse,
  dateFrom,
  dateTo,
  status = 'all',
  movementType,
  createdBy,
  executedBy,
  material,
  top = 50
}) {

  // Step 1 — Build header filters
  const headerFilters = [`WarehouseNumber eq '${esc(warehouse)}'`];

  if (status === 'confirmed') headerFilters.push(`IsConfirmed eq true`);
  if (status === 'open')      headerFilters.push(`IsConfirmed ne true`);

  if (dateFrom)      headerFilters.push(`CreatedDate ge ${esc(dateFrom)}`);
  if (dateTo)        headerFilters.push(`CreatedDate le ${esc(dateTo)}`);
  if (movementType)  headerFilters.push(`MovementType eq '${esc(movementType)}'`);
  if (createdBy)     headerFilters.push(`CreatedBy eq '${esc(createdBy)}'`);
  if (executedBy)    headerFilters.push(`ExecutedBy eq '${esc(executedBy)}'`);

  const headerSelect = [
    'WarehouseNumber','TransferOrderNumber','MovementType','IsConfirmed',
    'CreatedDate','CreatedTime','CreatedBy',
    'ConfirmedDate','ExecutedBy','StartDate','StartTime','EndDate','EndTime',
    'TransferReqNumber','NumberOfItems'
  ].join(',');

  const headerPath = `${BASE_HEADER}?$filter=${encodeURIComponent(headerFilters.join(' and '))}&$orderby=CreatedDate desc,CreatedTime desc&$top=${top}&$select=${headerSelect}`;
  const headerData = await s4hGet(headerPath);
  const headers    = headerData.value ?? [];

  if (headers.length === 0) {
    return {
      count: 0,
      truncated: false,
      warehouse,
      filters: { dateFrom: dateFrom ?? 'all', dateTo: dateTo ?? 'all', status, movementType: movementType ?? 'all' },
      orders: []
    };
  }

  // Step 2 — Fetch items for the returned TOs
  const toNumbers = [...new Set(headers.map(h => h.TransferOrderNumber))];
  const toFilter  = toNumbers.map(n => `TransferOrderNumber eq '${esc(n)}'`).join(' or ');

  const itemFilters = [`WarehouseNumber eq '${esc(warehouse)}'`, `(${toFilter})`];
  if (material) itemFilters.push(`Material eq '${esc(material)}'`);

  const itemPath = `${BASE_ITEM}?$filter=${encodeURIComponent(itemFilters.join(' and '))}&$top=${top * 10}`;
  const itemData = await s4hGet(itemPath);
  const allItems = itemData.value ?? [];

  // Step 3 — Group items by TO number
  const itemsByTo = {};
  for (const item of allItems) {
    const key = item.TransferOrderNumber;
    if (!itemsByTo[key]) itemsByTo[key] = [];
    itemsByTo[key].push({
      item:         item.TransferOrderItem,
      material:     item.Material?.trimStart?.() ?? item.Material,
      plant:        item.Plant,
      sourceType:   item.SourceStorageType,
      sourceBin:    item.SourceBin,
      destType:     item.DestStorageType,
      destBin:      item.DestBin,
      requiredQty:  parseFloat(item.RequiredQuantity)  || 0,
      confirmedQty: parseFloat(item.ConfirmedQuantity) || 0,
      uom:          item.UnitOfMeasure
    });
  }

  // Step 4 — If material filter active, drop TOs that have no matching items
  const filteredHeaders = material
    ? headers.filter(h => itemsByTo[h.TransferOrderNumber]?.length > 0)
    : headers;

  // Step 5 — Build response
  const today = new Date();

  const orders = filteredHeaders.map(h => {
    const items          = itemsByTo[h.TransferOrderNumber] ?? [];
    const createdAt      = h.CreatedDate ? new Date(h.CreatedDate) : null;
    const daysSince      = createdAt ? Math.floor((today - createdAt) / 86400000) : null;
    const isConfirmed    = h.IsConfirmed === true || h.IsConfirmed === 'X';

    // Duration: minutes between StartDate/Time and EndDate/Time
    let durationMinutes = null;
    if (h.StartDate && h.EndDate && h.StartTime && h.EndTime) {
      const start = new Date(`${h.StartDate}T${h.StartTime}`);
      const end   = new Date(`${h.EndDate}T${h.EndTime}`);
      if (!isNaN(start) && !isNaN(end)) {
        durationMinutes = Math.round((end - start) / 60000);
      }
    }

    return {
      toNumber:           h.TransferOrderNumber,
      status:             isConfirmed ? 'confirmed' : 'open',
      movementType:       h.MovementType,
      transferReqNumber:  h.TransferReqNumber || null,
      numberOfItems:      parseInt(h.NumberOfItems) || items.length,
      created: {
        date:   h.CreatedDate,
        time:   h.CreatedTime,
        by:     h.CreatedBy,
        daysAgo: daysSince
      },
      execution: isConfirmed ? {
        confirmedDate: h.ConfirmedDate  || null,
        executedBy:    h.ExecutedBy     || null,
        startDate:     h.StartDate      || null,
        startTime:     h.StartTime      || null,
        endDate:       h.EndDate        || null,
        endTime:       h.EndTime        || null,
        durationMinutes
      } : null,
      items
    };
  });

  return {
    count:    orders.length,
    truncated: headers.length === top,
    warehouse,
    filters: {
      dateFrom:     dateFrom     ?? 'all',
      dateTo:       dateTo       ?? 'all',
      status,
      movementType: movementType ?? 'all',
      createdBy:    createdBy    ?? 'all',
      executedBy:   executedBy   ?? 'all',
      material:     material     ?? 'all'
    },
    orders
  };
}
