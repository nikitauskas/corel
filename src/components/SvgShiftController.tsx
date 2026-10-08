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

import { useId } from "react";

interface CornerRotButtonProps {
  corner: "tl" | "tr" | "bl" | "br";
  degText: string;
  degStep: number;
  label: string;
  direction: "left" | "right";
  isFine?: boolean;
  onRotate: (deg: number) => void;
}

// Full class strings so Tailwind can detect them at build time
const POS: Record<CornerRotButtonProps["corner"], string> = {
  tl: "top-0 left-0",
  tr: "top-0 right-0",
  bl: "bottom-0 left-0",
  br: "bottom-0 right-0",
};

const ORIGIN: Record<CornerRotButtonProps["corner"], string> = {
  tl: "origin-top-left",
  tr: "origin-top-right",
  bl: "origin-bottom-left",
  br: "origin-bottom-right",
};

const CONTENT_POS: Record<CornerRotButtonProps["corner"], string> = {
  tl: "top-2.5 left-3 items-start",
  tr: "top-2.5 right-3 items-end",
  bl: "bottom-2.5 left-3 items-start",
  br: "bottom-2.5 right-3 items-end",
};

const TRANSFORM: Record<CornerRotButtonProps["corner"], string | undefined> = {
  tl: undefined,
  tr: "translate(52, 0) scale(-1, 1)",
  bl: "translate(0, 52) scale(1, -1)",
  br: "translate(52, 52) scale(-1, -1)",
};

function CornerRotButton({
  corner,
  degText,
  degStep,
  label,
  direction,
  isFine,
  onRotate,
}: CornerRotButtonProps) {
  // Unique gradient id per instance (useId returns ":r0:" style strings)
  const gradId = `rot-grad-${useId().replace(/:/g, "")}`;

  const svgGlow = isFine
    ? "group-hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.55)]"
    : "group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]";

  const pathHover = isFine
    ? "group-hover:stroke-sky-400"
    : "group-hover:stroke-gray-300";

  const iconColor = isFine
    ? "text-sky-400 group-hover:text-sky-300"
    : "text-gray-300 group-hover:text-white";

  const textColor = isFine
    ? "text-[13px] text-sky-300 group-hover:text-sky-100"
    : "text-[14px] text-gray-200 group-hover:text-white";

  return (
    <button
      type="button"
      onClick={() => onRotate(degStep)}
      title={label}
      aria-label={label}
      // pointer-events-none: the square box ignores the mouse.
      // Only the triangle <path> re-enables it, so hover/click happen on the triangle only.
      // Clicks on the path still bubble up to this onClick, and :hover/:active still reach `group`.
      className={`group absolute ${POS[corner]} w-[78px] h-[78px] z-10 pointer-events-none outline-none`}
    >
      <svg
        viewBox="0 0 52 52"
        className={`w-full h-full overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)] ${svgGlow} group-active:scale-95 group-focus-visible:drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] ${ORIGIN[corner]} transition-all`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a4252" />
            <stop offset="100%" stopColor="#171a21" />
          </linearGradient>
        </defs>
        <g transform={TRANSFORM[corner]}>
          <path
            d="M 4 14 Q 4 4 14 4 L 41 4 Q 47 4 45 10 L 10 45 Q 4 47 4 41 Z"
            fill={`url(#${gradId})`}
            stroke="#434b59"
            strokeWidth="1.2"
            className={`pointer-events-auto cursor-pointer ${pathHover} group-hover:brightness-125 transition-all`}
          />
          {/* subtle inner highlight */}
          <path
            d="M 8 15 Q 8 8 15 8 L 39 8"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </g>
      </svg>

      <div
        className={`absolute ${CONTENT_POS[corner]} flex ${corner === "bl" || corner === "br" ? "flex-col" : "flex-col-reverse"} gap-0.5 pointer-events-none select-none`}
      >
        <svg
          className={`w-[22px] h-[22px] transition-colors ${iconColor}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          {direction === "left" ? (
            <>
              <path
                d="M4.5 7.5A4.5 4.5 0 1 1 8 12.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M4.5 4.5V7.5H7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <path
                d="M11.5 7.5A4.5 4.5 0 1 0 8 12.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M11.5 4.5V7.5H8.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
        <span
          className={`font-mono font-bold leading-none transition-colors ${textColor}`}
        >
          {degText}
        </span>
      </div>
    </button>
  );
}

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
          {rotation !== 0 && (
            <button
              type="button"
              onClick={() => onRotationChange?.(0)}
              className="text-[10px] text-gray-400 hover:text-red-400 px-1 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer"
              title="Reset rotation to 0°"
            >
              ×
            </button>
          )}
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
        <span className="text-gray-600">·</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 border border-sky-400/80 bg-gray-800 rotate-45 rounded-[2px]" />
          Corners: Rot
        </span>
      </div>

      {/* ── Circular D-Pad Controller with 4 Corner Rotation Controls ── */}
      <div className="relative w-[268px] h-[268px] my-1 select-none flex items-center justify-center">
        {/* Top-Left: Rotate Left -0.1° */}
        <CornerRotButton
          corner="tl"
          degText="-0.1°"
          degStep={-0.1}
          label="Rotate Left -0.1°"
          direction="left"
          isFine
          onRotate={handleRotate}
        />

        {/* Top-Right: Rotate Right +0.1° */}
        <CornerRotButton
          corner="tr"
          degText="+0.1°"
          degStep={0.1}
          label="Rotate Right +0.1°"
          direction="right"
          isFine
          onRotate={handleRotate}
        />

        {/* Bottom-Left: Rotate Left -1° */}
        <CornerRotButton
          corner="bl"
          degText="-1°"
          degStep={-1}
          label="Rotate Left -1°"
          direction="left"
          onRotate={handleRotate}
        />

        {/* Bottom-Right: Rotate Right +1° */}
        <CornerRotButton
          corner="br"
          degText="+1°"
          degStep={1}
          label="Rotate Right +1°"
          direction="right"
          onRotate={handleRotate}
        />

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
              aria-label="Reset shift and rotation to 0"
              title="Reset shift and rotation to 0"
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
