import { useState, MouseEvent, WheelEvent } from "react";

interface SvgPreviewProps {
  svgContent: string;
}

export function SvgPreview({ svgContent }: SvgPreviewProps) {
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
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale + scaleAmount), 10);
    
    if (newScale !== scale) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const scaleRatio = newScale / scale;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      
      setPosition({
        x: mouseX - cx - (mouseX - cx - position.x) * scaleRatio,
        y: mouseY - cy - (mouseY - cy - position.y) * scaleRatio,
      });
      setScale(newScale);
    }
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 10));
  const zoomOut = () => setScale((s) => Math.max(0.1, s - 0.2));
  const reset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative bg-white rounded-2xl overflow-hidden border border-gray-200 select-none" style={{ height: "70vh" }}>
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1 border border-gray-200">
        <button type="button" onClick={zoomIn} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-xl font-bold cursor-pointer text-gray-700 transition-colors" title="Zoom In">+</button>
        <button type="button" onClick={zoomOut} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-xl font-bold cursor-pointer text-gray-700 transition-colors" title="Zoom Out">-</button>
        <button type="button" onClick={reset} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-xs font-bold cursor-pointer text-gray-700 transition-colors" title="Reset View">R</button>
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
