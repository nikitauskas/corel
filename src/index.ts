import * as fs from 'node:fs';
import * as path from 'node:path';
import * as m from 'mgrs';
import {
  computeLeftLabelLayout,
  computeRightLabelLayout,
  escapeXml,
} from './utils.js';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

// Layout & Canvas Parameters
// Physical map sheet: 1810 mm × 1810 mm at scale 1:25,000
// SVG canvas matches the physical map size exactly (no bleed/trim distinction here)
const MAP_SHEET_MM = 1810; // physical map dimension (square)
const MAP_SCALE = 25_000; // 1:25000
const BLEED_MM = 0.0; // no bleed for this format
const DPI = 300;

const TOTAL_WIDTH_MM = MAP_SHEET_MM;
const TOTAL_HEIGHT_MM = MAP_SHEET_MM;

const CENTER_X_MM = TOTAL_WIDTH_MM / 2; // 905 mm
const CENTER_Y_MM = TOTAL_HEIGHT_MM / 2; // 905 mm

// Pixels at 300 DPI (1 inch = 25.4 mm)
const MM_TO_PX_300 = DPI / 25.4;

// ----------------------------------------------------
// MGRS Window — derived from Top-Left corner + map size
//
// Top-Left MGRS: 37U BP 97080 43769
// Ground coverage = MAP_SHEET_MM * MAP_SCALE (mm → m)
//   = 1810 mm × 25 000 = 45 250 000 mm = 45 250 m = 45.25 km
// ----------------------------------------------------
export const MGRS_TL = '37UBP9708043769';

const [TL_LON, TL_LAT] = mgrs.toPoint(MGRS_TL);

// Ground size covered by the map sheet, in metres
const GROUND_SIZE_M = (MAP_SHEET_MM * MAP_SCALE) / 1000;

// Degree spans (using TL latitude for cos correction)
const TL_LAT_RAD = (TL_LAT * Math.PI) / 180;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos(TL_LAT_RAD);

const SPAN_DEG_LON = GROUND_SIZE_M / M_PER_DEG_LON; // ~0.610°
const SPAN_DEG_LAT = GROUND_SIZE_M / M_PER_DEG_LAT; // ~0.406°

// Derived bounding box (TL = top-left, BR = bottom-right)
const MIN_LON = TL_LON;
const MAX_LAT = TL_LAT;
const MAX_LON = TL_LON + SPAN_DEG_LON;
const MIN_LAT = TL_LAT - SPAN_DEG_LAT;

console.log(`Map window:  TL (${TL_LON.toFixed(6)}, ${TL_LAT.toFixed(6)})`);
console.log(`             BR (${MAX_LON.toFixed(6)}, ${MIN_LAT.toFixed(6)})`);
console.log(
  `Ground size: ${GROUND_SIZE_M / 1000} km × ${GROUND_SIZE_M / 1000} km`,
);

interface Point {
  lon: number;
  lat: number;
  name?: string;
  desc?: string;
  sidc?: string;
  count?: string;
}

const mappingSVGs: Record<string, [string, number]> = {
  'ЗПМ ': ['icons2/1.svg', 7.032],
  'РТР ': ['icons2/2.svg', 7.932],
};

// Padding (in SVG user units) added around each icon's content bounding box when icons were extracted.
// targetHeightMm in mappingSVGs refers to the VISIBLE content size, not the padded viewBox.
const ICON_VIEWBOX_PADDING = 50;

// Per-icon rendered size [width, height] in mm, populated during defs generation
const iconRenderedSizes: [number, number][] = [];

// Process mapped icons into SVG <defs> components
let iconsDefsContent = '';
let iconsSymbolsContent = '';

Object.entries(mappingSVGs).forEach(
  ([prefix, [iconPathRelative, targetHeightMm]], idx) => {
    const iconPath = path.resolve(process.cwd(), iconPathRelative);
    if (!fs.existsSync(iconPath)) {
      console.warn(
        `Warning: Icon not found for prefix '${prefix}': ${iconPathRelative}`,
      );
      iconRenderedSizes.push([targetHeightMm, targetHeightMm]); // fallback square
      return;
    }

    const iconContent = fs.readFileSync(iconPath, 'utf-8');

    const viewBoxMatch = iconContent.match(/viewBox="([^"]+)"/);
    const viewBoxStr = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
    const parts = viewBoxStr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const minX = parts[0] || 0;
    const minY = parts[1] || 0;
    const svgWidth = parts[2] || 100;
    const svgHeight = parts[3] || 100;

    const innerSvgMatch = iconContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const innerSvg = innerSvgMatch ? innerSvgMatch[1] : '';

    const defsMatch = innerSvg.match(/<defs>([\s\S]*?)<\/defs>/i);
    if (defsMatch) {
      iconsDefsContent += `\n    <!-- Hoisted defs for ${prefix} -->\n    ${defsMatch[1]}`;
    }
    const geometry = innerSvg.replace(/<defs>[\s\S]*?<\/defs>/i, '');

    // Scale so that the VISIBLE CONTENT height (viewBox minus padding on both sides)
    // matches targetHeightMm exactly, preserving aspect ratio.
    const contentH = svgHeight - 2 * ICON_VIEWBOX_PADDING;
    const contentW = svgWidth - 2 * ICON_VIEWBOX_PADDING;
    const scale = targetHeightMm / (contentH > 0 ? contentH : svgHeight);
    const scaledW = svgWidth * scale; // total rendered width including padding
    const scaledH = svgHeight * scale; // total rendered height including padding
    const scaledContentW = contentW * scale; // == targetHeightMm * (contentW / contentH)
    const scaledContentH = contentH * scale; // == targetHeightMm

    // Record actual CONTENT dimensions for centering during placement
    iconRenderedSizes.push([scaledContentW, scaledContentH]);

    const symbolId = `icon-mapping-${idx}`;

    iconsSymbolsContent += `
    <g id="${symbolId}">
      <!-- ${prefix}: content=${scaledContentW.toFixed(4)}x${scaledContentH.toFixed(4)}mm (target=${targetHeightMm}mm), total with padding=${scaledW.toFixed(4)}x${scaledH.toFixed(4)}mm -->
      <g transform="scale(${scale}) translate(${-minX}, ${-minY})">
        ${geometry}
      </g>
    </g>`;
  },
);

const generatedIconsDefs = `  <defs>
${iconsDefsContent}
${iconsSymbolsContent}
  </defs>`;

// Window Bounds Filter Function
function inWindow(lon: number, lat: number): boolean {
  return lon >= MIN_LON && lon <= MAX_LON && lat >= MIN_LAT && lat <= MAX_LAT;
}

// Center of the window
const centerLon = (MIN_LON + MAX_LON) / 2;
const centerLat = (MIN_LAT + MAX_LAT) / 2;

// Top-left corner as the SVG origin reference
const SHIFT_LON = MIN_LON; // TL longitude
const SHIFT_LAT = MAX_LAT; // TL latitude

// Aspect correction at center latitude
const LAT_RAD = (centerLat * Math.PI) / 180;
const COS_LAT = Math.cos(LAT_RAD);

// Scale: map the window exactly onto the physical sheet dimensions
// S is mm per degree such that SPAN_DEG_LON * COS_LAT * S == TOTAL_WIDTH_MM
// and SPAN_DEG_LAT * S == TOTAL_HEIGHT_MM  (both should be equal for a square map)
const S = TOTAL_WIDTH_MM / (SPAN_DEG_LON * COS_LAT); // mm / degree

// Offset so that TL maps to SVG (0, 0)
const OFFSET_X = 0; // TL is at x=0
const OFFSET_Y = 0; // TL is at y=0

// Transform (lon, lat) -> (svgX, svgY) in mm
function geoToSvg(pt: Point): { x: number; y: number } {
  const x = OFFSET_X + (pt.lon - SHIFT_LON) * COS_LAT * S;
  const y = OFFSET_Y + (SHIFT_LAT - pt.lat) * S;
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}

// ----------------------------------------------------
// 1. KML Lines Parsing (myrne/лбз/doc.kml) - Filtered to Window
//    Optional: skipped if file does not exist
// ----------------------------------------------------
const lbzKmlPath = path.resolve(process.cwd(), 'myrne/лбз/doc.kml');
const lbzKmlContent = fs.existsSync(lbzKmlPath)
  ? fs.readFileSync(lbzKmlPath, 'utf-8')
  : '';

const lbzCoordMatches =
  lbzKmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/gi) || [];

const kmlLines: Point[][] = [];

for (const match of lbzCoordMatches) {
  const rawCoords = match.replace(/<\/?coordinates>/gi, '').trim();
  const pointsStr = rawCoords.split(/\s+/);
  let currentSegment: Point[] = [];

  for (const pStr of pointsStr) {
    const parts = pStr.split(',');
    if (parts.length >= 2) {
      const lon = Number.parseFloat(parts[0]);
      const lat = Number.parseFloat(parts[1]);
      if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
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
// 2. Blue Force Points Parsing (data/full_data.csv)
// ----------------------------------------------------
const blueCsvPath = path.resolve(process.cwd(), 'data/full_data.csv');
const blueCsvContent = fs.existsSync(blueCsvPath)
  ? fs.readFileSync(blueCsvPath, 'utf-8')
  : '';

const bluePointMarkers: Point[] = [];

const csvLines = blueCsvContent.split('\n');
for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (!line) continue;

  const cols: string[] = [];
  let inQuotes = false;
  let currentWord = '';
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      if (inQuotes && line[j + 1] === '"') {
        currentWord += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cols.push(currentWord);
      currentWord = '';
    } else {
      currentWord += char;
    }
  }
  cols.push(currentWord);

  if (cols.length >= 8) {
    const sidc = cols[3]?.trim() || '';
    const count = cols[4]?.trim() || '';
    const name = cols[5]?.trim() || '';
    const mgrsStr = cols[7]?.trim() || '';
    const desc = cols[12]?.trim() || '';

    if (mgrsStr) {
      try {
        const [lon, lat] = mgrs.toPoint(mgrsStr);
        if (!Number.isNaN(lon) && !Number.isNaN(lat) && inWindow(lon, lat)) {
          bluePointMarkers.push({ lon, lat, name, desc, sidc, count });
        }
      } catch (e) {
        // Ignore invalid MGRS strings
      }
    }
  }
}

// Generate SVG elements for Blue Force points (Red Dots OR Drone Icons if SIDC matches)
const bluePointElements: string[] = [];
const blueTextElements: string[] = [];
let customIconCount = 0;

bluePointMarkers.forEach((pt, idx) => {
  const svgPt = geoToSvg(pt);

  const ptName = pt.name ?? '';
  const mappingIdx = Object.keys(mappingSVGs).findIndex((prefix) =>
    ptName.startsWith(prefix),
  );

  if (mappingIdx !== -1) {
    customIconCount++;
    // Use the actual rendered dimensions for this icon
    const [iconW, iconH] = iconRenderedSizes[mappingIdx] ?? [8.0, 8.0];
    const xPos = Number((svgPt.x - iconW / 2).toFixed(3));
    const yPos = Number((svgPt.y - iconH / 2).toFixed(3));

    bluePointElements.push(
      `    <g transform="translate(${xPos} ${yPos})">`,
      `      <use xlink:href="#icon-mapping-${mappingIdx}" />`,
      '    </g>',
    );
  } else {
    bluePointElements.push(
      `    <circle id="blue-point-${idx + 1}" cx="${svgPt.x}" cy="${svgPt.y}" r="2.0" fill="#ff0000" stroke="#000000" stroke-width="0.3" />`,
    );
  }

  // Text label logic
  if (mappingIdx !== -1) {
    // Custom icon: name label anchored at bottom-left of icon
    // text-anchor="end" → text grows LEFT from x (left edge of icon)
    // dominant-baseline / dy → text baseline sits at bottom of icon, grows UP

    const [iconW, iconH] = iconRenderedSizes[mappingIdx] ?? [8.0, 8.0];

    // Tweak these values to adjust the gap between the labels and the icon.
    // Positive values move the labels outwards (away from the icon).
    const leftLabelMargin = 0.0;
    const rightLabelMargin = 1.0;

    const { xPos, yPos, cleanText, rectX, rectY, rectW, rectH } =
      computeLeftLabelLayout(
        svgPt,
        iconW,
        iconH,
        pt.name || 'Test',
        3.526,
        0.9,
        0.05,
        2.917,
        leftLabelMargin,
      );

    const rightLabel = computeRightLabelLayout(
      svgPt,
      iconW,
      iconH,
      '9/3//78',
      3.526,
      0.9,
      0.05,
      2.917,
      rightLabelMargin,
    );

    const countNum = pt.count || 'X';
    const groupDesc = `AK74-${countNum}од`;
    const descX = Number(rectX) + Number(rectW) / 2;
    const descY = Number(rectY) + Number(rectH) + 2.6; // 3.0mm gives a little padding below the rect

    const textElements = [
      `<g id="blue-label-${idx + 1}-group">`,
      `    <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="#92B4EC" />`,
      `    <text id="blue-label-${idx + 1}" x="${xPos}" y="${yPos.toFixed(3)}" text-anchor="end" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${cleanText}</text>`,
      `    <rect x="${rightLabel.rectX}" y="${rightLabel.rectY}" width="${rightLabel.rectW}" height="${rightLabel.rectH}" fill="#92B4EC" />`,
      `    <text id="blue-label-right-${idx + 1}" x="${rightLabel.xPos}" y="${rightLabel.yPos.toFixed(3)}" text-anchor="start" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${rightLabel.cleanText}</text>`,
    ];

    if (groupDesc) {
      // 8pt ≈ 2.822mm
      textElements.push(
        `    <text id="blue-label-desc-${idx + 1}" x="${descX.toFixed(3)}" y="${descY.toFixed(3)}" text-anchor="middle" font-family="ArialBI, sans-serif" font-size="2.822" fill="#000000">${groupDesc}</text>`,
      );
    }

    textElements.push('</g>');
    blueTextElements.push(...textElements);
  } else {
    // Regular dot: name/desc label below the dot
    let labelText = pt.name && pt.name !== '●' ? pt.name : pt.desc || '';
    if (!labelText || labelText === '●') {
      labelText = `Blue #${idx + 1}`;
    }
    const cleanText = escapeXml(labelText);
    blueTextElements.push(
      `    <text id="blue-label-${idx + 1}" x="${svgPt.x}" y="${(svgPt.y + 4.2).toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.6" font-weight="bold" fill="#cc0000">${cleanText}</text>`,
    );
  }
});

// ----------------------------------------------------
// 3. Enemy Points Parsing (myrne/enemy/doc.kml)
//    Optional: skipped if file does not exist
// ----------------------------------------------------
const enemyKmlPath = path.resolve(process.cwd(), 'myrne/enemy/doc.kml');
const enemyKmlContent = fs.existsSync(enemyKmlPath)
  ? fs.readFileSync(enemyKmlPath, 'utf-8')
  : '';

const enemyPlacemarks =
  enemyKmlContent.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];
const enemyPointMarkers: Point[] = [];

for (const pm of enemyPlacemarks) {
  const nameMatch = pm.match(/<name>(.*?)<\/name>/i);
  const descMatch = pm.match(/<description>(.*?)<\/description>/i);
  const sidcMatch = pm.match(/<Data name="sidc">\s*<value>(.*?)<\/value>/i);

  const name = nameMatch ? nameMatch[1].trim() : '';
  const desc = descMatch ? descMatch[1].trim() : '';
  const sidc = sidcMatch ? sidcMatch[1].trim() : '';

  const coordMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (coordMatch) {
    const rawCoords = coordMatch[1].trim().split(/\s+/);
    for (const pStr of rawCoords) {
      const parts = pStr.split(',');
      if (parts.length >= 2) {
        const lon = Number.parseFloat(parts[0]);
        const lat = Number.parseFloat(parts[1]);
        if (!Number.isNaN(lon) && !Number.isNaN(lat) && inWindow(lon, lat)) {
          enemyPointMarkers.push({ lon, lat, name, desc, sidc });
        }
      }
    }
  }
}

// Generate SVG elements for Enemy points
const enemyCircleElements: string[] = [];
const enemyTextElements: string[] = [];

enemyPointMarkers.forEach((pt, idx) => {
  const svgPt = geoToSvg(pt);

  enemyCircleElements.push(
    `    <circle id="enemy-point-${idx + 1}" cx="${svgPt.x}" cy="${svgPt.y}" r="2.0" fill="#000000" stroke="#ffffff" stroke-width="0.3" />`,
  );

  let labelText =
    pt.name && pt.name !== '-'
      ? pt.name
      : pt.desc && pt.desc !== '-'
        ? pt.desc
        : '';
  if (!labelText || labelText === '-') {
    labelText = `E-${idx + 1}`;
  }
  if (labelText.startsWith('DTG Start')) {
    labelText = 'DTG';
  }
  const cleanText = escapeXml(labelText);

  enemyTextElements.push(
    `    <text id="enemy-label-${idx + 1}" x="${svgPt.x}" y="${(svgPt.y + 4.2).toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.5" font-weight="normal" fill="#000000">${cleanText}</text>`,
  );
});

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
        <dc:title>1:25000 Map 1810×1810mm — TL MGRS ${MGRS_TL} — SIDC UAV Drone Icons</dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>

${generatedIconsDefs}

  <!-- Background / Canvas -->
  <rect id="background" width="100%" height="100%" fill="#ffffff" />

  <!-- Center Crosshair Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line id="vertical-center-line" x1="${CENTER_X_MM}" y1="0" x2="${CENTER_X_MM}" y2="${TOTAL_HEIGHT_MM}" />
    <!-- Horizontal Center Line -->
    <line id="horizontal-center-line" x1="0" y1="${CENTER_Y_MM}" x2="${TOTAL_WIDTH_MM}" y2="${CENTER_Y_MM}" />
  </g>

  <!-- KML Frontlines Layer -->
  <g id="KMLLines">
${pathElements}
  </g>

  <!-- Blue Force Centered Labels -->
  <g id="BlueForceLabels">
${blueTextElements.join('\n')}
  </g>

  <!-- Blue Force Layer (Red Dots / Drone Icons) -->
  <g id="BlueForceDots">
${bluePointElements.join('\n')}
  </g>

  <!-- Enemy Black Dots Layer -->
  <g id="EnemyDots">
${enemyCircleElements.join('\n')}
  </g>

  <!-- Enemy Centered Labels -->
  <g id="EnemyLabels">
${enemyTextElements.join('\n')}
  </g>
</svg>
`;

const outputPath = path.resolve(process.cwd(), 'layout_1810x1810_25k.svg');
fs.writeFileSync(outputPath, svgContent, 'utf-8');

console.log(`SVG successfully generated: ${outputPath}`);
console.log(`- Blue Force points: ${bluePointMarkers.length}`);
console.log(`- Custom mapped icons rendered: ${customIconCount}`);
console.log(`- Enemy points & labels: ${enemyPointMarkers.length}`);
