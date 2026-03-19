@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Cycle Count Bin Status'
define view entity ZR_WMCycleCountBin
  as select from lagp
{
  key lgnum as WarehouseNumber,
  key lgtyp as StorageType,
  key lgpla as StorageBin,
      kzinv as IsInventoryActive,
      idatu as LastInventoryDate,
      ivnum as InventoryDocNumber,
      kzler as IsEmpty,
      anzqu as QuantCount,
      lkapv as UsedCapacity,
      rkapv as RemainingCapacity
}
