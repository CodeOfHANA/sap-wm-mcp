import { s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function createTransferOrder({
  warehouse, movementType, material, plant,
  quantity, unitOfMeasure,
  sourceType = '', sourceBin = '',
  destType, destBin
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
    DestStorageType:   destType,
    DestBin:           destBin
  };

  const data = await s4hPost(path, body);

  return {
    success: true,
    warehouse,
    transferOrderNumber: data?.value?.[0]?.TransferOrderNumber ?? data?.TransferOrderNumber ?? null,
    raw: data
  };
}
