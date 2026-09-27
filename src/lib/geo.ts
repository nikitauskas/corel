import * as m from "mgrs";

const mgrs =
  "toPoint" in m ? m : (m as unknown as { default: typeof m }).default;

export interface Point {
  lon: number;
  lat: number;
  name?: string;
  desc?: string;
  sidc?: string;
  count?: string;
  app6dType?: string;
  higherFrmation?: string;
  comments?: string;
  isHQ?: boolean;
  echelon?: string;
  objectId?: string;
  identificationStatus?: string;
  combatEffectiveness?: string;
  overlayName?: string;
}

export interface MapFormatConfig {
  name?: string;
  scale: number;
  widthMm: number;
  heightMm: number;
  mgrsTL?: string;
  outputFilename?: string;
}

export interface MapContext {
  config: MapFormatConfig;
  widthMm: number;
  heightMm: number;
  centerX: number;
  centerY: number;
  scale: number;
  mgrsTL: string;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  inWindow: (lon: number, lat: number) => boolean;
  geoToSvg: (pt: Point) => { x: number; y: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTM / Transverse-Mercator helpers (WGS-84)
//
// Using proper UTM math instead of equirectangular approximation ensures that
// the generated SVG coordinates align perfectly with MGRS/UTM-based maps
// (e.g. Corel Draw maps whose grid is UTM).
// ─────────────────────────────────────────────────────────────────────────────

const WGS84_A = 6_378_137.0; // semi-major axis (m)
const WGS84_E2 = 0.006_694_379_990_14; // eccentricity²
const UTM_K0 = 0.9996; // UTM central-meridian scale factor
const UTM_FALSE_EASTING = 500_000; // m

// MGRS column-letter sets (24 usable letters = A-Z minus I and O)
// The set used depends on (zone_number mod 3):
//   mod 1 → starts at A (zones 1, 4, 7, …, 37, …)
//   mod 2 → starts at J (zones 2, 5, 8, …, 38, …)
//   mod 0 → starts at S (zones 3, 6, 9, …, 36, …)
const COL_MOD1 = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const COL_MOD2 = "JKLMNPQRSTUVWXYZABCDEFGH";
const COL_MOD0 = "STUVWXYZABCDEFGHJKLMNPQR";

// MGRS row-letter sets (20 letters, 100 km each → 2 000 km cycle)
// Odd-numbered zones: A…V (skipping I and O)
// Even-numbered zones: F…V A…E (also skipping I and O, offset by 5)
const ROW_ODD = "ABCDEFGHJKLMNPQRSTUV";
const ROW_EVEN = "FGHJKLMNPQRSTUVABCDE";

// MGRS latitude-band letters (C = −80° … X = 84°, each 8°; skips I and O)
const BAND_LETTERS = "CDEFGHJKLMNPQRSTUVWX";

/** Meridional arc M(φ) in metres for WGS-84. */
function meridionalArc(latRad: number): number {
  const e2 = WGS84_E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    WGS84_A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latRad) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latRad) -
      ((35 * e6) / 3072) * Math.sin(6 * latRad))
  );
}

/**
 * Parse a compact MGRS string (spaces optional) into UTM easting / northing
 * without going through lat/lon.  This is the key to accurate projection.
 */
function mgrsToUtm(mgrsRaw: string): {
  easting: number;
  northing: number;
  zoneNumber: number;
} {
  const s = mgrsRaw.replace(/\s/g, "").toUpperCase();

  // Zone number (1–2 digits)
  let i = 0;
  while (i < s.length && /\d/.test(s[i])) i++;
  const zoneNumber = Number.parseInt(s.substring(0, i), 10);

  // Band letter
  const band = s[i++];

  // Grid-square letters: column then row
  const colLetter = s[i++];
  const rowLetter = s[i++];

  // Equal-split easting / northing digits
  const digits = s.substring(i);
  const half = digits.length / 2;
  const eInSquare = Number.parseInt(digits.substring(0, half), 10);
  const nInSquare = Number.parseInt(digits.substring(half), 10);

  // Column letter → UTM easting
  const mod = ((zoneNumber % 3) + 3) % 3; // 0, 1, or 2
  const colSet = mod === 1 ? COL_MOD1 : mod === 2 ? COL_MOD2 : COL_MOD0;
  const colIdx = colSet.indexOf(colLetter);
  if (colIdx < 0) throw new Error(`MGRS: unknown column letter "${colLetter}"`);
  const easting = (colIdx + 1) * 100_000 + eInSquare;

  // Row letter → northing offset within the 2 000 000 m cycle
  const rowSet = zoneNumber % 2 === 1 ? ROW_ODD : ROW_EVEN;
  const rowIdx = rowSet.indexOf(rowLetter);
  if (rowIdx < 0) throw new Error(`MGRS: unknown row letter "${rowLetter}"`);
  const nInCycle = rowIdx * 100_000 + nInSquare;

  // Determine which 2 M cycle this northing falls in, using the band letter.
  // We find the approximate meridional arc at the band midpoint and search
  // ±1 cycle around that estimate.
  const bandIdx = BAND_LETTERS.indexOf(band);
  if (bandIdx < 0) throw new Error(`MGRS: unknown band letter "${band}"`);
  const midLatDeg = -80 + bandIdx * 8 + 4; // mid-latitude of the band
  const approxNorthing = meridionalArc(
    Math.abs((midLatDeg * Math.PI) / 180),
  );

  const baseCycle = Math.max(0, Math.floor(approxNorthing / 2_000_000) - 1);
  let bestNorthing = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let c = baseCycle; c <= baseCycle + 2; c++) {
    const candidate = c * 2_000_000 + nInCycle;
    const diff = Math.abs(candidate - approxNorthing);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNorthing = candidate;
    }
  }

  return { easting, northing: bestNorthing, zoneNumber };
}

/**
 * Convert geographic lat/lon (WGS-84) → UTM easting/northing for a given zone.
 * Standard Transverse-Mercator formula (matches the MGRS library's internal math).
 */
function latLonToUtm(
  lat: number,
  lon: number,
  zoneNumber: number,
): { easting: number; northing: number } {
  const latRad = (lat * Math.PI) / 180;
  const centralMeridian = (zoneNumber - 1) * 6 - 180 + 3; // degrees
  const dLonRad = ((lon - centralMeridian) * Math.PI) / 180;

  const e2 = WGS84_E2;
  const ePrime2 = e2 / (1 - e2); // e′²
  const k0 = UTM_K0;
  const a = WGS84_A;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ePrime2 * cosLat * cosLat;
  const A = cosLat * dLonRad;
  const M = meridionalArc(latRad);

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ePrime2) * A * A * A * A * A) /
          120) +
    UTM_FALSE_EASTING;

  const northing =
    k0 *
    (M +
      N *
        tanLat *
        (A * A / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ePrime2) *
            A *
            A *
            A *
            A *
            A *
            A) /
            720));

  return { easting, northing };
}

// ─────────────────────────────────────────────────────────────────────────────

export function createMapContext(
  config: MapFormatConfig,
  fallbackMgrsTL: string,
): MapContext {
  const mgrsTL = config.mgrsTL || fallbackMgrsTL;

  // Lat/lon of TL (still needed for the informational minLon/maxLon bounds)
  const [TL_LON, TL_LAT] = mgrs.toPoint(mgrsTL);

  const { widthMm, heightMm, scale } = config;
  const centerX = widthMm / 2;
  const centerY = heightMm / 2;

  // ── UTM-based coordinate system ──────────────────────────────────────────
  // Parse TL MGRS directly to UTM — no equirectangular approximation.
  const { easting: TL_E, northing: TL_N, zoneNumber } = mgrsToUtm(mgrsTL);

  // Real-world extent in metres at the chosen scale
  //   1 mm on paper = scale mm in reality = scale/1000 m
  const widthM = (widthMm / 1000) * scale;
  const heightM = (heightMm / 1000) * scale;

  /** True only when the point falls inside (or right on) the map rectangle. */
  const inWindow = (lon: number, lat: number): boolean => {
    const { easting, northing } = latLonToUtm(lat, lon, zoneNumber);
    const xMm = ((easting - TL_E) / scale) * 1000;
    const yMm = ((TL_N - northing) / scale) * 1000;
    // tiny 0.5 mm tolerance to include boundary points
    return (
      xMm >= -0.5 &&
      xMm <= widthMm + 0.5 &&
      yMm >= -0.5 &&
      yMm <= heightMm + 0.5
    );
  };

  /** Convert a geographic point to SVG user-units (= mm in the viewBox). */
  const geoToSvg = (pt: Point): { x: number; y: number } => {
    const { easting, northing } = latLonToUtm(pt.lat, pt.lon, zoneNumber);
    const x = ((easting - TL_E) / scale) * 1000;
    const y = ((TL_N - northing) / scale) * 1000;
    return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
  };

  // Approximate lat/lon bounding box (kept for compatibility / display)
  const S = (111_320 * 1000) / scale; // mm per degree of latitude at this scale
  const centerLat = TL_LAT - heightMm / (2 * S);
  const COS_LAT = Math.cos((centerLat * Math.PI) / 180);
  const MIN_LAT = TL_LAT - heightM / 111_320;
  const MAX_LAT = TL_LAT;
  const MIN_LON = TL_LON;
  const MAX_LON = TL_LON + widthM / (111_320 * COS_LAT);

  return {
    config,
    widthMm,
    heightMm,
    centerX,
    centerY,
    scale,
    mgrsTL,
    minLon: MIN_LON,
    maxLon: MAX_LON,
    minLat: MIN_LAT,
    maxLat: MAX_LAT,
    inWindow,
    geoToSvg,
  };
}
