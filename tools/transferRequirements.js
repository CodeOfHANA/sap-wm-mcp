import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferRequirement`;

const STATUS_LABEL = { ' ': 'open', '': 'open', 'B': 'partial', 'C': 'completed' };

export async function getTransferRequirements({ warehouse, status, material, storageType, top = 50 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (material)    filters.push(`Material eq '${material}'`);
  if (storageType) filters.push(`(SourceStorageType eq '${storageType}' or DestStorageType eq '${storageType}')`);

  if (status === 'open')           filters.push(`Status eq ' '`);
  else if (status === 'partial')   filters.push(`Status eq 'B'`);
  else if (status === 'completed') filters.push(`Status eq 'C'`);
  else                             filters.push(`(Status eq ' ' or Status eq 'B')`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const today = new Date();

  return {
    count: rows.length,
    warehouse,
    filters: { status: status ?? 'open+partial', material: material ?? 'all', storageType: storageType ?? 'all' },
    requirements: rows.map(r => {
      const daysSinceCreation = r.CreatedDate
        ? Math.floor((today - new Date(r.CreatedDate)) / 86400000)
        : null;
      return {
        trNumber:         r.TransferReqNumber,
        trItem:           r.TransferReqItem,
        status:           STATUS_LABEL[r.Status] ?? r.Status,
        ageFlag:          daysSinceCreation > 30 ? '⚠ OVERDUE' : 'ok',
        daysSinceCreation,
        movementType:     r.MovementType,
        createdBy:        r.CreatedBy,
        createdDate:      r.CreatedDate,
        material:         r.Material?.trimStart?.() ?? r.Material,
        plant:            r.Plant,
        sourceType:       r.SourceStorageType,
        sourceBin:        r.SourceBin,
        destType:         r.DestStorageType,
        destBin:          r.DestBin,
        requiredQty:      parseFloat(r.RequiredQuantity) || 0,
        uom:              r.UnitOfMeasure,
        assignedTO:       r.AssignedTO || null,
        refDocType:       r.RefDocType  || null,
        refDocNum:        r.RefDocNumber || null,
        deliveryComplete: r.IsDeliveryComplete === true || r.IsDeliveryComplete === 'X'
      };
    })
  };
}
