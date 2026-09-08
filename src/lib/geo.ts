import * as m from 'mgrs';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

// Physical map sheet: 1810 mm × 1810 mm at scale 1:25,000
const MAP_SHEET_MM = 1810;
const MAP_SCALE = 25_000;

export const TOTAL_WIDTH_MM = MAP_SHEET_MM;
export const TOTAL_HEIGHT_MM = MAP_SHEET_MM;
export const CENTER_X_MM = TOTAL_WIDTH_MM / 2;
export const CENTER_Y_MM = TOTAL_HEIGHT_MM / 2;

// Top-Left MGRS corner of the map sheet
export const MGRS_TL = '37UBP9708043769';

const [TL_LON, TL_LAT] = mgrs.toPoint(MGRS_TL);

// Ground size covered by the map sheet, in metres
const GROUND_SIZE_M = (MAP_SHEET_MM * MAP_SCALE) / 1000;

// Degree spans
const TL_LAT_RAD = (TL_LAT * Math.PI) / 180;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos(TL_LAT_RAD);

const SPAN_DEG_LON = GROUND_SIZE_M / M_PER_DEG_LON;
const SPAN_DEG_LAT = GROUND_SIZE_M / M_PER_DEG_LAT;

// Bounding box
export const MIN_LON = TL_LON;
export const MAX_LAT = TL_LAT;
export const MAX_LON = TL_LON + SPAN_DEG_LON;
export const MIN_LAT = TL_LAT - SPAN_DEG_LAT;

// Aspect correction at center latitude
const centerLat = (MIN_LAT + MAX_LAT) / 2;
const LAT_RAD = (centerLat * Math.PI) / 180;
const COS_LAT = Math.cos(LAT_RAD);

// mm per degree — maps the window exactly onto the physical sheet
const S = TOTAL_WIDTH_MM / (SPAN_DEG_LON * COS_LAT);

export interface Point {
  lon: number;
  lat: number;
  name?: string;
  desc?: string;
  sidc?: string;
  count?: string;
  app6dType?: string;
}

export function inWindow(lon: number, lat: number): boolean {
  return lon >= MIN_LON && lon <= MAX_LON && lat >= MIN_LAT && lat <= MAX_LAT;
}

export function geoToSvg(pt: Point): { x: number; y: number } {
  const x = (pt.lon - MIN_LON) * COS_LAT * S;
  const y = (MAX_LAT - pt.lat) * S;
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}
