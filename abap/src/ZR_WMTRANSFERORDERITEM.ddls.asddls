@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM Transfer Order Item'
define view entity ZR_WMTransferOrderItem
  as select from ltap
{
  key lgnum  as WarehouseNumber,
  key tanum  as TransferOrderNumber,
  key tapos  as TransferOrderItem,
      matnr  as Material,
      werks  as Plant,
      vltyp  as SourceStorageType,
      vlpla  as SourceBin,
      nltyp  as DestStorageType,
      nlpla  as DestBin,
      nsolm  as RequiredQuantity,
      nistm  as ConfirmedQuantity,
      meins  as UnitOfMeasure,
      altme  as AlternativeUOM
}
