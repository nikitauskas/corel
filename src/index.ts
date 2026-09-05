import * as fs from 'node:fs';
import * as path from 'node:path';
import * as m from 'mgrs';

const mgrs = m.toPoint ? m : (m as any).default;

// Layout & Canvas Parameters
const TRIM_WIDTH_MM = 1200;
const TRIM_HEIGHT_MM = 1460;
const BLEED_MM = 4.0;
const DPI = 300;

const TOTAL_WIDTH_MM = TRIM_WIDTH_MM + 2 * BLEED_MM; // 1208 mm
const TOTAL_HEIGHT_MM = TRIM_HEIGHT_MM + 2 * BLEED_MM; // 1468 mm

const CENTER_X_MM = TOTAL_WIDTH_MM / 2; // 604 mm
const CENTER_Y_MM = TOTAL_HEIGHT_MM / 2; // 734 mm

// Pixels at 300 DPI (1 inch = 25.4 mm)
const MM_TO_PX_300 = DPI / 25.4;
const TOTAL_WIDTH_PX_300 = Number((TOTAL_WIDTH_MM * MM_TO_PX_300).toFixed(4));
const TOTAL_HEIGHT_PX_300 = Number((TOTAL_HEIGHT_MM * MM_TO_PX_300).toFixed(4));

// ----------------------------------------------------
// HARDCODED MGRS Window Bounding Box
// Bottom-Left: 37U DQ 00357 81654
// Top-Right:   37U DQ 09562 88842
// ----------------------------------------------------
export const MGRS_BL = '37UDQ0035781654';
export const MGRS_TR = '37UDQ0956288842';

const [MIN_LON, MIN_LAT] = mgrs.toPoint(MGRS_BL);
const [MAX_LON, MAX_LAT] = mgrs.toPoint(MGRS_TR);

interface Point {
  lon: number;
  lat: number;
  name?: string;
}

// Window Bounds Filter Function
function inWindow(lon: number, lat: number): boolean {
  return lon >= MIN_LON && lon <= MAX_LON && lat >= MIN_LAT && lat <= MAX_LAT;
}

// Center of the hardcoded window
const centerLon = (MIN_LON + MAX_LON) / 2;
const centerLat = (MIN_LAT + MAX_LAT) / 2;

// HARDCODED reference shift to top-left start position of the window
const SHIFT_LON = MIN_LON; // Bottom-Left longitude
const SHIFT_LAT = MAX_LAT; // Top-Right latitude

// Aspect correction factor for latitude (~49.51° N)
const LAT_RAD = (centerLat * Math.PI) / 180;
const COS_LAT = Math.cos(LAT_RAD);

// Determine scale factor S (mm per degree) to map the window onto the 1208x1468 layout
const DRAW_WIDTH_TARGET = 1050; // mm drawing area width
const DRAW_HEIGHT_TARGET = 1300; // mm drawing area height

const spanLonMm = (MAX_LON - MIN_LON) * COS_LAT;
const spanLatMm = MAX_LAT - MIN_LAT;

const scaleX = DRAW_WIDTH_TARGET / spanLonMm;
const scaleY = DRAW_HEIGHT_TARGET / spanLatMm;
const S = Math.min(scaleX, scaleY); // Uniform scale (~13,500 mm/degree)

// Compute common X/Y offsets from SHIFT_LON, SHIFT_LAT so center of window lands on (CENTER_X_MM, CENTER_Y_MM)
const centerRelativeX = (centerLon - SHIFT_LON) * COS_LAT * S;
const centerRelativeY = (SHIFT_LAT - centerLat) * S;

const OFFSET_X = CENTER_X_MM - centerRelativeX;
const OFFSET_Y = CENTER_Y_MM - centerRelativeY;

// Transform (lon, lat) -> (svgX, svgY) in mm
function geoToSvg(pt: Point): { x: number; y: number } {
  const x = OFFSET_X + (pt.lon - SHIFT_LON) * COS_LAT * S;
  const y = OFFSET_Y + (SHIFT_LAT - pt.lat) * S;
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}

// ----------------------------------------------------
// 1. KML Lines Parsing (data/nikitos_лбз/doc.kml) - Filtered to Window
// ----------------------------------------------------
const lbzKmlPath = path.resolve(process.cwd(), 'data/nikitos_лбз/doc.kml');
const lbzKmlContent = fs.readFileSync(lbzKmlPath, 'utf-8');

const lbzCoordMatches = lbzKmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/gi) || [];

const kmlLines: Point[][] = [];

for (const match of lbzCoordMatches) {
  const rawCoords = match.replace(/<\/?coordinates>/gi, '').trim();
  const pointsStr = rawCoords.split(/\s+/);
  let currentSegment: Point[] = [];

  for (const pStr of pointsStr) {
    const parts = pStr.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        const pt = { lon, lat };
        if (inWindow(lon, lat)) {
          currentSegment.push(pt);
        } else {
          if (currentSegment.length > 0) {
            kmlLines.push(currentSegment);
            currentSegment = [];
          }
        }
      }
    }
  }
  if (currentSegment.length > 0) {
    kmlLines.push(currentSegment);
  }
}

// Generate SVG <path> d attributes for filtered KML lines
const pathElements = kmlLines
  .map((line, idx) => {
    if (line.length < 2) return '';
    const start = geoToSvg(line[0]);
    let d = `M ${start.x},${start.y}`;
    for (let i = 1; i < line.length; i++) {
      const pt = geoToSvg(line[i]);
      d += ` L ${pt.x},${pt.y}`;
    }
    return `    <path id="kml-line-${idx + 1}" d="${d}" stroke="#d32f2f" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
  })
  .filter(Boolean)
  .join('\n');

// ----------------------------------------------------
// 2. Blue Force Points Parsing (data/nikitos_blue_force/doc.kml) - Filtered to Window
// ----------------------------------------------------
const blueKmlPath = path.resolve(process.cwd(), 'data/nikitos_blue_force/doc.kml');
const blueKmlContent = fs.readFileSync(blueKmlPath, 'utf-8');

const bluePlacemarks = blueKmlContent.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];
const bluePointMarkers: Point[] = [];

for (const pm of bluePlacemarks) {
  if (/<Point>/i.test(pm)) {
    const nameMatch = pm.match(/<name>(.*?)<\/name>/i);
    const name = nameMatch ? nameMatch[1] : 'Point';
    const coordMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (coordMatch) {
      const parts = coordMatch[1].trim().split(',');
      if (parts.length >= 2) {
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lon) && !isNaN(lat) && inWindow(lon, lat)) {
          bluePointMarkers.push({ lon, lat, name });
        }
      }
    }
  }
}

// Generate SVG <circle> elements for Blue Force <Point> placemarks (Red Dots)
const blueCircleElements = bluePointMarkers
  .map((pt, idx) => {
    const svgPt = geoToSvg(pt);
    const safeName = pt.name ? pt.name.replace(/["'<>]/g, '') : `Point ${idx + 1}`;
    return `    <circle id="blue-point-${idx + 1}" cx="${svgPt.x}" cy="${svgPt.y}" r="2.0" fill="#ff0000" stroke="#000000" stroke-width="0.3"><title>${safeName} (${pt.lon}, ${pt.lat})</title></circle>`;
  })
  .join('\n');

// ----------------------------------------------------
// 3. Enemy Points Parsing (data/nikitos_enemy/doc.kml) - Filtered to Window
// ----------------------------------------------------
const enemyKmlPath = path.resolve(process.cwd(), 'data/nikitos_enemy/doc.kml');
const enemyKmlContent = fs.readFileSync(enemyKmlPath, 'utf-8');

const enemyCoordMatches = enemyKmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/gi) || [];
const enemyPointsInWindow: Point[] = [];

for (const match of enemyCoordMatches) {
  const rawCoords = match.replace(/<\/?coordinates>/gi, '').trim();
  const pointsStr = rawCoords.split(/\s+/);
  for (const pStr of pointsStr) {
    const parts = pStr.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat) && inWindow(lon, lat)) {
        enemyPointsInWindow.push({ lon, lat, name: 'Enemy Point' });
      }
    }
  }
}

// Generate SVG <circle> elements for Enemy points inside window (Black Dots)
const enemyCircleElements = enemyPointsInWindow
  .map((pt, idx) => {
    const svgPt = geoToSvg(pt);
    return `    <circle id="enemy-point-${idx + 1}" cx="${svgPt.x}" cy="${svgPt.y}" r="2.0" fill="#000000" stroke="#ffffff" stroke-width="0.3"><title>Enemy Point ${idx + 1} (${pt.lon}, ${pt.lat})</title></circle>`;
  })
  .join('\n');

// ----------------------------------------------------
// 4. Generate Final CorelDRAW SVG Content
// ----------------------------------------------------
const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${TOTAL_WIDTH_MM}mm" height="${TOTAL_HEIGHT_MM}mm" viewBox="0 0 ${TOTAL_WIDTH_MM} ${TOTAL_HEIGHT_MM}" style="width: ${TOTAL_WIDTH_MM}mm; height: ${TOTAL_HEIGHT_MM}mm;" version="1.1">
  <sodipodi:namedview id="namedview1" pagecolor="#ffffff" bordercolor="#666666" borderopacity="1.0" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:document-units="mm" showgrid="false" units="mm" width="${TOTAL_WIDTH_MM}mm" height="${TOTAL_HEIGHT_MM}mm" inkscape:zoom="1" inkscape:cx="${CENTER_X_MM}" inkscape:cy="${CENTER_Y_MM}" />
  <metadata id="metadata1">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <cc:Work xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:format>image/svg+xml</dc:format>
        <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <dc:title>Layout ${TRIM_WIDTH_MM}x${TRIM_HEIGHT_MM}mm (MGRS Window ${MGRS_BL} to ${MGRS_TR})</dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>

  <!-- Background / Canvas -->
  <rect id="background" width="100%" height="100%" fill="#ffffff" />

  <!-- Center Crosshair Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line id="vertical-center-line" x1="${CENTER_X_MM}" y1="0" x2="${CENTER_X_MM}" y2="${TOTAL_HEIGHT_MM}" />
    <!-- Horizontal Center Line -->
    <line id="horizontal-center-line" x1="0" y1="${CENTER_Y_MM}" x2="${TOTAL_WIDTH_MM}" y2="${CENTER_Y_MM}" />
  </g>

  <!-- KML Frontlines Layer (Inside Window) -->
  <g id="KMLLines">
${pathElements}
  </g>

  <!-- Blue Force Red Dots Layer (Inside Window) -->
  <g id="BlueForceDots">
${blueCircleElements}
  </g>

  <!-- Enemy Black Dots Layer (Inside Window) -->
  <g id="EnemyDots">
${enemyCircleElements}
  </g>
</svg>
`;

const outputPath = path.resolve(process.cwd(), 'layout_1200x1460_bleed4.svg');
fs.writeFileSync(outputPath, svgContent, 'utf-8');

console.log(`SVG successfully generated for MGRS Window: ${outputPath}`);
console.log(`- MGRS Bottom-Left: ${MGRS_BL} (${MIN_LON.toFixed(6)}, ${MIN_LAT.toFixed(6)})`);
console.log(`- MGRS Top-Right: ${MGRS_TR} (${MAX_LON.toFixed(6)}, ${MAX_LAT.toFixed(6)})`);
console.log(`- Layout: ${TOTAL_WIDTH_MM} x ${TOTAL_HEIGHT_MM} mm`);
console.log(`- Frontline segments inside window: ${kmlLines.length}`);
console.log(`- Blue Force Red Dots inside window: ${bluePointMarkers.length}`);
console.log(`- Enemy Black Dots inside window: ${enemyPointsInWindow.length}`);
