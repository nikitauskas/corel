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
export function buildLinePathElements(
  csvContent: string,
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
): string {
  const csvLineSegments: Point[][] = [];

  const csvRawLines = csvContent.split('\n');
  for (let i = 1; i < csvRawLines.length; i++) {
    const line = csvRawLines[i].trim();
    if (!line) continue;

    // Simple CSV parser (handles quoted fields)
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

    const app6dType = cols[0]?.trim() || '';
    if (app6dType !== 'Горизонтальна (між підрозділами)') continue;

    // col[7] — semicolon-separated MGRS coords for the line
    const mgrsRaw = cols[7]?.trim() || '';
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
      return `    <path id="Горизонтальна (між підрозділами)" d="${d}" stroke="#d32f2f" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join('\n');
}
