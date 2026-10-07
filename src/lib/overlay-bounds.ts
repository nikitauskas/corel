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

  const [lon, lat] = proj4(def, "EPSG:4326", [
    e0 + shiftX + widthM / 2,
    n0 + shiftY - heightM / 2,
  ]);
  const [xC, yC] = proj4("EPSG:4326", "EPSG:3857", [lon, lat]);

  const k = 1 / Math.cos((lat * Math.PI) / 180);
  const w = widthM * k;
  const h = heightM * k;

  return {
    xMin: xC - w / 2,
    xMax: xC + w / 2,
    yMin: yC - h / 2,
    yMax: yC + h / 2,
  };
}

export function extentToLatLng(e: MercatorExtent) {
  const [west, south] = proj4("EPSG:3857", "EPSG:4326", [e.xMin, e.yMin]);
  const [east, north] = proj4("EPSG:3857", "EPSG:4326", [e.xMax, e.yMax]);
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
