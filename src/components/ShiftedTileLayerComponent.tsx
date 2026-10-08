import {
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import L from "leaflet";
import type { TileLayerProps } from "react-leaflet";

const EARTH_CIRC = 40075016.68557849;

class ShiftedTileLayer extends L.TileLayer {
  private shiftX = 0; // meters, east+
  private shiftY = 0; // meters, north+

  setShift(x = 0, y = 0) {
    if (x === this.shiftX && y === this.shiftY) return;
    this.shiftX = x;
    this.shiftY = y;
    this.redraw();
  }

  // private Leaflet API, but stable across 1.x
  _getTilePos(coords: L.Coords) {
    // @ts-expect-error
    const pos: L.Point = super._getTilePos(coords);
    const tileSize = this.getTileSize().x;
    const metersPerPx = EARTH_CIRC / (tileSize * 2 ** coords.z);
    return pos.add([this.shiftX / metersPerPx, -this.shiftY / metersPerPx]);
  }
}

type Props = TileLayerProps & { shiftX?: number; shiftY?: number };

export const ShiftedTileLayerComponent = createTileLayerComponent<
  ShiftedTileLayer,
  Props
>(
  function createLayer({ url, shiftX, shiftY, ...options }, context) {
    const layer = new ShiftedTileLayer(url, withPane(options, context));
    layer.setShift(shiftX, shiftY);
    return { instance: layer, context };
  },
  function updateLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    layer.setShift(props.shiftX, props.shiftY);
  },
);
