import { VectorTile } from "@mapbox/vector-tile";
import L from "leaflet";
import * as Protobuf from "pbf";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface OsmWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

type Props = Record<string, any>;
type TagFn = (p: Props) => Record<string, string>;

interface TileSource {
  name: string;
  template: () => Promise<string>;
  layers: Array<{ layer: string; tags: TagFn }>;
}

/** Set to false to silence diagnostics. */
const DEBUG = true;

const MAX_Z = 14; // max zoom of both tilesets
const MIN_Z = 8; // never go coarser than this
const MAX_TILES = 60; // lower the tile zoom until the viewport needs <= this many tiles

let openFreeMapTemplate: string | undefined;

const SOURCES: TileSource[] = [
  {
    // Shortbread schema
    name: "VersaTiles",
    template: async () =>
      "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{x}/{y}.pbf",
    layers: [
      { layer: "buildings", tags: () => ({ building: "yes" }) },
      { layer: "water_polygons", tags: () => ({ natural: "water" }) },
      {
        layer: "water_lines",
        tags: (p) => ({ waterway: String(p.kind ?? "stream") }),
      },
      {
        layer: "streets",
        tags: (p) => ({ highway: String(p.kind ?? "residential") }),
      },
    ],
  },
  {
    // OpenMapTiles schema
    name: "OpenFreeMap",
    template: async () => {
      if (!openFreeMapTemplate) {
        const res = await fetch("https://tiles.openfreemap.org/planet");
        if (!res.ok) throw new Error(`TileJSON HTTP ${res.status}`);
        const tj = await res.json();
        openFreeMapTemplate = tj.tiles[0] as string;
      }
      return openFreeMapTemplate;
    },
    layers: [
      { layer: "building", tags: () => ({ building: "yes" }) },
      { layer: "water", tags: () => ({ natural: "water" }) },
      {
        layer: "waterway",
        tags: (p) => ({ waterway: String(p.class ?? "stream") }),
      },
      {
        layer: "transportation",
        tags: (p) => ({ highway: String(p.class ?? "residential") }),
      },
    ],
  },
];

let preferredSource = 0;
const rawTileCache = new Map<string, OsmWay[]>(); // lat/lon, CRS independent
const inFlight = new Map<string, Promise<OsmWay[]>>();

const lon2x = (lon: number, z: number) =>
  Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
};

async function fetchTileFromSource(
  source: TileSource,
  z: number,
  x: number,
  y: number,
): Promise<OsmWay[]> {
  const template = await source.template();
  const url = template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  const res = await fetch(url);
  if (res.status === 404 || res.status === 204) return [];
  if (!res.ok) throw new Error(`${source.name} tile HTTP ${res.status}`);

  const tile = new VectorTile(new Protobuf(await res.arrayBuffer()));
  const out: OsmWay[] = [];
  const counts: Record<string, number> = {};

  for (const { layer, tags } of source.layers) {
    const l = tile.layers[layer];
    counts[layer] = l ? l.length : -1; // -1 = layer not present in tile
    if (!l) continue;

    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i);
      const g: any = f.toGeoJSON(x, y, z).geometry;

      const parts: number[][][] =
        g.type === "Polygon"
          ? g.coordinates
          : g.type === "MultiPolygon"
            ? g.coordinates.flat()
            : g.type === "LineString"
              ? [g.coordinates]
              : g.type === "MultiLineString"
                ? g.coordinates
                : [];

      const t = tags(f.properties as Props);
      for (const c of parts) {
        out.push({
          id: out.length,
          tags: t,
          geometry: c.map(([lon, lat]) => ({ lat, lon })),
        });
      }
    }
  }

  if (DEBUG) {
    console.debug(
      `[OsmVectorLayer] ${source.name} ${z}/${x}/${y}`,
      counts,
      "available layers:",
      Object.keys(tile.layers),
    );
  }
  return out;
}

function loadTile(z: number, x: number, y: number): Promise<OsmWay[]> {
  const key = `${z}/${x}/${y}`;
  const cached = rawTileCache.get(key);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = (async () => {
    let lastError: unknown;
    for (let i = 0; i < SOURCES.length; i++) {
      const idx = (preferredSource + i) % SOURCES.length;
      try {
        const ways = await fetchTileFromSource(SOURCES[idx], z, x, y);
        preferredSource = idx;
        rawTileCache.set(key, ways);
        return ways;
      } catch (e) {
        lastError = e;
        console.warn(`Tile source failed: ${SOURCES[idx].name}`, e);
      }
    }
    throw lastError ?? new Error("All tile sources failed");
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, job);
  return job;
}

type Kind = "water" | "building" | "waterway" | "road";

/** A way projected once into CRS units (metres for UTM), ready for fast drawing. */
interface ProjWay {
  kind: Kind;
  highway?: string;
  xy: Float64Array; // x0,y0,x1,y1,...
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function OsmVectorLayer() {
  const map = useMap();

  useEffect(() => {
    // Leaflet's typings omit these fields, but every CRS has them at runtime.
    const crs = map.options.crs as unknown as L.CRS & {
      projection: L.Projection;
      transformation: L.Transformation;
    };

    const paneName = "osmVectorPane";
    if (!map.getPane(paneName)) map.createPane(paneName);
    const pane = map.getPane(paneName)!;
    pane.style.zIndex = "350";
    pane.style.pointerEvents = "none";

    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.pointerEvents = "none";
    pane.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    // Projected tiles for THIS map/CRS. Projection (proj4) runs once per tile,
    // not on every redraw.
    const projTiles = new Map<string, { z: number; ways: ProjWay[] }>();
    let currentZ = MAX_Z; // tile zoom currently shown
    let disposed = false;
    let rafId: number | undefined;
    let debounceTimer: number | undefined;

    function projectWays(ways: OsmWay[]): ProjWay[] {
      const out: ProjWay[] = [];
      for (const w of ways) {
        const g = w.geometry;
        const t = w.tags ?? {};
        if (!g || g.length < 2) continue;

        let kind: Kind;
        if (t.building) kind = "building";
        else if (t.natural === "water") kind = "water";
        else if (t.waterway) kind = "waterway";
        else if (t.highway) kind = "road";
        else continue;

        const xy = new Float64Array(g.length * 2);
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (let i = 0; i < g.length; i++) {
          const p = crs.projection.project(L.latLng(g[i].lat, g[i].lon));
          xy[i * 2] = p.x;
          xy[i * 2 + 1] = p.y;
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        out.push({ kind, highway: t.highway, xy, minX, minY, maxX, maxY });
      }
      return out;
    }

    function draw() {
      if (disposed) return;

      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const cw = Math.round(size.x * dpr);
      const ch = Math.round(size.y * dpr);

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }

      const origin = map.containerPointToLayerPoint(L.point(0, 0));
      L.DomUtil.setPosition(canvas, origin);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size.x, size.y);
      ctx!.lineJoin = "round";
      ctx!.lineCap = "round";

      // CRS units -> canvas pixels is an affine map: px = ax*X + bx, py = ay*Y + by
      const s = crs.scale(map.getZoom());
      const tr = crs.transformation;
      const p0 = tr.transform(L.point(0, 0), s);
      const pX = tr.transform(L.point(1, 0), s);
      const pY = tr.transform(L.point(0, 1), s);
      const po = map.getPixelOrigin();
      const ax = pX.x - p0.x;
      const ay = pY.y - p0.y;
      const bx = p0.x - po.x - origin.x;
      const by = p0.y - po.y - origin.y;

      const pad = 50;
      const visible: Record<Kind, ProjWay[]> = {
        water: [],
        building: [],
        waterway: [],
        road: [],
      };

      for (const tile of projTiles.values()) {
        if (tile.z !== currentZ) continue; // avoid drawing overlapping zoom levels
        for (const w of tile.ways) {
          const x1 = ax * w.minX + bx;
          const x2 = ax * w.maxX + bx;
          const y1 = ay * w.minY + by;
          const y2 = ay * w.maxY + by;
          if (Math.max(x1, x2) < -pad || Math.min(x1, x2) > size.x + pad)
            continue;
          if (Math.max(y1, y2) < -pad || Math.min(y1, y2) > size.y + pad)
            continue;
          visible[w.kind].push(w);
        }
      }

      const trace = (w: ProjWay, close: boolean) => {
        const xy = w.xy;
        ctx!.moveTo(ax * xy[0] + bx, ay * xy[1] + by);
        for (let i = 2; i < xy.length; i += 2) {
          ctx!.lineTo(ax * xy[i] + bx, ay * xy[i + 1] + by);
        }
        if (close) ctx!.closePath();
      };

      // One path + one fill per layer (much faster than per feature).
      ctx!.beginPath();
      for (const w of visible.water) trace(w, true);
      ctx!.fillStyle = "#b8dce8";
      ctx!.fill("evenodd");

      ctx!.beginPath();
      for (const w of visible.building) trace(w, true);
      ctx!.fillStyle = "#d8d2c8";
      ctx!.fill("evenodd");

      ctx!.beginPath();
      for (const w of visible.waterway) trace(w, false);
      ctx!.strokeStyle = "#75afc5";
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // Roads: minor first, major on top.
      const roadStyles: Array<{
        match: (h: string) => boolean;
        color: string;
        width: number;
      }> = [
        {
          match: (h) =>
            h !== "motorway" &&
            h !== "trunk" &&
            h !== "primary" &&
            h !== "secondary",
          color: "#f5f0e6",
          width: 1,
        },
        {
          match: (h) => h === "primary" || h === "secondary",
          color: "#f5f0e6",
          width: 2,
        },
        {
          match: (h) => h === "motorway" || h === "trunk",
          color: "#e8b9a0",
          width: 3,
        },
      ];

      for (const style of roadStyles) {
        ctx!.beginPath();
        for (const w of visible.road) {
          if (style.match(w.highway ?? "")) trace(w, false);
        }
        ctx!.strokeStyle = style.color;
        ctx!.lineWidth = style.width;
        ctx!.stroke();
      }
    }

    function scheduleDraw() {
      if (rafId !== undefined) return;
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        draw();
      });
    }

    function loadData() {
      const b = map.getBounds();

      // Pick the finest tile zoom whose tile count fits the viewport.
      let z = MAX_Z;
      let x0 = 0,
        x1 = 0,
        y0 = 0,
        y1 = 0;
      for (; z >= MIN_Z; z--) {
        x0 = lon2x(b.getWest(), z);
        x1 = lon2x(b.getEast(), z);
        y0 = lat2y(b.getNorth(), z);
        y1 = lat2y(b.getSouth(), z);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES) break;
      }
      if (z < MIN_Z) {
        console.warn(
          "[OsmVectorLayer] viewport too large, zoom in to load data",
        );
        return;
      }

      if (z !== currentZ) {
        currentZ = z;
        if (DEBUG) console.debug(`[OsmVectorLayer] tile zoom -> ${z}`);
        scheduleDraw();
      }

      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${z}/${x}/${y}`;
          if (projTiles.has(key)) continue;

          loadTile(z, x, y)
            .then((ways) => {
              if (disposed) return;
              projTiles.set(key, { z, ways: projectWays(ways) });
              scheduleDraw();
            })
            .catch((e) => console.error(`Tile ${key} failed:`, e));
        }
      }
    }

    const debouncedLoad = () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(loadData, 200);
    };

    map.on("move", scheduleDraw);
    map.on("zoom", scheduleDraw);
    map.on("viewreset", scheduleDraw);
    map.on("zoomend", scheduleDraw);
    map.on("moveend", debouncedLoad);

    loadData();
    scheduleDraw();

    return () => {
      disposed = true;
      window.clearTimeout(debounceTimer);
      if (rafId !== undefined) cancelAnimationFrame(rafId);

      map.off("move", scheduleDraw);
      map.off("zoom", scheduleDraw);
      map.off("viewreset", scheduleDraw);
      map.off("zoomend", scheduleDraw);
      map.off("moveend", debouncedLoad);

      canvas.remove();
    };
  }, [map]);

  return null;
}
