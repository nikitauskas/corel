import L, { type LatLngBounds, type LatLngBoundsExpression } from "leaflet";
import * as mgrs from "mgrs";
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

interface SvgMapOverlayProps {
  svgContent: string;
  topLeftMgrs: string; // e.g. "36UXA1234567890"
  widthMm?: number; // SVG size on paper
  heightMm?: number;
  scaleDenominator: number; // e.g. 1000 for 1:1000 -> 1810 mm = 1810 m
  className?: string;
}

/** MGRS -> { lon, lat } of the referenced point (SW corner of the MGRS square). */
function mgrsToLonLat(code: string) {
  const [w, s] = mgrs.inverse(code); // [west, south, east, north]
  return { lon: w, lat: s };
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
  const { lon, lat } = mgrsToLonLat(topLeftMgrs);

  const [e0, n0] = proj4("EPSG:4326", def, [lon, lat]);
  const [lonBR, latBR] = proj4(def, "EPSG:4326", [e0 + widthM, n0 - heightM]);

  return L.latLngBounds([latBR, lon], [lat, lonBR]); // SW, NE
}

/** Fit the map to the overlay once (not on every svgContent change). */
function FitOnce({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    map.fitBounds(bounds, { padding: [10, 10] });
  }, [map, bounds]);
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
      <ImageOverlay url={url} bounds={bounds} opacity={0.8} />
      <FitOnce bounds={bounds} />
    </MapContainer>
  );
}
