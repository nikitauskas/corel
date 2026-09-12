import * as fs from 'node:fs';
import * as path from 'node:path';

import { MapFormatConfig, createMapContext } from './lib/geo.js';
import { buildIconsDefs } from './lib/icons.js';
import { buildLinePathElements } from './lib/lines.js';
import { buildBlueForceElements, parseBluePoints } from './lib/points.js';
import { buildFinalSvg } from './lib/svg.js';

// ====================================================
// Map Settings & Formats Configuration
// Starting top-left coordinate used for maps unless overridden
// ====================================================
export const STARTING_MGRS_TL = '37UBP9708043769';

export const MAP_FORMATS: MapFormatConfig[] = [
  {
    name: '1:25000',
    scale: 25_000,
    widthMm: 1810,
    heightMm: 1810,
    outputFilename: 'layout_1810x1810_25k.svg',
  },

  // {
  //   name: '1:10000',
  //   scale: 10_000,
  //   widthMm: 940,
  //   heightMm: 875,
  //   outputFilename: 'layout_940x875_10k.svg',
  // },
  // {
  //   name: '1:15000',
  //   scale: 15_000,
  //   widthMm: 2105,
  //   heightMm: 1205,
  //   outputFilename: 'layout_2105x1205_15k.svg',
  // },
];

// ----------------------------------------------------
// 1. Defs generation (shared across all maps)
// ----------------------------------------------------
const { generatedIconsDefs, iconRenderedSizes, customIconCount } =
  buildIconsDefs();

// ----------------------------------------------------
// 2. Data Loading (shared across all maps)
// ----------------------------------------------------
const blueCsvPath = path.resolve(process.cwd(), 'data/full_data.csv');
const blueCsvContent = fs.existsSync(blueCsvPath)
  ? fs.readFileSync(blueCsvPath, 'utf-8')
  : '';

// ----------------------------------------------------
// 3. Generate SVGs for each configured map format
// ----------------------------------------------------
for (const format of MAP_FORMATS) {
  const map = createMapContext(format, STARTING_MGRS_TL);

  // Parse lines matching map window and project to SVG coordinates
  const pathElements = buildLinePathElements(
    blueCsvContent,
    map.inWindow,
    map.geoToSvg,
  ); //

  // Parse points inside map window
  const bluePointMarkers = parseBluePoints(blueCsvContent, map.inWindow);

  // Generate SVG elements for Blue Force points (marker + labels grouped per element)
  const { blueForceElements, overlappingCount } = buildBlueForceElements(
    bluePointMarkers,
    iconRenderedSizes,
    map.geoToSvg,
  );

  // Assemble final SVG
  const svgContent = buildFinalSvg(
    map,
    generatedIconsDefs,
    pathElements,
    blueForceElements,
  );

  const filename =
    format.outputFilename ||
    `layout_${format.widthMm}x${format.heightMm}_${format.scale / 1000}k.svg`;
  const outputPath = path.resolve(process.cwd(), filename);
  fs.writeFileSync(outputPath, svgContent, 'utf-8');

  console.log('\n========================================');
  console.log(
    `Map: ${format.name ?? `1:${format.scale}`} (${format.widthMm}mm × ${format.heightMm}mm)`,
  );
  console.log(`Output: ${outputPath}`);
  console.log(`- Top-Left MGRS: ${map.mgrsTL}`);
  console.log(`- Blue Force points in window: ${bluePointMarkers.length}`);
  console.log(`- Overlapping elements marked red: ${overlappingCount}`);
  console.log(`- Custom mapped icons: ${customIconCount}`);
  console.log(
    `- CSV lines rendered: ${pathElements ? pathElements.split('<path').length - 1 : 0}`,
  );
}
