import { useEffect, useState } from "react";
import type { GenerateResult } from "../generator";
import {
  type AreaType,
  type LineOverrides,
  type LineType,
  typesOfAreas,
  typesOfLines,
} from "../lib/lines";
import type { PaletteColor } from "../lib/palette";
import { CustomColorDropdown } from "./CustomColorDropdown";
import { MapSettingsForm } from "./MapSettingsForm";
import { PaletteManager } from "./PaletteManager";
import { SvgShiftController } from "./SvgShiftController";

export const DEFAULT_LAYER_COLORS: Record<string, string> = {
  "1bat": "#FECC00",
  "2bat": "#834E98",
  "3bat": "#009846",
  "109": "#A76281",
  "156": "#7690C9",
  "мпб/100": "#A8D4AF",
  "ЗПМ(78)": "#EF7F1A",
  "210": "#F5B2B6",
};

const BaseMaps = [
  {
    name: "ArcGIS World Basemap",
    format: "UTM",
  },
  {
    name: "Satellite",
    format: "WebMercator",
  },
  {
    name: "Local Tiles",
    format: "UTM",
  },
];

// ─── Collapsible section ──────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
    >
      <path
        d="M3 6l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  storageKey,
  summary,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  storageKey: string;
  /** Shown under the title only while the section is collapsed */
  summary?: React.ReactNode;
}) {
  const lsKey = `delta2corel_section_${storageKey}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved !== null) return saved === "1";
    } catch {
      // ignore
    }
    return defaultOpen;
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(lsKey, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 mb-3 cursor-pointer group"
      >
        <ChevronIcon open={open} />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest group-hover:text-gray-200 transition-colors text-left">
          {title}
        </h3>
      </button>

      {!open && summary && (
        <div className="-mt-2 mb-1 ml-6 text-[11px] font-mono text-gray-500 truncate">
          {summary}
        </div>
      )}

      {/* Animated fold: grid row goes 1fr <-> 0fr */}
      <div
        className={`grid transition-[grid-template-rows,visibility] duration-200 ease-out ${
          open ? "grid-rows-[1fr] visible" : "grid-rows-[0fr] invisible"
        }`}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface MapSidebarProps {
  status: string;
  result?: GenerateResult;
  csvFilename: string | null;
  mgrsTL: string;
  scale: number;
  width: string;
  height: string;
  layerColors: Record<string, string>;
  lineOverrides: LineOverrides;
  palette: PaletteColor[];
  basemapId: number;
  shiftX: number;
  shiftY: number;
  shiftEnabled: boolean;
  onClose: () => void;
  onMgrsChange: (val: string) => void;
  onScaleChange: (val: number) => void;
  onWidthChange: (val: string) => void;
  onHeightChange: (val: string) => void;
  onLayerColorChange: (layerName: string, color: string) => void;
  onLineTypeColorChange: (type: LineType, color: string) => void;
  onLineTypeOutlineChange: (type: LineType, show: boolean) => void;
  onAreaTypeColorChange: (type: AreaType, color: string) => void;
  onAreaTypeOutlineChange: (type: AreaType, show: boolean) => void;
  onPaletteAdd: () => void;
  onPaletteChange: (
    id: string,
    patch: Partial<Omit<PaletteColor, "id">>,
  ) => void;
  onPaletteDelete: (id: string) => void;
  onPaletteReset: () => void;
  setBasemapId: (val: number) => void;
  onShiftChange: (x: number, y: number, enabled?: boolean) => void;
  onResetShift: () => void;
  rotation: number;
  onRotationChange: (rot: number) => void;
  /** SVG overlay opacity 0–100 */
  svgOpacity: number;
  onSvgOpacityChange: (val: number) => void;
  /** Background rect opacity 0–100 */
  bgOpacity: number;
  onBgOpacityChange: (val: number) => void;
  /** Background rect fill color (CSS hex) */
  bgColor: string;
  onBgColorChange: (val: string) => void;
}

function OpacityControl({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  id: string;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex items-center gap-2">
      <label
        htmlFor={`${id}-num`}
        className="text-xs text-gray-300 w-24 shrink-0"
      >
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="flex-1 h-1 appearance-none rounded-full bg-gray-700 accent-blue-500 cursor-pointer min-w-0"
      />
      <input
        id={`${id}-num`}
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-11 text-right text-xs bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-100 focus:outline-none focus:border-blue-500 shrink-0"
      />
      <span className="text-xs text-gray-500 shrink-0">%</span>
    </div>
  );
}

export function MapSidebar({
  status,
  result,
  csvFilename,
  mgrsTL,
  scale,
  width,
  height,
  layerColors,
  lineOverrides,
  palette,
  basemapId,
  shiftX,
  shiftY,
  shiftEnabled,
  rotation,
  onClose,
  onMgrsChange,
  onScaleChange,
  onWidthChange,
  onHeightChange,
  onLayerColorChange,
  onLineTypeColorChange,
  onLineTypeOutlineChange,
  onAreaTypeColorChange,
  onAreaTypeOutlineChange,
  onPaletteAdd,
  onPaletteChange,
  onPaletteDelete,
  onPaletteReset,
  setBasemapId,
  onShiftChange,
  onResetShift,
  onRotationChange,
  svgOpacity,
  onSvgOpacityChange,
  bgOpacity,
  onBgOpacityChange,
  bgColor,
  onBgColorChange,
}: MapSidebarProps) {
  const isReady = status === "done" || (status === "loading" && result);
  const [popupId, setPopupId] = useState<number>(0);

  useEffect(() => {
    if (popupId === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopupId(0);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [popupId]);

  return (
    <div className="absolute top-0 left-0 h-full w-96 bg-gray-900 border-r border-gray-800 z-30 shadow-2xl flex flex-col">
      <div className="flex justify-between items-center p-5 border-b border-gray-800 shrink-0">
        <h2 className="text-white font-bold text-lg tracking-tight">
          Settings
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 cursor-pointer transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Settings */}
        <CollapsibleSection
          title="Map Settings"
          storageKey="settings"
          summary={`${mgrsTL} · 1:${scale} · ${width}×${height} mm`}
        >
          <MapSettingsForm
            idPrefix="sidebar"
            mgrsTL={mgrsTL}
            scale={scale}
            width={width}
            height={height}
            onMgrsChange={onMgrsChange}
            onScaleChange={onScaleChange}
            onWidthChange={onWidthChange}
            onHeightChange={onHeightChange}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Basemap Layer"
          storageKey="basemapId"
          summary={BaseMaps[basemapId - 1]?.name ?? `Basemap ${basemapId}`}
        >
          <div className="space-y-2">
            {BaseMaps.map((bm, index) => {
              const id = index + 1;
              const isSelected = basemapId === id;

              return (
                <div
                  key={bm.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => setBasemapId(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setBasemapId(id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/15 border-blue-500 ring-1 ring-blue-500"
                      : "bg-gray-800/50 border-gray-700/50 hover:border-gray-500 hover:bg-gray-800"
                  }`}
                >
                  <img
                    src={`/img/${id}.jpg`}
                    alt={bm.name}
                    className={`w-14 h-14 object-cover rounded shrink-0 border ${
                      isSelected ? "border-blue-400/60" : "border-gray-700"
                    }`}
                  />

                  <div className="flex flex-col justify-center min-w-0">
                    <div
                      className={`text-xs font-mono font-medium truncate ${
                        isSelected
                          ? "text-white font-semibold"
                          : "text-gray-200"
                      }`}
                      title={bm.name}
                    >
                      {bm.name}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-gray-400">Format:</span>

                      {bm.format === "UTM" && (
                        <>
                          <svg
                            className="w-3.5 h-3.5 text-green-500 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            role="img"
                            aria-label="UTM supported"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span className="text-[11px] text-gray-400">
                            {bm.format}
                          </span>
                        </>
                      )}

                      {bm.format === "WebMercator" && (
                        // 4px buffer zone (p-1): default cursor, no row selection.
                        // -my-1 cancels the vertical padding so the row height doesn't change.
                        <>
                          <svg
                            className="w-3 h-3 shrink-0 text-amber-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          <span className="text-[11px] text-gray-400">
                            {bm.format}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* "Learn How" – only for Local Tiles (Popup #2) */}
                  {bm.name === "Local Tiles" && (
                    <div
                      className="ml-auto p-1 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setPopupId(2)}
                        className="cursor-pointer px-2 py-1 rounded text-[11px] font-medium text-blue-400 border border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                      >
                        Learn How
                      </button>
                    </div>
                  )}

                  {bm.name === "Satellite" && (
                    <div
                      className="ml-auto p-1 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setPopupId(1)}
                        className="cursor-pointer px-2 py-1 rounded text-[11px] font-medium text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  )}

                  {/* "Details" – for ArcGIS World Basemap (Popup #3) */}
                  {bm.name === "ArcGIS World Basemap" && (
                    <div
                      className="ml-auto p-1 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setPopupId(3)}
                        className="cursor-pointer px-2 py-1 rounded text-[11px] font-medium text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  )}

                  {isSelected && (
                    <div
                      className={`shrink-0 mr-1 flex items-center justify-center ${
                        bm.name === "Satellite" ? "ml-auto" : ""
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleSection>

        {/* SVG Position Shift Controller */}
        <CollapsibleSection
          title="SVG Position Shift"
          storageKey="shift"
          summary={
            shiftX !== 0 || shiftY !== 0 || rotation !== 0
              ? `ΔX: ${shiftX > 0 ? `+${shiftX}` : shiftX}m · ΔY: ${shiftY > 0 ? `+${shiftY}` : shiftY}m · Rot: ${rotation > 0 ? `+${rotation}` : rotation}°`
              : "0m · 0m · 0°"
          }
        >
          <SvgShiftController
            mgrsTL={mgrsTL}
            shiftX={shiftX}
            shiftY={shiftY}
            shiftEnabled={shiftEnabled}
            rotation={rotation}
            onShiftChange={onShiftChange}
            onResetShift={onResetShift}
            onRotationChange={onRotationChange}
          />
        </CollapsibleSection>

        {/* SVG Overlay Opacity + Background */}
        <CollapsibleSection
          title="SVG Overlay"
          storageKey="svg_overlay"
          summary={`SVG: ${svgOpacity}% · BG: ${bgOpacity}% ${bgColor}`}
        >
          <div className="space-y-2">
            <OpacityControl
              id="svg-opacity-slider"
              label="SVG opacity"
              value={svgOpacity}
              onChange={onSvgOpacityChange}
            />

            <OpacityControl
              id="bg-opacity-slider"
              label="BG opacity"
              value={bgOpacity}
              onChange={onBgOpacityChange}
            />

            <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex items-center justify-between gap-2">
              <label
                htmlFor="bg-color-picker"
                className="text-xs text-gray-300 w-36 shrink-0"
              >
                BG color for overlay
              </label>
              <label
                htmlFor="bg-color-picker"
                className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 cursor-pointer transition-colors"
              >
                <span
                  className="w-4 h-4 rounded border border-gray-600 shrink-0"
                  style={{ backgroundColor: bgColor }}
                />
                <span className="text-xs text-gray-300 font-mono max-w-[80px] truncate">
                  {bgColor.toUpperCase()}
                </span>
              </label>
              <input
                id="bg-color-picker"
                type="color"
                value={bgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="sr-only"
              />
            </div>
          </div>
        </CollapsibleSection>

        {isReady && result && (
          <>
            {/* Layer Colors */}
            <CollapsibleSection
              title={`Layer Label Background Colors (${result.stats.overlayNames.length})`}
              storageKey="layers"
            >
              {result.stats.overlayNames.length > 0 ? (
                <div className="space-y-2">
                  {result.stats.overlayNames.map((layerName) => {
                    const currentColor =
                      layerColors[layerName] ||
                      DEFAULT_LAYER_COLORS[layerName] ||
                      "#92B4EC";
                    return (
                      <div
                        key={layerName}
                        className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex items-center justify-between gap-3"
                      >
                        <span
                          className="text-xs font-mono font-medium text-gray-200 truncate flex-1"
                          title={layerName}
                        >
                          {layerName}
                        </span>
                        <CustomColorDropdown
                          value={currentColor}
                          palette={palette}
                          onChange={(newColor) =>
                            onLayerColorChange(layerName, newColor)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No layers detected</p>
              )}
            </CollapsibleSection>

            {/* Line Type Colors */}
            <CollapsibleSection
              title={`Line Types (${(Object.keys(typesOfLines) as LineType[]).length})`}
              storageKey="line-types"
            >
              <div className="space-y-2">
                {(
                  Object.entries(typesOfLines) as [
                    LineType,
                    { color: string },
                  ][]
                ).map(([type, defaults]) => {
                  const override = lineOverrides.lines[type] ?? {};
                  const currentColor = override.color ?? defaults.color;
                  const showOutline = override.showOutline ?? true;
                  return (
                    <div
                      key={type}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs font-mono font-medium text-gray-200 truncate flex-1"
                          title={type}
                        >
                          {type}
                        </span>
                        <CustomColorDropdown
                          value={
                            currentColor.startsWith("#")
                              ? currentColor
                              : defaults.color
                          }
                          palette={palette}
                          onChange={(newColor) =>
                            onLineTypeColorChange(type, newColor)
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showOutline}
                          onChange={(e) =>
                            onLineTypeOutlineChange(type, e.target.checked)
                          }
                          className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-xs text-gray-400">
                          Show semi-transparent outline
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            {/* Area Type Colors */}
            <CollapsibleSection
              title={`Area Types (${(Object.keys(typesOfAreas) as AreaType[]).length})`}
              storageKey="area-types"
            >
              <div className="space-y-2">
                {(
                  Object.entries(typesOfAreas) as [
                    AreaType,
                    { color: string },
                  ][]
                ).map(([type, defaults]) => {
                  const override = lineOverrides.areas[type] ?? {};
                  const currentColor = override.color ?? defaults.color;
                  const showOutline = override.showOutline ?? true;
                  return (
                    <div
                      key={type}
                      className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs font-mono font-medium text-gray-200 truncate flex-1"
                          title={type}
                        >
                          {type}
                        </span>
                        <CustomColorDropdown
                          value={
                            currentColor.startsWith("#")
                              ? currentColor
                              : defaults.color
                          }
                          palette={palette}
                          onChange={(newColor) =>
                            onAreaTypeColorChange(type, newColor)
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showOutline}
                          onChange={(e) =>
                            onAreaTypeOutlineChange(type, e.target.checked)
                          }
                          className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                        />
                        <span className="text-xs text-gray-400">
                          Show semi-transparent outline
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            {/* Color Palette */}
            <CollapsibleSection
              title={`Color Palette (${palette.length})`}
              storageKey="palette"
            >
              <PaletteManager
                palette={palette}
                onAdd={onPaletteAdd}
                onChange={onPaletteChange}
                onDelete={onPaletteDelete}
                onReset={onPaletteReset}
              />
            </CollapsibleSection>

            {/* Console Log */}
            <CollapsibleSection
              title="Generation Log"
              storageKey="log"
              defaultOpen={false}
            >
              <div className="overflow-auto bg-black rounded-lg p-3 border border-gray-800 font-mono text-[13px] leading-relaxed text-gray-400 whitespace-pre-wrap max-h-64">
                {`========================================\nMap: ${result.stats.format} (${result.stats.widthMm}mm × ${result.stats.heightMm}mm)\nInput CSV: ${csvFilename || "unknown"}\nOutput SVG: ${result.filename}\n- Top-Left MGRS: ${result.stats.mgrsTL}\n- Points in window: ${result.stats.pointsInWindow}\n- Overlapping elements: ${result.stats.overlapping}\n- Custom mapped icons: ${result.stats.customIconCount}\n- CSV lines rendered: ${result.stats.linesCount}\n- Overlay names: \n    ${result.stats.overlayNames.join("\n    ")}\n\n========================================\n${result.stats.missedIcons.length > 0 ? "Missing icons (" + result.stats.missedIcons.length + "):\n  - " + result.stats.missedIcons.join("\n  - ") : "All icons successfully mapped."}`}
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>

      {/* Overlay Popup Modal */}
      {popupId > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setPopupId(0)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
              <h3 className="font-semibold text-base text-white">
                {popupId === 1 && (
                  <span className="text-amber-400 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    WebMercator Projection Notice
                  </span>
                )}
                {popupId === 2 && (
                  <span className="text-blue-400 flex items-center gap-2">
                    Local Offline Tiles Guide
                  </span>
                )}
                {popupId === 3 && (
                  <span className="text-emerald-400 flex items-center gap-2">
                    ArcGIS Basemap Information
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setPopupId(0)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Scrollable Content with formatted text & images */}
            <div className="p-5 overflow-y-auto space-y-4 text-sm leading-relaxed text-gray-300">
              {popupId === 1 && (
                <>
                  <p className="text-gray-200">
                    Satellite imagery uses{" "}
                    <strong className="text-amber-300">
                      WebMercator (EPSG:3857)
                    </strong>{" "}
                    projection. Tactical grids and SVG military symbols use{" "}
                    <strong className="text-white">UTM</strong> projection.
                  </p>
                  <img
                    src="/img/2.jpg"
                    alt="Satellite WebMercator preview"
                    className="w-full h-48 object-cover rounded-lg border border-gray-700 shadow-md"
                  />
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 leading-relaxed">
                    <strong>Warning:</strong> Slight latitude-dependent scaling
                    and coordinate alignment differences may occur when
                    overlaying UTM coordinates onto WebMercator tiles.
                  </div>
                </>
              )}

              {popupId === 2 && (
                <>
                  <p className="text-gray-200">
                    How to configure and run local offline tile servers:
                  </p>
                  <img
                    src="/img/3.jpg"
                    alt="Local Tiles Setup preview"
                    className="w-full h-48 object-cover rounded-lg border border-gray-700 shadow-md"
                  />
                  <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 font-mono text-xs text-blue-300 overflow-x-auto">
                    http://localhost:8080/tiles/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-400">
                    <li>
                      Store downloaded tile caches in the local tile server
                      folder.
                    </li>
                    <li>Supports standard XYZ, TMS, or MBTiles servers.</li>
                    <li>Ensure CORS headers allow localhost access.</li>
                  </ul>
                </>
              )}

              {popupId === 3 && (
                <>
                  <p className="text-gray-200">
                    ArcGIS World Basemap vector tiles:
                  </p>
                  <img
                    src="/img/1.jpg"
                    alt="ArcGIS Basemap preview"
                    className="w-full h-48 object-cover rounded-lg border border-gray-700 shadow-md"
                  />
                  <p className="text-xs text-gray-400">
                    High contrast tactical vector tiles with native UTM
                    projection matching military grid reference standards.
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-800 flex justify-end shrink-0 bg-gray-900/50">
              <button
                type="button"
                onClick={() => setPopupId(0)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
