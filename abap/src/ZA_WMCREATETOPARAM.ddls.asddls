@EndUserText.label: 'WM Create Transfer Order Parameters'
define abstract entity ZA_WMCreateTOParam {
  WarehouseNumber   : abap.char(3);
  MovementType      : abap.char(3);
  Material          : abap.char(40);
  Plant             : abap.char(4);
  Quantity          : abap.dec(15,3);
  UnitOfMeasure     : abap.char(3);
  SourceStorageType : abap.char(3);
  SourceBin         : abap.char(10);
  SourceStorageUnit : abap.char(20);
  DestStorageType   : abap.char(3);
  DestBin           : abap.char(10);
  DestStorageUnit   : abap.char(20);
}
