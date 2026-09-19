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
  anchorPoint: { x: number; y: number };
  renderPoint?: { x: number; y: number };
  mappingIdx: number;
  ptApp6dType: string;
  parts: Rect[];
  bbox: BoundingBox;
  status: 'idle' | 'displaced' | 'conflict' | 'movable';
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
    const anchorPoint = geoToSvg(pt);
    const ptApp6dType = pt.app6dType ?? '';
    const mappingIdx = Object.keys(mappingSVGs).findIndex(
      (key) => key === ptApp6dType,
    );

    if (mappingIdx !== -1) {
      const [iconW, iconH] = iconRenderedSizes[mappingIdx] ?? [8.0, 8.0];
      const xPos = Number((anchorPoint.x - iconW / 2).toFixed(3));
      const yPos = Number((anchorPoint.y - iconH / 2).toFixed(3));

      const leftLabelMargin = -0.5;
      const rightLabelMargin = 0.5;

      const leftLabel = computeLeftLabelLayout(
        anchorPoint,
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
        anchorPoint,
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
        anchorPoint,
        mappingIdx,
        ptApp6dType,
        parts,
        bbox,
        status: (pt.name?.startsWith('КСП ') ? 'movable' : 'idle') as BlueForceElementLayout['status'],
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
      x: anchorPoint.x - 2.0,
      y: anchorPoint.y - 2.0,
      width: 4.0,
      height: 4.0,
    };
    const textW = measureTextWidthMm(cleanText, 1.6);
    const textRect: Rect = {
      x: anchorPoint.x - textW / 2,
      y: anchorPoint.y + 4.2 - 1.6,
      width: textW,
      height: 1.6,
    };
    const parts = [circleRect, textRect];
    const bbox = computeBoundingBox(parts);

    return {
      pt,
      idx,
      anchorPoint,
      mappingIdx,
      ptApp6dType,
      parts,
      bbox,
      status: (pt.name?.startsWith('КСП ') ? 'movable' : 'idle') as BlueForceElementLayout['status'],
      circleDetails: {
        cleanText,
      },
    };
  });

  for (let i = 0; i < preparedElements.length; i++) {
    const elA = preparedElements[i];
    for (let j = i + 1; j < preparedElements.length; j++) {
      const elB = preparedElements[j];
      // Movable elements never participate in conflict resolution
      if (elA.status === 'movable' || elB.status === 'movable') continue;

      if (boundingBoxesOverlap(elA.bbox, elB.bbox)) {
        const partsOverlap = elA.parts.some((pA) =>
          elB.parts.some((pB) => rectsOverlap(pA, pB)),
        );
        if (partsOverlap) {
          const priorityA = mappingSVGs[elA.ptApp6dType]?.priority ?? 0;
          const priorityB = mappingSVGs[elB.ptApp6dType]?.priority ?? 0;

          if (priorityA === 10 && priorityB === 10) {
            elA.status = 'conflict';
            elB.status = 'conflict';
          } else if (priorityA > priorityB) {
            if (priorityB !== 10 && elB.status !== 'conflict') {
              elB.status = 'displaced';
            }
          } else if (priorityB > priorityA) {
            if (priorityA !== 10 && elA.status !== 'conflict') {
              elA.status = 'displaced';
            }
          } else {
            // Equal priority  < 10
            // Keep the first element (elA) in its original position and only displace the second (elB)
            if (priorityB !== 10 && elB.status !== 'conflict') {
              elB.status = 'displaced';
            }
          }
        }
      }
    }
  }

  return preparedElements;
}
