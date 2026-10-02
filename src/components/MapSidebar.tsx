import { useState } from "react";
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
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 mb-3 cursor-pointer group"
      >
        <ChevronIcon open={open} />
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest group-hover:text-gray-200 transition-colors text-left">
          {title}
        </h3>
      </button>
      {open && children}
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
}: MapSidebarProps) {
  const isReady = status === "done" || (status === "loading" && result);

  return (
    <div className="absolute top-0 left-0 h-full w-96 bg-gray-900 border-r border-gray-800 z-30 shadow-2xl flex flex-col">
      <div className="flex justify-between items-center p-5 border-b border-gray-800 shrink-0">
        <h2 className="text-white font-bold text-lg tracking-tight">
          Map Settings
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

        {isReady && result && (
          <>
            {/* Layer Colors */}
            <CollapsibleSection
              title={`Layer Label Background Colors (${result.stats.overlayNames.length})`}
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
            <CollapsibleSection title={`Color Palette (${palette.length})`}>
              <PaletteManager
                palette={palette}
                onAdd={onPaletteAdd}
                onChange={onPaletteChange}
                onDelete={onPaletteDelete}
                onReset={onPaletteReset}
              />
            </CollapsibleSection>

            {/* Console Log */}
            <CollapsibleSection title="Generation Log" defaultOpen={false}>
              <div className="overflow-auto bg-black rounded-lg p-3 border border-gray-800 font-mono text-[13px] leading-relaxed text-gray-400 whitespace-pre-wrap max-h-64">
                {`========================================\nMap: ${result.stats.format} (${result.stats.widthMm}mm × ${result.stats.heightMm}mm)\nInput CSV: ${csvFilename || "unknown"}\nOutput SVG: ${result.filename}\n- Top-Left MGRS: ${result.stats.mgrsTL}\n- Points in window: ${result.stats.pointsInWindow}\n- Overlapping elements: ${result.stats.overlapping}\n- Custom mapped icons: ${result.stats.customIconCount}\n- CSV lines rendered: ${result.stats.linesCount}\n- Overlay names: \n    ${result.stats.overlayNames.join("\n    ")}\n\n========================================\n${result.stats.missedIcons.length > 0 ? "Missing icons (" + result.stats.missedIcons.length + "):\n  - " + result.stats.missedIcons.join("\n  - ") : "All icons successfully mapped."}`}
              </div>
            </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  );
}
