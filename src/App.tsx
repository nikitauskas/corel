import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
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
} as const;

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

export default function App() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [mgrsTL, setMgrsTL] = useState<string>(getInitialMgrs);
  const [scale, setScale] = useState<number>(getInitialScale);
  const [width, setWidth] = useState<string>(getInitialWidth);
  const [height, setHeight] = useState<string>(getInitialHeight);
  const [csvContent, setCsvContent] = useState<string | null>(null);

  const generateMap = useCallback(
    async (
      csv: string,
      mgrsVal: string,
      scaleVal: number,
      widthVal: string,
      heightVal: string,
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

        const result = await generateSVGFromCSV(csv, mgrsVal, formatConfig);
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
        await generateMap(text, mgrsTL, scale, width, height);
      } catch (err) {
        setState({ status: "error", message: String(err) });
      }
    },
    [generateMap, mgrsTL, scale, width, height],
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
      generateMap(csvContent, mgrsTL, newScale, width, height);
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
      generateMap(csvContent, mgrsTL, scale, newWidth, height);
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
      generateMap(csvContent, mgrsTL, scale, width, newHeight);
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
      generateMap(csvContent, newMgrs, scale, width, height);
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
    setState({ status: "idle" });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Delta<span className="text-blue-400">2</span>Corel
        </h1>
        <p className="mt-2 text-gray-400 text-sm">CSV → SVG map generator</p>
      </header>

      {/* Control Panel */}
      <div className="w-full max-w-xl mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div>
          <label
            htmlFor="mgrs-tl"
            className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest"
          >
            Top-Left MGRS
          </label>
          <input
            id="mgrs-tl"
            type="text"
            value={mgrsTL}
            onChange={(e) => handleMgrsChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 37UBP9708043769"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="map-scale"
              className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest"
            >
              Scale
            </label>
            <select
              id="map-scale"
              value={scale}
              onChange={(e) => handleScaleChange(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={10000}>1:10000</option>
              <option value={15000}>1:15000</option>
              <option value={25000}>1:25000</option>
              <option value={50000}>1:50000</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="map-width"
              className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest"
            >
              Width (mm)
            </label>
            <input
              id="map-width"
              type="number"
              value={width}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1810"
              min="1"
            />
          </div>

          <div>
            <label
              htmlFor="map-height"
              className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest"
            >
              Height (mm)
            </label>
            <input
              id="map-height"
              type="number"
              value={height}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1810"
              min="1"
            />
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {(state.status === "idle" || state.status === "error") && (
        <div
          {...getRootProps()}
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors
            ${isDragActive ? "border-blue-400 bg-blue-950/30" : "border-gray-700 hover:border-blue-600 bg-gray-900"}`}
        >
          <input {...getInputProps()} />
          <svg
            className={`w-12 h-12 mb-4 ${isDragActive ? "text-blue-400" : "text-gray-600"}`}
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
          <p className="text-gray-300 font-medium">
            {isDragActive ? "Drop the CSV here…" : "Drop CSV file here"}
          </p>
          <p className="text-gray-500 text-xs mt-1">or click to browse</p>
          {state.status === "error" && (
            <p className="mt-4 text-red-400 text-sm text-center">
              {state.message}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {state.status === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Generating SVG…</p>
        </div>
      )}

      {/* Result */}
      {state.status === "done" && (
        <div className="w-full max-w-2xl flex flex-col gap-6">
          {/* Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">
              ✅ Generated — {state.result.stats.format}
            </h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <StatRow
                label="Points in window"
                value={state.result.stats.pointsInWindow}
              />
              <StatRow
                label="Overlapping"
                value={state.result.stats.overlapping}
              />
              <StatRow
                label="Custom icons"
                value={state.result.stats.customIconCount}
              />
              <StatRow
                label="Lines rendered"
                value={state.result.stats.linesCount}
              />
            </dl>

            {state.result.stats.overlayNames.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Overlays
                </p>
                <ul className="text-sm text-gray-300 space-y-0.5">
                  {state.result.stats.overlayNames.map((n) => (
                    <li key={n} className="font-mono">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.result.stats.missedIcons.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-yellow-500 uppercase tracking-widest mb-1">
                  Missing icons ({state.result.stats.missedIcons.length})
                </p>
                <ul className="text-xs text-yellow-400/80 space-y-0.5 max-h-32 overflow-auto">
                  {state.result.stats.missedIcons.map((n) => (
                    <li key={n} className="font-mono">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* SVG Preview */}
          <div className="bg-white rounded-2xl overflow-auto max-h-[60vh] p-4">
            <div
              // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering generated SVG preview
              dangerouslySetInnerHTML={{ __html: state.result.svgContent }}
              className="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={download}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
            >
              ⬇ Download SVG <br />
              <span className="text-xs font-normal">
                {state.result.filename}
              </span>
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 rounded-xl transition-colors cursor-pointer"
            >
              ↩ Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-white font-mono font-semibold">{value}</dd>
    </>
  );
}
