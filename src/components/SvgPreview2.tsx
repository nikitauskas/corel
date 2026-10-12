import L, { type LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  ImageOverlay,
  MapContainer,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";

import {
  computeUtmBoundsLatLng,
  computeUtmCornersLatLng,
  utmDef,
} from "../lib/overlay-bounds";
import "proj4leaflet";
import { mgrsToUtm } from "../lib/geo";
import { createLocalTilesCrs, LayerLocalTile } from "./LayerLocalTile";
import { LayerOsmVector } from "./LayerOsmVector";
import { RotatedImageOverlay } from "./RotatedImageOverlay";
import { TransformedTileLayerComponent } from "./ShiftedTileLayerComponent";

const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// // Metres per pixel for zoom 0..23 (8192 m/px down to ~1 mm/px)
// const UTM_RESOLUTIONS = Array.from({ length: 24 }, (_, i) => 2 ** (13 - i));

/** "33UUP1234..." -> zone 33, north. Falls back to the bounds centre. */
function utmZone(mgrs: string, fallback: L.LatLng) {
  const m = /^\s*(\d{1,2})\s*([C-HJ-NP-X])/i.exec(mgrs);
  if (m) return { zone: Number(m[1]), south: m[2].toUpperCase() < "N" };
  return {
    zone: Math.floor((fallback.lng + 180) / 6) + 1,
    south: fallback.lat < 0,
  };
}

function makeUtmCrs(zone: number, south: boolean): L.CRS {
  const epsg = (south ? 32700 : 32600) + zone;
  const def = `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
  return new (L as any).Proj.CRS(`EPSG:${epsg}`, def, {
    resolutions: UTM_RESOLUTIONS,
    origin: [0, 10_000_000], // top-left of the projected "world"
  });
}

interface SvgMapOverlayProps {
  svgContent: string;
  topLeftMgrs: string;
  widthMm?: number;
  heightMm?: number;
  scaleDenominator: number;
  tileMaxZoom?: number;
  className?: string;
  /** 1 = Esri vector basemap (MapLibre), 2 = OSM raster, otherwise none */
  useRealMap?: number;
  shiftX?: number;
  shiftY?: number;
  tileMinZoom?: number;
}

function computeBounds(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
) {
  const { south, west, north, east } = computeUtmBoundsLatLng(
    topLeftMgrs,
    widthM,
    heightM,
    shiftX,
    shiftY,
  );
  return L.latLngBounds([south, west], [north, east]);
}

/** Fit the map so the overlay fills the viewport width. */
function FitOnce({
  bounds,
  boundsKey,
}: {
  bounds: LatLngBoundsExpression;
  boundsKey: string;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === boundsKey) return;
    lastKey.current = boundsKey;

    const lb = L.latLngBounds(bounds as L.LatLngBoundsLiteral);
    const fitZoom = map.getBoundsZoom(lb, false, L.point(0, 0));

    const sw = map.project(lb.getSouthWest(), fitZoom);
    const ne = map.project(lb.getNorthEast(), fitZoom);
    const overlayPxW = Math.abs(ne.x - sw.x);
    const viewportW = map.getSize().x;

    // const zoom =
    //   overlayPxW < viewportW
    //     ? fitZoom + Math.log2(viewportW / overlayPxW)
    //     : fitZoom;

    const zoom =
      overlayPxW < viewportW
        ? map.getScaleZoom(viewportW / overlayPxW, fitZoom)
        : fitZoom;

    map.setView(lb.getCenter(), zoom);
  }, [map, bounds, boundsKey]);

  return null;
}

const RES0 = 156543.03392804097;
const UTM_RESOLUTIONS = Array.from({ length: 23 }, (_, i) => RES0 / 2 ** i);

export function SvgMapOverlay({
  svgContent,
  topLeftMgrs,
  widthMm = 1810,
  heightMm = 1810,
  scaleDenominator,
  tileMinZoom = 12,
  tileMaxZoom = 15,
  className = "h-[100vh] z-0 bg-neutral-900",
  useRealMap,
  shiftX = 0,
  shiftY = 0,
}: SvgMapOverlayProps) {
  const widthM = (widthMm * scaleDenominator) / 1000;
  const heightM = (heightMm * scaleDenominator) / 1000;

  const baseBounds = useMemo(
    () => computeBounds(topLeftMgrs, widthM, heightM),
    [topLeftMgrs, widthM, heightM],
  );

  const baseBounds2 = useMemo(
    () =>
      computeBounds(
        topLeftMgrs,
        (widthMm * scaleDenominator) / 1000,
        (heightMm * scaleDenominator) / 1000,
      ),
    [topLeftMgrs, widthMm, heightMm, scaleDenominator],
  );

  const overlayBounds = useMemo(
    () => computeBounds(topLeftMgrs, widthM, heightM, shiftX, shiftY),
    [topLeftMgrs, widthM, heightM, shiftX, shiftY],
  );

  const boundsKey = `${topLeftMgrs}_${widthMm}_${heightMm}_${scaleDenominator}`;

  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  const corners = useMemo(
    () => computeUtmCornersLatLng(topLeftMgrs, widthM, heightM, shiftX, shiftY),
    [topLeftMgrs, widthM, heightM, shiftX, shiftY],
  );

  const utm = useMemo(() => {
    const { zone, south } = utmZone(topLeftMgrs, baseBounds.getCenter());
    return { zone, south };
  }, [topLeftMgrs, baseBounds]);

  // const crs = useMemo(
  //   () => (useRealMap === 1 ? makeUtmCrs(utm.zone, utm.south) : L.CRS.EPSG3857),
  //   [useRealMap, utm],
  // );

  // const crs = useMemo(() => getUtmCrs(topLeftMgrs), [topLeftMgrs]);

  const crs = useMemo(
    () =>
      useRealMap === 3
        ? createLocalTilesCrs(topLeftMgrs)
        : useRealMap === 1
          ? makeUtmCrs(utm.zone, utm.south)
          : L.CRS.EPSG3857,
    [useRealMap, utm, topLeftMgrs],
  );

  let tilesUrl = ``;
  if (topLeftMgrs === "37UBP9669644135") {
    tilesUrl = `./tiles1/{z}/{x}/{y}.png`;
  } else {
    tilesUrl = `./tiles2/{z}/{x}/{y}.png`;
  }

  return (
    <MapContainer
      key={`map_${useRealMap ?? 0}_${utm.zone}${utm.south ? "S" : "N"}`} // crs is only read at init
      crs={crs}
      center={baseBounds.getCenter()}
      zoom={useRealMap === 1 ? 8 : tileMaxZoom}
      maxZoom={22}
      className={className}
      zoomControl={false}
    >
      <ZoomControl position="topright" />

      {useRealMap === 1 && <LayerOsmVector />}

      {useRealMap === 2 && (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={22}
        />
      )}

      {useRealMap === 3 && (
        <LayerLocalTile
          url={tilesUrl}
          bounds={baseBounds}
          minZoom={tileMinZoom}
          maxZoom={tileMaxZoom}
        />
      )}

      <RotatedImageOverlay
        url={url}
        corners={corners}
        size={[widthMm, heightMm]}
        opacity={0.8}
        className="shadow-[0_0_0_100000px_rgba(0,0,0,0.5)]"
      />

      <FitOnce bounds={baseBounds} boundsKey={boundsKey} />
    </MapContainer>
  );
}
