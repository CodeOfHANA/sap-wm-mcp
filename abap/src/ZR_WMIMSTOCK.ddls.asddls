@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'WM IM Stock for Variance'
define view entity ZR_WMIMStock
  as select from mard
    inner join mara on mard.matnr = mara.matnr
{
  key mard.matnr as Material,
  key mard.werks as Plant,
  key mard.lgort as StorageLocation,
      @Semantics.quantity.unitOfMeasure: 'UnitOfMeasure'
      mard.labst as UnrestrictedStock,
      @Semantics.quantity.unitOfMeasure: 'UnitOfMeasure'
      mard.insme as QIStock,
      @Semantics.quantity.unitOfMeasure: 'UnitOfMeasure'
      mard.einme as RestrictedStock,
      mara.meins as UnitOfMeasure
}
