import { s4hPost, s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function createTransferOrder({
  warehouse, movementType, material, plant,
  quantity, unitOfMeasure,
  sourceType = '', sourceBin = '', sourceStorageUnit = '',
  destType, destBin, destStorageUnit = ''
}) {
  const path = `${BASE}/WMTransferOrder/${NS}.CreateTransferOrder`;

  const body = {
    WarehouseNumber:   warehouse,
    MovementType:      movementType,
    Material:          material,
    Plant:             plant,
    Quantity:          quantity,
    UnitOfMeasure:     unitOfMeasure,
    SourceStorageType: sourceType,
    SourceBin:         sourceBin,
    SourceStorageUnit: sourceStorageUnit,
    DestStorageType:   destType,
    DestBin:           destBin,
    DestStorageUnit:   destStorageUnit
  };

  // Snapshot the latest TO number BEFORE the call to avoid the race condition
  // where a concurrent TO creation causes us to return the wrong number.
  const beforeSnap = await s4hGet(
    `${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1&$select=TransferOrderNumber`
  );
  const lastBefore = beforeSnap?.value?.[0]?.TransferOrderNumber ?? null;

  const data = await s4hPost(path, body);

  // Prefer the action result if available
  let transferOrderNumber = data?.value?.[0]?.TransferOrderNumber ?? data?.TransferOrderNumber ?? null;

  // Fallback: find the TO created AFTER our snapshot (not just the globally latest)
  if (!transferOrderNumber) {
    const afterSnap = await s4hGet(
      `${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1&$select=TransferOrderNumber`
    );
    const latestAfter = afterSnap?.value?.[0]?.TransferOrderNumber ?? null;

    if (latestAfter && latestAfter !== lastBefore) {
      transferOrderNumber = latestAfter;
    }
  }

  // If we still have no TO number, the action may have silently failed
  if (!transferOrderNumber) {
    return {
      success:  false,
      warning:  'Transfer order action returned no TO number. The TO may not have been created. Verify in SAP via LT21.',
      warehouse,
      raw: data
    };
  }

  return {
    success: true,
    warehouse,
    transferOrderNumber,
    raw: data
  };
}
