import { s4hGet, s4hPost } from '../lib/s4hClient.js';

const BASE = `/sap/opu/odata4/sap/api_whse_fixbin_assgnmnt/srvd_a2x/sap/whsefixedbinassignment/0001/WarehouseFixedBinAssignment`;

// Read — get fixed bin assignments for a warehouse, optionally filtered by product or bin
export async function getFixedBinAssignments({ warehouse, product, storageBin, top = 20 }) {
  const filters = [`EWMWarehouse eq '${warehouse}'`];
  if (product) filters.push(`Product eq '${product}'`);
  if (storageBin) filters.push(`EWMStorageBin eq '${storageBin}'`);

  const path = `${BASE}?$filter=${encodeURIComponent(filters.join(' and '))}&$top=${top}`;
  const data = await s4hGet(path);

  return {
    count: data.value.length,
    warehouse,
    assignments: data.value.map(a => ({
      warehouse: a.EWMWarehouse,
      storageBin: a.EWMStorageBin,
      storageType: a.EWMStorageType,
      product: a.Product,
      owner: a.EntitledToDisposeParty,
      minQty: a.EWMMinimumStorageQuantity,
      maxQty: a.EWMMaximumStorageQuantity,
      unit: a.EWMMaximumStorageQuantityUnit,
      createdOn: a.EWMFixedBinAssgmtCreatedDteTme,
    }))
  };
}

// Write — assign a material to a fixed bin
export async function assignFixedBin({ warehouse, storageBin, product, owner, storageType }) {
  const body = {
    EWMWarehouse: warehouse,
    EWMStorageBin: storageBin,
    Product: product,
    EntitledToDisposeParty: owner,
    ...(storageType && { EWMStorageType: storageType })
  };

  const result = await s4hPost(BASE, body);

  return {
    success: true,
    warehouse,
    storageBin,
    product,
    owner,
    message: `Material ${product} assigned to fixed bin ${storageBin} in warehouse ${warehouse}.`,
    response: result
  };
}
