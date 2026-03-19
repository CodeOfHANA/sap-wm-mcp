import { s4hGet } from '../lib/s4hClient.js';

const BASE_WM = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMWarehouseStock`;
const BASE_IM = `/sap/opu/odata4/iwbep/all/srvd/sap/zsd_wmmcpservice/0001/WMIMStock`;

export async function getWMIMVariance({ warehouse, plant, storageLocation, material, threshold = 0 }) {
  // Step 1 — Fetch WM stock, aggregate by Material + Plant
  const wmFilters = [`WarehouseNumber eq '${warehouse}'`];
  if (material) wmFilters.push(`Material eq '${material}'`);

  const wmPath = `${BASE_WM}?$filter=${encodeURIComponent(wmFilters.join(' and '))}&$top=500`;
  const wmData = await s4hGet(wmPath);
  const wmRows = wmData.value ?? [];

  const derivedPlant = plant ?? wmRows[0]?.Plant ?? '';

  const wmByMat = {};
  for (const r of wmRows) {
    const mat = r.Material?.trimStart?.() ?? r.Material;
    const key = `${mat}__${r.Plant}`;
    if (!wmByMat[key]) wmByMat[key] = { material: mat, plant: r.Plant, uom: r.UnitOfMeasure, wmStock: 0 };
    wmByMat[key].wmStock += parseFloat(r.TotalStock ?? 0);
  }

  // Step 2 — Fetch IM stock filtered by plant + optionally storage location (LGORT)
  // storageLocation (LGORT) narrows MARD to the specific location linked to the warehouse
  // e.g. for warehouse 102 / plant 1010 this is typically LGORT '0002'
  const imFilters = [`Plant eq '${derivedPlant}'`];
  if (storageLocation) imFilters.push(`StorageLocation eq '${storageLocation}'`);
  if (material)        imFilters.push(`Material eq '${material}'`);

  const imPath = `${BASE_IM}?$filter=${encodeURIComponent(imFilters.join(' and '))}&$top=500`;
  const imData = await s4hGet(imPath);
  const imRows = imData.value ?? [];

  const imByMat = {};
  for (const r of imRows) {
    const mat = r.Material?.trimStart?.() ?? r.Material;
    const key = `${mat}__${r.Plant}`;
    if (!imByMat[key]) imByMat[key] = { imStock: 0, qiStock: 0, restrictedStock: 0, uom: r.UnitOfMeasure };
    imByMat[key].imStock         += parseFloat(r.UnrestrictedStock ?? 0);
    imByMat[key].qiStock         += parseFloat(r.QIStock           ?? 0);
    imByMat[key].restrictedStock += parseFloat(r.RestrictedStock   ?? 0);
  }

  // Step 3 — Join and compute variance
  const allKeys = new Set([...Object.keys(wmByMat), ...Object.keys(imByMat)]);
  const results = [];

  for (const key of allKeys) {
    const wm = wmByMat[key];
    const im = imByMat[key];
    const wmStock = wm?.wmStock ?? 0;
    const imStock = im?.imStock ?? 0;
    const variance = wmStock - imStock;

    if (Math.abs(variance) <= threshold) continue;

    const [mat, plt] = key.split('__');
    results.push({
      material:        mat,
      plant:           plt,
      uom:             wm?.uom ?? im?.uom,
      wmStock,
      imStock,
      qiStock:         im?.qiStock ?? 0,
      restrictedStock: im?.restrictedStock ?? 0,
      variance,
      status:          variance === 0 ? 'ok' : variance > 0 ? 'wm_exceeds_im' : 'im_exceeds_wm'
    });
  }

  results.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  return {
    count: results.length,
    warehouse,
    plant: derivedPlant,
    storageLocation: storageLocation ?? 'all',
    threshold,
    note: !storageLocation
      ? 'Tip: pass storageLocation (LGORT) linked to this warehouse for accurate results e.g. "0002"'
      : undefined,
    summary: {
      inSync:      results.filter(r => r.status === 'ok').length,
      wmExceedsIM: results.filter(r => r.status === 'wm_exceeds_im').length,
      imExceedsWM: results.filter(r => r.status === 'im_exceeds_wm').length
    },
    variances: results
  };
}
