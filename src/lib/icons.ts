import { ICON_RAW_SVGS } from "./icon-assets";

export const STANDARD_ICON_SIZE_MM = 7.932;

/**
 * Icons that differ from the default size (7.932 mm) or default priority (5).
 */
export const ICON_CONFIG_OVERRIDES: Record<
  string,
  {
    height?: number;
    priority?: number;
  }
> = {
  Error: {
    priority: 10,
  },

  Enemy: {
    height: STANDARD_ICON_SIZE_MM + 3,
    priority: 8,
  },

  "Точка старту НРК": {
    priority: 6,
  },
  "Бойова броньована машина (ББМ, БМП)": {
    priority: 6,
  },
  "Точка злету БпЛА літакового типу": {
    priority: 6,
  },

  "Радіоелектронна боротьба": {
    priority: 3,
  },
  "Радіоелектронна боротьба - Створення перешкод": {
    priority: 3,
  },
  "Радіоелектронна боротьба - Перехоплення": {
    priority: 3,
  },
  "Радіоелектронна боротьба - Радіопеленгація": {
    priority: 3,
  },
  "Постачання ресурсів": {
    priority: 3,
  },
  РЛС: {
    priority: 3,
  },

  "Піхотний підрозділ": {
    priority: 8,
  },

  "Особа з гвинтівкою": {
    height: 6,
    priority: 2,
  },

  "Стик (між частинами та підрозділами)": {
    height: 6.84,
    priority: 10,
  },
  "Пункт проведення медичної евакуації (MEDEVAC) Пункт прийому о/с на борт": {
    height: 20,
    priority: 4,
  },
};

/**
 * Standard icon ordering to maintain fixed index mappings (#icon-mapping-${idx}).
 */
export const KNOWN_ICON_ORDER = [
  "Error",
  "Enemy",
  "Точка старту НРК",
  "Бойова броньована машина (ББМ, БМП)",
  "Точка злету БпЛА літакового типу",
  "Радіоелектронна боротьба",
  "Радіоелектронна боротьба - Створення перешкод",
  "Радіоелектронна боротьба - Перехоплення",
  "Радіоелектронна боротьба - Радіопеленгація",
  "Постачання ресурсів",
  "РЛС",
  "Підрозділ польової артилерії",
  "Важкий міномет",
  "Середній міномет",
  "Розвідувальний артилерійський підрозділ",
  "Механізований підрозділ",
  "Середній кулемет",
  "Легкий кулемет",
  "Кулемет",
  "Підрозділ зв'язку",
  "Важкий кулемет",
  "Радіоретрансляція",
  "Радіоелектронна боротьба - Аналіз",
  "Радіопеленгація",
  "Підрозділ безпілотних літальних апаратів (БпЛА)",
  "Безпілотний наземний транспортний засіб",
  "Мінометний підрозділ",
  "Підрозділ безпілотних наземних апаратів",
  "Інженерний підрозділ",
  "Спільне вогневе забезпечення",
  "Антена",
  "Антена радіомовного передавача",
  "Перехоплення (пошук та запис)",
  "Пошук",
  "Середня польова гармата",
  "Гвинтівка",
  "Радіоелектронна боротьба - Пошук",
  "Точка злету БпЛА вертикального зльоту / посадки",
  "Піхотний підрозділ",
  "Середня гаубиця",
  "Легка гаубиця",
  "Особа з гвинтівкою",
  "Стик (між частинами та підрозділами)",
  "Легка пускова установка ЗРК",
  "Автомобіль медичної евакуації",
  "Пункт проведення медичної евакуації (MEDEVAC) Пункт прийому о/с на борт",
];

/**
 * Programmatically generated mapping dictionary.
 * Combines KNOWN_ICON_ORDER & any auto-discovered icons from ICON_RAW_SVGS,
 * applying default height/priority unless overridden in ICON_CONFIG_OVERRIDES.
 */
export const mappingSVGs: Record<
  string,
  {
    height: number;
    priority: number;
  }
> = {};

for (const key of KNOWN_ICON_ORDER) {
  const override = ICON_CONFIG_OVERRIDES[key];
  mappingSVGs[key] = {
    height: override?.height ?? STANDARD_ICON_SIZE_MM,
    priority: override?.priority ?? 5,
  };
}

for (const key of Object.keys(ICON_RAW_SVGS)) {
  if (
    !mappingSVGs[key] &&
    key !== "Damaged" &&
    key !== "Destroyed" &&
    !key.startsWith("!")
  ) {
    const override = ICON_CONFIG_OVERRIDES[key];
    mappingSVGs[key] = {
      height: override?.height ?? STANDARD_ICON_SIZE_MM,
      priority: override?.priority ?? 5,
    };
  }
}

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
  let iconsDefsContent = "";
  let iconsSymbolsContent = "";
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
      const viewBoxStr = viewBoxMatch ? viewBoxMatch[1] : "0 0 100 100";
      const parts = viewBoxStr
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const minX = parts[0] || 0;
      const minY = parts[1] || 0;
      const svgWidth = parts[2] || 100;
      const svgHeight = parts[3] || 100;

      const innerSvgMatch = iconContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
      const innerSvg = innerSvgMatch ? innerSvgMatch[1] : "";

      const defsMatch = innerSvg.match(/<defs>([\s\S]*?)<\/defs>/i);
      if (defsMatch) {
        iconsDefsContent += `\n    <!-- Hoisted defs for ${prefix} -->\n    ${defsMatch[1]}`;
      }
      const geometry = innerSvg.replace(/<defs>[\s\S]*?<\/defs>/i, "");

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
