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

  const [lonTL, latTL] = proj4(def, "EPSG:4326", [e0, n0]);
  const [lonTR, latTR] = proj4(def, "EPSG:4326", [e0 + widthM, n0]);
  const [lonBL, latBL] = proj4(def, "EPSG:4326", [e0, n0 - heightM]);
  const [lonBR, latBR] = proj4(def, "EPSG:4326", [e0 + widthM, n0 - heightM]);

  // Compute side midpoints to maintain exact aspect ratio and eliminate projection tilt padding
  const west = (lonTL + lonBL) / 2;
  const east = (lonTR + lonBR) / 2;
  const north = (latTL + latTR) / 2;
  const south = (latBL + latBR) / 2;

  return L.latLngBounds([south, west], [north, east]); // SW, NE
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

  const url = useMemo(() => {
    const withPreserve = svgContent.includes("preserveAspectRatio")
      ? svgContent.replace(
          /preserveAspectRatio="[^"]*"/,
          'preserveAspectRatio="none"',
        )
      : svgContent.replace("<svg ", '<svg preserveAspectRatio="none" ');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withPreserve)}`;
  }, [svgContent]);

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
