import { ICON_RAW_SVGS } from './icon-assets';

const STANDARD_ICON_SIZE_MM = 7.932;

export const mappingSVGs: Record<
  string,
  {
    height: number;
    priority: number;
  }
> = {
  Error: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 10,
  },

  Enemy: {
    height: STANDARD_ICON_SIZE_MM + 3,
    priority: 8,
  },

  'Точка старту НРК': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 6,
  },
  'Бойова броньована машина (ББМ, БМП)': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 6,
  },
  'Точка злету БпЛА літакового типу': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 6,
  },

  'Радіоелектронна боротьба': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  'Радіоелектронна боротьба - Створення перешкод': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  'Радіоелектронна боротьба - Перехоплення': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  'Радіоелектронна боротьба - Радіопеленгація': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  'Постачання ресурсів': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  РЛС: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 3,
  },

  'Підрозділ польової артилерії': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Важкий міномет': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Середній міномет': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },
  'Розвідувальний артилерійський підрозділ': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Механізований підрозділ': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Середній кулемет': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },
  'Легкий кулемет': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Кулемет: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  "Підрозділ зв'язку": {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Важкий кулемет': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Радіоретрансляція: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Радіоелектронна боротьба - Аналіз': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Радіопеленгація: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Підрозділ безпілотних літальних апаратів (БпЛА)': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },
  'Безпілотний наземний транспортний засіб': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Мінометний підрозділ': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Підрозділ безпілотних наземних апаратів': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Інженерний підрозділ': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Спільне вогневе забезпечення': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Антена: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Перехоплення (пошук та запис)': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Пошук: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Середня польова гармата': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  Гвинтівка: {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Радіоелектронна боротьба - Пошук': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Точка злету БпЛА вертикального зльоту / посадки': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Піхотний підрозділ': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 8,
  },

  'Середня гаубиця': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Легка гаубиця': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 5,
  },

  'Особа з гвинтівкою': {
    height: 6,
    priority: 2,
  },

  'Стик (між частинами та підрозділами)': {
    height: 6.84,
    priority: 10,
  },
};

const ICON_VIEWBOX_PADDING = 0;

/**
 * Synchronous — reads SVG content from the bundled ICON_RAW_SVGS registry.
 * Works on file:// protocol (no fetch needed).
 */
export function buildIconsDefs(): {
  generatedIconsDefs: string;
  iconRenderedSizes: { width: number; height: number }[];
  customIconCount: number;
} {
  const iconRenderedSizes: { width: number; height: number }[] = [];
  let iconsDefsContent = '';
  let iconsSymbolsContent = '';
  let customIconCount = 0;

  Object.entries(mappingSVGs).forEach(
    ([prefix, { height: targetHeightMm }], idx) => {
      const iconContent = ICON_RAW_SVGS[prefix];

      if (!iconContent) {
        console.warn(`Warning: Icon not found for prefix '${prefix}'`);
        iconRenderedSizes.push({
          width: targetHeightMm,
          height: targetHeightMm,
        });
        return;
      }

      customIconCount++;

      const viewBoxMatch = iconContent.match(/viewBox="([^"]+)"/);
      const viewBoxStr = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
      const parts = viewBoxStr
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const minX = parts[0] || 0;
      const minY = parts[1] || 0;
      const svgWidth = parts[2] || 100;
      const svgHeight = parts[3] || 100;

      const innerSvgMatch = iconContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      const innerSvg = innerSvgMatch ? innerSvgMatch[1] : '';

      const defsMatch = innerSvg.match(/<defs>([\s\S]*?)<\/defs>/i);
      if (defsMatch) {
        iconsDefsContent += `\n    <!-- Hoisted defs for ${prefix} -->\n    ${defsMatch[1]}`;
      }
      const geometry = innerSvg.replace(/<defs>[\s\S]*?<\/defs>/i, '');

      const contentH = svgHeight - 2 * ICON_VIEWBOX_PADDING;
      const contentW = svgWidth - 2 * ICON_VIEWBOX_PADDING;
      const scale = targetHeightMm / (contentH > 0 ? contentH : svgHeight);
      const scaledW = svgWidth * scale;
      const scaledH = svgHeight * scale;
      const scaledContentW = contentW * scale;
      const scaledContentH = contentH * scale;

      iconRenderedSizes.push({
        width: scaledContentW,
        height: scaledContentH,
      });

      const symbolId = `icon-mapping-${idx}`;

      iconsSymbolsContent += `
    <g id="${symbolId}">
      <!-- ${prefix}: content=${scaledContentW.toFixed(4)}x${scaledContentH.toFixed(4)}mm (target=${targetHeightMm}mm), total with padding=${scaledW.toFixed(4)}x${scaledH.toFixed(4)}mm -->
      <g transform="scale(${scale}) translate(${-minX}, ${-minY})">
        ${geometry}
      </g>
    </g>`;
    },
  );

  const generatedIconsDefs = `  <defs>\n${iconsDefsContent}\n${iconsSymbolsContent}\n  </defs>`;

  return {
    generatedIconsDefs,
    iconRenderedSizes,
    customIconCount,
  };
}
