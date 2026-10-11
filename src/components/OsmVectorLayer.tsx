import { VectorTile } from "@mapbox/vector-tile";
import L from "leaflet";
import { PbfReader } from "pbf";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

const DEBUG = true;

const MAX_Z = 14;
const MIN_Z = 8;
const MAX_TILES = 60;
/** Added to the tile zoom when checking style minzoom/maxzoom. Try 1 or -1 if layers appear at the wrong level. */
const ZOOM_OFFSET = 0;

const TILE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf";
const STYLE_URL =
  "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/resources/styles/root.json";

type Props = Record<string, any>;
type Spec = any; // number | string | { stops: [zoom, value][] } | expression

/* ----------------------------- style handling ----------------------------- */

interface StyleLayer {
  id: string;
  type: "fill" | "line";
  sourceLayer: string;
  filter?: any[];
  minzoom: number;
  maxzoom: number;
  color: Spec;
  width?: Spec;
  opacity?: Spec;
}

/** Resolve a constant or {stops} value at zoom z (linear for numbers, step for colours). */
function resolve(spec: Spec, z: number): any {
  if (spec === undefined || spec === null || typeof spec !== "object")
    return spec;
  const st: Array<[number, any]> | undefined = spec.stops;
  if (!st?.length) return undefined;
  if (z <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    const [z1, v1] = st[i];
    const [z0, v0] = st[i - 1];
    if (z <= z1) {
      if (typeof v0 !== "number" || typeof v1 !== "number") return v0;
      return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
    }
  }
  return st[st.length - 1][1];
}

/** Legacy Mapbox filter syntax (what Esri's root.json uses). Unknown ops pass. */
function evalFilter(f: any[] | undefined, p: Props, geom: string): boolean {
  if (!f) return true;
  const op = f[0];
  const key = f[1];
  const val = key === "$type" ? geom : p[key];
  switch (op) {
    case "all":
      return f.slice(1).every((x) => evalFilter(x, p, geom));
    case "any":
      return f.slice(1).some((x) => evalFilter(x, p, geom));
    case "none":
      return !f.slice(1).some((x) => evalFilter(x, p, geom));
    case "==":
      return val == f[2]; // loose: tile props may be numbers or strings
    case "!=":
      return val != f[2];
    case "in":
      return f.slice(2).some((v) => v == val);
    case "!in":
      return !f.slice(2).some((v) => v == val);
    case "has":
      return key in p;
    case "!has":
      return !(key in p);
    case "<":
      return val < f[2];
    case "<=":
      return val <= f[2];
    case ">":
      return val > f[2];
    case ">=":
      return val >= f[2];
    default:
      return true;
  }
}

let stylePromise: Promise<StyleLayer[]> | undefined;

function loadStyle(): Promise<StyleLayer[]> {
  if (!stylePromise) {
    stylePromise = fetch(STYLE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`style HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const out: StyleLayer[] = [];
        for (const l of json.layers ?? []) {
          const sourceLayer = l["source-layer"];
          if (!sourceLayer) continue;
          const paint = l.paint ?? {};
          const base = {
            id: l.id as string,
            sourceLayer: sourceLayer as string,
            filter: l.filter as any[] | undefined,
            minzoom: (l.minzoom ?? 0) as number,
            maxzoom: (l.maxzoom ?? 25) as number,
          };
          if (l.type === "fill" && paint["fill-color"] !== undefined) {
            out.push({
              ...base,
              type: "fill",
              color: paint["fill-color"],
              opacity: paint["fill-opacity"],
            });
          } else if (l.type === "line" && paint["line-color"] !== undefined) {
            out.push({
              ...base,
              type: "line",
              color: paint["line-color"],
              width: paint["line-width"],
              opacity: paint["line-opacity"],
            });
          }
          // symbol, background, raster, fill-pattern layers are skipped
        }
        return out;
      })
      .catch((e) => {
        stylePromise = undefined; // allow retry
        throw e;
      });
  }
  return stylePromise;
}

/* ------------------------------- tile loading ------------------------------ */

interface RawWay {
  style: number; // index into the style layer list (= paint order)
  poly: number; // same for all rings of one feature
  coords: number[][]; // [lon, lat][]
}

const rawTileCache = new Map<string, RawWay[]>();
const inFlight = new Map<string, Promise<RawWay[]>>();

const lon2x = (lon: number, z: number) =>
  Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z,
  );
};

function viewportLatLngBounds(map: L.Map) {
  const pb = map.getPixelBounds();
  const corners = [
    pb.min,
    L.point(pb.max.x, pb.min.y),
    pb.max,
    L.point(pb.min.x, pb.max.y),
  ].map((p) => map.unproject(p));
  return L.latLngBounds(corners);
}

async function fetchTile(z: number, x: number, y: number): Promise<RawWay[]> {
  const style = await loadStyle();
  const url = TILE_URL.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));

  const res = await fetch(url);
  if (res.status === 404 || res.status === 204) return [];
  if (!res.ok) throw new Error(`tile HTTP ${res.status}`);

  const tile = new VectorTile(
    new PbfReader(new Uint8Array(await res.arrayBuffer())),
  );
  const sz = z + ZOOM_OFFSET;
  const out: RawWay[] = [];
  let poly = 0;

  for (const [name, layer] of Object.entries(tile.layers)) {
    const rules: number[] = [];
    for (let i = 0; i < style.length; i++) {
      const s = style[i];
      if (s.sourceLayer === name && sz >= s.minzoom && sz < s.maxzoom) {
        rules.push(i);
      }
    }
    if (!rules.length) continue;

    if (DEBUG && /water/i.test(name)) {
      const symbols = new Set<any>();
      for (let i = 0; i < layer.length; i++) {
        symbols.add(layer.feature(i).properties._symbol);
      }
      console.debug(`[${name}] ${z}/${x}/${y} _symbol values:`, [...symbols]);
    }

    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const props = f.properties as Props;
      const g: any = f.toGeoJSON(x, y, z).geometry;

      const isPoly = g.type === "Polygon" || g.type === "MultiPolygon";
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
      if (!parts.length) continue;

      let pid = -1;
      for (const si of rules) {
        const s = style[si];
        if (s.type === "fill" && !isPoly) continue;
        if (!evalFilter(s.filter, props, isPoly ? "Polygon" : "LineString"))
          continue;
        if (pid < 0) pid = poly++;
        for (const c of parts) out.push({ style: si, poly: pid, coords: c });
      }
    }
  }
  return out;
}

function loadTile(z: number, x: number, y: number): Promise<RawWay[]> {
  const key = `${z}/${x}/${y}`;
  const cached = rawTileCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const job = fetchTile(z, x, y)
    .then((ways) => {
      rawTileCache.set(key, ways);
      return ways;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/* ---------------------------------- layer ---------------------------------- */

interface ProjWay {
  poly: number;
  xy: Float64Array;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface ProjTile {
  z: number;
  quad: Float64Array;
  byStyle: Map<number, ProjWay[]>;
}

export function OsmVectorLayer() {
  const map = useMap();

  useEffect(() => {
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

    const projTiles = new Map<string, ProjTile>();
    let style: StyleLayer[] = [];
    let currentZ = MAX_Z;
    let disposed = false;
    let rafId: number | undefined;
    let debounceTimer: number | undefined;

    function projectWays(ways: RawWay[]): Map<number, ProjWay[]> {
      const out = new Map<number, ProjWay[]>();
      for (const w of ways) {
        const g = w.coords;
        if (g.length < 2) continue;

        const xy = new Float64Array(g.length * 2);
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (let i = 0; i < g.length; i++) {
          const p = crs.projection.project(L.latLng(g[i][1], g[i][0]));
          xy[i * 2] = p.x;
          xy[i * 2 + 1] = p.y;
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }

        const pw: ProjWay = { poly: w.poly, xy, minX, minY, maxX, maxY };
        const arr = out.get(w.style);
        if (arr) arr.push(pw);
        else out.set(w.style, [pw]);
      }
      return out;
    }

    /** Tile outline in CRS units, edges subdivided so UTM curvature is respected. */
    function tileQuad(z: number, x: number, y: number): Float64Array {
      const n = 2 ** z;
      const lonOf = (xx: number) => (xx / n) * 360 - 180;
      const latOf = (yy: number) =>
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;

      const N = 8;
      const pts: number[] = [];
      const push = (xx: number, yy: number) => {
        const p = crs.projection.project(L.latLng(latOf(yy), lonOf(xx)));
        pts.push(p.x, p.y);
      };
      for (let i = 0; i < N; i++) push(x + i / N, y);
      for (let i = 0; i < N; i++) push(x + 1, y + i / N);
      for (let i = 0; i < N; i++) push(x + 1 - i / N, y + 1);
      for (let i = 0; i < N; i++) push(x, y + 1 - i / N);

      let cx = 0,
        cy = 0;
      for (let i = 0; i < pts.length; i += 2) {
        cx += pts[i];
        cy += pts[i + 1];
      }
      cx /= pts.length / 2;
      cy /= pts.length / 2;
      const k = 1.002; // slight overlap so neighbouring clips leave no gap
      for (let i = 0; i < pts.length; i += 2) {
        pts[i] = cx + (pts[i] - cx) * k;
        pts[i + 1] = cy + (pts[i + 1] - cy) * k;
      }
      return new Float64Array(pts);
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

      const trace = (w: ProjWay, close: boolean) => {
        const xy = w.xy;
        ctx!.moveTo(ax * xy[0] + bx, ay * xy[1] + by);
        for (let i = 2; i < xy.length; i += 2) {
          ctx!.lineTo(ax * xy[i] + bx, ay * xy[i + 1] + by);
        }
        if (close) ctx!.closePath();
      };

      const clipToTile = (q: Float64Array) => {
        ctx!.beginPath();
        ctx!.moveTo(ax * q[0] + bx, ay * q[1] + by);
        for (let i = 2; i < q.length; i += 2) {
          ctx!.lineTo(ax * q[i] + bx, ay * q[i + 1] + by);
        }
        ctx!.closePath();
        ctx!.clip();
      };

      const onScreen = (w: ProjWay) => {
        const x1 = ax * w.minX + bx;
        const x2 = ax * w.maxX + bx;
        const y1 = ay * w.minY + by;
        const y2 = ay * w.maxY + by;
        return !(
          Math.max(x1, x2) < -pad ||
          Math.min(x1, x2) > size.x + pad ||
          Math.max(y1, y2) < -pad ||
          Math.min(y1, y2) > size.y + pad
        );
      };

      // Tiles currently on screen
      const tiles: ProjTile[] = [];
      for (const tile of projTiles.values()) {
        if (tile.z !== currentZ) continue;
        const q = tile.quad;
        let qx0 = Infinity,
          qy0 = Infinity,
          qx1 = -Infinity,
          qy1 = -Infinity;
        for (let i = 0; i < q.length; i += 2) {
          const px = ax * q[i] + bx;
          const py = ay * q[i + 1] + by;
          if (px < qx0) qx0 = px;
          if (px > qx1) qx1 = px;
          if (py < qy0) qy0 = py;
          if (py > qy1) qy1 = py;
        }
        if (qx1 < -pad || qx0 > size.x + pad) continue;
        if (qy1 < -pad || qy0 > size.y + pad) continue;
        tiles.push(tile);
      }

      // Style layers that have data, in Esri's paint order
      const present = new Set<number>();
      for (const t of tiles) for (const k of t.byStyle.keys()) present.add(k);
      const order = [...present].sort((a, b) => a - b);

      const sz = currentZ + ZOOM_OFFSET;

      for (const si of order) {
        const st = style[si];
        if (!st) continue;
        const color = resolve(st.color, sz);
        if (typeof color !== "string") continue; // expressions are not supported
        const opacity = resolve(st.opacity, sz);
        const alpha = typeof opacity === "number" ? opacity : 1;

        if (st.type === "fill") {
          ctx!.fillStyle = color;
        } else {
          const width = resolve(st.width, sz);
          ctx!.strokeStyle = color;
          ctx!.lineWidth = typeof width === "number" ? width : 1;
        }
        ctx!.globalAlpha = alpha;

        for (const tile of tiles) {
          const ways = tile.byStyle.get(si);
          if (!ways) continue;
          const vis = ways.filter(onScreen);
          if (!vis.length) continue;

          ctx!.save();
          clipToTile(tile.quad);

          if (st.type === "fill") {
            // one evenodd fill per feature so holes work and tile duplicates can't cancel
            const byPoly = new Map<number, ProjWay[]>();
            for (const w of vis) {
              const arr = byPoly.get(w.poly);
              if (arr) arr.push(w);
              else byPoly.set(w.poly, [w]);
            }
            for (const group of byPoly.values()) {
              ctx!.beginPath();
              for (const w of group) trace(w, true);
              ctx!.fill("evenodd");
            }
          } else {
            ctx!.beginPath();
            for (const w of vis) trace(w, false);
            ctx!.stroke();
          }

          ctx!.restore();
        }
      }
      ctx!.globalAlpha = 1;
    }

    function scheduleDraw() {
      if (rafId !== undefined) return;
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        draw();
      });
    }

    function loadData() {
      const b = viewportLatLngBounds(map);

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
        scheduleDraw();
      }

      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${z}/${x}/${y}`;
          if (projTiles.has(key)) continue;

          loadTile(z, x, y)
            .then((ways) => {
              if (disposed || projTiles.has(key)) return;
              projTiles.set(key, {
                z,
                quad: tileQuad(z, x, y),
                byStyle: projectWays(ways),
              });
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

    loadStyle()
      .then((s) => {
        if (disposed) return;
        style = s;
        loadData();
        scheduleDraw();
      })
      .catch((e) => console.error("Style load failed:", e));

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
