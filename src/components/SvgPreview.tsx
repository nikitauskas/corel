import {
  type MouseEvent,
  type WheelEvent,
  useCallback,
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
  const isFirstLoad = useRef(true);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
    return Math.min(scaleW, scaleH); // no upper cap — always fit-to-container
  }, [svgContent]);

  /** Apply fit-to-container transform. */
  const fitToContainer = useCallback(() => {
    setScale(calcFitScale());
    setPosition({ x: 0, y: 0 });
  }, [calcFitScale]);

  // Fit on first render only — subsequent svgContent changes keep zoom/position.
  useLayoutEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      fitToContainer();
    }
  }, [fitToContainer]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel: zoom toward mouse pointer
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const newScale = Math.min(Math.max(0.01, scale + -e.deltaY * 0.001), 10);
    if (newScale === scale) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const r = newScale / scale;

    setPosition({
      x: mouseX - cx - (mouseX - cx - position.x) * r,
      y: mouseY - cy - (mouseY - cy - position.y) * r,
    });
    setScale(newScale);
  };

  // Buttons: zoom toward screen center
  const zoomAtCenter = (delta: number) => {
    const newScale = Math.min(Math.max(0.01, scale + delta), 10);
    if (newScale === scale) return;
    const r = newScale / scale;
    setPosition({ x: position.x * r, y: position.y * r });
    setScale(newScale);
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
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.1s ease-out",
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
