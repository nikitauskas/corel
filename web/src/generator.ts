import { parseCSV } from './lib/csv';
import { type MapFormatConfig, createMapContext } from './lib/geo';
import { buildIconsDefs } from './lib/icons';
import { buildLUnitsSpearationLinesSVGs } from './lib/lines';
import { buildMapObjects } from './lib/map-objects';
import { renderElementsSVG } from './lib/render-objects-svg';
import { resolveOverlappingRenderPoints } from './lib/resolve-overlaps';
import { buildFinalSvg } from './lib/svg';

export const STARTING_MGRS_TL = '37UBP9708043769';

export const MAP_FORMATS: MapFormatConfig[] = [
  {
    name: '1:25000',
    scale: 25_000,
    widthMm: 1810,
    heightMm: 1810,
    outputFilename: 'layout_1810x1810_25k.svg',
  },
];

export interface GenerateResult {
  svgContent: string;
  filename: string;
  stats: {
    format: string;
    pointsInWindow: number;
    overlapping: number;
    customIconCount: number;
    linesCount: number;
    overlayNames: string[];
    usedIcons: string[];
    missedIcons: string[];
  };
}

export async function generateSVGFromCSV(
  csvContent: string,
  mgrsTL = STARTING_MGRS_TL,
  formatConfig: MapFormatConfig = MAP_FORMATS[0],
): Promise<GenerateResult> {
  // 1. Load icon defs (bundled at build time — sync, no fetch)
  const { generatedIconsDefs, iconRenderedSizes, customIconCount } =
    buildIconsDefs();

  // 2. Parse CSV
  const csvData = parseCSV(csvContent);

  // 3. Build map context
  const map = createMapContext(formatConfig, mgrsTL);

  // 4. Lines
  const unitsSpearationLinesSVGs = buildLUnitsSpearationLinesSVGs(
    csvData,
    map.inWindow,
    map.geoToSvg,
  );

  // 5. Map objects
  const preparedObjects = buildMapObjects(
    csvData,
    iconRenderedSizes,
    map.inWindow,
    map.geoToSvg,
  );

  resolveOverlappingRenderPoints(preparedObjects);

  const mapObjectsSVGs = renderElementsSVG(preparedObjects);

  const overlappingCount = preparedObjects.filter(
    (el) => el.status !== 'idle',
  ).length;

  // 6. Final SVG
  const svgContent = buildFinalSvg(
    map,
    generatedIconsDefs,
    unitsSpearationLinesSVGs,
    mapObjectsSVGs,
  );

  const filename =
    formatConfig.outputFilename ||
    `layout_${formatConfig.widthMm}x${formatConfig.heightMm}_${formatConfig.scale / 1000}k.svg`;

  // Stats
  const overlayNames = Array.from(
    new Set(csvData.map((r) => r['overlay name']).filter(Boolean) as string[]),
  );

  const usedIcons = new Set<string>();
  const missedIcons = new Set<string>();

  for (const obj of preparedObjects) {
    if (obj.isExcluded) {
      missedIcons.add(`[excluded] ${obj.ptApp6dType}`);
    } else if (!obj.hasSpecificIcon) {
      missedIcons.add(obj.ptApp6dType);
    } else {
      usedIcons.add(obj.ptApp6dType);
    }
  }

  return {
    svgContent,
    filename,
    stats: {
      format: formatConfig.name ?? `1:${formatConfig.scale}`,
      pointsInWindow: mapObjectsSVGs.length,
      overlapping: overlappingCount,
      customIconCount,
      linesCount: unitsSpearationLinesSVGs.join('\n').split('<path').length - 1,
      overlayNames,
      usedIcons: Array.from(usedIcons),
      missedIcons: Array.from(missedIcons),
    },
  };
}
