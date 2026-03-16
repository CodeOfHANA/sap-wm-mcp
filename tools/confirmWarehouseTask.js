import { s4hGet, s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001`;
const NAMESPACE = `com.sap.gateway.srvd_a2x.api_warehouse_order_task_2.v0001`;

export async function confirmWarehouseTask({ warehouse, warehouseTask, warehouseTaskItem = '0' }) {
  const key = `EWMWarehouse='${warehouse}',WarehouseTask='${warehouseTask}',WarehouseTaskItem='${warehouseTaskItem}'`;

  // GET the entity first to retrieve the ETag required by the bound action
  const entity = await s4hGet(`${BASE}/WarehouseTask(${key})`);
  const etag = entity['@odata.etag'] ?? '*';

  // POST the bound action with If-Match header
  const path = `${BASE}/WarehouseTask(${key})/${NAMESPACE}.ConfirmWarehouseTaskExact`;
  const result = await s4hPost(path, {}, { ifMatch: etag });

  return {
    success: true,
    warehouse,
    warehouseTask,
    warehouseTaskItem,
    message: `Warehouse task ${warehouseTask} confirmed successfully.`,
    response: result
  };
}
