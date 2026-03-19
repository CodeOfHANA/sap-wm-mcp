@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Transfer Requirement'
define view entity ZR_WMTransferRequirement
  as select from ltbp as Item
    inner join ltbk as Header
      on  Header.lgnum = Item.lgnum
      and Header.tbnum = Item.tbnum
{
  key Item.lgnum   as WarehouseNumber,
  key Item.tbnum   as TransferReqNumber,
  key Item.tbpos   as TransferReqItem,
      Header.statu as Status,
      Header.bwlvs as MovementType,
      Header.bname as CreatedBy,
      Header.bdatu as CreatedDate,
      Header.bzeit as CreatedTime,
      Header.vltyp as SourceStorageType,
      Header.vlpla as SourceBin,
      Header.nltyp as DestStorageType,
      Header.nlpla as DestBin,
      Header.betyp as RefDocType,
      Header.benum as RefDocNumber,
      Header.anzps as NumberOfItems,
      Item.matnr   as Material,
      Item.werks   as Plant,
      Item.menge   as RequiredQuantity,
      Item.meins   as UnitOfMeasure,
      Item.tanum   as AssignedTO,
      Item.elikz   as IsDeliveryComplete
}
