@EndUserText.label: 'WM Storage Bin'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define view entity ZC_WMStoragBin
  as select from ZR_WMStoragBin
{
      @UI.lineItem: [{ position: 10, label: 'Warehouse' }]
  key WarehouseNumber,
      @UI.lineItem: [{ position: 20, label: 'Storage Type' }]
  key StorageType,
      @UI.lineItem: [{ position: 30, label: 'Bin' }]
  key StorageBin,
      @UI.lineItem: [{ position: 40, label: 'Section' }]
      StorageSection,
      StorageBinType,
      @UI.lineItem: [{ position: 50, label: 'Empty' }]
      IsEmpty,
      IsFull,
      PutawayBlock,
      RemovalBlock,
      NumberOfQuants,
      MaxQuants,
      MaximumWeight,
      WeightUnit,
      OccupiedWeight,
      TotalCapacity,
      RemainingCapacity,
      @UI.lineItem: [{ position: 60, label: 'Last Movement' }]
      LastMovementDate,
      IsDynamicBin
}
