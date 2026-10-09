import proj4 from "proj4";

import { mgrsToUtm } from "./geo";
import { utmDef } from "./overlay-bounds";

export type LngLat = [number, number];

export interface QuadCorners {
  tl: LngLat;
  tr: LngLat;
  br: LngLat;
  bl: LngLat;
}

/** Corners of the (optionally shifted) UTM rectangle, as WGS84 [lng, lat]. */
export function computeUtmCornersLngLat(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
): QuadCorners {
  const { easting, northing } = mgrsToUtm(topLeftMgrs);
  const def = utmDef(topLeftMgrs);

  const toLngLat = (e: number, n: number): LngLat =>
    proj4(def, "EPSG:4326", [e, n]) as LngLat;

  const west = easting + shiftX;
  const east = west + widthM;
  const north = northing + shiftY;
  const south = north - heightM;

  return {
    tl: toLngLat(west, north),
    tr: toLngLat(east, north),
    br: toLngLat(east, south),
    bl: toLngLat(west, south),
  };
}

const toMercator = ([lng, lat]: LngLat): [number, number] => [
  (lng * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

/** Geometry needed to orient and zoom the map so grid north is up. */
export function describeQuad(q: QuadCorners) {
  const [x0, y0] = toMercator(q.tl);
  const [x1, y1] = toMercator(q.tr);
  const dx = x1 - x0;
  const dy = y1 - y0;

  const center: LngLat = [
    (q.tl[0] + q.tr[0] + q.br[0] + q.bl[0]) / 4,
    (q.tl[1] + q.tr[1] + q.br[1] + q.bl[1]) / 4,
  ];

  return {
    center,
    /** Map bearing (deg) that makes the UTM grid axis-aligned on screen. */
    bearing: (-Math.atan2(dy, dx) * 180) / Math.PI,
    /** Overlay width in Mercator radians. */
    mercatorWidth: Math.hypot(dx, dy),
  };
}
