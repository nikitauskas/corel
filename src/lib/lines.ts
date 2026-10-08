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

/** Per-type override settings stored in App state / localStorage */
export interface LineTypeSettings {
  color?: string;
  /** Controls the semi-transparent wide outline stroke (strokeWidth * 4, opacity ~0.30) */
  showOutline?: boolean;
}

export interface LineOverrides {
  lines: Partial<Record<LineType, LineTypeSettings>>;
  areas: Partial<Record<AreaType, LineTypeSettings>>;
}

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
  overrides: LineOverrides = { lines: {}, areas: {} },
  projectWgs?: (lat: number, lng: number) => XY | null,
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
    const wgsParts = row["coordinates(wgs,yx)"]?.split(";") ?? [];
    // Use whichever coordinate column is populated
    const useWgs = mgrsParts.length === 0 && wgsParts.length > 0 && projectWgs;

    const coordParts = useWgs ? wgsParts : mgrsParts;

    for (let ci = 0; ci < coordParts.length; ci++) {
      const part = coordParts[ci].trim();
      if (!part) continue;

      let p: XY | null = null;
      if (useWgs && projectWgs) {
        // Format: "lat, lng"
        const [latStr, lngStr] = part.split(",");
        const lat = parseFloat(latStr ?? "");
        const lng = parseFloat(lngStr ?? "");
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          p = projectWgs(lat, lng);
        }
      } else {
        p = project(part);
        // Fallback to WGS84 if MGRS fails and wgs data is present
        if (!p && projectWgs && wgsParts[ci]) {
          const [latStr, lngStr] = wgsParts[ci].trim().split(",");
          const lat = parseFloat(latStr ?? "");
          const lng = parseFloat(lngStr ?? "");
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            p = projectWgs(lat, lng);
          }
        }
      }

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
    const defaults = isArea
      ? typesOfAreas[type as AreaType]
      : typesOfLines[type as LineType];

    const typeOverride: LineTypeSettings = isArea
      ? (overrides.areas[type as AreaType] ?? {})
      : (overrides.lines[type as LineType] ?? {});

    const color = typeOverride.color ?? defaults.color;
    const { strokeWidth } = defaults;
    // showOutline defaults to true to preserve original behaviour
    const showOutline = typeOverride.showOutline ?? true;

    const d =
      points.map((p, k) => `${k === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ") +
      (isArea ? " Z" : "");

    const createPath = (width: number, opacity?: number) =>
      `<path id="${escapeXmlAttr(type)}" d="${d}" stroke="${color}" stroke-width="${width}" stroke-miterlimit="22.9256"${
        opacity !== undefined ? ` stroke-opacity="${opacity}"` : ""
      } fill="none" stroke-linecap="round" stroke-linejoin="round" />`;

    const outlinePath = showOutline
      ? `${createPath(strokeWidth * 4, 0.301961)}\n`
      : "";

    const svg = `<g id="[${i + 1}] ${escapeXmlAttr(name)}">${outlinePath}${createPath(strokeWidth)}</g>`;

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
