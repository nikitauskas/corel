import { useState } from "react";

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

export interface CustomColorDropdownProps {
  value: string;
  onChange: (color: string) => void;
}

export function CustomColorDropdown({
  value,
  onChange,
}: CustomColorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeOption = LABEL_BG_COLORS.find(
    (c) => c.value.toLowerCase() === value.toLowerCase()
  ) || { label: "C", value: value };

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
