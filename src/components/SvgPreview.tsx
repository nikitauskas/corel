import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

interface SvgPreviewProps {
  svgContent: string;
  className?: string;
}

const MM_TO_PX = 96 / 25.4; // CSS standard: 96 dpi

/**
 * Parse the root SVG width/height in CSS pixels.
 * Handles plain numbers (assumed px) and mm / cm / in units.
 */
function parseSvgSizePx(svg: string): { w: number; h: number } | null {
  const wRaw = svg.match(/<svg[^>]*\swidth="([^"]+)"/)?.[1];
  const hRaw = svg.match(/<svg[^>]*\sheight="([^"]+)"/)?.[1];
  if (!wRaw || !hRaw) return null;

  const toPx = (val: string): number => {
    const n = parseFloat(val);
    if (!Number.isFinite(n)) return 0;
    if (val.endsWith("mm")) return n * MM_TO_PX;
    if (val.endsWith("cm")) return n * MM_TO_PX * 10;
    if (val.endsWith("in")) return n * 96;
    return n; // bare number → px
  };

  const w = toPx(wRaw);
  const h = toPx(hRaw);
  return w > 0 && h > 0 ? { w, h } : null;
}

export function SvgPreview({
  svgContent,
  className = "h-[70vh] rounded-2xl",
}: SvgPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Live transform state — held in a ref so wheel/drag handlers never cause re-renders.
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });

  // Only used for cursor style changes and button-driven zoom (which are infrequent).
  const [isDragging, setIsDragging] = useState(false);

  // Exposed scale for display if needed; updated only on button clicks / fit.
  const [, forceUpdate] = useState(0);

  /** Write the current transform to the DOM directly — no re-render. */
  const applyTransform = useCallback(
    (x: number, y: number, scale: number, animate = false) => {
      transformRef.current = { x, y, scale };
      const el = innerRef.current;
      if (!el) return;
      el.style.transition = animate ? "transform 0.15s ease-out" : "none";
      el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    },
    [],
  );

  /**
   * Compute the scale that makes the full SVG visible inside the container
   * with a 10 px margin on every side.
   */
  const calcFitScale = useCallback((): number => {
    const container = containerRef.current;
    if (!container) return 1;
    const size = parseSvgSizePx(svgContent);
    if (!size) return 1;
    const margin = 10;
    const scaleW = (container.clientWidth - margin * 2) / size.w;
    const scaleH = (container.clientHeight - margin * 2) / size.h;
    return Math.min(scaleW, scaleH);
  }, [svgContent]);

  /** Apply fit-to-container transform. */
  const fitToContainer = useCallback(() => {
    const s = calcFitScale();
    applyTransform(0, 0, s, true);
    forceUpdate((n) => n + 1); // re-render buttons
  }, [calcFitScale, applyTransform]);

  // Fit on first render only — subsequent svgContent changes keep zoom/position.
  useLayoutEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fitToContainer();
    }
  }, [fitToContainer]);

  // ── Wheel (non-passive so we can prevent page scroll) ──────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { x, y, scale } = transformRef.current;
      const newScale = Math.min(Math.max(0.01, scale + -e.deltaY * 0.001), 10);
      if (newScale === scale) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const r = newScale / scale;

      applyTransform(
        mouseX - cx - (mouseX - cx - x) * r,
        mouseY - cy - (mouseY - cy - y) * r,
        newScale,
        false, // never animate during wheel — kills glitch
      );
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // ── Drag ───────────────────────────────────────────────────────────────────
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const { x, y } = transformRef.current;
    dragStart.current = { x: e.clientX - x, y: e.clientY - y };
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const { scale } = transformRef.current;
      applyTransform(
        e.clientX - dragStart.current.x,
        e.clientY - dragStart.current.y,
        scale,
        false,
      );
    },
    [isDragging, applyTransform],
  );

  const handleMouseUp = () => setIsDragging(false);

  // ── Button zoom (toward center, animated) ──────────────────────────────────
  const zoomAtCenter = (delta: number) => {
    const { x, y, scale } = transformRef.current;
    const newScale = Math.min(Math.max(0.01, scale + delta), 10);
    if (newScale === scale) return;
    const r = newScale / scale;
    applyTransform(x * r, y * r, newScale, true);
    forceUpdate((n) => n + 1);
  };

  const zoomIn = () => zoomAtCenter(0.2);
  const zoomOut = () => zoomAtCenter(-0.2);

  const btnCls =
    "w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded font-bold cursor-pointer text-gray-300 transition-colors";

  return (
    <div
      ref={containerRef}
      className={`relative bg-gray-950 overflow-hidden select-none ${className}`}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-700">
        <button type="button" onClick={zoomIn} className={btnCls} title="Zoom In">
          +
        </button>
        <button type="button" onClick={zoomOut} className={btnCls} title="Zoom Out">
          −
        </button>
        <div className="h-px bg-gray-700 mx-1" />
        <button
          type="button"
          onClick={fitToContainer}
          className={`${btnCls} text-xs`}
          title="Reset View — fit full map"
        >
          R
        </button>
      </div>

      {/* Canvas */}
      <div
        className={`w-full h-full ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={innerRef}
          style={{
            transform: `translate(${transformRef.current.x}px, ${transformRef.current.y}px) scale(${transformRef.current.scale})`,
            transformOrigin: "center center",
            willChange: "transform",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering generated SVG preview
            dangerouslySetInnerHTML={{ __html: svgContent }}
            style={{ pointerEvents: "none" }}
          />
        </div>
      </div>
    </div>
  );
}
