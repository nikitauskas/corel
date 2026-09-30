import type { CsvRow } from "./csv";
import type { XY } from "./geo";
import { escapeXmlAttr } from "./utils";

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
  points: XY[]; // already projected to SVG mm
}

export function buildLUnitsSpearationLinesSVGs(
  csvData: CsvRow[],
  project: (mgrs: string) => XY | null,
  inWindow: (p: XY) => boolean,
): string[] {
  const segments: LineSegment[] = [];

  for (const row of csvData) {
    const rawType = row["app6d type"]?.trim() ?? "";
    const isLine = rawType in typesOfLines;
    const isArea = rawType in typesOfAreas;
    if (!isLine && !isArea) continue;

    const type = rawType as LineType | AreaType;
    const overlayName = row["overlay name"]?.trim() || "Default Overlay";
    const name = row.name?.trim() || type;

    const flush = (points: XY[]) => {
      // A single point cannot form a line, so drop it here instead of at render.
      if (points.length >= 2) {
        segments.push({ type, isArea, overlayName, name, points });
      }
    };

    let current: XY[] = [];
    const mgrsParts = row["coordinates(mgrs)"]?.split(";") ?? [];

    for (const part of mgrsParts) {
      const mgrsStr = part.trim();
      if (!mgrsStr) continue;

      const p = project(mgrsStr);
      if (p && inWindow(p)) {
        current.push(p);
      } else if (current.length > 0) {
        flush(current);
        current = [];
      }
    }
    flush(current);
  }

  const layers = new Map<string, string[]>();

  for (const [i, seg] of segments.entries()) {
    const { type, isArea, overlayName, name, points } = seg;
    const { color, strokeWidth } = isArea
      ? typesOfAreas[type as AreaType]
      : typesOfLines[type as LineType];

    const d =
      points.map((p, k) => `${k === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ") +
      (isArea ? " Z" : "");

    const createPath = (width: number, opacity?: number) =>
      `<path id="${escapeXmlAttr(type)}" d="${d}" stroke="${color}" stroke-width="${width}" stroke-miterlimit="22.9256"${
        opacity !== undefined ? ` stroke-opacity="${opacity}"` : ""
      } fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

    const svg = `<g id="[${i + 1}] ${escapeXmlAttr(name)}">${createPath(strokeWidth * 4, 0.301961)}\n${createPath(strokeWidth)}</g>`;

    const bucket = layers.get(overlayName);
    if (bucket) bucket.push(svg);
    else layers.set(overlayName, [svg]);
  }

  const result: string[] = [];
  for (const [layerName, paths] of layers) {
    result.push(
      `  <g id="${escapeXmlAttr(layerName)}">`,
      paths.join("\n"),
      "  </g>",
    );
  }
  return result;
}
