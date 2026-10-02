import { useEffect, useRef, useState } from "react";
import type { PaletteColor } from "../lib/palette";

interface Props {
  value: string;
  onChange: (color: string) => void;
  palette: PaletteColor[];
}

export function CustomColorDropdown({ value, onChange, palette }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = palette.find(
    (c) => c.value.toLowerCase() === value.toLowerCase(),
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 cursor-pointer"
      >
        <span
          className="w-4 h-4 rounded border border-gray-600"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs text-gray-300 max-w-[80px] truncate">
          {current?.name ?? value}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 max-h-56 overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 py-1">
          {palette.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">Palette is empty</p>
          )}
          {palette.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-800 cursor-pointer ${
                current?.id === c.id ? "bg-gray-800" : ""
              }`}
            >
              <span
                className="w-4 h-4 rounded border border-gray-600 shrink-0"
                style={{ backgroundColor: c.value }}
              />
              <span className="text-xs text-gray-200 truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
