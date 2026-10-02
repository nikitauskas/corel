import type { PaletteColor } from "../lib/palette";

interface PaletteManagerProps {
  palette: PaletteColor[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<Omit<PaletteColor, "id">>) => void;
  onDelete: (id: string) => void;
  onReset: () => void;
}

export function PaletteManager({
  palette,
  onAdd,
  onChange,
  onDelete,
  onReset,
}: PaletteManagerProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Color Palette ({palette.length})
        </h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-200 cursor-pointer transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-2">
        {palette.map((c) => (
          <div
            key={c.id}
            className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2 flex items-center gap-2"
          >
            <input
              type="color"
              value={c.value}
              onChange={(e) => onChange(c.id, { value: e.target.value })}
              className="w-8 h-8 shrink-0 rounded cursor-pointer bg-transparent border border-gray-600 p-0"
              title="Change color"
            />
            <input
              type="text"
              value={c.name}
              onChange={(e) => onChange(c.id, { name: e.target.value })}
              className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
            <span className="text-[11px] font-mono text-gray-500 uppercase">
              {c.value}
            </span>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="text-gray-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
              title="Delete color"
            >
              <svg
                className="w-4 h-4"
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
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full border border-dashed border-gray-700 hover:border-blue-500 hover:text-blue-400 text-gray-400 text-xs font-semibold rounded-lg py-2 cursor-pointer transition-colors"
      >
        + Add color
      </button>
    </div>
  );
}
