@EndUserText.label: 'WM Warehouse Stock'
@AccessControl.authorizationCheck: #NOT_REQUIRED
define view entity ZC_WMWarehouseStock
  as select from ZR_WMWarehouseStock
{
      @UI.lineItem: [{ position: 10, label: 'Warehouse' }]
  key WarehouseNumber,
      @UI.lineItem: [{ position: 20, label: 'Storage Type' }]
  key StorageType,
      @UI.lineItem: [{ position: 30, label: 'Bin' }]
  key StorageBin,
      @UI.lineItem: [{ position: 40, label: 'Quant' }]
  key QuantNumber,
      @UI.lineItem: [{ position: 50, label: 'Material' }]
      Material,
      Plant,
      Batch,
      @UI.lineItem: [{ position: 60, label: 'Total Stock' }]
      TotalStock,
      @UI.lineItem: [{ position: 70, label: 'Available' }]
      AvailableStock,
      StockForPutaway,
      PickQuantity,
      TransferQuantity,
      @UI.lineItem: [{ position: 80, label: 'UoM' }]
      UnitOfMeasure,
      StockCategory,
      PutawayBlock,
      RemovalBlock,
      LastMovementDate,
      StorageUnitType,
      StorageLocation
}
