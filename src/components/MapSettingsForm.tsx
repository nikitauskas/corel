interface MapSettingsFormProps {
  idPrefix: string;
  mgrsTL: string;
  scale: number;
  width: string;
  height: string;
  onMgrsChange: (v: string) => void;
  onScaleChange: (v: number) => void;
  onWidthChange: (v: string) => void;
  onHeightChange: (v: string) => void;
}

const SCALES = [10000, 15000, 25000, 50000] as const;

const inputCls =
  "w-full bg-gray-900 border border-gray-700 hover:border-gray-500 rounded px-2.5 py-1.5 text-xs font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls =
  "block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-widest";

export function MapSettingsForm({
  idPrefix,
  mgrsTL,
  scale,
  width,
  height,
  onMgrsChange,
  onScaleChange,
  onWidthChange,
  onHeightChange,
}: MapSettingsFormProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-mgrs`} className={labelCls}>
          Top-Left MGRS
        </label>
        <input
          id={`${idPrefix}-mgrs`}
          type="text"
          value={mgrsTL}
          onChange={(e) => onMgrsChange(e.target.value)}
          className={inputCls}
          placeholder="e.g. 37UBP9708043769"
        />
      </div>
      <div>
        <span className={labelCls}>Scale</span>
        <div
          role="radiogroup"
          aria-label="Scale"
          className="grid grid-cols-4 bg-gray-900 border border-gray-700 rounded p-0.5"
        >
          {SCALES.map((s, i) => {
            const active = s === scale;
            const prevActive = SCALES[i - 1] === scale;
            // line on the left of every button except the first,
            // hidden next to the selected one so the blue pill stays clean
            const divider =
              i === 0
                ? ""
                : active || prevActive
                  ? "border-l border-transparent"
                  : "border-l border-gray-700";

            return (
              <label
                key={s}
                className={`relative py-1 text-center text-[11px] font-mono transition-colors cursor-pointer ${
                  active
                    ? "rounded bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                } ${i === 0 ? "rounded-l" : ""} ${
                  i === SCALES.length - 1 ? "rounded-r" : ""
                } ${divider}`}
              >
                <input
                  type="radio"
                  name="scale"
                  value={s}
                  checked={active}
                  onChange={() => onScaleChange(s)}
                  className="sr-only"
                />
                1:{s / 1000}k
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <span className={labelCls}>Size</span>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id={`${idPrefix}-width`}
              type="number"
              min="1"
              value={width}
              onChange={(e) => onWidthChange(e.target.value)}
              aria-label="Width (mm)"
              placeholder="1810"
              className={`${inputCls} pr-9`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">
              mm
            </span>
          </div>
          <span className="text-gray-600 text-xs">×</span>
          <div className="relative flex-1">
            <input
              id={`${idPrefix}-height`}
              type="number"
              min="1"
              value={height}
              onChange={(e) => onHeightChange(e.target.value)}
              aria-label="Height (mm)"
              placeholder="1810"
              className={`${inputCls} pr-9`}
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">
              mm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
