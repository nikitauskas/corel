import * as m from 'mgrs';
import { Point } from './geo.js';
import { mappingSVGs } from './icons.js';
import {
  BoundingBox,
  Rect,
  boundingBoxesOverlap,
  computeBoundingBox,
  computeLeftLabelLayout,
  computeRightLabelLayout,
  measureTextWidthMm,
  rectsOverlap,
} from './utils.js';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

import { CsvRow } from './csv.js';

export function filterElementsInsideWindow(
  csvData: CsvRow[],
  inWindow: (lon: number, lat: number) => boolean,
): Point[] {
  const bluePointMarkers: Point[] = [];

  for (const row of csvData) {
    const app6dType = row['app6d type']?.trim() || '';
    const sidc = row['app6d sidc']?.trim() || '';
    const count = row['objects count']?.trim() || '';
    const name = row.name?.trim() || '';
    const mgrsStr = row['coordinates(mgrs)']?.trim() || '';
    const desc = row['object creator']?.trim() || '';

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

  return bluePointMarkers;
}

export interface BlueForceElementLayout {
  pt: Point;
  idx: number;
  svgCoords: { x: number; y: number };
  mappingIdx: number;
  ptApp6dType: string;
  parts: Rect[];
  bbox: BoundingBox;
  iconDetails?: {
    iconW: number;
    iconH: number;
    xPos: number;
    yPos: number;
    leftLabel: ReturnType<typeof computeLeftLabelLayout>;
    rightLabel: ReturnType<typeof computeRightLabelLayout>;
    leftDesc: {
      cleanText: string;
      xPos: number;
      yPos: number;
      rectX: number;
      rectY: number;
      rectW: number;
      rectH: number;
    };
  };
  circleDetails?: {
    cleanText: string;
  };
}

export function buildBlueForceElements(
  csvData: CsvRow[],
  iconRenderedSizes: [number, number][],
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
) {
  const points = filterElementsInsideWindow(csvData, inWindow);

  // 1. Calculate bounding polygon / rectangles for each element
  const preparedElements: BlueForceElementLayout[] = points.map((pt, idx) => {
    const svgCoords = geoToSvg(pt);
    const ptApp6dType = pt.app6dType ?? '';
    const mappingIdx = Object.keys(mappingSVGs).findIndex(
      (key) => key === ptApp6dType,
    );

    if (mappingIdx !== -1) {
      const [iconW, iconH] = iconRenderedSizes[mappingIdx] ?? [8.0, 8.0];
      const xPos = Number((svgCoords.x - iconW / 2).toFixed(3));
      const yPos = Number((svgCoords.y - iconH / 2).toFixed(3));

      const leftLabelMargin = -0.5;
      const rightLabelMargin = 0.5;

      const leftLabel = computeLeftLabelLayout(
        svgCoords,
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
        svgCoords,
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
      const cleanTextDesc = `AK74-${countNum}од`;
      const descX = Number(leftLabel.rectX) + Number(leftLabel.rectW) / 2;
      const descY = Number(leftLabel.rectY) + Number(leftLabel.rectH) + 2.6;
      
      const leftDesc = {
        cleanText: cleanTextDesc,
        xPos: descX,
        yPos: descY,
        rectW: cleanTextDesc ? measureTextWidthMm(cleanTextDesc, 2.822) : 0,
        rectH: 2.822,
        rectX: 0,
        rectY: 0,
      };
      leftDesc.rectX = leftDesc.xPos - leftDesc.rectW / 2;
      leftDesc.rectY = leftDesc.yPos - 2.5;

      const iconRect: Rect = { x: xPos, y: yPos, width: iconW, height: iconH };
      const leftRect: Rect = {
        x: Number(leftLabel.rectX),
        y: Number(leftLabel.rectY),
        width: Number(leftLabel.rectW),
        height: Number(leftLabel.rectH),
      };
      const rightRect: Rect = {
        x: Number(rightLabel.rectX),
        y: Number(rightLabel.rectY),
        width: Number(rightLabel.rectW),
        height: Number(rightLabel.rectH),
      };

      const parts: Rect[] = [iconRect, leftRect, rightRect];

      if (leftDesc.cleanText) {
        const descRect: Rect = {
          x: leftDesc.rectX,
          y: leftDesc.rectY,
          width: leftDesc.rectW,
          height: leftDesc.rectH,
        };
        parts.push(descRect);
      }

      const bbox = computeBoundingBox(parts);

      return {
        pt,
        idx,
        svgCoords,
        mappingIdx,
        ptApp6dType,
        parts,
        bbox,
        iconDetails: {
          iconW,
          iconH,
          xPos,
          yPos,
          leftLabel,
          rightLabel,
          leftDesc,
        },
      };
    }

    // Fallback circular marker
    let labelText = pt.name && pt.name !== '●' ? pt.name : pt.desc || '';
    if (!labelText || labelText === '●') {
      labelText = `Blue #${idx + 1}`;
    }
    const cleanText = labelText;
    const circleRect: Rect = {
      x: svgCoords.x - 2.0,
      y: svgCoords.y - 2.0,
      width: 4.0,
      height: 4.0,
    };
    const textW = measureTextWidthMm(cleanText, 1.6);
    const textRect: Rect = {
      x: svgCoords.x - textW / 2,
      y: svgCoords.y + 4.2 - 1.6,
      width: textW,
      height: 1.6,
    };
    const parts = [circleRect, textRect];
    const bbox = computeBoundingBox(parts);

    return {
      pt,
      idx,
      svgCoords,
      mappingIdx,
      ptApp6dType,
      parts,
      bbox,
      circleDetails: {
        cleanText,
      },
    };
  });

  // 2. Check for overlaps between elements
  const overlappingIndices = new Set<number>();
  for (let i = 0; i < preparedElements.length; i++) {
    const elA = preparedElements[i];
    for (let j = i + 1; j < preparedElements.length; j++) {
      const elB = preparedElements[j];
      if (boundingBoxesOverlap(elA.bbox, elB.bbox)) {
        const partsOverlap = elA.parts.some((pA) =>
          elB.parts.some((pB) => rectsOverlap(pA, pB)),
        );
        if (partsOverlap) {
          overlappingIndices.add(i);
          overlappingIndices.add(j);
        }
      }
    }
  }

  // 3. Render SVG elements (red background for overlapping element label rectangles)
  const blueForceElements: string[] = [];

  preparedElements.forEach((el, idx) => {
    const isOverlapping = overlappingIndices.has(idx);
    const elementLines: string[] = [];
    elementLines.push(`    <g id="${el.ptApp6dType}">`);

    if (el.mappingIdx !== -1 && el.iconDetails) {
      const { xPos, yPos, leftLabel, rightLabel, leftDesc } =
        el.iconDetails;

      const rectBgColor = isOverlapping ? '#ff0000' : '#92B4EC';

      elementLines.push(
        `      <rect x="${leftLabel.rectX}" y="${leftLabel.rectY}" width="${leftLabel.rectW}" height="${leftLabel.rectH}" fill="${rectBgColor}" />`,
        `      <text id="blue-label-${idx + 1}" x="${leftLabel.xPos}" y="${leftLabel.yPos.toFixed(3)}" text-anchor="end" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${leftLabel.cleanText}</text>`,
        `      <rect x="${rightLabel.rectX}" y="${rightLabel.rectY}" width="${rightLabel.rectW}" height="${rightLabel.rectH}" fill="${rectBgColor}" />`,
        `      <text id="blue-label-right-${idx + 1}" x="${rightLabel.xPos}" y="${rightLabel.yPos.toFixed(3)}" text-anchor="start" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${rightLabel.cleanText}</text>`,
      );

      if (leftDesc.cleanText) {
        elementLines.push(
          `      <text id="blue-label-desc-${idx + 1}" x="${leftDesc.xPos.toFixed(3)}" y="${leftDesc.yPos.toFixed(3)}" text-anchor="middle" font-family="ArialBI, sans-serif" font-size="2.822" fill="#000000">${leftDesc.cleanText}</text>`,
        );
      }

      elementLines.push(
        `      <g transform="translate(${xPos} ${yPos})">`,
        `        <use xlink:href="#icon-mapping-${el.mappingIdx}" />`,
        '      </g>',
      );
    } else if (el.circleDetails) {
      elementLines.push(
        `      <circle id="blue-point-${idx + 1}" cx="${el.svgCoords.x}" cy="${el.svgCoords.y}" r="2.0" fill="#ff0000" stroke="#000000" stroke-width="0.3" />`,
      );
      elementLines.push(
        `      <text id="blue-label-${idx + 1}" x="${el.svgCoords.x}" y="${(el.svgCoords.y + 4.2).toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.6" font-weight="bold" fill="#cc0000">${el.circleDetails.cleanText}</text>`,
      );
    }

    elementLines.push('    </g>');
    blueForceElements.push(elementLines.join('\n'));
  });

  return { blueForceElements, overlappingCount: overlappingIndices.size };
}
