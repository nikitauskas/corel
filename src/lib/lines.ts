import * as m from 'mgrs';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

interface Point {
  lon: number;
  lat: number;
}

// ----------------------------------------------------
// Lines Parsing - "Горизонтальна (між підрозділами)" rows
//     col[7] contains semicolon-separated MGRS coordinates
// ----------------------------------------------------

/**
 * Parses line segments from a CSV string and generates SVG <path> elements.
 *
 * @param csvContent - Raw CSV file content (full_data.csv)
 * @param inWindow   - Predicate that returns true when (lon, lat) is inside the map window
 * @param geoToSvg   - Converts a {lon, lat} point to SVG {x, y} coordinates (in mm)
 * @returns           A string of SVG <path> elements joined by newlines
 */

export const typesOfLines = ['Горизонтальна (між підрозділами)'];
import { CsvRow } from './csv.js';

export function buildLUnitsSpearationLinesSVGs(
  csvData: CsvRow[],
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
): string {
  const csvLineSegments: Point[][] = [];

  for (const row of csvData) {
    const app6dType = row['app6d type']?.trim() || '';
    if (!typesOfLines.includes(app6dType)) continue;

    // col[7] — semicolon-separated MGRS coords for the line
    const mgrsRaw = row['coordinates(mgrs)']?.trim() || '';
    if (!mgrsRaw) continue;

    const mgrsParts = mgrsRaw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    const segment: Point[] = [];

    for (const mgrsStr of mgrsParts) {
      try {
        const [lon, lat] = mgrs.toPoint(mgrsStr);
        if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
          // Include point even if outside window so lines clip naturally;
          // split segment at window boundary as before.
          if (inWindow(lon, lat)) {
            segment.push({ lon, lat });
          } else {
            if (segment.length > 0) {
              csvLineSegments.push([...segment]);
              segment.length = 0;
            }
          }
        }
      } catch (_) {
        // Ignore invalid MGRS strings
      }
    }
    if (segment.length > 0) {
      csvLineSegments.push(segment);
    }
  }

  // Generate SVG <path> elements for the lines layer
  return csvLineSegments
    .map((seg, idx) => {
      if (seg.length < 2) return '';
      const start = geoToSvg(seg[0]);
      let d = `M ${start.x},${start.y}`;
      for (let i = 1; i < seg.length; i++) {
        const pt = geoToSvg(seg[i]);
        d += ` L ${pt.x},${pt.y}`;
      }
      return `    <path id="Горизонтальна (між підрозділами)" d="${d}" stroke="#171796" stroke-width="4.2333" stroke-miterlimit="22.9256" stroke-opacity="0.301961" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    <path id="Горизонтальна (між підрозділами)" d="${d}" stroke="#171796" stroke-width="1.0583" stroke-miterlimit="22.9256" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join('\n');
}
