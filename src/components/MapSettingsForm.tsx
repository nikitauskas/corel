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

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelCls =
  "block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest";

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
    <div className="space-y-4">
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
        <label htmlFor={`${idPrefix}-scale`} className={labelCls}>
          Scale
        </label>
        <select
          id={`${idPrefix}-scale`}
          value={scale}
          onChange={(e) => onScaleChange(Number(e.target.value))}
          className={`${inputCls} cursor-pointer`}
        >
          <option value={10000}>1:10000</option>
          <option value={15000}>1:15000</option>
          <option value={25000}>1:25000</option>
          <option value={50000}>1:50000</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-width`} className={labelCls}>
            Width (mm)
          </label>
          <input
            id={`${idPrefix}-width`}
            type="number"
            value={width}
            onChange={(e) => onWidthChange(e.target.value)}
            className={inputCls}
            placeholder="1810"
            min="1"
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-height`} className={labelCls}>
            Height (mm)
          </label>
          <input
            id={`${idPrefix}-height`}
            type="number"
            value={height}
            onChange={(e) => onHeightChange(e.target.value)}
            className={inputCls}
            placeholder="1810"
            min="1"
          />
        </div>
      </div>
    </div>
  );
}
