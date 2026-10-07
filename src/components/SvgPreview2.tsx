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

import { computeMercatorExtent, extentToLatLng } from "../lib/overlay-bounds";

interface SvgMapOverlayProps {
  svgContent: string;
  topLeftMgrs: string;
  widthMm?: number;
  heightMm?: number;
  scaleDenominator: number;
  /** Tile URL template, relative so it works on file:// and localhost */
  tilesUrl?: string;
  tileMinZoom?: number;
  tileMaxZoom?: number;
  className?: string;
  useRealMap?: number;
}

const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function computeBounds(topLeftMgrs: string, widthM: number, heightM: number) {
  const { south, west, north, east } = extentToLatLng(
    computeMercatorExtent(topLeftMgrs, widthM, heightM),
  );
  return L.latLngBounds([south, west], [north, east]);
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
  tilesUrl = `./tiles/{z}/{x}/{y}.png`,
  tileMinZoom = 12,
  tileMaxZoom = 15,
  className = "h-[100vh] z-0 bg-neutral-900",
  useRealMap,
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
  if (useRealMap === 2) {
    tilesUrl = `./tiles/{z}/{x}/{y}.png`;
  } else {
    tilesUrl =
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
  }

  return (
    <MapContainer
      center={bounds.getCenter()}
      zoom={tileMaxZoom}
      className={className}
      minZoom={tileMinZoom - 2}
      maxZoom={22}
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      <TileLayer
        url={tilesUrl}
        bounds={bounds} // never request tiles outside the map
        minNativeZoom={tileMinZoom}
        maxNativeZoom={tileMaxZoom}
        maxZoom={22}
        noWrap
        errorTileUrl={TRANSPARENT_PX}
        attribution="Local map"
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
