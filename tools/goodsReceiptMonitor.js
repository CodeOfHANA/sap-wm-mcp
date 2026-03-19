import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE_TR    = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMTransferRequirement`;
const BASE_STOCK = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getGoodsReceiptMonitor({ warehouse, grStorageType = '902' }) {

  // Step 1 — Stock in the GR area (received, awaiting putaway)
  const grFilters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `StorageType eq '${esc(grStorageType)}'`
  ];
  const grData  = await s4hGet(`${BASE_STOCK}?$filter=${encodeURIComponent(grFilters.join(' and '))}&$top=100`);
  const grStock = (grData.value ?? []).filter(r => parseFloat(r.TotalStock ?? 0) > 0);

  // Step 2 — Open inbound TRs (status open or partial)
  const today    = new Date().toISOString().slice(0, 10);
  const trFilters = [
    `WarehouseNumber eq '${esc(warehouse)}'`,
    `(Status eq ' ' or Status eq 'B')`
  ];
  const trData    = await s4hGet(`${BASE_TR}?$filter=${encodeURIComponent(trFilters.join(' and '))}&$top=50`);
  const allTRs    = trData.value ?? [];

  const inboundTRs = allTRs.filter(r => r.MovementType === '101' || r.CreatedDate === today);
  const todayDate  = new Date();

  return {
    warehouse,
    grStorageType,
    grArea: {
      pendingPutaway: grStock.length,
      stock: grStock.map(r => ({
        bin:      r.StorageBin,
        material: r.Material?.trimStart?.() ?? r.Material,
        plant:    r.Plant,
        qty:      parseFloat(r.TotalStock ?? 0),
        uom:      r.UnitOfMeasure,
        lastMove: r.LastMovementDate
      }))
    },
    inboundTRs: {
      count: inboundTRs.length,
      requirements: inboundTRs.map(r => ({
        trNumber:          r.TransferReqNumber,
        trItem:            r.TransferReqItem,
        movementType:      r.MovementType,
        createdDate:       r.CreatedDate,
        createdBy:         r.CreatedBy,
        material:          r.Material?.trimStart?.() ?? r.Material,
        requiredQty:       parseFloat(r.RequiredQuantity) || 0,
        uom:               r.UnitOfMeasure,
        assignedTO:        r.AssignedTO || null,
        daysSinceCreation: r.CreatedDate
          ? Math.floor((todayDate - new Date(r.CreatedDate)) / 86400000)
          : null
      }))
    }
  };
}
