import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;

export async function getStockForMaterial({ warehouse, material, storageType, top = 20 }) {
  const filters = [`WarehouseNumber eq '${esc(warehouse)}'`];
  if (material)    filters.push(`Material eq '${esc(material)}'`);
  if (storageType) filters.push(`StorageType eq '${esc(storageType)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  return {
    count:     rows.length,
    truncated: rows.length === top,
    warehouse,
    material: material ?? 'all',
    stock: rows.map(q => ({
      bin:              q.StorageBin,
      storageType:      q.StorageType,
      quantNumber:      q.QuantNumber,
      material:         q.Material,
      plant:            q.Plant,
      batch:            q.Batch,
      totalStock:       q.TotalStock,
      availableStock:   q.AvailableStock,
      pickQuantity:     q.PickQuantity,
      transferQuantity: q.TransferQuantity,
      uom:              q.UnitOfMeasure,
      stockCategory:    q.StockCategory,
      lastMovement:     q.LastMovementDate
    }))
  };
}
