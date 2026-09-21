import * as m from 'mgrs';
import { Point } from './geo.js';
import { mappingSVGs } from './icons.js';
import {
  BoundingBox,
  LabelLayout,
  Rect,
  boundingBoxesOverlap,
  computeBoundingBox,
  computeLabelLayout,
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
    const isHQ =
      (row['Штаб / тактична група / індикатор хибності']?.trim() || '') ===
      'Штаб';
    const higherFrmation = row['Вище формування']?.trim() || '';
    const comments = row.comments?.trim() || '';

    if (mgrsStr) {
      try {
        const [lon, lat] = mgrs.toPoint(mgrsStr);
        if (!Number.isNaN(lon) && !Number.isNaN(lat) && inWindow(lon, lat)) {
          bluePointMarkers.push({
            lon,
            lat,
            isHQ,
            name: isHQ ? `HQ ${name}` : name,
            desc,
            sidc,
            count,
            app6dType,
            higherFrmation,
            comments,
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
  status: 'idle' | 'displaced' | 'conflict';
  iconDetails?: {
    iconW: number;
    iconH: number;
    xPos: number;
    yPos: number;
    leftLabel: LabelLayout;
    rightLabel: LabelLayout;
    leftDesc: LabelLayout;
    bottomLabel: LabelLayout;
    bottomDesc: LabelLayout;
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

      let leftLabelText = '';
      let leftDescText = '';
      let rightLabelText = '';
      let rightDescText = '';
      let bottomLabelText = '';
      let bottomDescText = '';

      if (pt.name) {
        leftLabelText = pt.name;
      } else {
        leftLabelText = 'Left Label';
      }

      if (pt.count) {
        const countNum = pt.count;
        const rifleType = pt.comments?.toLowerCase().includes('colt')
          ? 'ColtM4A1'
          : 'AK74';
        leftDescText =
          rifleType && countNum
            ? `${rifleType}-${countNum}од`
            : 'XXXXXXXXXXXXX од.';
      }

      if (pt.higherFrmation) {
        rightLabelText = pt.higherFrmation;
      } else {
        rightLabelText = 'Right Label';
      }

      if (pt.higherFrmation === 'xxx') {
        rightDescText = 'sss';
      }
      if (pt.higherFrmation === 'xxx2') {
        bottomLabelText = 'sss';
      }
      if (pt.higherFrmation === 'xxx3') {
        bottomDescText = 'sss';
      }

      if (ptApp6dType === 'Стик (між частинами та підрозділами)') {
        bottomLabelText = pt.name ?? '';
        rightLabelText = '';
        rightDescText = '';
        leftLabelText = '';
        leftDescText = '';
      }

      const leftLabel = computeLabelLayout(
        anchorPoint,
        iconW,
        iconH,
        leftLabelText,
        'left',
        3.526,
        0.9,
        0.05,
        2.917,
        leftLabelMargin,
      );

      const rightLabel = computeLabelLayout(
        anchorPoint,
        iconW,
        iconH,
        rightLabelText,
        'right',
        3.526,
        0.9,
        0.05,
        2.917,
        rightLabelMargin,
      );

      // leftDesc sits below the leftLabel rect, centered on it
      const leftDescOrigin = {
        x: leftLabel.rectX + leftLabel.rectW / 2,
        y: leftLabel.rectY + leftLabel.rectH,
      };

      const leftDesc = computeLabelLayout(
        leftDescOrigin,
        0,
        0,
        leftDescText,
        'bottom-center',
        2.822,
        0.9,
        0.05,
        2.822,
        0.1, // small gap below leftLabel rect
      );

      // bottomLabel sits centered below the icon
      const bottomLabel = computeLabelLayout(
        anchorPoint,
        iconW,
        iconH,
        bottomLabelText,
        'bottom-center',
        3.526,
        0.9,
        0.05,
        2.917,
        0.05, // gap between icon bottom and label rect top
      );

      // bottomDesc sits below the bottomLabel rect
      const bottomDescOrigin = {
        x: anchorPoint.x,
        y: bottomLabel.rectY + bottomLabel.rectH,
      };
      const bottomDesc = computeLabelLayout(
        bottomDescOrigin,
        0,
        0,
        bottomDescText,
        'bottom-center',
        2.822,
        0.9,
        0.05,
        2.822,
        0.5, // gap between bottomLabel rect and bottomDesc rect
      );

      const iconRect: Rect = { x: xPos, y: yPos, width: iconW, height: iconH };
      const parts: Rect[] = [iconRect];

      if (leftLabel.cleanText) {
        parts.push({
          x: leftLabel.rectX,
          y: leftLabel.rectY,
          width: leftLabel.rectW,
          height: leftLabel.rectH,
        });
      }

      if (rightLabel.cleanText) {
        parts.push({
          x: rightLabel.rectX,
          y: rightLabel.rectY,
          width: rightLabel.rectW,
          height: rightLabel.rectH,
        });
      }

      if (bottomLabel.cleanText) {
        parts.push({
          x: bottomLabel.rectX,
          y: bottomLabel.rectY,
          width: bottomLabel.rectW,
          height: bottomLabel.rectH,
        });
      }

      if (bottomDesc.cleanText) {
        parts.push({
          x: bottomDesc.rectX,
          y: bottomDesc.rectY,
          width: bottomDesc.rectW,
          height: bottomDesc.rectH,
        });
      }

      if (leftDesc.cleanText) {
        parts.push({
          x: leftDesc.rectX,
          y: leftDesc.rectY,
          width: leftDesc.rectW,
          height: leftDesc.rectH,
        });
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
        status: 'idle',
        iconDetails: {
          iconW,
          iconH,
          xPos,
          yPos,
          leftLabel,
          rightLabel,
          leftDesc,
          bottomLabel,
          bottomDesc,
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
      status: 'idle',
      circleDetails: {
        cleanText,
      },
    };
  });

  for (let i = 0; i < preparedElements.length; i++) {
    const elA = preparedElements[i];
    for (let j = i + 1; j < preparedElements.length; j++) {
      const elB = preparedElements[j];
      if (boundingBoxesOverlap(elA.bbox, elB.bbox)) {
        const partsOverlap = elA.parts.some((pA) =>
          elB.parts.some((pB) => rectsOverlap(pA, pB)),
        );
        if (partsOverlap) {
          const priorityA = mappingSVGs[elA.ptApp6dType]?.priority ?? 0;
          const priorityB = mappingSVGs[elB.ptApp6dType]?.priority ?? 0;

          // if (elA.pt.isHQ) priorityA -= 5;
          // if (elB.pt.isHQ) priorityB -= 5;

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
