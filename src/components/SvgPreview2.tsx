import L, { type LatLngBounds, type LatLngBoundsExpression } from "leaflet";
import proj4 from "proj4";
import { useEffect, useMemo, useRef } from "react";
import {
  ImageOverlay,
  MapContainer,
  TileLayer,
  useMap,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { mgrsToUtm } from "../lib/geo";

interface SvgMapOverlayProps {
  svgContent: string;
  topLeftMgrs: string; // e.g. "36UXA1234567890"
  widthMm?: number; // SVG size on paper
  heightMm?: number;
  scaleDenominator: number; // e.g. 1000 for 1:1000 -> 1810 mm = 1810 m
  className?: string;
}

/** UTM proj definition derived from the MGRS string (zone + hemisphere). */
function utmDef(code: string): string {
  const m = code
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2})([C-X])/);
  if (!m) throw new Error(`Invalid MGRS: ${code}`);
  const zone = Number(m[1]);
  const south = m[2] < "N";
  return `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs`;
}

/** Compute Leaflet bounds [[south, west], [north, east]] for the SVG. */
function computeBounds(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
): LatLngBounds {
  const def = utmDef(topLeftMgrs);
  const { easting: e0, northing: n0 } = mgrsToUtm(topLeftMgrs);

  // Geographic center in UTM
  const eCenter = e0 + widthM / 2;
  const nCenter = n0 - heightM / 2;
  const [centerLon, centerLat] = proj4(def, "EPSG:4326", [eCenter, nCenter]);
  const [xCenter, yCenter] = proj4(
    "EPSG:4326",
    "EPSG:3857",
    [centerLon, centerLat],
  );

  // In Web Mercator (EPSG:3857), local scale factor k = 1 / cos(latitude)
  // Scaling both dimensions by k preserves conformal shape and exactly matches SVG aspect ratio (widthM / heightM)
  const k = 1 / Math.cos((centerLat * Math.PI) / 180);
  const wMerc = widthM * k;
  const hMerc = heightM * k;

  const xMin = xCenter - wMerc / 2;
  const xMax = xCenter + wMerc / 2;
  const yMin = yCenter - hMerc / 2;
  const yMax = yCenter + hMerc / 2;

  const [swLon, swLat] = proj4("EPSG:3857", "EPSG:4326", [xMin, yMin]);
  const [neLon, neLat] = proj4("EPSG:3857", "EPSG:4326", [xMax, yMax]);

  return L.latLngBounds([swLat, swLon], [neLat, neLon]); // SW, NE
}

/** Fit the map so the overlay fills the viewport width (no horizontal padding). */
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

    // Step 1: standard zoom that fits the entire overlay
    const fitZoom = map.getBoundsZoom(lb, false, L.point(0, 0));

    // Step 2: at that zoom, how wide is the overlay in pixels?
    const sw = map.project(lb.getSouthWest(), fitZoom);
    const ne = map.project(lb.getNorthEast(), fitZoom);
    const overlayPxW = Math.abs(ne.x - sw.x);
    const viewportW = map.getSize().x;

    // Step 3: if the overlay is narrower than the viewport, zoom in to fill width
    const zoom =
      overlayPxW < viewportW
        ? fitZoom + Math.log2(viewportW / overlayPxW)
        : fitZoom;

    map.setView(lb.getCenter(), zoom);
  }, [map, bounds, boundsKey]);

  return null;
}

export function SvgMapOverlay({
  svgContent,
  topLeftMgrs,
  widthMm = 1810,
  heightMm = 1810,
  scaleDenominator,
  className = "h-[100vh] z-0",
}: SvgMapOverlayProps) {
  const bounds = useMemo(
    () =>
      computeBounds(
        topLeftMgrs,
        (widthMm * scaleDenominator) / 1000,
        (heightMm * scaleDenominator) / 1000,
      ),
    [topLeftMgrs, widthMm, heightMm, scaleDenominator],
  );

  const boundsKey = `${topLeftMgrs}_${widthMm}_${heightMm}_${scaleDenominator}`;

  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  return (
    <MapContainer
      center={bounds.getCenter()}
      zoom={15}
      className={className}
      maxZoom={22}
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        attribution="&copy; OpenStreetMap contributors"
        maxNativeZoom={19}
        maxZoom={22}
      />
      <ImageOverlay
        url={url}
        bounds={bounds}
        opacity={0.8}
        className="shadow-[0_0_0_100000px_rgba(0,0,0,0.5)]"
      />
      <FitOnce bounds={bounds} boundsKey={boundsKey} />
    </MapContainer>
  );
}
