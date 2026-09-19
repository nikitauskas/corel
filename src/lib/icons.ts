import * as fs from 'node:fs';
import * as path from 'node:path';

const STANDARD_ICON_SIZE_MM = 7.932;

export const mappingSVGs: Record<
  string,
  {
    height: number;
    priority: number;
  }
> = {
  'Точка злету БпЛА літакового типу': {
    height: STANDARD_ICON_SIZE_MM,
    priority: 6,
  },

  Антена: {
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

  'Особа з гвинтівкою': {
    height: 6, // 8.249
    priority: 2,
  },

  'Стик (між частинами та підрозділами)': {
    height: 6.84,
    priority: 10,
  },
};

const ICON_VIEWBOX_PADDING = 0;

export function buildIconsDefs() {
  const iconRenderedSizes: [number, number][] = [];
  let iconsDefsContent = '';
  let iconsSymbolsContent = '';
  let customIconCount = 0;

  Object.entries(mappingSVGs).forEach(
    ([prefix, { height: targetHeightMm }], idx) => {
      const iconPathRelative = `icons2/${prefix.replace(/\//g, '-')}.svg`;
      const iconPath = path.resolve(process.cwd(), iconPathRelative);
      if (!fs.existsSync(iconPath)) {
        console.warn(
          `Warning: Icon not found for prefix '${prefix}': ${iconPathRelative}`,
        );
        iconRenderedSizes.push([targetHeightMm, targetHeightMm]); // fallback square
        return;
      }

      customIconCount++;
      const iconContent = fs.readFileSync(iconPath, 'utf-8');

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
      const scaledW = svgWidth * scale; // total rendered width including padding
      const scaledH = svgHeight * scale; // total rendered height including padding
      const scaledContentW = contentW * scale; // == targetHeightMm * (contentW / contentH)
      const scaledContentH = contentH * scale; // == targetHeightMm

      // Record actual CONTENT dimensions for centering during placement
      iconRenderedSizes.push([scaledContentW, scaledContentH]);

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
