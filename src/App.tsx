import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { MapSettingsForm } from "./components/MapSettingsForm";
import { DEFAULT_LAYER_COLORS, MapSidebar } from "./components/MapSidebar";
import { SvgPreview } from "./components/SvgPreview";
//import { SvgPreview } from "./components/SvgPreview";
import { SvgMapOverlay } from "./components/SvgPreview2";
import {
  type GenerateResult,
  generateSVGFromCSV,
  STARTING_MGRS_TL,
} from "./generator";
import type { MapFormatConfig } from "./lib/geo";
import type { AreaType, LineOverrides, LineType } from "./lib/lines";
import {
  DEFAULT_PALETTE,
  loadPalette,
  type PaletteColor,
  savePalette,
} from "./lib/palette";

type State =
  | { status: "idle" }
  | { status: "loading"; result?: GenerateResult }
  | { status: "done"; result: GenerateResult }
  | { status: "error"; message: string };

const STORAGE_KEYS = {
  SCALE: "delta2corel_Scale",
  WIDTH: "delta2corel_Width",
  HEIGHT: "delta2corel_Height",
  MGRS: "delta2corel_MGRS",
  LAYER_COLORS: "delta2corel_LayerColors",
  LINE_OVERRIDES: "delta2corel_LineOverrides",
  SHIFT_X: "delta2corel_ShiftX",
  SHIFT_Y: "delta2corel_ShiftY",
  SHIFT_ENABLED: "delta2corel_ShiftEnabled",
} as const;

// Constants and Dropdown moved to MapSidebar.tsx and CustomColorDropdown.tsx

const DEFAULT_SCALE = 25000;
const DEFAULT_WIDTH = "1810";
const DEFAULT_HEIGHT = "1810";

function getInitialScale(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SCALE);
    if (saved) {
      const parsed = Number(saved.replace(/^1:/, ""));
      if ([10000, 15000, 25000, 50000].includes(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read delta2corel_Scale from localStorage", e);
  }
  return DEFAULT_SCALE;
}

function getInitialWidth(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.WIDTH);
    if (saved !== null && saved.trim() !== "") {
      return saved;
    }
  } catch (e) {
    console.error("Failed to read delta2corel_Width from localStorage", e);
  }
  return DEFAULT_WIDTH;
}

function getInitialHeight(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HEIGHT);
    if (saved !== null && saved.trim() !== "") {
      return saved;
    }
  } catch (e) {
    console.error("Failed to read delta2corel_Height from localStorage", e);
  }
  return DEFAULT_HEIGHT;
}

function getInitialMgrs(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MGRS);
    if (saved !== null && saved.trim() !== "") {
      return saved;
    }
  } catch (e) {
    console.error("Failed to read delta2corel_MGRS from localStorage", e);
  }
  return STARTING_MGRS_TL;
}

function getInitialLayerColors(): Record<string, string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LAYER_COLORS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === "object" && parsed !== null) {
        return { ...DEFAULT_LAYER_COLORS, ...parsed };
      }
    }
  } catch (e) {
    console.error(
      "Failed to read delta2corel_LayerColors from localStorage",
      e,
    );
  }
  return DEFAULT_LAYER_COLORS;
}

function getInitialLineOverrides(): LineOverrides {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LINE_OVERRIDES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed === "object" && parsed !== null) {
        return {
          lines: parsed.lines ?? {},
          areas: parsed.areas ?? {},
        };
      }
    }
  } catch (e) {
    console.error(
      "Failed to read delta2corel_LineOverrides from localStorage",
      e,
    );
  }
  return { lines: {}, areas: {} };
}

function getInitialShiftX(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFT_X);
    if (saved !== null) {
      const val = Number(saved);
      if (!Number.isNaN(val)) return val;
    }
  } catch (e) {
    console.error("Failed to read delta2corel_ShiftX from localStorage", e);
  }
  return 0;
}

function getInitialShiftY(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFT_Y);
    if (saved !== null) {
      const val = Number(saved);
      if (!Number.isNaN(val)) return val;
    }
  } catch (e) {
    console.error("Failed to read delta2corel_ShiftY from localStorage", e);
  }
  return 0;
}

function getInitialShiftEnabled(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SHIFT_ENABLED);
    if (saved !== null) {
      return saved === "1" || saved === "true";
    }
  } catch (e) {
    console.error(
      "Failed to read delta2corel_ShiftEnabled from localStorage",
      e,
    );
  }
  return true;
}

// CustomColorDropdown moved to src/components/CustomColorDropdown.tsx

export default function App() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [mgrsTL, setMgrsTL] = useState<string>(getInitialMgrs);
  const [scale, setScale] = useState<number>(getInitialScale);
  const [width, setWidth] = useState<string>(getInitialWidth);
  const [height, setHeight] = useState<string>(getInitialHeight);
  const [shiftX, setShiftX] = useState<number>(getInitialShiftX);
  const [shiftY, setShiftY] = useState<number>(getInitialShiftY);
  const [shiftEnabled, setShiftEnabled] = useState<boolean>(
    getInitialShiftEnabled,
  );
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const [layerColors, setLayerColors] = useState<Record<string, string>>(
    getInitialLayerColors,
  );
  const [lineOverrides, setLineOverrides] = useState<LineOverrides>(
    getInitialLineOverrides,
  );
  const [palette, setPalette] = useState<PaletteColor[]>(loadPalette);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [useRealMap, setUseRealMap] = useState(1);

  const handleShiftChange = (x: number, y: number, enabled = true) => {
    setShiftX(x);
    setShiftY(y);
    setShiftEnabled(enabled);
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFT_X, String(x));
      localStorage.setItem(STORAGE_KEYS.SHIFT_Y, String(y));
      localStorage.setItem(STORAGE_KEYS.SHIFT_ENABLED, enabled ? "1" : "0");
    } catch (e) {
      console.error("Failed to save shift to localStorage", e);
    }
  };

  const handleResetShift = () => {
    setShiftX(0);
    setShiftY(0);
    setShiftEnabled(false);
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFT_X, "0");
      localStorage.setItem(STORAGE_KEYS.SHIFT_Y, "0");
      localStorage.setItem(STORAGE_KEYS.SHIFT_ENABLED, "0");
    } catch (e) {
      console.error("Failed to save shift reset to localStorage", e);
    }
  };

  const generateMap = useCallback(
    async (
      csv: string,
      mgrsVal: string,
      scaleVal: number,
      widthVal: string,
      heightVal: string,
      colorsVal: Record<string, string>,
      lineOverridesVal: LineOverrides,
    ) => {
      setState((prev) => ({
        status: "loading",
        result:
          prev.status === "done"
            ? prev.result
            : prev.status === "loading"
              ? prev.result
              : undefined,
      }));
      try {
        const parsedW = Number(widthVal);
        const parsedH = Number(heightVal);
        const widthMm = !Number.isNaN(parsedW) && parsedW > 0 ? parsedW : 1810;
        const heightMm = !Number.isNaN(parsedH) && parsedH > 0 ? parsedH : 1810;

        const formatConfig: MapFormatConfig = {
          name: `1:${scaleVal}`,
          scale: scaleVal,
          widthMm,
          heightMm,
        };

        const result = await generateSVGFromCSV(
          csv,
          mgrsVal,
          formatConfig,
          colorsVal,
          lineOverridesVal,
        );
        setState({ status: "done", result });
      } catch (err) {
        setState({ status: "error", message: String(err) });
      }
    },
    [],
  );

  const processFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        setCsvContent(text);
        setCsvFilename(file.name);
        await generateMap(
          text,
          mgrsTL,
          scale,
          width,
          height,
          layerColors,
          lineOverrides,
        );
      } catch (err) {
        setState({ status: "error", message: String(err) });
      }
    },
    [generateMap, mgrsTL, scale, width, height, layerColors, lineOverrides],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) processFile(accepted[0]);
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".csv", ".txt"] },
    multiple: false,
  });

  const handleScaleChange = (newScale: number) => {
    setScale(newScale);
    try {
      localStorage.setItem(STORAGE_KEYS.SCALE, String(newScale));
    } catch (e) {
      console.error("Failed to save delta2corel_Scale", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        newScale,
        width,
        height,
        layerColors,
        lineOverrides,
      );
    }
  };

  const handleWidthChange = (newWidth: string) => {
    setWidth(newWidth);
    try {
      localStorage.setItem(STORAGE_KEYS.WIDTH, newWidth);
    } catch (e) {
      console.error("Failed to save delta2corel_Width", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        newWidth,
        height,
        layerColors,
        lineOverrides,
      );
    }
  };

  const handleHeightChange = (newHeight: string) => {
    setHeight(newHeight);
    try {
      localStorage.setItem(STORAGE_KEYS.HEIGHT, newHeight);
    } catch (e) {
      console.error("Failed to save delta2corel_Height", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        newHeight,
        layerColors,
        lineOverrides,
      );
    }
  };

  const handleMgrsChange = (newMgrs: string) => {
    setMgrsTL(newMgrs);
    try {
      localStorage.setItem(STORAGE_KEYS.MGRS, newMgrs);
    } catch (e) {
      console.error("Failed to save delta2corel_MGRS", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        newMgrs,
        scale,
        width,
        height,
        layerColors,
        lineOverrides,
      );
    }
  };

  const handleLayerColorChange = (layerName: string, newColor: string) => {
    const updatedColors = { ...layerColors, [layerName]: newColor };
    setLayerColors(updatedColors);
    try {
      localStorage.setItem(
        STORAGE_KEYS.LAYER_COLORS,
        JSON.stringify(updatedColors),
      );
    } catch (e) {
      console.error("Failed to save delta2corel_LayerColors", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        height,
        updatedColors,
        lineOverrides,
      );
    }
  };

  const handleLineTypeColorChange = (type: LineType, newColor: string) => {
    const updated: LineOverrides = {
      ...lineOverrides,
      lines: {
        ...lineOverrides.lines,
        [type]: { ...lineOverrides.lines[type], color: newColor },
      },
    };
    setLineOverrides(updated);
    try {
      localStorage.setItem(
        STORAGE_KEYS.LINE_OVERRIDES,
        JSON.stringify(updated),
      );
    } catch (e) {
      console.error("Failed to save delta2corel_LineOverrides", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        height,
        layerColors,
        updated,
      );
    }
  };

  const handleLineTypeOutlineChange = (type: LineType, show: boolean) => {
    const updated: LineOverrides = {
      ...lineOverrides,
      lines: {
        ...lineOverrides.lines,
        [type]: { ...lineOverrides.lines[type], showOutline: show },
      },
    };
    setLineOverrides(updated);
    try {
      localStorage.setItem(
        STORAGE_KEYS.LINE_OVERRIDES,
        JSON.stringify(updated),
      );
    } catch (e) {
      console.error("Failed to save delta2corel_LineOverrides", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        height,
        layerColors,
        updated,
      );
    }
  };

  const handleAreaTypeColorChange = (type: AreaType, newColor: string) => {
    const updated: LineOverrides = {
      ...lineOverrides,
      areas: {
        ...lineOverrides.areas,
        [type]: { ...lineOverrides.areas[type], color: newColor },
      },
    };
    setLineOverrides(updated);
    try {
      localStorage.setItem(
        STORAGE_KEYS.LINE_OVERRIDES,
        JSON.stringify(updated),
      );
    } catch (e) {
      console.error("Failed to save delta2corel_LineOverrides", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        height,
        layerColors,
        updated,
      );
    }
  };

  const handleAreaTypeOutlineChange = (type: AreaType, show: boolean) => {
    const updated: LineOverrides = {
      ...lineOverrides,
      areas: {
        ...lineOverrides.areas,
        [type]: { ...lineOverrides.areas[type], showOutline: show },
      },
    };
    setLineOverrides(updated);
    try {
      localStorage.setItem(
        STORAGE_KEYS.LINE_OVERRIDES,
        JSON.stringify(updated),
      );
    } catch (e) {
      console.error("Failed to save delta2corel_LineOverrides", e);
    }
    if (csvContent) {
      generateMap(
        csvContent,
        mgrsTL,
        scale,
        width,
        height,
        layerColors,
        updated,
      );
    }
  };

  // ---- Palette management ----
  const updatePalette = (next: PaletteColor[]) => {
    setPalette(next);
    savePalette(next);
  };

  const handlePaletteAdd = () =>
    updatePalette([
      ...palette,
      { id: crypto.randomUUID(), name: "New color", value: "#92b4ec" },
    ]);

  const handlePaletteChange = (
    id: string,
    patch: Partial<Omit<PaletteColor, "id">>,
  ) =>
    updatePalette(palette.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const handlePaletteDelete = (id: string) =>
    updatePalette(palette.filter((c) => c.id !== id));

  const handlePaletteReset = () => updatePalette(DEFAULT_PALETTE);

  const download = () => {
    if (state.status !== "done") return;
    const blob = new Blob([state.result.svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setCsvContent(null);
    setCsvFilename(null);
    setState({ status: "idle" });
  };

  useEffect(() => {
    const isDone = state.status === "done";
    const els = [document.documentElement, document.body];
    els.forEach((el) => {
      el.style.overflow = isDone ? "hidden" : "";
      el.style.height = isDone ? "100%" : "";
      el.style.width = isDone ? "100%" : "";
    });
    return () => {
      els.forEach((el) => {
        el.style.overflow = "";
        el.style.height = "";
        el.style.width = "";
      });
    };
  }, [state.status]);

  const handleApplyShiftedMgrs = (newMgrs: string) => {
    handleMgrsChange(newMgrs);
    setShiftX(0);
    setShiftY(0);
    setShiftEnabled(false);
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFT_X, "0");
      localStorage.setItem(STORAGE_KEYS.SHIFT_Y, "0");
      localStorage.setItem(STORAGE_KEYS.SHIFT_ENABLED, "0");
    } catch (e) {
      console.error("Failed to reset shift on apply", e);
    }
  };

  if (state.status === "done" || (state.status === "loading" && csvContent)) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-gray-600 relative">
        {/* Map (SvgPreview takes full width/height) */}
        {(state.status === "done" || state.status === "loading") &&
          state.result &&
          (useRealMap ? (
            <SvgMapOverlay
              svgContent={state.result.svgContent}
              topLeftMgrs={mgrsTL}
              scaleDenominator={scale}
              widthMm={Number(width)}
              heightMm={Number(height)}
              useRealMap={useRealMap}
              shiftX={shiftEnabled ? shiftX : 0}
              shiftY={shiftEnabled ? shiftY : 0}
            />
          ) : (
            <SvgPreview
              svgContent={state.result.svgContent}
              className="w-full h-full border-none rounded-none"
            />
          ))}

        {/* Settings Button */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-4 left-4 z-20 bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-white p-2.5 rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-sm font-semibold">Settings</span>
        </button>

        {/* Sidebar overlay */}
        {isSidebarOpen && (
          <MapSidebar
            status={state.status}
            result={
              state.status === "loading"
                ? state.result
                : state.status === "done"
                  ? state.result
                  : undefined
            }
            csvFilename={csvFilename}
            mgrsTL={mgrsTL}
            scale={scale}
            width={width}
            height={height}
            layerColors={layerColors}
            lineOverrides={lineOverrides}
            palette={palette}
            shiftX={shiftX}
            shiftY={shiftY}
            shiftEnabled={shiftEnabled}
            onClose={() => setIsSidebarOpen(false)}
            onMgrsChange={handleMgrsChange}
            onScaleChange={handleScaleChange}
            onWidthChange={handleWidthChange}
            onHeightChange={handleHeightChange}
            onLayerColorChange={handleLayerColorChange}
            onLineTypeColorChange={handleLineTypeColorChange}
            onLineTypeOutlineChange={handleLineTypeOutlineChange}
            onAreaTypeColorChange={handleAreaTypeColorChange}
            onAreaTypeOutlineChange={handleAreaTypeOutlineChange}
            onPaletteAdd={handlePaletteAdd}
            onPaletteChange={handlePaletteChange}
            onPaletteDelete={handlePaletteDelete}
            onPaletteReset={handlePaletteReset}
            useRealMap={useRealMap}
            onUseRealMapChange={setUseRealMap}
            onShiftChange={handleShiftChange}
            onResetShift={handleResetShift}
            onApplyShiftedMgrs={handleApplyShiftedMgrs}
          />
        )}

        {/* Start Over Button (bottom left) */}
        <div className="absolute bottom-4 left-4 z-20">
          <button
            type="button"
            onClick={reset}
            className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-gray-200 font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-colors cursor-pointer text-sm"
          >
            ↩ Start Over
          </button>
        </div>

        {/* Download Button (bottom right, shrinking width) */}
        <div className="absolute bottom-4 right-4 z-20">
          {(state.status === "done" || state.status === "loading") &&
            state.result && (
              <button
                type="button"
                onClick={download}
                className="bg-blue-600 backdrop-blur-sm hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-colors cursor-pointer text-sm flex flex-col items-center"
              >
                <span>⬇ Download SVG</span>
                <span className="text-xs font-normal opacity-70 mt-0.5">
                  {state.result.filename}
                </span>
              </button>
            )}
        </div>

        {/* Loading Overlay */}
        {state.status === "loading" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
            <div className="bg-gray-900 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-gray-800">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-300 font-medium text-sm">Updating Map…</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for idle/error/loading before initial map is done
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-4 py-8">
      {/* Top Header & Settings Row (1200px) */}
      <div className="w-full max-w-[1200px] mb-8 flex flex-col md:flex-row items-start justify-between gap-6">
        <div className="text-left shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Delta<span className="text-blue-400">2</span>Corel
          </h1>
          <p className="mt-1.5 text-gray-400 text-sm">
            CSV → SVG map generator
          </p>
        </div>

        {/* Right Side: Control Panel */}
        <div className="p-5 max-w-md w-full">
          <MapSettingsForm
            idPrefix="landing"
            mgrsTL={mgrsTL}
            scale={scale}
            width={width}
            height={height}
            onMgrsChange={handleMgrsChange}
            onScaleChange={handleScaleChange}
            onWidthChange={handleWidthChange}
            onHeightChange={handleHeightChange}
            padding={"p-5"}
          />
        </div>
      </div>

      {/* Drop zone (Full Width 1200px & Full Height) */}
      {(state.status === "idle" || state.status === "error") && (
        <div
          {...getRootProps()}
          className={`w-full max-w-[1200px] min-h-[420px] flex-1 border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors
            ${isDragActive ? "border-blue-400 bg-blue-950/30" : "border-gray-700 hover:border-blue-600 bg-gray-900"}`}
        >
          <input {...getInputProps()} />
          <svg
            className={`w-16 h-16 mb-4 ${isDragActive ? "text-blue-400" : "text-gray-600"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-gray-200 text-lg font-medium">
            {isDragActive ? "Drop the CSV here…" : "Drop CSV file here"}
          </p>
          <p className="text-gray-400 text-sm mt-2">or click to browse</p>
          {state.status === "error" && (
            <p className="mt-4 text-red-400 text-sm text-center">
              {state.message}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {state.status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-24">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Generating SVG…</p>
        </div>
      )}
    </div>
  );
}
