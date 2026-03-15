import { s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/sap/api_warehouse_order_task_2/srvd_a2x/sap/warehouseorder/0001`;
const NAMESPACE = `com.sap.gateway.srvd_a2x.api_warehouse_order_task_2.v0001`;

export async function confirmWarehouseTask({ warehouse, warehouseTask, warehouseTaskItem = '0' }) {
  // OData V4 bound action: POST to entity key + action name
  const key = `EWMWarehouse='${warehouse}',WarehouseTask='${warehouseTask}',WarehouseTaskItem='${warehouseTaskItem}'`;
  const path = `${BASE}/WarehouseTask(${key})/${NAMESPACE}.ConfirmWarehouseTaskExact`;

  const result = await s4hPost(path, {});

  return {
    success: true,
    warehouse,
    warehouseTask,
    warehouseTaskItem,
    message: `Warehouse task ${warehouseTask} confirmed successfully.`,
    response: result
  };
}
