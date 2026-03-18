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

  const data = await s4hPost(path, body);

  // RAP static action result does not carry entity fields back — query the latest TO
  let transferOrderNumber = data?.value?.[0]?.TransferOrderNumber ?? data?.TransferOrderNumber ?? null;
  if (!transferOrderNumber) {
    const latest = await s4hGet(
      `${BASE}/WMTransferOrder?$orderby=TransferOrderNumber%20desc&$top=1`
    );
    transferOrderNumber = latest?.value?.[0]?.TransferOrderNumber ?? null;
  }

  return {
    success: true,
    warehouse,
    transferOrderNumber,
    raw: data
  };
}
