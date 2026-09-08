import * as m from 'mgrs';
import { Point } from './geo.js';
import { mappingSVGs } from './icons.js';
import {
  computeLeftLabelLayout,
  computeRightLabelLayout,
} from './utils.js';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

export function parseBluePoints(
  csvContent: string,
  inWindow: (lon: number, lat: number) => boolean,
): Point[] {
  const bluePointMarkers: Point[] = [];
  const csvLines = csvContent.split('\n');

  for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i].trim();
    if (!line) continue;

    const cols: string[] = [];
    let inQuotes = false;
    let currentWord = '';
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          currentWord += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cols.push(currentWord);
        currentWord = '';
      } else {
        currentWord += char;
      }
    }
    cols.push(currentWord);

    if (cols.length >= 8) {
      const app6dType = cols[0]?.trim() || '';
      const sidc = cols[3]?.trim() || '';
      const count = cols[4]?.trim() || '';
      const name = cols[5]?.trim() || '';
      const mgrsStr = cols[7]?.trim() || '';
      const desc = cols[12]?.trim() || '';

      if (mgrsStr) {
        try {
          const [lon, lat] = mgrs.toPoint(mgrsStr);
          if (!Number.isNaN(lon) && !Number.isNaN(lat) && inWindow(lon, lat)) {
            bluePointMarkers.push({
              lon,
              lat,
              name,
              desc,
              sidc,
              count,
              app6dType,
            });
          }
        } catch (e) {
          // Ignore invalid MGRS strings
        }
      }
    }
  }

  return bluePointMarkers;
}

export function buildBlueForceElements(
  points: Point[],
  iconRenderedSizes: [number, number][],
  geoToSvg: (pt: Point) => { x: number; y: number },
) {
  const blueForceElements: string[] = [];

  points.forEach((pt, idx) => {
    const svgPt = geoToSvg(pt);

    const ptApp6dType = pt.app6dType ?? '';
    const mappingIdx = Object.keys(mappingSVGs).findIndex(
      (key) => key === ptApp6dType,
    );

    const elementLines: string[] = [];
    elementLines.push(`    <g id="${ptApp6dType}">`);

    if (mappingIdx !== -1) {
      const [iconW, iconH] = iconRenderedSizes[mappingIdx] ?? [8.0, 8.0];
      const xPos = Number((svgPt.x - iconW / 2).toFixed(3));
      const yPos = Number((svgPt.y - iconH / 2).toFixed(3));

      const leftLabelMargin = -0.5;
      const rightLabelMargin = 0.5;

      const {
        xPos: labelX,
        yPos: labelY,
        cleanText,
        rectX,
        rectY,
        rectW,
        rectH,
      } = computeLeftLabelLayout(
        svgPt,
        iconW,
        iconH,
        pt.name || 'Test',
        3.526,
        0.9,
        0.05,
        2.917,
        leftLabelMargin,
      );

      const rightLabel = computeRightLabelLayout(
        svgPt,
        iconW,
        iconH,
        '9/3//78',
        3.526,
        0.9,
        0.05,
        2.917,
        rightLabelMargin,
      );

      const countNum = pt.count || 'X';
      const groupDesc = `AK74-${countNum}од`;
      const descX = Number(rectX) + Number(rectW) / 2;
      const descY = Number(rectY) + Number(rectH) + 2.6;

      elementLines.push(
        `      <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="#92B4EC" />`,
        `      <text id="blue-label-${idx + 1}" x="${labelX}" y="${labelY.toFixed(3)}" text-anchor="end" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${cleanText}</text>`,
        `      <rect x="${rightLabel.rectX}" y="${rightLabel.rectY}" width="${rightLabel.rectW}" height="${rightLabel.rectH}" fill="#92B4EC" />`,
        `      <text id="blue-label-right-${idx + 1}" x="${rightLabel.xPos}" y="${rightLabel.yPos.toFixed(3)}" text-anchor="start" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${rightLabel.cleanText}</text>`,
      );

      if (groupDesc) {
        elementLines.push(
          `      <text id="blue-label-desc-${idx + 1}" x="${descX.toFixed(3)}" y="${descY.toFixed(3)}" text-anchor="middle" font-family="ArialBI, sans-serif" font-size="2.822" fill="#000000">${groupDesc}</text>`,
        );
      }

      elementLines.push(
        `      <g transform="translate(${xPos} ${yPos})">`,
        `        <use xlink:href="#icon-mapping-${mappingIdx}" />`,
        '      </g>',
      );
    } else {
      elementLines.push(
        `      <circle id="blue-point-${idx + 1}" cx="${svgPt.x}" cy="${svgPt.y}" r="2.0" fill="#ff0000" stroke="#000000" stroke-width="0.3" />`,
      );

      let labelText = pt.name && pt.name !== '●' ? pt.name : pt.desc || '';
      if (!labelText || labelText === '●') {
        labelText = `Blue #${idx + 1}`;
      }
      const cleanText = labelText;
      elementLines.push(
        `      <text id="blue-label-${idx + 1}" x="${svgPt.x}" y="${(svgPt.y + 4.2).toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.6" font-weight="bold" fill="#cc0000">${cleanText}</text>`,
      );
    }

    elementLines.push('    </g>');
    blueForceElements.push(elementLines.join('\n'));
  });

  return { blueForceElements };
}
