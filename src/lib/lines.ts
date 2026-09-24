import * as m from 'mgrs';
import { CsvRow } from './csv.js';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

interface Point {
  lon: number;
  lat: number;
}

export const typesOfLines = {
  'Горизонтальна (між підрозділами)': {
    color: '#171796',
    strokeWidth: 1.0583,
  },
  'Рубіж узгодженого вогню': {
    color: 'red',
    strokeWidth: 1.0583,
  },
} as const;

export type LineType = keyof typeof typesOfLines;

interface LineSegment {
  type: LineType;
  points: Point[];
}

export function buildLUnitsSpearationLinesSVGs(
  csvData: CsvRow[],
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
): string {
  const lineSegments: LineSegment[] = [];

  for (const row of csvData) {
    const app6dType = row['app6d type']?.trim() as LineType;
    if (!typesOfLines[app6dType]) continue;

    const mgrsParts =
      row['coordinates(mgrs)']
        ?.split(';')
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    let currentSegment: Point[] = [];

    for (const mgrsStr of mgrsParts) {
      try {
        const [lon, lat] = mgrs.toPoint(mgrsStr);
        if (Number.isNaN(lon) || Number.isNaN(lat)) continue;

        if (inWindow(lon, lat)) {
          currentSegment.push({ lon, lat });
        } else if (currentSegment.length > 0) {
          lineSegments.push({ type: app6dType, points: [...currentSegment] });
          currentSegment = [];
        }
      } catch {
        // Skip invalid MGRS strings
      }
    }

    if (currentSegment.length > 0) {
      lineSegments.push({ type: app6dType, points: currentSegment });
    }
  }

  return lineSegments
    .filter((seg) => seg.points.length >= 2)
    .map(({ type, points }) => {
      const { color, strokeWidth } = typesOfLines[type];
      const pathData = points
        .map((pt, idx) => {
          const { x, y } = geoToSvg(pt);
          return `${idx === 0 ? 'M' : 'L'} ${x},${y}`;
        })
        .join(' ');

      const opacityAttr = (opacity?: number) =>
        opacity !== undefined ? ` stroke-opacity="${opacity}"` : '';

      const createPath = (width: number, opacity?: number) =>
        `<path class="${type}" d="${pathData}" stroke="${color}" stroke-width="${width}" stroke-miterlimit="22.9256"${opacityAttr(opacity)} fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

      return `${createPath(strokeWidth * 4, 0.301961)}\n${createPath(strokeWidth)}`;
    })
    .join('\n');
}
