#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';

import { getBinStatus } from './tools/binStatus.js';
import { getStockForMaterial } from './tools/stockByMaterial.js';
import { findEmptyBins } from './tools/emptyBins.js';
import { getBinUtilization } from './tools/binUtilization.js';
import { confirmWarehouseTask } from './tools/confirmWarehouseTask.js';
import { getFixedBinAssignments, assignFixedBin } from './tools/fixedBinAssignment.js';

const server = new McpServer({ name: 'sap-ewm-mcp', version: '0.1.0' });

// Tool 1 — get_bin_status
server.tool(
  'get_bin_status',
  'Query EWM storage bins from S/4HANA by warehouse, storage type, empty/blocked status',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    storageType: z.string().optional().describe('Storage type e.g. Y011'),
    emptyOnly: z.boolean().optional().describe('Return only empty bins'),
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
  'Get physical warehouse stock for a specific material/product in S/4HANA EWM',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    material: z.string().optional().describe('Material/Product number e.g. MZ-FG-M500'),
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
  'Find all empty storage bins in an EWM warehouse, optionally filtered by storage type',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    storageType: z.string().optional().describe('Storage type to filter e.g. Y011'),
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
  'Get warehouse bin utilization stats — occupied vs empty vs blocked, and stock by storage type',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
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

// Tool 5 — confirm_warehouse_task
server.tool(
  'confirm_warehouse_task',
  'Confirm a warehouse task as completed in EWM using the ConfirmWarehouseTaskExact bound action',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    warehouseTask: z.string().describe('Warehouse task number e.g. 100000001'),
    warehouseTaskItem: z.string().optional().default('0').describe('Warehouse task item — defaults to 0')
  },
  async (params) => {
    try {
      const result = await confirmWarehouseTask(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 6 — get_fixed_bin_assignments
server.tool(
  'get_fixed_bin_assignments',
  'Get fixed bin assignments in EWM — which materials are permanently assigned to which bins',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    product: z.string().optional().describe('Filter by material/product number'),
    storageBin: z.string().optional().describe('Filter by storage bin'),
    top: z.number().optional().default(20).describe('Max records to return')
  },
  async (params) => {
    try {
      const result = await getFixedBinAssignments(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 7 — assign_fixed_bin
server.tool(
  'assign_fixed_bin',
  'Assign a material to a fixed storage bin in EWM — master data write operation',
  {
    warehouse: z.string().describe('Warehouse number e.g. 1710'),
    storageBin: z.string().describe('Storage bin to assign as fixed bin e.g. 052.08'),
    product: z.string().describe('Material/product number e.g. EWMS4-42'),
    owner: z.string().describe('Entitled to dispose party / stock owner e.g. BP1710'),
    storageType: z.string().optional().describe('Storage type e.g. Y052')
  },
  async (params) => {
    try {
      const result = await assignFixedBin(params);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('SAP EWM MCP Server running (stdio)...');
