import { useState } from "react";
import { computeShiftedMgrs } from "../lib/overlay-bounds";

interface SvgShiftControllerProps {
  mgrsTL: string;
  shiftX: number;
  shiftY: number;
  shiftEnabled: boolean;
  rotation?: number;
  onShiftChange: (x: number, y: number, enabled?: boolean) => void;
  onResetShift: () => void;
  onRotationChange?: (rot: number) => void;
}

const OUTER_BUTTONS = [
  { dir: "N", label: "North 15m", rot: 0, dx: 0, dy: 15 },
  { dir: "NE", label: "North-East 15m", rot: 45, dx: 15, dy: 15 },
  { dir: "E", label: "East 15m", rot: 90, dx: 15, dy: 0 },
  { dir: "SE", label: "South-East 15m", rot: 135, dx: 15, dy: -15 },
  { dir: "S", label: "South 15m", rot: 180, dx: 0, dy: -15 },
  { dir: "SW", label: "South-West 15m", rot: 225, dx: -15, dy: -15 },
  { dir: "W", label: "West 15m", rot: 270, dx: -15, dy: 0 },
  { dir: "NW", label: "North-West 15m", rot: 315, dx: -15, dy: 15 },
] as const;

const INNER_BUTTONS = [
  { dir: "N", label: "North 5m", rot: 0, dx: 0, dy: 5 },
  { dir: "E", label: "East 5m", rot: 90, dx: 5, dy: 0 },
  { dir: "S", label: "South 5m", rot: 180, dx: 0, dy: -5 },
  { dir: "W", label: "West 5m", rot: 270, dx: -5, dy: 0 },
] as const;

export function SvgShiftController({
  mgrsTL,
  shiftX,
  shiftY,
  shiftEnabled,
  rotation = 0,
  onShiftChange,
  onResetShift,
  onRotationChange,
}: SvgShiftControllerProps) {
  const [copied, setCopied] = useState(false);

  const effectiveX = shiftEnabled ? shiftX : 0;
  const effectiveY = shiftEnabled ? shiftY : 0;
  const shiftedMgrs = computeShiftedMgrs(mgrsTL, effectiveX, effectiveY);
  const hasShift = shiftX !== 0 || shiftY !== 0 || rotation !== 0;

  const handleNudge = (dx: number, dy: number) => {
    const nextX = shiftX + dx;
    const nextY = shiftY + dy;
    onShiftChange(nextX, nextY, true);
  };

  const handleRotate = (deg: number) => {
    const next = Math.round((rotation + deg) * 100) / 100;
    onRotationChange?.(next);
  };

  const handleToggleActive = (checked: boolean) => {
    if (!checked) {
      onResetShift();
    } else {
      onShiftChange(shiftX, shiftY, true);
    }
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

  return (
    <div className="flex flex-col items-center gap-4 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      {/* Header: Checkbox to toggle / reset shift, and Reset button */}
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

        {hasShift && (
          <button
            type="button"
            onClick={onResetShift}
            className="text-[11px] font-mono text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700/80 px-2 py-0.5 rounded border border-gray-700 transition-colors cursor-pointer"
            title="Reset shift and rotation to 0"
          >
            Reset All
          </button>
        )}
      </div>

      {/* Coordinate & Rotation readouts */}
      <div className="w-full grid grid-cols-3 gap-2 text-xs font-mono px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ΔX:</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
              shiftX !== 0
                ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {shiftX > 0 ? `+${shiftX}` : shiftX}m
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">ΔY:</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
              shiftY !== 0
                ? "bg-blue-900/50 text-blue-300 border border-blue-700/50"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {shiftY > 0 ? `+${shiftY}` : shiftY}m
          </span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-gray-400">Rot:</span>
          <span
            className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
              rotation !== 0
                ? "bg-sky-950 text-sky-300 border border-sky-800/60"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {rotation > 0 ? `+${rotation}` : rotation}°
          </span>
        </div>
      </div>

      {/* Legend */}
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
      <div className="relative my-2 select-none flex items-center justify-center">
        {/* Chassis Dial */}
        <div className="relative w-[240px] h-[240px] rounded-full bg-gradient-to-b from-[#2a2f3a] via-[#1f232b] to-[#15171c] border border-[#3a414f] shadow-[0_12px_30px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center overflow-hidden">
          {/* Concentric groove */}
          <div className="w-[146px] h-[146px] rounded-full border-2 border-[#16181e] bg-[#1a1d24] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-none">
            {/* Inner ring platform */}
            <div className="w-[138px] h-[138px] rounded-full bg-[#20252e] border border-[#2e333d]" />
          </div>

          {/* 8 Outer Buttons (15m step) */}
          {OUTER_BUTTONS.map(({ dir, label, rot, dx, dy }) => (
            <div
              key={dir}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${rot}deg) translateY(-87px)`,
              }}
              className="pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => handleNudge(dx, dy)}
                aria-label={label}
                title={label}
                className="w-[30px] h-[26px] rounded-lg bg-gradient-to-b from-[#323844] to-[#1d2026] border border-[#434b59] shadow-md flex items-center justify-center hover:border-gray-300 hover:brightness-125 active:scale-90 transition-all cursor-pointer"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className="text-white shrink-0 pointer-events-none drop-shadow"
                >
                  <path
                    d="M6 2L10 6.5H7.2V10H4.8V6.5H2L6 2Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* 4 Inner Blue Petal Buttons (5m step) */}
          {INNER_BUTTONS.map(({ dir, label, rot, dx, dy }) => (
            <div
              key={dir}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${rot}deg) translateY(-46px)`,
              }}
              className="pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => handleNudge(dx, dy)}
                aria-label={label}
                title={label}
                className="w-[38px] h-[30px] rounded-t-[18px] rounded-b-[10px] bg-gradient-to-b from-sky-400 to-blue-600 border border-sky-300 shadow-[0_3px_8px_rgba(2,132,199,0.5),inset_0_1px_1px_rgba(255,255,255,0.5)] flex items-center justify-center hover:brightness-110 active:scale-90 transition-all cursor-pointer"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="text-white shrink-0 pointer-events-none"
                >
                  <path
                    d="M5 1.5L8.5 5.5H6.2V8.5H3.8V5.5H1.5L5 1.5Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* Center Square (Reset Button) */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
            className="pointer-events-auto"
          >
            <button
              type="button"
              onClick={onResetShift}
              aria-label="Reset shift to 0,0"
              title="Reset shift to (0, 0)"
              className="w-[40px] h-[40px] rounded-xl bg-gradient-to-b from-[#2a2f3a] to-[#181a20] border border-[#3d4554] shadow-inner flex items-center justify-center hover:border-blue-400 hover:text-blue-400 text-gray-400 active:scale-90 transition-all cursor-pointer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0 pointer-events-none"
              >
                <path
                  d="M13.5 8A5.5 5.5 0 1 1 9.5 2.8M10 1L9.5 3.5L12 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Rotation Controls (Left / Right) ── */}
      <div className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-300 flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-sky-400"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M2.5 8a5.5 5.5 0 0 1 9.39-3.89M13.5 8a5.5 5.5 0 0 1-9.39 3.89"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M12 2v2.5H9.5M4 14v-2.5H6.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Rotation
          </span>
          <div className="flex items-center gap-1.5 font-mono">
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                rotation !== 0
                  ? "bg-sky-950 text-sky-300 border border-sky-800/60"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {rotation > 0 ? `+${rotation}` : rotation}°
            </span>
            {rotation !== 0 && (
              <button
                type="button"
                onClick={() => onRotationChange?.(0)}
                className="text-[10px] text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
                title="Reset rotation to 0°"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => handleRotate(-1)}
            className="py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-xs text-gray-200 font-mono transition-all border border-gray-700/60 flex items-center justify-center gap-1 cursor-pointer"
            title="Rotate Left -1°"
          >
            ⟲ -1°
          </button>
          <button
            type="button"
            onClick={() => handleRotate(-0.1)}
            className="py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-xs text-sky-300 font-mono transition-all border border-gray-700/60 flex items-center justify-center gap-0.5 cursor-pointer"
            title="Rotate Left -0.1°"
          >
            ⟲ -0.1°
          </button>
          <button
            type="button"
            onClick={() => handleRotate(0.1)}
            className="py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-xs text-sky-300 font-mono transition-all border border-gray-700/60 flex items-center justify-center gap-0.5 cursor-pointer"
            title="Rotate Right +0.1°"
          >
            +0.1° ⟳
          </button>
          <button
            type="button"
            onClick={() => handleRotate(1)}
            className="py-1.5 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-xs text-gray-200 font-mono transition-all border border-gray-700/60 flex items-center justify-center gap-1 cursor-pointer"
            title="Rotate Right +1°"
          >
            +1° ⟳
          </button>
        </div>
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
      </div>
    </div>
  );
}
