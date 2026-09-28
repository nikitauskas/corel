import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { SvgPreview } from "./components/SvgPreview";
import {
  type GenerateResult,
  generateSVGFromCSV,
  STARTING_MGRS_TL,
} from "./generator";
import type { MapFormatConfig } from "./lib/geo";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: GenerateResult }
  | { status: "error"; message: string };

const STORAGE_KEYS = {
  SCALE: "delta2corel_Scale",
  WIDTH: "delta2corel_Width",
  HEIGHT: "delta2corel_Height",
  MGRS: "delta2corel_MGRS",
  LAYER_COLORS: "delta2corel_LayerColors",
} as const;

export const LABEL_BG_COLORS = [
  { label: "-", value: "#92B4EC" },
  { label: "1", value: "#FECC00" },
  { label: "2", value: "#834E98" },
  { label: "3", value: "#009846" },
  { label: "4", value: "#A76281" },
  { label: "5", value: "#7690C9" },
  { label: "6", value: "#A8D4AF" },
  { label: "7", value: "#EF7F1A" },
  { label: "8", value: "#F5B2B6" },
  { label: "9", value: "#4682B4" },
  { label: "10", value: "#E5C07B" },
  { label: "11", value: "#B57EDC" },
  { label: "12", value: "#36B5B0" },
  { label: "13", value: "#E06C75" },
] as const;

const DEFAULT_LAYER_COLORS: Record<string, string> = {
  "1bat": "#FECC00",
  "2bat": "#834E98",
  "3bat": "#009846",
  "109": "#A76281",
  "156": "#7690C9",
  "мпб/100": "#A8D4AF",
  "ЗПМ(78)": "#EF7F1A",
  "210": "#F5B2B6",
};

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

interface CustomColorDropdownProps {
  value: string;
  onChange: (color: string) => void;
}

function CustomColorDropdown({ value, onChange }: CustomColorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeOption =
    LABEL_BG_COLORS.find(
      (c) => c.value.toLowerCase() === value.toLowerCase(),
    ) || LABEL_BG_COLORS[0];

  return (
    <div className="relative inline-block text-left shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs font-mono text-gray-100 hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors"
      >
        <span>{activeOption.label}</span>
        <span
          className="w-4 h-4 rounded border border-gray-600 shadow-sm shrink-0 inline-block"
          style={{ backgroundColor: activeOption.value }}
        />
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 mt-1 w-20 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 py-1 max-h-56 overflow-y-auto">
            {LABEL_BG_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(c.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer hover:bg-gray-800 ${
                  c.value.toLowerCase() === value.toLowerCase()
                    ? "text-blue-400 font-semibold bg-blue-950/40"
                    : "text-gray-200"
                }`}
              >
                <span>{c.label}</span>
                <span
                  className="w-4 h-4 rounded border border-gray-600 shadow-sm shrink-0 inline-block"
                  style={{ backgroundColor: c.value }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [mgrsTL, setMgrsTL] = useState<string>(getInitialMgrs);
  const [scale, setScale] = useState<number>(getInitialScale);
  const [width, setWidth] = useState<string>(getInitialWidth);
  const [height, setHeight] = useState<string>(getInitialHeight);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [csvFilename, setCsvFilename] = useState<string | null>(null);
  const [layerColors, setLayerColors] = useState<Record<string, string>>(
    getInitialLayerColors,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const generateMap = useCallback(
    async (
      csv: string,
      mgrsVal: string,
      scaleVal: number,
      widthVal: string,
      heightVal: string,
      colorsVal: Record<string, string>,
    ) => {
      setState({ status: "loading" });
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
        await generateMap(text, mgrsTL, scale, width, height, layerColors);
      } catch (err) {
        setState({ status: "error", message: String(err) });
      }
    },
    [generateMap, mgrsTL, scale, width, height, layerColors],
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
      generateMap(csvContent, mgrsTL, newScale, width, height, layerColors);
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
      generateMap(csvContent, mgrsTL, scale, newWidth, height, layerColors);
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
      generateMap(csvContent, mgrsTL, scale, width, newHeight, layerColors);
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
      generateMap(csvContent, newMgrs, scale, width, height, layerColors);
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
      generateMap(csvContent, mgrsTL, scale, width, height, updatedColors);
    }
  };

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

  if (state.status === "done" || (state.status === "loading" && csvContent)) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-gray-900 relative">
        {/* Map (SvgPreview takes full width/height) */}
        {state.status === "done" && (
          <SvgPreview svgContent={state.result.svgContent} className="w-full h-full border-none rounded-none" />
        )}
        
        {/* Settings Button */}
        <button 
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="absolute top-4 left-4 z-20 bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-white p-2.5 rounded-lg shadow-lg transition-colors flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-sm font-semibold">Settings</span>
        </button>
        
        {/* Sidebar overlay */}
        {isSidebarOpen && (
          <div className="absolute top-0 left-0 h-full w-96 bg-gray-900 border-r border-gray-800 z-30 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-gray-800 shrink-0">
              <h2 className="text-white font-bold text-lg tracking-tight">Map Settings</h2>
              <button type="button" onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-1 cursor-pointer transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Settings */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="mgrs-tl" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest">Top-Left MGRS</label>
                  <input id="mgrs-tl" type="text" value={mgrsTL} onChange={(e) => handleMgrsChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 37UBP9708043769" />
                </div>
                <div>
                  <label htmlFor="map-scale" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest">Scale</label>
                  <select id="map-scale" value={scale} onChange={(e) => handleScaleChange(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value={10000}>1:10000</option>
                    <option value={15000}>1:15000</option>
                    <option value={25000}>1:25000</option>
                    <option value={50000}>1:50000</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="map-width" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest">Width (mm)</label>
                    <input id="map-width" type="number" value={width} onChange={(e) => handleWidthChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1810" min="1" />
                  </div>
                  <div>
                    <label htmlFor="map-height" className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest">Height (mm)</label>
                    <input id="map-height" type="number" value={height} onChange={(e) => handleHeightChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1810" min="1" />
                  </div>
                </div>
              </div>

              {/* Layer Colors */}
              {state.status === "done" && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Layer Label Background Colors ({state.result.stats.overlayNames.length})</h3>
                  {state.result.stats.overlayNames.length > 0 ? (
                    <div className="space-y-2">
                      {state.result.stats.overlayNames.map((layerName) => {
                        const currentColor = layerColors[layerName] || DEFAULT_LAYER_COLORS[layerName] || "#92B4EC";
                        return (
                          <div key={layerName} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-mono font-medium text-gray-200 truncate flex-1" title={layerName}>{layerName}</span>
                            <CustomColorDropdown value={currentColor} onChange={(newColor) => handleLayerColorChange(layerName, newColor)} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No layers detected</p>
                  )}
                </div>
              )}

              {/* Console Log */}
              {state.status === "done" && (
                <div className="flex flex-col shrink-0">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Generation Log</h3>
                  <div className="overflow-auto bg-black rounded-lg p-3 border border-gray-800 font-mono text-[10px] leading-relaxed text-gray-400 whitespace-pre-wrap max-h-64">
{`========================================
Map: ${state.result.stats.format} (${state.result.stats.widthMm}mm × ${state.result.stats.heightMm}mm)
Input CSV: ${csvFilename || "unknown"}
Output SVG: ${state.result.filename}
- Top-Left MGRS: ${state.result.stats.mgrsTL}
- Points in window: ${state.result.stats.pointsInWindow}
- Overlapping elements: ${state.result.stats.overlapping}
- Custom mapped icons: ${state.result.stats.customIconCount}
- CSV lines rendered: ${state.result.stats.linesCount}
- Overlay names: 
    ${state.result.stats.overlayNames.join("\n    ")}

========================================
${state.result.stats.missedIcons.length > 0 ? "Missing icons (" + state.result.stats.missedIcons.length + "):\n  - " + state.result.stats.missedIcons.join("\n  - ") : "All icons successfully mapped."}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Download Button (bottom right, shrinking width) */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col sm:flex-row gap-2 items-end">
          <button type="button" onClick={reset} className="bg-gray-900/90 backdrop-blur-sm border border-gray-700 hover:bg-gray-800 text-gray-200 font-semibold py-2.5 px-4 rounded-xl shadow-lg transition-colors cursor-pointer text-sm">
            ↩ Start Over
          </button>
          <button type="button" onClick={download} className="bg-blue-600/90 backdrop-blur-sm hover:bg-blue-500 text-white font-semibold py-2.5 px-5 rounded-xl shadow-lg transition-colors cursor-pointer text-sm whitespace-nowrap">
            ⬇ Download SVG
          </button>
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
      <div className="w-full max-w-[1200px] mb-8 flex flex-col items-start justify-center">
        <div className="text-left shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-white">Delta<span className="text-blue-400">2</span>Corel</h1>
          <p className="mt-1.5 text-gray-400 text-sm">CSV → SVG map generator</p>
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
          <svg className={`w-16 h-16 mb-4 ${isDragActive ? "text-blue-400" : "text-gray-600"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          <p className="text-gray-200 text-lg font-medium">{isDragActive ? "Drop the CSV here…" : "Drop CSV file here"}</p>
          <p className="text-gray-400 text-sm mt-2">or click to browse</p>
          {state.status === "error" && <p className="mt-4 text-red-400 text-sm text-center">{state.message}</p>}
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
