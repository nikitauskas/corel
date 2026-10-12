import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

type LL = [number, number];
export interface Corners {
  tl: LL;
  tr: LL;
  bl: LL;
}

/** ImageOverlay positioned by 3 corners (affine: rotation + scale + skew). */
const RotatedOverlay = (L.ImageOverlay as any).extend({
  initialize(url: string, corners: Corners, options: any) {
    this._corners = [corners.tl, corners.tr, corners.bl].map((p) =>
      L.latLng(p),
    );
    (L.ImageOverlay.prototype as any).initialize.call(
      this,
      url,
      L.latLngBounds(this._corners),
      options,
    );
  },

  setCorners(corners: Corners) {
    this._corners = [corners.tl, corners.tr, corners.bl].map((p) =>
      L.latLng(p),
    );
    this._bounds = L.latLngBounds(this._corners);
    if (this._map) this._reset();
    return this;
  },

  _place(toPoint: (ll: L.LatLng) => L.Point) {
    const img = this._image as HTMLImageElement;
    const [w, h] = this.options.size as [number, number];
    const [tl, tr, bl] = this._corners.map(toPoint);

    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.transformOrigin = "0 0";
    img.style.transform =
      `matrix(${(tr.x - tl.x) / w}, ${(tr.y - tl.y) / w}, ` +
      `${(bl.x - tl.x) / h}, ${(bl.y - tl.y) / h}, ${tl.x}, ${tl.y})`;
  },

  _reset() {
    this._place((ll: L.LatLng) => this._map.latLngToLayerPoint(ll));
  },

  _animateZoom(e: any) {
    this._place((ll: L.LatLng) =>
      this._map._latLngToNewLayerPoint(ll, e.zoom, e.center),
    );
  },
});

interface Props {
  url: string;
  corners: Corners; // memoize in the parent
  /** only the aspect ratio matters, e.g. [widthMm, heightMm] */
  size: [number, number];
  opacity?: number;
  className?: string;
}

export function RotatedImageOverlay({
  url,
  corners,
  size,
  opacity = 1,
  className,
}: Props) {
  const map = useMap();
  const ref = useRef<any>(null);

  useEffect(() => {
    const layer = new (RotatedOverlay as any)(url, corners, {
      opacity,
      className,
      size,
    });
    layer.addTo(map);
    ref.current = layer;
    return () => {
      layer.remove();
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, className, size[0], size[1]]);

  useEffect(() => {
    ref.current?.setCorners(corners);
  }, [corners]);

  useEffect(() => {
    ref.current?.setOpacity(opacity);
  }, [opacity]);

  return null;
}
