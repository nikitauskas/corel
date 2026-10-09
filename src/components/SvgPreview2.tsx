import {
  type GeoJSONSource,
  type ImageSource,
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  computeUtmCornersLngLat,
  describeQuad,
  type QuadCorners,
} from "../lib/overlay-corners";

const TILE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const STYLE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json";

// Optional. Leave empty if the service works without a token for you.
const ESRI_TOKEN: string | undefined = import.meta.env.VITE_ESRI_TOKEN;

const OVERLAY_SOURCE = "svg-overlay";
const DIM_SOURCE = "overlay-dim";

const withToken = (url: string) =>
  ESRI_TOKEN && url.includes("arcgis.com") && !url.includes("token=")
    ? `${url}${url.includes("?") ? "&" : "?"}token=${ESRI_TOKEN}`
    : url;

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "bg",
      type: "background",
      paint: { "background-color": "#171717" },
    },
  ],
};

const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

async function loadEsriStyle(signal: AbortSignal): Promise<StyleSpecification> {
  const res = await fetch(withToken(STYLE_URL), { signal });
  if (!res.ok) throw new Error(`Style request failed: ${res.status}`);
  const style = (await res.json()) as StyleSpecification;

  const abs = (u: string) =>
    new URL(u, STYLE_URL).href.replace(/%7B/gi, "{").replace(/%7D/gi, "}");

  if (style.sprite && typeof style.sprite === "string") {
    style.sprite = abs(style.sprite);
  }
  if (style.glyphs) style.glyphs = abs(style.glyphs);

  for (const src of Object.values(style.sources ?? {})) {
    if (src.type === "vector") {
      const vector = src as { url?: string; tiles?: string[] };
      delete vector.url;
      vector.tiles = [TILE_URL];
    }
  }
  return style;
}

type Coords = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

const toCoords = (q: QuadCorners): Coords => [q.tl, q.tr, q.br, q.bl];

/** World polygon with a hole where the overlay is, to dim everything else. */
const dimGeoJson = (q: QuadCorners): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
      [q.tl, q.bl, q.br, q.tr, q.tl],
    ],
  },
});

interface SvgMapOverlayProps {
  svgContent: string;
  topLeftMgrs: string;
  widthMm?: number;
  heightMm?: number;
  scaleDenominator: number;
  className?: string;
  /** 1 = Esri vector basemap, 2 = OSM raster, otherwise none */
  useRealMap?: number;
  shiftX?: number;
  shiftY?: number;
}

export function SvgMapOverlay({
  svgContent,
  topLeftMgrs,
  widthMm = 1810,
  heightMm = 1810,
  scaleDenominator,
  className = "h-[100vh] z-0 bg-neutral-900",
  useRealMap = 0,
  shiftX = 0,
  shiftY = 0,
}: SvgMapOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const lastFitKey = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const widthM = (widthMm * scaleDenominator) / 1000;
  const heightM = (heightMm * scaleDenominator) / 1000;

  const baseCorners = useMemo(
    () => computeUtmCornersLngLat(topLeftMgrs, widthM, heightM),
    [topLeftMgrs, widthM, heightM],
  );

  const overlayCorners = useMemo(
    () => computeUtmCornersLngLat(topLeftMgrs, widthM, heightM, shiftX, shiftY),
    [topLeftMgrs, widthM, heightM, shiftX, shiftY],
  );

  const url = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  const boundsKey = `${topLeftMgrs}_${widthMm}_${heightMm}_${scaleDenominator}`;

  // Latest values for the (map-creating) effect without making it a dependency.
  const latest = useRef({ url, overlayCorners, baseCorners });
  useEffect(() => {
    latest.current = { url, overlayCorners, baseCorners };
  }, [url, overlayCorners, baseCorners]);

  // Create / recreate the map when the basemap type changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const abort = new AbortController();
    let map: MapLibreMap | null = null;
    let cancelled = false;

    const create = (style: StyleSpecification) => {
      if (cancelled) return;

      const { baseCorners: base } = latest.current;
      const info = describeQuad(base);

      map = new MapLibreMap({
        container,
        style,
        center: info.center,
        zoom: 12,
        bearing: info.bearing,
        maxZoom: 22,
        attributionControl: { compact: true },
        transformRequest: (u) => ({ url: withToken(u) }),
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: true }), "top-right");

      map.on("load", () => {
        if (!map) return;
        const { url: imgUrl, overlayCorners: oc } = latest.current;

        map.addSource(DIM_SOURCE, { type: "geojson", data: dimGeoJson(oc) });
        map.addLayer({
          id: "overlay-dim",
          type: "fill",
          source: DIM_SOURCE,
          paint: { "fill-color": "#000", "fill-opacity": 0.5 },
        });

        map.addSource(OVERLAY_SOURCE, {
          type: "image",
          url: imgUrl,
          coordinates: toCoords(oc),
        });
        map.addLayer({
          id: "svg-overlay",
          type: "raster",
          source: OVERLAY_SOURCE,
          paint: { "raster-opacity": 0.8, "raster-fade-duration": 0 },
        });

        lastFitKey.current = null; // force a fit for the new map
        setReady(true);
      });
    };

    setReady(false);

    if (useRealMap === 1) {
      loadEsriStyle(abort.signal)
        .then(create)
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          console.error(e);
          create(EMPTY_STYLE);
        });
    } else {
      create(useRealMap === 2 ? OSM_STYLE : EMPTY_STYLE);
    }

    return () => {
      cancelled = true;
      abort.abort();
      setReady(false);
      mapRef.current = null;
      map?.remove();
    };
  }, [useRealMap]);

  // Update overlay when svg / shift / scale changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const image = map.getSource(OVERLAY_SOURCE) as ImageSource | undefined;
    image?.updateImage({ url, coordinates: toCoords(overlayCorners) });

    const dim = map.getSource(DIM_SOURCE) as GeoJSONSource | undefined;
    dim?.setData(dimGeoJson(overlayCorners));
  }, [ready, url, overlayCorners]);

  // Fit once per bounds key: grid north up, overlay fills viewport width.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || lastFitKey.current === boundsKey) return;
    lastFitKey.current = boundsKey;

    map.resize();
    const info = describeQuad(baseCorners);
    const viewportW = map.getContainer().clientWidth;
    // MapLibre world size in px = 512 * 2^zoom; Mercator world = 2π radians.
    const zoom = Math.log2(
      (viewportW * 2 * Math.PI) / (512 * info.mercatorWidth),
    );

    map.jumpTo({ center: info.center, zoom, bearing: info.bearing });
  }, [ready, boundsKey, baseCorners]);

  return <div ref={containerRef} className={className} />;
}
