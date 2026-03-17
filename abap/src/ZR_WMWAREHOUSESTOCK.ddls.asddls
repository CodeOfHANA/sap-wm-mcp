@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Warehouse Stock (Quants)'
define view entity ZR_WMWarehouseStock
  as select from lqua
{
  key lgnum         as WarehouseNumber,
  key lgtyp         as StorageType,
  key lgpla         as StorageBin,
  key lqnum         as QuantNumber,
      matnr         as Material,
      werks         as Plant,
      charg         as Batch,
      gesme         as TotalStock,
      verme         as AvailableStock,
      einme         as StockForPutaway,
      ausme         as PickQuantity,
      trame         as TransferQuantity,
      meins         as UnitOfMeasure,
      bestq         as StockCategory,
      skzue         as PutawayBlock,
      skzua         as RemovalBlock,
      bdatu         as LastMovementDate,
      letyp         as StorageUnitType,
      lgort         as StorageLocation
}
