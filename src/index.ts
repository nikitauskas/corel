import * as fs from 'node:fs';
import * as path from 'node:path';

import { inWindow, geoToSvg } from './lib/geo.js';
import { buildIconsDefs } from './lib/icons.js';
import { parseBluePoints, buildBlueForceElements } from './lib/points.js';
import { buildLinePathElements } from './lib/lines.js';
import { buildFinalSvg } from './lib/svg.js';

// ----------------------------------------------------
// 1. Defs generation
// ----------------------------------------------------
const { generatedIconsDefs, iconRenderedSizes, customIconCount } = buildIconsDefs();

// ----------------------------------------------------
// 2. Data Parsing
// ----------------------------------------------------
const blueCsvPath = path.resolve(process.cwd(), 'data/full_data.csv');
const blueCsvContent = fs.existsSync(blueCsvPath)
  ? fs.readFileSync(blueCsvPath, 'utf-8')
  : '';

// Lines Parsing
const pathElements = buildLinePathElements(blueCsvContent, inWindow, geoToSvg);

// Blue Force Points Parsing
const bluePointMarkers = parseBluePoints(blueCsvContent, inWindow);

// Generate SVG elements for Blue Force points
const { bluePointElements, blueTextElements } = buildBlueForceElements(
  bluePointMarkers,
  iconRenderedSizes,
  geoToSvg,
);

// ----------------------------------------------------
// 3. Assemble and Output final SVG
// ----------------------------------------------------
const svgContent = buildFinalSvg(
  generatedIconsDefs,
  pathElements,
  bluePointElements,
  blueTextElements,
);

const outputPath = path.resolve(process.cwd(), 'layout_1810x1810_25k.svg');
fs.writeFileSync(outputPath, svgContent, 'utf-8');

console.log(`SVG successfully generated: ${outputPath}`);
console.log(`- Blue Force points: ${bluePointMarkers.length}`);
console.log(`- Custom mapped icons rendered: ${customIconCount}`);
console.log(
  `- CSV lines rendered: ${pathElements ? pathElements.split('<path').length - 1 : 0}`,
);
