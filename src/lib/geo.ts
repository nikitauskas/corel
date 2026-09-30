export interface XY {
  x: number;
  y: number;
}

export interface Point {
  mgrsStr: string;
  anchor: XY; // SVG mm, projected once when the row is filtered
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
  /** MGRS → SVG mm. Returns null for invalid MGRS or a different UTM zone. */
  project: (mgrs: string) => XY | null;
  /** True if an SVG-space point lies inside the map rectangle. */
  inWindow: (p: XY) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MGRS → UTM (WGS-84). No lat/lon involved.
// ─────────────────────────────────────────────────────────────────────────────

const WGS84_A = 6_378_137.0;
const WGS84_E2 = 0.006_694_379_990_14;

// Column letters by (zone % 3): 1 → A.., 2 → J.., 0 → S..
const COL_SETS = [
  "STUVWXYZABCDEFGHJKLMNPQR", // zone % 3 === 0
  "ABCDEFGHJKLMNPQRSTUVWXYZ", // zone % 3 === 1
  "JKLMNPQRSTUVWXYZABCDEFGH", // zone % 3 === 2
];
const ROW_ODD = "ABCDEFGHJKLMNPQRSTUV";
const ROW_EVEN = "FGHJKLMNPQRSTUVABCDE";
const BAND_LETTERS = "CDEFGHJKLMNPQRSTUVWX";

const MGRS_RE =
  /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])((?:\d{2}){0,5})$/;

/** Meridional arc M(φ) in metres. */
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

export function mgrsToUtm(raw: string): {
  easting: number;
  northing: number;
  zone: number;
} {
  const m = MGRS_RE.exec(raw.replace(/\s/g, "").toUpperCase());
  if (!m) throw new Error(`Invalid MGRS: "${raw}"`);
  const [, zoneStr, band, colLetter, rowLetter, digits] = m;

  const zone = Number.parseInt(zoneStr, 10);
  const half = digits.length / 2;
  const mult = 10 ** (5 - half);
  const eInSquare = half
    ? Number.parseInt(digits.slice(0, half), 10) * mult
    : 0;
  const nInSquare = half ? Number.parseInt(digits.slice(half), 10) * mult : 0;

  const colIdx = COL_SETS[zone % 3].indexOf(colLetter);
  const rowIdx = (zone % 2 ? ROW_ODD : ROW_EVEN).indexOf(rowLetter);
  if (colIdx < 0 || rowIdx < 0) throw new Error(`Invalid MGRS: "${raw}"`);

  const easting = (colIdx + 1) * 100_000 + eInSquare;
  const nInCycle = rowIdx * 100_000 + nInSquare;

  // The row letters repeat every 2 000 km. The latitude band (~890 km tall)
  // tells us which cycle we are in: pick the one closest to the band midpoint.
  const midLatRad =
    (Math.abs(-80 + BAND_LETTERS.indexOf(band) * 8 + 4) * Math.PI) / 180;
  const approxN = meridionalArc(midLatRad);
  const cycles = Math.max(0, Math.round((approxN - nInCycle) / 2_000_000));

  return { easting, northing: cycles * 2_000_000 + nInCycle, zone };
}

// ─────────────────────────────────────────────────────────────────────────────

export function createMapContext(
  config: MapFormatConfig,
  fallbackMgrsTL: string,
): MapContext {
  const mgrsTL = config.mgrsTL || fallbackMgrsTL;
  const { widthMm, heightMm, scale } = config;

  const tl = mgrsToUtm(mgrsTL);
  const mPerMm = scale / 1000;
  const round3 = (n: number) => Number(n.toFixed(3));

  const project = (mgrs: string): XY | null => {
    let utm: ReturnType<typeof mgrsToUtm>;
    try {
      utm = mgrsToUtm(mgrs);
    } catch {
      return null;
    }
    if (utm.zone !== tl.zone) return null;
    return {
      x: round3((utm.easting - tl.easting) / mPerMm),
      y: round3((tl.northing - utm.northing) / mPerMm),
    };
  };

  const TOL = 0.5; // mm, includes boundary points
  const inWindow = ({ x, y }: XY): boolean =>
    x >= -TOL && x <= widthMm + TOL && y >= -TOL && y <= heightMm + TOL;

  return {
    config,
    widthMm,
    heightMm,
    centerX: widthMm / 2,
    centerY: heightMm / 2,
    scale,
    mgrsTL,
    project,
    inWindow,
  };
}
