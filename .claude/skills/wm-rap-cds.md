# Skill: /wm-rap-cds

Create or modify CDS view entities for the SAP Classic WM RAP service.

Adapted from weiserman/rap-skills `rap-cds` for on-premise S/4H with classic WM tables.

## When to use
- Add a new field to an existing WM CDS view
- Create a new association between WM entities
- Add or change UI annotations
- Create a value help view over WM master data

## Classic WM CDS architecture

```
LGPLA (SAP table)
    ↓
ZR_WMStorageBin          ← Interface view — clean projection of the SAP table
    ↓
ZC_WMStorageBin          ← Projection view — UI annotations, value helps, associations
    ↓
ZX_WMStorageBin          ← Metadata extension — Fiori layout (optional)
```

## Naming patterns

| Artifact | Pattern | Example |
|---|---|---|
| Interface view | `ZR_WM{Entity}` | `ZR_WMStorageBin` |
| Projection view | `ZC_WM{Entity}` | `ZC_WMStorageBin` |
| Metadata extension | `ZX_WM{Entity}` | `ZX_WMStorageBin` |
| Value help view | `ZVH_WM{Entity}` | `ZVH_WMMaterial` |

## WM-specific CDS patterns

### Pattern 1 — Read from classic WM table with key fields

```abap
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Storage Bin'
define view entity ZR_WMStorageBin
  as select from lgpla
{
  key lgnum    as WarehouseNumber,
  key lgtyp    as StorageType,
  key lgpla    as StorageBin,
      verme    as MaximumWeight,
      gesme    as TotalCapacity,
      meins    as UnitOfMeasure,
      -- Derived field: 'X' means empty (no quant in bin)
      case lgpla_ltr
        when 'X' then cast( 'true'  as abap.char(5) )
                 else cast( 'false' as abap.char(5) )
      end      as IsEmpty
}
```

### Pattern 2 — Join two WM tables (bins + quants)

```abap
@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Stock per Bin (enriched)'
define view entity ZR_WMStockPerBin
  as select from lqua as stock
    inner join lgpla  as bin
      on  bin.lgnum = stock.lgnum
      and bin.lgtyp = stock.lgtyp
      and bin.lgpla = stock.lgpla
{
  key stock.lgnum  as WarehouseNumber,
  key stock.lgtyp  as StorageType,
  key stock.lgpla  as StorageBin,
  key stock.lqnum  as QuantNumber,
      stock.matnr  as Material,
      stock.lgmng  as StockQuantity,
      stock.einme  as UnitOfMeasure,
      bin.verme    as BinMaxWeight,
      bin.gesme    as BinCapacity
}
```

### Pattern 3 — Association between entities

```abap
define view entity ZR_WMStorageBin
  as select from lgpla
  association [0..*] to ZR_WMWarehouseStock as _Stock
    on  _Stock.WarehouseNumber = $projection.WarehouseNumber
    and _Stock.StorageType     = $projection.StorageType
    and _Stock.StorageBin      = $projection.StorageBin
{
  key lgnum  as WarehouseNumber,
  key lgtyp  as StorageType,
  key lgpla  as StorageBin,
  -- ...other fields...
  _Stock     -- expose association
}
```

### Pattern 4 — Projection view with UI annotations

```abap
@EndUserText.label: 'WM Storage Bin'
@AccessControl.authorizationCheck: #NOT_REQUIRED

@UI: {
  headerInfo: {
    typeName: 'Storage Bin',
    typeNamePlural: 'Storage Bins',
    title: { type: #STANDARD, value: 'StorageBin' }
  }
}

define view entity ZC_WMStorageBin
  provider contract transactional_query
  as projection on ZR_WMStorageBin
{
      @UI.lineItem:  [{ position: 10 }]
      @UI.selectionField: [{ position: 10 }]
  key WarehouseNumber,

      @UI.lineItem:  [{ position: 20 }]
      @UI.selectionField: [{ position: 20 }]
  key StorageType,

      @UI.lineItem:  [{ position: 30 }]
      @UI.selectionField: [{ position: 30 }]
  key StorageBin,

      @UI.lineItem:  [{ position: 40, label: 'Max Weight' }]
      MaximumWeight,

      @UI.lineItem:  [{ position: 50 }]
      UnitOfMeasure,

      @UI.lineItem:  [{ position: 60, criticality: 'IsEmptyCriticality' }]
      IsEmpty,

      _Stock  -- pass-through association
}
```

## Workflow for editing an existing view

1. Use VSP `GetSource` to read the current source of the view
2. Make the change (add field, association, annotation)
3. Use VSP `WriteSource` or `EditSource` to save
4. Run VSP `SyntaxCheck` — fix any errors before proceeding
5. Run VSP `Activate` — activate the changed view first, then dependent objects

## Common WM CDS pitfalls

- `LGPLA` has field `MANDT` (client) — exclude it from the CDS select or include explicitly; do not expose as key
- Field `LGPLA_LTR` = 'X' means empty bin — but only if no LQUA records exist. For accuracy, do a count join on LQUA
- LQUA can have multiple quants per bin (different materials) — always include `LQNUM` as a key in stock views
- Material number `MATNR` in LQUA is 18 chars, left-padded with spaces in older systems — use `ALPHA` conversion exit where needed
