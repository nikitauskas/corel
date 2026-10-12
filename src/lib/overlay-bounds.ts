import * as mgrs from "mgrs";
import proj4 from "proj4";
import { mgrsToUtm } from "./geo";

export function utmDef(code: string): string {
  const m = code
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2})([C-X])/);
  if (!m) throw new Error(`Invalid MGRS: ${code}`);
  const zone = Number(m[1]);
  const south = m[2] < "N";
  return `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
}

export interface MercatorExtent {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Extent of the paper map in EPSG:3857 meters with optional shiftX and shiftY (in meters). */
export function computeMercatorExtent(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
): MercatorExtent {
  const def = utmDef(topLeftMgrs);
  const { easting: e0, northing: n0 } = mgrsToUtm(topLeftMgrs);

  // Top-Left corner (after shift)
  const eTL = e0 + shiftX;
  const nTL = n0 + shiftY;

  // Bottom-Right corner
  const eBR = eTL + widthM;
  const nBR = nTL - heightM;

  // Convert to Lat/Lng
  const tlLatLng = proj4(def, "EPSG:4326", [eTL, nTL]);
  const brLatLng = proj4(def, "EPSG:4326", [eBR, nBR]);

  // Convert to Web Mercator (EPSG:3857)
  const tl3857 = proj4("EPSG:4326", "EPSG:3857", tlLatLng);
  const br3857 = proj4("EPSG:4326", "EPSG:3857", brLatLng);

  return {
    xMin: tl3857[0],
    xMax: br3857[0],
    yMin: br3857[1], // Note: nBR is smaller, so yMin is br3857[1]
    yMax: tl3857[1],
  };
}

export function extentToLatLng(e: MercatorExtent) {
  const [west, south] = proj4("EPSG:3857", "EPSG:4326", [e.xMin, e.yMin]);
  const [east, north] = proj4("EPSG:3857", "EPSG:4326", [e.xMax, e.yMax]);
  return { south, west, north, east };
}

export interface LatLngBoundsResult {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function computeUtmBoundsLatLng(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
): LatLngBoundsResult {
  const def = utmDef(topLeftMgrs);
  const { easting: e0, northing: n0 } = mgrsToUtm(topLeftMgrs);

  const eTL = e0 + shiftX;
  const nTL = n0 + shiftY;

  const eBR = eTL + widthM;
  const nBR = nTL - heightM;

  const [west, north] = proj4(def, "EPSG:4326", [eTL, nTL]);
  const [east, south] = proj4(def, "EPSG:4326", [eBR, nBR]);

  return { south, west, north, east };
}

/**
 * Computes the new MGRS coordinate of the top-left corner shifted by shiftX (East) and shiftY (North) in meters.
 */
export function computeShiftedMgrs(
  baseMgrs: string,
  shiftX: number,
  shiftY: number,
): string {
  if (!baseMgrs) return "";
  if (shiftX === 0 && shiftY === 0) return baseMgrs.trim().toUpperCase();

  try {
    const def = utmDef(baseMgrs);
    const { easting: e0, northing: n0 } = mgrsToUtm(baseMgrs);
    const shiftedE = e0 + shiftX;
    const shiftedN = n0 + shiftY;
    const [lon, lat] = proj4(def, "EPSG:4326", [shiftedE, shiftedN]);
    return mgrs.forward([lon, lat] as [number, number], 5);
  } catch (e) {
    console.error("Failed to compute shifted MGRS", e);
    return baseMgrs;
  }
}

export function computeUtmCornersLatLng(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
  rotation = 0,
) {
  const def = utmDef(topLeftMgrs);
  const { easting: e0, northing: n0 } = mgrsToUtm(topLeftMgrs);

  let eW = e0 + shiftX;
  let eE = eW + widthM;
  let nN = n0 + shiftY;
  let nS = nN - heightM;

  if (rotation !== 0) {
    const cE = (eW + eE) / 2;
    const cN = (nN + nS) / 2;
    const rad = (-rotation * Math.PI) / 180; // Clockwise in screen/map
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rot = (e: number, n: number) => {
      const de = e - cE;
      const dn = n - cN;
      return [cE + de * cos - dn * sin, cN + de * sin + dn * cos] as const;
    };

    const [tlE, tlN] = rot(eW, nN);
    const [trE, trN] = rot(eE, nN);
    const [blE, blN] = rot(eW, nS);

    const ll = (e: number, n: number): [number, number] => {
      const [lng, lat] = proj4(def, "EPSG:4326", [e, n]);
      return [lat, lng];
    };

    return { tl: ll(tlE, tlN), tr: ll(trE, trN), bl: ll(blE, blN) };
  }

  const ll = (e: number, n: number): [number, number] => {
    const [lng, lat] = proj4(def, "EPSG:4326", [e, n]);
    return [lat, lng];
  };

  return { tl: ll(eW, nN), tr: ll(eE, nN), bl: ll(eW, nS) };
}
