import { s4hPost, s4hGet } from '../lib/s4hClient.js';
import { esc } from '../lib/sanitize.js';

const BASE = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001`;
const NS   = `com.sap.gateway.srvd.zsd_wmmcpservice.v0001`;

export async function createCycleCountDoc({
  warehouse,
  storageType,
  bin,
  activateNow = true
}) {
  const path = `${BASE}/WMTransferOrder/${NS}.CreateInventoryDocument`;

  const body = {
    WarehouseNumber: esc(warehouse),
    StorageType:     esc(storageType),
    StorageBin:      esc(bin),
    ActivateNow:     activateNow ? 'X' : ' '
  };

  await s4hPost(path, body);

  // RAP static action returns $self (WMTransferOrder) — field assignment does not
  // propagate back through the OData layer. Instead, read the inventory document
  // number from the bin master record (LAGP.IVNUM) via a follow-up GET on
  // WMStorageBin. When activateNow=true the bin is locked and IVNUM is set.
  const binFilter = `WarehouseNumber eq '${esc(warehouse)}' and StorageType eq '${esc(storageType)}' and StorageBin eq '${esc(bin)}'`;
  const binData = await s4hGet(`${BASE}/WMStorageBin?$filter=${encodeURIComponent(binFilter)}&$select=InventoryDocNumber,InventoryStatus`);
  const binRow  = binData?.value?.[0];
  const invDocNumber = binRow?.InventoryDocNumber?.trim() || null;

  if (!invDocNumber) {
    return {
      success:    true,
      warning:    'Inventory document created but number unavailable via OData — verify in SAP via LI04.',
      warehouse,
      storageType,
      bin,
      activated:  activateNow
    };
  }

  return {
    success:            true,
    warehouse,
    storageType,
    bin,
    inventoryDocNumber: invDocNumber,
    inventoryStatus:    binRow?.InventoryStatus ?? '',
    activated:          activateNow,
    message:            `Inventory document ${invDocNumber} created${activateNow ? ' and activated' : ''} for bin ${storageType}/${bin}`
  };
}
