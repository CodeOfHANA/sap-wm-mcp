@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Storage Bin'
define view entity ZR_WMStoragBin
  as select from lagp
{
  key lgnum         as WarehouseNumber,
  key lgtyp         as StorageType,
  key lgpla         as StorageBin,
      lgber         as StorageSection,
      lptyp         as StorageBinType,
      kzler         as IsEmpty,
      kzvol         as IsFull,
      skzue         as PutawayBlock,
      skzua         as RemovalBlock,
      anzqu         as NumberOfQuants,
      maxqu         as MaxQuants,
      lgewi         as MaximumWeight,
      gewei         as WeightUnit,
      mgewi         as OccupiedWeight,
      lkapv         as TotalCapacity,
      rkapv         as RemainingCapacity,
      bdatu         as LastMovementDate,
      kzdyn         as IsDynamicBin
}
