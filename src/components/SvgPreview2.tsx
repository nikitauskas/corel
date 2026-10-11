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

import { computeUtmBoundsLatLng } from "../lib/overlay-bounds";

const TILE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const STYLE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json";

// Optional. Leave empty if the service works without a token for you.
const ESRI_TOKEN: string | undefined = import.meta.env.VITE_ESRI_TOKEN;

const withToken = (url: string) =>
  ESRI_TOKEN && url.includes("arcgis.com") && !url.includes("token=")
    ? `${url}${url.includes("?") ? "&" : "?"}token=${ESRI_TOKEN}`
    : url;

async function loadStyle(signal?: AbortSignal) {
  const res = await fetch(withToken(STYLE_URL), { signal });
  if (!res.ok) throw new Error(`Style request failed: ${res.status}`);
  const style = await res.json();

  const abs = (u: string) =>
    new URL(u, STYLE_URL).href.replace(/%7B/gi, "{").replace(/%7D/gi, "}");

  if (style.sprite) style.sprite = abs(style.sprite);
  if (style.glyphs) style.glyphs = abs(style.glyphs);

  for (const src of Object.values<any>(style.sources ?? {})) {
    if (src.type === "vector") {
      delete src.url;
      src.tiles = [TILE_URL];
    }
  }
  return style;
}

/** Vector basemap: MapLibre GL renders Esri's .pbf style inside the Leaflet map. */
function VectorTiles() {
  const map = useMap();

  useEffect(() => {
    const ctrl = new AbortController();
    let layer: any;

    loadStyle(ctrl.signal)
      .then((style) => {
        if (ctrl.signal.aborted) return;
        layer = (L as any)
          .maplibreGL({
            style,
            transformRequest: (url: string) => ({ url: withToken(url) }),
          })
          .addTo(map);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") console.error(e);
      });

    return () => {
      ctrl.abort();
      if (layer) map.removeLayer(layer);
    };
  }, [map]);

  return null;
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

  const overlayBounds = useMemo(
    () => computeBounds(topLeftMgrs, widthM, heightM, shiftX, shiftY),
    [topLeftMgrs, widthM, heightM, shiftX, shiftY],
  );

  const boundsKey = `${topLeftMgrs}_${widthMm}_${heightMm}_${scaleDenominator}`;

  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  return (
    <MapContainer
      key={`map_${useRealMap ?? 0}`}
      center={baseBounds.getCenter()}
      zoom={tileMaxZoom}
      maxZoom={22}
      className={className}
      zoomControl={false}
    >
      <ZoomControl position="topright" />

      {useRealMap === 1 && <VectorTiles />}

      {useRealMap === 2 && (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={22}
        />
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
