import {
  createTileLayerComponent,
  updateGridLayer,
  withPane,
} from "@react-leaflet/core";
import L from "leaflet";
import type { TileLayerProps } from "react-leaflet";

const EARTH_CIRC = 40075016.68557849;

interface Transform {
  shiftX?: number; // meters, east+
  shiftY?: number; // meters, north+
  rotation?: number; // degrees, clockwise
  rotationOrigin?: L.LatLngExpression; // pivot
}

class TransformedTileLayer extends L.TileLayer {
  private shiftX = 0;
  private shiftY = 0;
  private angle = 0;
  private origin: L.LatLng | null = null;

  setTransform({
    shiftX = 0,
    shiftY = 0,
    rotation = 0,
    rotationOrigin,
  }: Transform) {
    const origin = rotationOrigin ? L.latLng(rotationOrigin) : null;
    const sameOrigin =
      (!origin && !this.origin) ||
      (!!origin && !!this.origin && origin.equals(this.origin));
    if (
      shiftX === this.shiftX &&
      shiftY === this.shiftY &&
      rotation === this.angle &&
      sameOrigin
    )
      return;

    this.shiftX = shiftX;
    this.shiftY = shiftY;
    this.angle = rotation;
    this.origin = origin;
    this.redraw(); // one redraw for all params
  }

  private rotatePoint(p: L.Point, c: L.Point, deg: number) {
    const r = (deg * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    // screen Y points down, so this is clockwise for positive deg (same as CSS)
    return L.point(c.x + dx * cos - dy * sin, c.y + dx * sin + dy * cos);
  }

  private shiftPx(z: number) {
    const size = this.getTileSize().x;
    const mpp = EARTH_CIRC / (size * 2 ** z);
    return L.point(this.shiftX / mpp, -this.shiftY / mpp);
  }

  // --- private Leaflet API (stable across 1.x) ---

  _getTilePos(coords: L.Coords) {
    const self = this as any;
    const size = this.getTileSize();
    const half = size.divideBy(2);

    // absolute pixel position of the tile's top-left at this zoom
    let tl = coords.scaleBy(size);

    if (this.angle && this.origin) {
      const pivot = self._map.project(this.origin, coords.z);
      const center = tl.add(half);
      tl = this.rotatePoint(center, pivot, this.angle).subtract(half);
    }

    tl = tl.add(this.shiftPx(coords.z));
    return tl.subtract(self._level.origin);
  }

  _addTile(coords: L.Coords, container: HTMLElement) {
    const self = this as any;
    (L.TileLayer.prototype as any)._addTile.call(this, coords, container);

    if (!this.angle) return;
    const tile = self._tiles[self._tileCoordsToKey(coords)];
    if (tile) {
      // Leaflet already set translate3d(x, y, 0); append rotation about the tile center
      tile.el.style.transformOrigin = "50% 50%";
      tile.el.style.transform += ` rotate(${this.angle}deg)`;
    }
  }

  _getTiledPixelBounds(center: L.LatLng) {
    const self = this as any;
    const b: L.Bounds = (
      L.TileLayer.prototype as any
    )._getTiledPixelBounds.call(this, center);
    if (!this.angle || !this.origin) return b;

    // Map the viewport back into the unrotated tile grid, so we load the right tiles
    const z = self._tileZoom;
    const pivot = self._map.project(this.origin, z);
    const s = this.shiftPx(z);
    const corners = [
      b.min,
      L.point(b.max.x, b.min.y),
      b.max,
      L.point(b.min.x, b.max.y),
    ].map((p) => this.rotatePoint(p.subtract(s), pivot, -this.angle));

    return L.bounds(corners);
  }
}

type Props = TileLayerProps & Transform;

export const TransformedTileLayerComponent = createTileLayerComponent<
  TransformedTileLayer,
  Props
>(
  function createLayer(
    { url, shiftX, shiftY, rotation, rotationOrigin, ...options },
    context,
  ) {
    const layer = new TransformedTileLayer(url, withPane(options, context));
    layer.setTransform({ shiftX, shiftY, rotation, rotationOrigin });
    return { instance: layer, context };
  },
  function updateLayer(layer, props, prevProps) {
    updateGridLayer(layer, props, prevProps);
    layer.setTransform(props);
  },
);
