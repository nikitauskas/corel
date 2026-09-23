import * as m from 'mgrs';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

export const DEFAULT_MGRS_TL = '37UBP9708043769';

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

export function createMapContext(
  config: MapFormatConfig,
  fallbackMgrsTL: string = DEFAULT_MGRS_TL,
): MapContext {
  const mgrsTL = config.mgrsTL || fallbackMgrsTL;
  const [TL_LON, TL_LAT] = mgrs.toPoint(mgrsTL);

  const { widthMm, heightMm, scale } = config;
  const centerX = widthMm / 2;
  const centerY = heightMm / 2;

  // Scale: mm per degree of latitude at 1:scale
  // 1 degree latitude = 111,320 m = 111,320,000 mm.
  // At 1:scale, that is (111,320 * 1000) / scale mm on paper.
  const S = (111_320 * 1000) / scale;

  const SPAN_DEG_LAT = heightMm / S;
  const MIN_LAT = TL_LAT - SPAN_DEG_LAT;
  const MAX_LAT = TL_LAT;

  const centerLat = (MIN_LAT + MAX_LAT) / 2;
  const LAT_RAD = (centerLat * Math.PI) / 180;
  const COS_LAT = Math.cos(LAT_RAD);

  const SPAN_DEG_LON = widthMm / (S * COS_LAT);
  const MIN_LON = TL_LON;
  const MAX_LON = TL_LON + SPAN_DEG_LON;

  const inWindow = (lon: number, lat: number): boolean => {
    return lon >= MIN_LON && lon <= MAX_LON && lat >= MIN_LAT && lat <= MAX_LAT;
  };

  const geoToSvg = (pt: Point): { x: number; y: number } => {
    const x = (pt.lon - MIN_LON) * COS_LAT * S;
    const y = (MAX_LAT - pt.lat) * S;
    return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
  };

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
