import { useState } from "react";
import { computeShiftedMgrs } from "../lib/overlay-bounds";

interface SvgShiftControllerProps {
  mgrsTL: string;
  shiftX: number;
  shiftY: number;
  shiftEnabled: boolean;
  onShiftChange: (x: number, y: number, enabled?: boolean) => void;
  onResetShift: () => void;
  onApplyShiftedMgrs: (newMgrs: string) => void;
}

export function SvgShiftController({
  mgrsTL,
  shiftX,
  shiftY,
  shiftEnabled,
  onShiftChange,
  onResetShift,
  onApplyShiftedMgrs,
}: SvgShiftControllerProps) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  // Compute new top-left MGRS based on current base MGRS and active shift
  const effectiveX = shiftEnabled ? shiftX : 0;
  const effectiveY = shiftEnabled ? shiftY : 0;
  const shiftedMgrs = computeShiftedMgrs(mgrsTL, effectiveX, effectiveY);

  const hasShift = shiftX !== 0 || shiftY !== 0;

  // Handle D-pad directional clicks
  const handleNudge = (dx: number, dy: number) => {
    const nextX = shiftX + dx;
    const nextY = shiftY + dy;
    onShiftChange(nextX, nextY, true);
    setApplied(false);
  };

  // Check / uncheck option: unchecking resets the shift
  const handleToggleActive = (checked: boolean) => {
    if (!checked) {
      onResetShift();
    } else {
      onShiftChange(shiftX, shiftY, true);
    }
    setApplied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shiftedMgrs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleApply = () => {
    if (!shiftedMgrs || shiftedMgrs === mgrsTL) return;
    onApplyShiftedMgrs(shiftedMgrs);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  return (
    <div className="flex flex-col items-center gap-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      {/* Top Header: Checkbox to toggle / reset shift, and Reset button */}
      <div className="w-full flex items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={shiftEnabled && hasShift}
            onChange={(e) => handleToggleActive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
          />
          <span className="text-xs font-semibold text-gray-200">
            Apply Shift
          </span>
        </label>

        <div className="flex items-center gap-2">
          {hasShift && (
            <button
              type="button"
              onClick={onResetShift}
              className="text-[11px] font-mono text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700/80 px-2 py-0.5 rounded border border-gray-700 transition-colors cursor-pointer"
              title="Reset shift to 0,0"
            >
              Reset (0, 0)
            </button>
          )}
        </div>
      </div>

      {/* Coordinate shift readouts */}
      <div className="w-full flex items-center justify-between text-xs font-mono px-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">ΔX:</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded ${
              shiftX !== 0
                ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {shiftX > 0 ? `+${shiftX}` : shiftX} m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">ΔY:</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded ${
              shiftY !== 0
                ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {shiftY > 0 ? `+${shiftY}` : shiftY} m
          </span>
        </div>
      </div>

      {/* Step guide legend */}
      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
          Blue: ±5m
        </span>
        <span className="text-gray-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-gray-700 border border-gray-500" />
          Outer: ±15m
        </span>
      </div>

      {/* ── Circular D-Pad Controller ── */}
      <div className="relative flex items-center justify-center p-2 select-none">
        <svg
          width="240"
          height="240"
          viewBox="0 0 240 240"
          className="drop-shadow-2xl overflow-visible"
        >
          <defs>
            {/* Dial Chassis Gradient */}
            <radialGradient
              id="dialGrad"
              cx="50%"
              cy="50%"
              r="50%"
              fx="50%"
              fy="45%"
            >
              <stop offset="0%" stopColor="#2e3440" />
              <stop offset="65%" stopColor="#21252d" />
              <stop offset="100%" stopColor="#16181d" />
            </radialGradient>

            {/* Inner Recessed Groove Gradient */}
            <radialGradient id="grooveGrad" cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="#181a1f" />
              <stop offset="100%" stopColor="#252932" />
            </radialGradient>

            {/* Outer Button Gradient */}
            <linearGradient id="outerBtnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2f343d" />
              <stop offset="100%" stopColor="#1a1c22" />
            </linearGradient>

            {/* Inner Blue Petal Gradient */}
            <linearGradient
              id="bluePetalGrad"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#1d8cf8" />
            </linearGradient>

            {/* Center Square Gradient */}
            <linearGradient
              id="centerBtnGrad"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#282d36" />
              <stop offset="100%" stopColor="#191c22" />
            </linearGradient>

            {/* Shadow Filter */}
            <filter
              id="controllerShadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="6"
                stdDeviation="8"
                floodColor="#000000"
                floodOpacity="0.6"
              />
            </filter>

            {/* Subtle Blue Glow */}
            <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="3"
                floodColor="#0284c7"
                floodOpacity="0.5"
              />
            </filter>
          </defs>

          {/* 1. Base Circular Dial Body */}
          <circle
            cx="120"
            cy="120"
            r="114"
            fill="url(#dialGrad)"
            stroke="#3a404d"
            strokeWidth="1.5"
            filter="url(#controllerShadow)"
          />

          {/* Concentric subtle groove */}
          <circle
            cx="120"
            cy="120"
            r="72"
            fill="url(#grooveGrad)"
            stroke="#17191e"
            strokeWidth="2"
          />

          {/* Inner ring platform */}
          <circle
            cx="120"
            cy="120"
            r="69"
            fill="#232730"
            stroke="#323742"
            strokeWidth="1"
          />

          {/* 2. Outer Ring: 8 Directional Buttons (15m each) */}
          {[
            {
              dir: "N",
              label: "North 15m",
              rot: 0,
              dx: 0,
              dy: 15,
            },
            {
              dir: "NE",
              label: "North-East 15m",
              rot: 45,
              dx: 15,
              dy: 15,
            },
            {
              dir: "E",
              label: "East 15m",
              rot: 90,
              dx: 15,
              dy: 0,
            },
            {
              dir: "SE",
              label: "South-East 15m",
              rot: 135,
              dx: 15,
              dy: -15,
            },
            {
              dir: "S",
              label: "South 15m",
              rot: 180,
              dx: 0,
              dy: -15,
            },
            {
              dir: "SW",
              label: "South-West 15m",
              rot: 225,
              dx: -15,
              dy: -15,
            },
            {
              dir: "W",
              label: "West 15m",
              rot: 270,
              dx: -15,
              dy: 0,
            },
            {
              dir: "NW",
              label: "North-West 15m",
              rot: 315,
              dx: -15,
              dy: 15,
            },
          ].map(({ dir, label, rot, dx, dy }) => (
            <g
              key={dir}
              transform={`rotate(${rot} 120 120)`}
              onClick={() => handleNudge(dx, dy)}
              className="cursor-pointer group transition-transform duration-100 active:scale-95 origin-[120px_120px]"
              aria-label={label}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNudge(dx, dy);
                }
              }}
            >
              {/* Outer button pill */}
              <rect
                x="105"
                y="15"
                width="30"
                height="26"
                rx="8"
                fill="url(#outerBtnGrad)"
                stroke="#3f4552"
                strokeWidth="1.2"
                className="group-hover:stroke-gray-300 group-hover:brightness-125 transition-all shadow-sm"
              />
              {/* White arrow pointing up (relative to rotation) */}
              <path
                d="M 120,22 L 126,29 L 122.5,29 L 122.5,35 L 117.5,35 L 117.5,29 L 114,29 Z"
                fill="#ffffff"
                className="group-hover:drop-shadow-[0_0_3px_rgba(255,255,255,0.8)] transition-all pointer-events-none"
              />
            </g>
          ))}

          {/* 3. Inner Ring: 4 Blue Petal Buttons (5m each) */}
          {[
            {
              dir: "N",
              label: "North 5m",
              rot: 0,
              dx: 0,
              dy: 5,
            },
            {
              dir: "E",
              label: "East 5m",
              rot: 90,
              dx: 5,
              dy: 0,
            },
            {
              dir: "S",
              label: "South 5m",
              rot: 180,
              dx: 0,
              dy: -5,
            },
            {
              dir: "W",
              label: "West 5m",
              rot: 270,
              dx: -5,
              dy: 0,
            },
          ].map(({ dir, label, rot, dx, dy }) => (
            <g
              key={dir}
              transform={`rotate(${rot} 120 120)`}
              onClick={() => handleNudge(dx, dy)}
              className="cursor-pointer group transition-transform duration-100 active:scale-95 origin-[120px_120px]"
              aria-label={label}
              filter="url(#blueGlow)"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleNudge(dx, dy);
                }
              }}
            >
              {/* Curved petal wedge shape hugging center square */}
              <path
                d="M 103,84 C 102,69 110,55 120,55 C 130,55 138,69 137,84 C 133,87 127,88 120,88 C 113,88 107,87 103,84 Z"
                fill="url(#bluePetalGrad)"
                stroke="#60a5fa"
                strokeWidth="1.2"
                className="group-hover:brightness-110 group-hover:stroke-white transition-all"
              />
              {/* Subtle petal center arrow / indicator */}
              <path
                d="M 120,63 L 124,69 L 121.5,69 L 121.5,74 L 118.5,74 L 118.5,69 L 116,69 Z"
                fill="#ffffff"
                opacity="0.95"
                className="pointer-events-none"
              />
            </g>
          ))}

          {/* 4. Center Button: Rounded Square (Reset) */}
          <g
            onClick={onResetShift}
            className="cursor-pointer group transition-transform duration-100 active:scale-90 origin-[120px_120px]"
            aria-label="Reset shift to 0,0"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onResetShift();
              }
            }}
          >
            <rect
              x="100"
              y="100"
              width="40"
              height="40"
              rx="9"
              fill="url(#centerBtnGrad)"
              stroke="#3b414e"
              strokeWidth="1.5"
              className="group-hover:stroke-blue-400 group-hover:brightness-125 transition-all shadow-inner"
            />
            {/* Center Reset Icon */}
            <path
              d="M 120,111 A 7.5,7.5 0 1,1 113,118.5 M 111,114.5 L 113,118.5 L 117,117"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:stroke-blue-300 transition-colors pointer-events-none"
            />
          </g>
        </svg>
      </div>

      {/* ── New Top-Left MGRS Box & Action Buttons ── */}
      <div className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            New Top-Left (MGRS)
          </span>
          {hasShift && (
            <span className="text-[10px] text-amber-400 font-medium bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
              Shifted
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5">
          <span
            className="text-xs font-mono font-bold text-gray-100 tracking-wider truncate"
            title={shiftedMgrs}
          >
            {shiftedMgrs || mgrsTL}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-gray-800 transition-colors shrink-0 cursor-pointer"
            title="Copy MGRS"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <p className="text-[11px] text-gray-400 leading-snug">
          Apply to update base coordinates and show SVG at this position without
          shift.
        </p>

        <button
          type="button"
          onClick={handleApply}
          disabled={!hasShift || applied}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            hasShift && !applied
              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 active:scale-[0.98]"
              : "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50"
          }`}
        >
          {applied ? (
            <>
              <span>✓ Applied! SVG Regenerating…</span>
            </>
          ) : (
            <>
              <span>Apply as Base MGRS (Clear Shift)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
