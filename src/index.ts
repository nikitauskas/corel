import * as fs from 'node:fs';
import * as path from 'node:path';

// Parameters
const TRIM_WIDTH_MM = 1200;
const TRIM_HEIGHT_MM = 1460;
const BLEED_MM = 4.0;
const DPI = 300;

// Calculated dimensions including bleed (4mm on top, bottom, left, right)
const TOTAL_WIDTH_MM = TRIM_WIDTH_MM + 2 * BLEED_MM; // 1208 mm
const TOTAL_HEIGHT_MM = TRIM_HEIGHT_MM + 2 * BLEED_MM; // 1468 mm

// Pixels at 300 DPI (1 inch = 25.4 mm)
const MM_TO_PX = DPI / 25.4;
const TOTAL_WIDTH_PX = TOTAL_WIDTH_MM * MM_TO_PX;
const TOTAL_HEIGHT_PX = TOTAL_HEIGHT_MM * MM_TO_PX;

const CENTER_X_MM = TOTAL_WIDTH_MM / 2; // 604 mm
const CENTER_Y_MM = TOTAL_HEIGHT_MM / 2; // 734 mm

const CENTER_X_PX = TOTAL_WIDTH_PX / 2;
const CENTER_Y_PX = TOTAL_HEIGHT_PX / 2;

// SVG Content generation using mm units (native vector precision for CorelDraw import)
const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${TOTAL_WIDTH_MM}mm"
  height="${TOTAL_HEIGHT_MM}mm"
  viewBox="0 0 ${TOTAL_WIDTH_MM} ${TOTAL_HEIGHT_MM}"
  version="1.1">
  <desc>
    Layout Width: ${TRIM_WIDTH_MM}mm, Height: ${TRIM_HEIGHT_MM}mm
    Bleed: ${BLEED_MM}mm
    Total Size: ${TOTAL_WIDTH_MM}mm x ${TOTAL_HEIGHT_MM}mm
    Resolution: ${DPI} DPI (${TOTAL_WIDTH_PX.toFixed(2)}px x ${TOTAL_HEIGHT_PX.toFixed(2)}px)
  </desc>

  <!-- Background / Canvas -->
  <rect width="100%" height="100%" fill="#ffffff" />

  <!-- Trim area guide (1200x1460 mm inside 4mm bleed margin) -->
  <!--
  <rect
    x="${BLEED_MM}"
    y="${BLEED_MM}"
    width="${TRIM_WIDTH_MM}"
    height="${TRIM_HEIGHT_MM}"
    fill="none"
    stroke="#cccccc"
    stroke-width="0.2"
    stroke-dasharray="2,2" />
  -->

  <!-- Center Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line x1="${CENTER_X_MM}" y1="0" x2="${CENTER_X_MM}" y2="${TOTAL_HEIGHT_MM}" />
    
    <!-- Horizontal Center Line -->
    <line x1="0" y1="${CENTER_Y_MM}" x2="${TOTAL_WIDTH_MM}" y2="${CENTER_Y_MM}" />
  </g>
</svg>
`;

const outputPath = path.resolve(process.cwd(), 'layout_1200x1460_bleed4.svg');
fs.writeFileSync(outputPath, svgContent, 'utf-8');

console.log(`SVG file successfully generated: ${outputPath}`);
console.log(`- Trim Box: ${TRIM_WIDTH_MM} x ${TRIM_HEIGHT_MM} mm`);
console.log(`- Bleed: ${BLEED_MM} mm (Total Box: ${TOTAL_WIDTH_MM} x ${TOTAL_HEIGHT_MM} mm)`);
console.log(`- Resolution: ${DPI} DPI (${TOTAL_WIDTH_PX.toFixed(2)} x ${TOTAL_HEIGHT_PX.toFixed(2)} px)`);
console.log(`- Center X: ${CENTER_X_MM} mm`);
console.log(`- Center Y: ${CENTER_Y_MM} mm`);
