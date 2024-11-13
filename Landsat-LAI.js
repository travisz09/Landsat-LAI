// ATUR Landsat Leaf Area Index
// Travis Zalesky
// 11/13/24
// 
// Objective: Calculate Leaf Area Index (LAI) at 30m resolution, using Landsat data for the entire ATUR study area
// 
// Version History:
// 0.0.1 - Initial Draft (11/7/24)
// 0.1.0 - Public facing version (11/13/24)

// Imports
// Requires use of project studyArea shapefile
// My shapefile is not publicly accessible and will not run as written!
// For ATUR project collaborators, contact me for permissions!
var studyArea = ee.FeatureCollection("projects/ee-travisz09/assets/ATUR/WBDHU8_OuterBoundary_Project"),
    landsat9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_TOA");

// Map setup
Map.centerObject(studyArea, 6);
Map.addLayer(studyArea, {}, 'Study Area', false);

// Paint study area outline
var empty = ee.Image().byte();  // An empty layer to paint on
var studyAreaOutline = empty.paint(studyArea, 'black', 2);
Map.addLayer(studyAreaOutline, {}, 'Study Area (outline)');

// Study period
var startDate = ee.Date('2023-01-01');
var endDate = ee.Date('2024-01-01');  // Exclusive end date
var timeDif = endDate.difference(startDate, 'day');
// var interval = 8;  // days
// print(timeDif);

// Landsat 8/9
var cloudFilter = 10  // 10% max cloud cover
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))  // Combine Lst-9 and Lst-8
  .filterDate(startDate, endDate)
  .filterBounds(studyArea)
  .sort('system:time_start')  // Sort by date
  .filter(ee.Filter.lt('CLOUD_COVER', cloudFilter));
  
// Lst scaling factor function
var scaleLst = function(col) {
  // Map over images in collection
  var scaled = col.map(function(img) {
    var opticalBands = img.select('SR_B.').multiply(0.0000275).add(-0.2);
    var thermalBands = img.select('ST_B.*').multiply(0.00341802).add(149.0);
    
    return img.addBands(opticalBands, null, true)  // Overwrite unscaled bands
      .addBands(thermalBands, null, true);
  });
  
  return scaled;
};

// print(landsat.first());  // Check the Lst data before scaling
landsat = scaleLst(landsat);  // Apply scaling factor
// print(landsat.first());  // Check Lst data after scaling

// NDVI, EVI, LAI, index function
var calcIndices = function(col) {
  var indices = col.map(function(img) {
    var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4'])
      .rename('ndvi');
    var evi = img.expression(
      '2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1))',
      {
        'nir': img.select('SR_B5'),
        'red': img.select('SR_B4'),
        'blue': img.select('SR_B2')
      }).rename('evi');
    var lai = evi.expression(
      '3.618 * evi - 0.118', 
      {
        'evi': evi.select('evi')
      }).rename('lai');
      
    return img.addBands(ndvi)
      .addBands(evi)
      .addBands(lai);
  });
  
  return indices;
};

// Apply indices
landsat = calcIndices(landsat);
// print(landsat.first());  // sanity check

// Isolate lai bands
var lai = landsat.map(function(img) {
  return img.select('lai');
});

Map.addLayer(lai.limit(20), {
  min: 0,
  max: 3.5,
  palette: ['red', 'white', 'green']
}, 'LAI');
print(lai);
