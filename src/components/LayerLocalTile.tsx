import L from "leaflet";
import "proj4leaflet";
import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { mgrsToUtm } from "../lib/geo";
import { utmDef } from "../lib/overlay-bounds";
import { RES0 } from "../lib/utils";

const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export const LOCAL_TILE_RESOLUTIONS = Array.from(
  { length: 23 },
  (_, i) => RES0 / 2 ** i, // RES0 must match
);

/** CRS that the local tiles require. Pass it to <MapContainer crs=... /> */
export function createLocalTilesCrs(
  topLeftMgrs: string,
  resolutions: number[] = LOCAL_TILE_RESOLUTIONS,
): L.CRS {
  try {
    const { zone, easting, northing } = mgrsToUtm(topLeftMgrs);
    const def = utmDef(topLeftMgrs);
    const south = def.includes("+south");
    return new (L as any).Proj.CRS(
      `EPSG:${(south ? 32700 : 32600) + zone}`,
      def,
      {
        resolutions,
        origin: [easting, northing],
      },
    );
  } catch (e) {
    console.error("Failed to build local tiles CRS", e);
    return L.CRS.EPSG3857;
  }
}

interface LocalTileLayerProps {
  url?: string;
  bounds: L.LatLngBoundsExpression;
  minZoom?: number;
  maxZoom?: number;
  tms?: boolean; // set true if tiles were made by gdal2tiles (flipped Y)
}

export function LayerLocalTile({
  url = "./tiles1/{z}/{x}/{y}.png",
  bounds,
  minZoom = 12,
  maxZoom = 15,
  tms = false,
}: LocalTileLayerProps) {
  const map = useMap();

  // Dev guard: this layer is meaningless on a Web Mercator map
  useEffect(() => {
    if (map.options.crs === L.CRS.EPSG3857) {
      console.warn("LocalTileLayer needs the CRS from createLocalTilesCrs()");
    }
  }, [map]);

  return (
    <TileLayer
      url={url}
      bounds={bounds}
      minNativeZoom={minZoom}
      maxNativeZoom={maxZoom}
      minZoom={minZoom - 2}
      maxZoom={22}
      tms={tms}
      noWrap
      errorTileUrl={TRANSPARENT_PX}
      attribution="Local map"
    />
  );
}
