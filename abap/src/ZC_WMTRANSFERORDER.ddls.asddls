@EndUserText.label: 'WM Transfer Order'
@AccessControl.authorizationCheck: #NOT_REQUIRED

define view entity ZC_WMTransferOrder
  as select from ZR_WMTransferOrder
{
      @UI.lineItem: [{ position: 10, label: 'Warehouse' }]
  key WarehouseNumber,
      @UI.lineItem: [{ position: 20, label: 'TO Number' }]
  key TransferOrderNumber,
      MovementType,
      IsConfirmed,
      CreatedDate,
      CreatedTime,
      CreatedBy,
      ShipmentType,
      TransferReqNumber,
      NumberOfItems
}
