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
import { TransformedTileLayerComponent } from "./ShiftedTileLayerComponent";

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
  shiftX?: number;
  shiftY?: number;
  rotation?: number;
}

const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function computeBounds(
  topLeftMgrs: string,
  widthM: number,
  heightM: number,
  shiftX = 0,
  shiftY = 0,
) {
  const { south, west, north, east } = extentToLatLng(
    computeMercatorExtent(topLeftMgrs, widthM, heightM, shiftX, shiftY),
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
  shiftX = 0,
  shiftY = 0,
  rotation = 0,
}: SvgMapOverlayProps) {
  const baseBounds = useMemo(
    () =>
      computeBounds(
        topLeftMgrs,
        (widthMm * scaleDenominator) / 1000,
        (heightMm * scaleDenominator) / 1000,
      ),
    [topLeftMgrs, widthMm, heightMm, scaleDenominator],
  );

  const overlayBounds = useMemo(
    () =>
      computeBounds(
        topLeftMgrs,
        (widthMm * scaleDenominator) / 1000,
        (heightMm * scaleDenominator) / 1000,
        shiftX,
        shiftY,
      ),
    [topLeftMgrs, widthMm, heightMm, scaleDenominator, shiftX, shiftY],
  );

  const boundsKey = `${topLeftMgrs}_${widthMm}_${heightMm}_${scaleDenominator}`;
  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  return (
    <MapContainer
      center={baseBounds.getCenter()}
      zoom={tileMaxZoom}
      className={className}
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      {useRealMap === 2 && (
        // <TransformedTileLayerComponent
        //   url={tilesUrl}
        //   bounds={baseBounds} // see note below
        //   minNativeZoom={tileMinZoom}
        //   maxNativeZoom={tileMaxZoom}
        //   maxZoom={22}
        //   minZoom={tileMinZoom - 2}
        //   noWrap
        //   errorTileUrl={TRANSPARENT_PX}
        //   attribution="Local map"
        //   shiftX={shiftX}
        //   shiftY={shiftY}
        //   rotation={rotation}
        //   rotationOrigin={baseBounds.getCenter()} // or any [lat, lng]
        // />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      {useRealMap === 1 && (
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; OpenStreetMap contributors"
          maxNativeZoom={19}
          maxZoom={22}
          minZoom={2}
        />
        // <TileLayer
        //   attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        //   url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        // />
      )}

      <ImageOverlay
        url={url}
        bounds={overlayBounds}
        opacity={0.8}
        className="shadow-[0_0_0_100000px_rgba(0,0,0,0.5)]"
      />
      <FitOnce bounds={baseBounds} boundsKey={boundsKey} />
    </MapContainer>
  );
}
