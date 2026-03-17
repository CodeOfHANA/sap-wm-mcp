@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Transfer Order'
define root view entity ZR_WMTransferOrder
  as select from ltak
{
  key lgnum     as WarehouseNumber,
  key tanum     as TransferOrderNumber,
      bwlvs     as MovementType,
      kquit     as IsConfirmed,
      bdatu     as CreatedDate,
      bzeit     as CreatedTime,
      bname     as CreatedBy,
      trart     as ShipmentType,
      tbnum     as TransferReqNumber,
      noitm     as NumberOfItems
}
