#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';

import { getBinStatus } from './tools/binStatus.js';
import { getStockForMaterial } from './tools/stockByMaterial.js';
import { findEmptyBins } from './tools/emptyBins.js';
import { getBinUtilization } from './tools/binUtilization.js';
import { createTransferOrder } from './tools/createTransferOrder.js';
import { confirmTransferOrder } from './tools/confirmTransferOrder.js';
import { confirmTransferOrderSU } from './tools/confirmTransferOrderSU.js';

const server = new McpServer({ name: 'sap-wm-mcp', version: '0.1.0' });

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
    unitOfMeasure:  z.string().describe('Unit of measure e.g. ST, KG'),
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('SAP WM MCP Server running (stdio)...');
