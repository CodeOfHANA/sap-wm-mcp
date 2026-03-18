import { s4hGet } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getStockForMaterial({ warehouse, material, storageType, top = 20 }) {
  const filters = [`WarehouseNumber eq '${warehouse}'`];
  if (material) filters.push(`Material eq '${material}'`);
  if (storageType) filters.push(`StorageType eq '${storageType}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);

  return {
    count: data.value.length,
    warehouse,
    material: material ?? 'all',
    stock: data.value.map(q => ({
      bin: q.StorageBin,
      storageType: q.StorageType,
      quantNumber: q.QuantNumber,
      material: q.Material,
      plant: q.Plant,
      batch: q.Batch,
      totalStock: q.TotalStock,
      availableStock: q.AvailableStock,
      pickQuantity: q.PickQuantity,
      transferQuantity: q.TransferQuantity,
      uom: q.UnitOfMeasure,
      stockCategory: q.StockCategory,
      lastMovement: q.LastMovementDate
    }))
  };
}
