import { type MouseEvent, useRef, useState, type WheelEvent } from "react";

interface SvgPreviewProps {
  svgContent: string;
  className?: string;
}

export function SvgPreview({
  svgContent,
  className = "h-[70vh] rounded-2xl",
}: SvgPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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
    const newScale = Math.min(Math.max(0.1, scale + -e.deltaY * 0.001), 10);
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
    const newScale = Math.min(Math.max(0.1, scale + delta), 10);
    if (newScale === scale) return;
    const r = newScale / scale;
    setPosition({ x: position.x * r, y: position.y * r });
    setScale(newScale);
  };

  const zoomIn = () => zoomAtCenter(0.2);
  const zoomOut = () => zoomAtCenter(-0.2);

  // Reset: recenter with scale=1 (SVG fills container via flex centering)
  const reset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const btnCls =
    "w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded font-bold cursor-pointer text-gray-300 transition-colors";

  return (
    <div
      ref={containerRef}
      className={`relative bg-gray-950 overflow-hidden select-none ${className}`}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-700">
        <button
          type="button"
          onClick={zoomIn}
          className={btnCls}
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className={btnCls}
          title="Zoom Out"
        >
          −
        </button>
        <div className="h-px bg-gray-700 mx-1" />
        <button
          type="button"
          onClick={reset}
          className={`${btnCls} text-xs`}
          title="Reset View"
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
