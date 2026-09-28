import * as m from "mgrs";
import type { CsvRow } from "./csv";

const mgrs =
  "toPoint" in m ? m : (m as unknown as { default: typeof m }).default;

interface Point {
  lon: number;
  lat: number;
  mgrsStr?: string;
}

export const typesOfLines = {
  "Горизонтальна (між підрозділами)": {
    color: "#171796",
    strokeWidth: 1.0583,
  },
  "Рубіж узгодженого вогню": {
    color: "red",
    strokeWidth: 1.0583,
  },

  "Рубіж переходу в наступ": {
    color: "purple",
    strokeWidth: 1.0583,
  },
  "Вірогідний рубіж розгортання": {
    color: "#108b4b",
    strokeWidth: 1.0583,
  },
} as const;

export const typesOfAreas = {
  Район: {
    color: "#c58025",
    strokeWidth: 1.0583,
  },
  "Зайнятий район зосередження": {
    color: "#31bfea",
    strokeWidth: 1.0583,
  },
} as const;

export type LineType = keyof typeof typesOfLines;
export type AreaType = keyof typeof typesOfAreas;

interface LineSegment {
  type: LineType | AreaType;
  isArea: boolean;
  overlayName: string;
  name: string;
  points: Point[];
}

export function buildLUnitsSpearationLinesSVGs(
  csvData: CsvRow[],
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
): string[] {
  const lineSegments: LineSegment[] = [];

  for (const row of csvData) {
    const rawType = row["app6d type"]?.trim() as string;
    const isLine = rawType in typesOfLines;
    const isArea = rawType in typesOfAreas;
    if (!isLine && !isArea) continue;
    
    const app6dType = rawType as LineType | AreaType;
    const overlayName = row["overlay name"]?.trim() || "Default Overlay";

    const mgrsParts =
      row["coordinates(mgrs)"]
        ?.split(";")
        .map((s) => s.trim())
        .filter(Boolean) ?? [];
    let currentSegment: Point[] = [];

    for (const mgrsStr of mgrsParts) {
      try {
        const [lon, lat] = mgrs.toPoint(mgrsStr);
        if (Number.isNaN(lon) || Number.isNaN(lat)) continue;

        if (inWindow(lon, lat)) {
          currentSegment.push({ lon, lat, mgrsStr });
        } else if (currentSegment.length > 0) {
          lineSegments.push({
            type: app6dType,
            isArea,
            overlayName,
            name: row["name"]?.trim() || app6dType,
            points: [...currentSegment],
          });
          currentSegment = [];
        }
      } catch {
        // Skip invalid MGRS strings
      }
    }

    if (currentSegment.length > 0) {
      lineSegments.push({
        type: app6dType,
        isArea,
        overlayName,
        name: row["name"]?.trim() || app6dType,
        points: currentSegment,
      });
    }
  }

  const layerMap = new Map<string, string[]>();

  for (const seg of lineSegments) {
    if (seg.points.length < 2) continue;
    const { type, isArea, overlayName, points } = seg;
    const style = isArea
      ? typesOfAreas[type as AreaType]
      : typesOfLines[type as LineType];
    const { color, strokeWidth } = style;

    let pathData = points
      .map((pt, idx) => {
        const { x, y } = geoToSvg(pt);
        return `${idx === 0 ? "M" : "L"} ${x},${y}`;
      })
      .join(" ");

    if (isArea) {
      pathData += " Z";
    }

    const opacityAttr = (opacity?: number) =>
      opacity !== undefined ? ` stroke-opacity="${opacity}"` : "";

    const createPath = (width: number, opacity?: number) =>
      `<path class="${type}" d="${pathData}" stroke="${color}" stroke-width="${width}" stroke-miterlimit="22.9256"${opacityAttr(opacity)} fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

    const pathSvg = `<g id="${seg.name}">${createPath(strokeWidth * 4, 0.301961)}\n${createPath(strokeWidth)}</g>`;

    let bucket = layerMap.get(overlayName);
    if (!bucket) {
      bucket = [];
      layerMap.set(overlayName, bucket);
    }
    bucket.push(pathSvg);
  }

  // Wrap each layer's paths in a named <g> group
  const result: string[] = [];
  layerMap.forEach((paths, name) => {
    result.push(`  <g id="${name}">`);
    result.push(paths.join("\n"));
    result.push("  </g>");
  });
  return result;
}
