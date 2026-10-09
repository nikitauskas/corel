import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface OsmWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements: OsmWay[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export function OsmVectorLayer() {
  const map = useMap();

  useEffect(() => {
    // Отдельная панель для векторной подложки.
    const paneName = "osmVectorPane";

    if (!map.getPane(paneName)) {
      map.createPane(paneName);
    }

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

    let ways: OsmWay[] = [];
    let requestController: AbortController | undefined;
    let disposed = false;

    function draw() {
      if (disposed) return;

      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(size.x * dpr);
      canvas.height = Math.round(size.y * dpr);
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;

      // Верхний левый угол viewport в координатах Leaflet layer.
      const origin = map.containerPointToLayerPoint(L.point(0, 0));

      L.DomUtil.setPosition(canvas, origin);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size.x, size.y);

      for (const way of ways) {
        const geometry = way.geometry;
        if (!geometry || geometry.length < 2) continue;

        const tags = way.tags ?? {};

        const isBuilding = Boolean(tags.building);
        const isWater =
          tags.natural === "water" || tags.waterway === "riverbank";
        const isRoad = Boolean(tags.highway);
        const isWaterway = Boolean(tags.waterway);

        if (!isBuilding && !isWater && !isRoad && !isWaterway) {
          continue;
        }

        ctx!.beginPath();

        geometry.forEach((point, index) => {
          // Leaflet применяет CRS карты здесь.
          // При UTM CRS точки проецируются в UTM.
          const pixel = map.latLngToLayerPoint(L.latLng(point.lat, point.lon));

          const x = pixel.x - origin.x;
          const y = pixel.y - origin.y;

          if (index === 0) {
            ctx!.moveTo(x, y);
          } else {
            ctx!.lineTo(x, y);
          }
        });

        if (isBuilding || isWater) {
          ctx!.closePath();
          ctx!.fillStyle = isBuilding ? "#d8d2c8" : "#b8dce8";
          ctx!.fill();

          ctx!.strokeStyle = isBuilding ? "#a59c90" : "#75afc5";
          ctx!.lineWidth = 0.7;
          ctx!.stroke();
        } else if (isRoad) {
          const highway = tags.highway;

          ctx!.strokeStyle =
            highway === "motorway" || highway === "trunk"
              ? "#e8b9a0"
              : "#f5f0e6";

          ctx!.lineWidth =
            highway === "motorway" || highway === "trunk"
              ? 3
              : highway === "primary"
                ? 2
                : 1;

          ctx!.stroke();
        } else if (isWaterway) {
          ctx!.strokeStyle = "#75afc5";
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }
      }
    }

    async function loadData() {
      requestController?.abort();
      requestController = new AbortController();

      const bounds = map.getBounds();
      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();

      const query = `
        [out:json][timeout:25];
        (
          way["highway"](${south},${west},${north},${east});
          way["building"](${south},${west},${north},${east});
          way["natural"="water"](${south},${west},${north},${east});
          way["waterway"](${south},${west},${north},${east});
        );
        out geom;
      `;

      try {
        const response = await fetch(OVERPASS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({ data: query }),
          signal: requestController.signal,
        });

        if (!response.ok) {
          throw new Error(`Overpass HTTP ${response.status}`);
        }

        const data = (await response.json()) as OverpassResponse;

        if (disposed) return;

        ways = data.elements;
        draw();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Failed to load OSM data:", error);
      }
    }

    // Перерисовка при движении, загрузка — после остановки.
    map.on("move", draw);
    map.on("moveend", loadData);
    map.on("zoomend", draw);

    void loadData();

    return () => {
      disposed = true;
      requestController?.abort();

      map.off("move", draw);
      map.off("moveend", loadData);
      map.off("zoomend", draw);

      canvas.remove();
    };
  }, [map]);

  return null;
}
