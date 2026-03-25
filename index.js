#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') });

import { getBinStatus } from './tools/binStatus.js';
import { getStockForMaterial } from './tools/stockByMaterial.js';
import { findEmptyBins } from './tools/emptyBins.js';
import { getBinUtilization } from './tools/binUtilization.js';
import { createTransferOrder } from './tools/createTransferOrder.js';
import { confirmTransferOrder } from './tools/confirmTransferOrder.js';
import { confirmTransferOrderSU } from './tools/confirmTransferOrderSU.js';
import { getOpenTransferOrders } from './tools/openTransferOrders.js';
import { getStockByType } from './tools/stockByType.js';
import { getTransferRequirements } from './tools/transferRequirements.js';
import { getWMIMVariance } from './tools/wmImVariance.js';
import { getCycleCountCandidates } from './tools/cycleCountCandidates.js';
import { getStockAging } from './tools/stockAging.js';
import { getNegativeStock } from './tools/negativeStock.js';
import { getGoodsReceiptMonitor } from './tools/goodsReceiptMonitor.js';
import { getQuantFragmentation } from './tools/quantFragmentation.js';
import { getUnresolvedSuNegatives } from './tools/unresolvedSuNegatives.js';
import { getInventoryAnomalies } from './tools/inventoryAnomalies.js';
import { getTransferOrderHistory } from './tools/transferOrderHistory.js';
import { cancelTransferOrder } from './tools/cancelTransferOrder.js';
import { getReplenishmentNeeds } from './tools/replenishmentNeeds.js';

const server = new McpServer({ name: 'sap-wm-mcp', version: '0.2.6' });

// Tool 1 — get_bin_status
server.tool(
  'get_bin_status',
  'Query classic WM storage bins from S/4HANA by warehouse, storage type, or specific bin — returns empty/blocked status and capacity',
  {
    warehouse: z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Storage type e.g. 001'),
    bin: z.string().optional().describe('Specific bin number e.g. 01-01-01'),
    top: z.number().optional().default(20).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getBinStatus(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2 — get_stock_for_material
server.tool(
  'get_stock_for_material',
  'Get physical warehouse stock for a material in classic WM — shows which bins hold the material and how much',
  {
    warehouse: z.string().describe('Warehouse number e.g. 102'),
    material: z.string().optional().describe('Material number e.g. TG0001'),
    storageType: z.string().optional().describe('Filter by storage type'),
    top: z.number().optional().default(20).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getStockForMaterial(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3 — find_empty_bins
server.tool(
  'find_empty_bins',
  'Find all empty storage bins in a classic WM warehouse, optionally filtered by storage type',
  {
    warehouse: z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Storage type to filter e.g. 001'),
    top: z.number().optional().default(50).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await findEmptyBins(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4 — get_bin_utilization
server.tool(
  'get_bin_utilization',
  'Get warehouse bin utilization stats for classic WM — occupied vs empty vs blocked, grouped by storage type',
  {
    warehouse: z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Filter by storage type'),
    top: z.number().optional().default(100).describe('Max bins to analyze')
  },
  async (params) => {
    try {
      const result = await getBinUtilization(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 5 — create_transfer_order
server.tool(
  'create_transfer_order',
  'Create a classic WM Transfer Order in S/4HANA — moves stock from source bin to destination bin via L_TO_CREATE_SINGLE',
  {
    warehouse:      z.string().describe('Warehouse number e.g. 102'),
    movementType:   z.string().describe('WM movement type e.g. 999'),
    material:       z.string().describe('Material number e.g. TG0001'),
    plant:          z.string().describe('Plant e.g. 1710'),
    quantity:       z.number().describe('Quantity to move'),
    unitOfMeasure:  z.string().optional().default('').describe('Unit of measure — leave empty to use material base UOM (recommended)'),
    sourceType:         z.string().optional().default('').describe('Source storage type e.g. 001'),
    sourceBin:          z.string().optional().default('').describe('Source bin e.g. 01-02-01'),
    sourceStorageUnit:  z.string().optional().default('').describe('Source storage unit (LENUM) — required for SU-managed types e.g. 00000000001000000017'),
    destType:           z.string().describe('Destination storage type e.g. 001'),
    destBin:            z.string().describe('Destination bin e.g. 01-06-03'),
    destStorageUnit:    z.string().optional().default('').describe('Destination storage unit (LENUM) — for SU-managed types, same as source SU when moving full SU')
  },
  async (params) => {
    try {
      const result = await createTransferOrder(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 6 — confirm_transfer_order
server.tool(
  'confirm_transfer_order',
  'Confirm a classic WM Transfer Order in S/4HANA — marks the TO as executed via L_TO_CONFIRM',
  {
    warehouse:           z.string().describe('Warehouse number e.g. 102'),
    transferOrderNumber: z.string().describe('Transfer order number e.g. 0000000123')
  },
  async (params) => {
    try {
      const result = await confirmTransferOrder(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 7 — confirm_transfer_order_su
server.tool(
  'confirm_transfer_order_su',
  'Confirm all open transfer orders on a classic WM storage unit — uses L_TO_CONFIRM_SU to confirm by SU number instead of individual TO number',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageUnit: z.string().describe('Storage unit number (LENUM) e.g. 000000001234567890')
  },
  async (params) => {
    try {
      const result = await confirmTransferOrderSU(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 8 — get_open_transfer_orders
server.tool(
  'get_open_transfer_orders',
  'Get open (unconfirmed) classic WM Transfer Orders in S/4HANA — optionally filter by bin, storage type, or material. Returns TO header + item details including source/dest bins and open quantities.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Filter by source or destination storage type e.g. 999'),
    bin:         z.string().optional().describe('Filter by source or destination bin e.g. AUFNAHME'),
    material:    z.string().optional().describe('Filter by material number e.g. TG0001'),
    top:         z.number().optional().default(50).describe('Max TO headers to return')
  },
  async (params) => {
    try {
      const result = await getOpenTransferOrders(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 9 — get_stock_by_type
server.tool(
  'get_stock_by_type',
  'Get all warehouse stock in a classic WM storage type — shows every occupied bin, material and quantity. Equivalent to SAP LX02 filtered by storage type.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Storage type e.g. 001. Omit to see all types.'),
    bin:         z.string().optional().describe('Narrow to a specific bin within the type'),
    top:         z.number().optional().default(100).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getStockByType(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 10 — get_transfer_requirements
server.tool(
  'get_transfer_requirements',
  'Get open Transfer Requirements (TRs) in classic WM — these are the demand documents that drive TO creation. Shows what work is pending and whether a TO has already been assigned. Equivalent to SAP LB10 / TR monitor.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    status:      z.enum(['open', 'partial', 'to-created', 'completed']).optional().describe('TR status filter. Defaults to open + partial + to-created. Use to-created to see TRs where a TO exists but is not yet confirmed.'),
    material:    z.string().optional().describe('Filter by material number e.g. TG0001'),
    storageType: z.string().optional().describe('Filter by source or destination storage type'),
    top:         z.number().optional().default(50).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getTransferRequirements(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 11 — get_wm_im_variance
server.tool(
  'get_wm_im_variance',
  'Compare WM bin stock (LQUA) against IM unrestricted stock (MARD) to surface discrepancies — the classic WM LX23 reconciliation check. Returns materials where WM and MM stock are out of sync.',
  {
    warehouse:       z.string().describe('Warehouse number e.g. 102'),
    plant:           z.string().describe('Plant e.g. 1010'),
    storageLocation: z.string().optional().describe('Storage location (LGORT) linked to this warehouse e.g. 0002 — required for accurate results, otherwise MARD returns all plant stock'),
    material:        z.string().optional().describe('Narrow to a specific material'),
    threshold:       z.number().optional().default(0).describe('Ignore variances smaller than this quantity')
  },
  async (params) => {
    try {
      const result = await getWMIMVariance(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 12 — get_cycle_count_candidates
server.tool(
  'get_cycle_count_candidates',
  'Find occupied storage bins in classic WM that are due for a cycle count — bins never counted or not counted within the specified number of days. Equivalent to SAP LX26 cycle count planning.',
  {
    warehouse:          z.string().describe('Warehouse number e.g. 102'),
    storageType:        z.string().optional().describe('Limit to a specific storage type e.g. 001'),
    daysSinceLastCount: z.number().optional().default(180).describe('Flag bins not counted within this many days (default 180)'),
    top:                z.number().optional().default(100).describe('Max bins to return')
  },
  async (params) => {
    try {
      const result = await getCycleCountCandidates(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 13 — get_stock_aging
server.tool(
  'get_stock_aging',
  'Find warehouse stock that has not moved in X days — identifies slow movers, dead stock, and forgotten bins. Sorted from oldest to most recent last movement.',
  {
    warehouse:        z.string().describe('Warehouse number e.g. 102'),
    storageType:      z.string().optional().describe('Narrow to a specific storage type'),
    material:         z.string().optional().describe('Narrow to a specific material'),
    daysSinceLastMove: z.number().optional().default(90).describe('Flag stock not moved in this many days (default 90)'),
    top:              z.number().optional().default(100).describe('Max quants to scan')
  },
  async (params) => {
    try {
      const result = await getStockAging(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 14 — get_negative_stock_report
server.tool(
  'get_negative_stock_report',
  'Surface all bins with negative WM stock quantities — typically caused by GI postings before TO confirmation in SU/GI zones. Returns likely cause and severity.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Narrow to a specific storage type e.g. 999')
  },
  async (params) => {
    try {
      const result = await getNegativeStock(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 15 — get_goods_receipt_monitor
server.tool(
  'get_goods_receipt_monitor',
  'Monitor inbound goods receipts in classic WM — shows stock sitting in the GR area awaiting putaway, plus any open inbound transfer requirements. Equivalent to checking WE-ZONE + LB10.',
  {
    warehouse:     z.string().describe('Warehouse number e.g. 102'),
    grStorageType: z.string().optional().default('902').describe('GR area storage type (default 902 = WE-ZONE)')
  },
  async (params) => {
    try {
      const result = await getGoodsReceiptMonitor(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 16 — get_quant_fragmentation
server.tool(
  'get_quant_fragmentation',
  'Find bin+material combinations with excessive quant counts in classic WM — a leading indicator of TO performance issues and picking errors. Bins with many quants for the same material benefit from consolidation TOs.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Limit to a specific storage type e.g. 003'),
    threshold:   z.number().optional().default(3).describe('Flag bin+material combos with this many quants or more (default 3)'),
    top:         z.number().optional().default(200).describe('Max stock records to scan')
  },
  async (params) => {
    try {
      const result = await getQuantFragmentation(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 17 — get_unresolved_su_negatives
server.tool(
  'get_unresolved_su_negatives',
  'Find persistent negative quants in SU/GI interim zones (types 999, 998) that are older than a threshold — distinguishes fresh GI negatives (expected, transient) from aged negatives (unconfirmed TOs or data integrity issues). Includes severity rating and recommended action.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Specific zone type to check e.g. 999. Defaults to 999 + 998.'),
    minAgeDays:  z.number().optional().default(7).describe('Only show negatives older than this many days (default 7). Set to 0 to see all.'),
    top:         z.number().optional().default(500).describe('Max stock records to scan')
  },
  async (params) => {
    try {
      const result = await getUnresolvedSuNegatives(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 18 — get_inventory_anomalies
server.tool(
  'get_inventory_anomalies',
  'Detect bins stuck in mid-inventory-process state in classic WM — empty bins still carrying an inventory lock, open count documents that were never posted, and orphaned lock codes. These block TO processing until resolved.',
  {
    warehouse:   z.string().describe('Warehouse number e.g. 102'),
    storageType: z.string().optional().describe('Limit to a specific storage type e.g. 001')
  },
  async (params) => {
    try {
      const result = await getInventoryAnomalies(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 19 — get_transfer_order_history
server.tool(
  'get_transfer_order_history',
  'Get the full history of classic WM Transfer Orders in S/4HANA — when they were created, by whom, when confirmed, who executed them, and how long they took. Filter by date range, status (open/confirmed/all), movement type, material, creator, or executor.',
  {
    warehouse:    z.string().describe('Warehouse number e.g. 102'),
    dateFrom:     z.string().optional().describe('Filter TOs created from this date (YYYY-MM-DD) e.g. 2026-01-01'),
    dateTo:       z.string().optional().describe('Filter TOs created up to this date (YYYY-MM-DD) e.g. 2026-03-31'),
    status:       z.enum(['open', 'confirmed', 'all']).optional().default('all').describe('Filter by confirmation status — open, confirmed, or all (default: all)'),
    movementType: z.string().optional().describe('Filter by WM movement type e.g. 999'),
    createdBy:    z.string().optional().describe('Filter by the SAP user who created the TO e.g. NOMANH'),
    executedBy:   z.string().optional().describe('Filter by the SAP user who executed/confirmed the TO'),
    material:     z.string().optional().describe('Filter by material number e.g. TG0001'),
    top:          z.number().optional().default(50).describe('Max number of TOs to return (default 50)')
  },
  async (params) => {
    try {
      const result = await getTransferOrderHistory(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 20 — cancel_transfer_order
server.tool(
  'cancel_transfer_order',
  'Cancel an open classic WM Transfer Order — releases the source quant lock and removes the destination bin reservation. Only works on TOs not yet confirmed. Use to recover from a wrong bin or quantity before retrying with corrected parameters.',
  {
    warehouse:           z.string().describe('Warehouse number e.g. 102'),
    transferOrderNumber: z.string().describe('Transfer order number to cancel e.g. 0000000730')
  },
  async (params) => {
    try {
      const result = await cancelTransferOrder(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 21 — get_replenishment_needs
server.tool(
  'get_replenishment_needs',
  'Find forward pick and fixed storage bins that are at or below their minimum stock threshold and need replenishment. Returns urgency level (critical = empty or negative, low = below minimum) and flags bins where an open replenishment TO already exists. Run at shift start and before peak picking periods.',
  {
    warehouse:       z.string().describe('Warehouse number e.g. 102'),
    storageType:     z.string().optional().default('P01').describe('Forward pick storage type to check (default P01)'),
    material:        z.string().optional().describe('Narrow to a specific material e.g. TG0001'),
    minimumQuantity: z.number().optional().default(0).describe('Flag bins with stock at or below this level. Default 0 = empty or negative only.'),
    targetQuantity:  z.number().optional().describe('Fill-to target quantity — used to calculate replenishmentQty in the response. Leave unset if unknown.'),
    top:             z.number().optional().default(50).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getReplenishmentNeeds(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('SAP WM MCP Server running (stdio)...');
