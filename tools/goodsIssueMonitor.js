import { s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMGoodsIssueDelivery`;

const GI_STATUS = {
  'A': 'Not started',
  'B': 'Partially picked',
  'C': 'Goods issue posted',
  ' ': 'Not started'
};

export async function getGoodsIssueMonitor({
  warehouse,
  shippingPoint,
  includeCompleted = false,
  material,
  top = 50
}) {
  const filters = [
    `WarehouseNumber eq '${esc(warehouse)}'`
  ];
  if (!includeCompleted) filters.push(`GIStatus ne 'C'`);
  if (shippingPoint) filters.push(`ShippingPoint eq '${esc(shippingPoint)}'`);
  if (material) filters.push(`Material eq '${esc(material)}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}&$orderby=PlannedGIDate asc`;
  const data = await s4hGet(path);
  const rows = data.value ?? [];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Group items by delivery number
  const deliveryMap = {};
  for (const r of rows) {
    const del = r.DeliveryNumber;
    if (!deliveryMap[del]) {
      deliveryMap[del] = {
        deliveryNumber: del,
        shippingPoint:  r.ShippingPoint,
        customer:       r.Customer?.trimStart?.() ?? r.Customer,
        plannedGIDate:  r.PlannedGIDate,
        actualGIDate:   r.ActualGIDate || null,
        deliveryDate:   r.DeliveryDate,
        giStatus:       r.GIStatus,
        giStatusText:   GI_STATUS[r.GIStatus] ?? r.GIStatus,
        isOverdue:      r.PlannedGIDate && r.PlannedGIDate < todayStr && r.GIStatus !== 'C',
        items:          []
      };
    }
    const deliveryQty = parseFloat(r.DeliveryQuantity ?? 0);
    const pickedQty   = parseFloat(r.PickedQuantity ?? 0);
    deliveryMap[del].items.push({
      item:          r.DeliveryItem,
      material:      r.Material?.trimStart?.() ?? r.Material,
      plant:         r.Plant,
      storageType:   r.StorageType,
      bin:           r.StorageBin,
      wmMovementType: r.WMMovementType,
      wmTORequired:  r.WMTORequired,
      deliveryQty,
      pickedQty,
      remainingQty:  Math.max(0, deliveryQty - pickedQty),
      uom:           r.DeliveryUOM,
      pickComplete:  deliveryQty > 0 && pickedQty >= deliveryQty
    });
  }

  const deliveries = Object.values(deliveryMap);
  const overdue    = deliveries.filter(d => d.isOverdue);

  return {
    warehouse,
    filters: {
      shippingPoint:    shippingPoint ?? 'all',
      includeCompleted,
      material:         material ?? 'all'
    },
    summary: {
      totalDeliveries:  deliveries.length,
      overdueDeliveries: overdue.length,
      byStatus: {
        notStarted: deliveries.filter(d => d.giStatus === 'A' || d.giStatus === ' ').length,
        partial:    deliveries.filter(d => d.giStatus === 'B').length,
        complete:   deliveries.filter(d => d.giStatus === 'C').length
      }
    },
    truncated: rows.length === top,
    deliveries
  };
}
