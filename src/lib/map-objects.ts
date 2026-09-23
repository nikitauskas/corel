import * as m from 'mgrs';
import { Point } from './geo.js';
import { mappingSVGs } from './icons.js';
import {
  BoundingBox,
  Rect,
  boundingBoxesOverlap,
  computeBoundingBox,
  rectsOverlap,
} from './utils.js';

const mgrs =
  'toPoint' in m ? m : (m as unknown as { default: typeof m }).default;

import { CsvRow } from './csv.js';
import {
  LabelLayout,
  labelBuilder,
  measureTextWidthMm,
} from './label-builder.js';

export function filterMapObjectsInsideWindow(
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
            name,
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

export interface MapObjectLayout {
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
    labels: LabelLayout[];
  };
  circleDetails?: {
    cleanText: string;
  };
}

export function buildMapObjects(
  csvData: CsvRow[],
  iconRenderedSizes: { width: number; height: number }[],
  inWindow: (lon: number, lat: number) => boolean,
  geoToSvg: (pt: Point) => { x: number; y: number },
) {
  const points = filterMapObjectsInsideWindow(csvData, inWindow);

  // 1. Calculate bounding polygon / rectangles for each element
  const preparedElements: MapObjectLayout[] = points.map((pt, idx) => {
    const anchorPoint = geoToSvg(pt);
    const ptApp6dType = pt.app6dType ?? '';
    const isHQ = pt.isHQ;
    const mappingIdx = Object.keys(mappingSVGs).findIndex(
      (key) => key === ptApp6dType,
    );

    if (mappingIdx !== -1) {
      const iconSize = iconRenderedSizes[mappingIdx] ?? {
        width: 8.0,
        height: 8.0,
      };

      const xPos = Number((anchorPoint.x - iconSize.width / 2).toFixed(3));
      const yPos = Number((anchorPoint.y - iconSize.height / 2).toFixed(3));

      let leftLabelText = '';
      let leftDescText = '';
      let rightLabelText = '';
      let rightDescText = '';
      let bottomLabelText = '';
      let bottomDescText = '';
      const topLabelText = '';

      const blueBg = '#92B4EC';

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
        leftDescText;
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

      if (pt.isHQ) {
        bottomLabelText = pt.name ?? '';
        bottomDescText = leftDescText;
        rightLabelText = '';
        rightDescText = '';
        leftLabelText = '';
        leftDescText = '';
      }

      if (ptApp6dType === 'Стик (між частинами та підрозділами)') {
        bottomLabelText = pt.name ?? '';
        rightLabelText = '';
        rightDescText = '';
        leftLabelText = '';
        leftDescText = '';
      }

      const margin = 0.5;
      const xIconLeft = anchorPoint.x - iconSize.width / 2;
      const xIconRight = anchorPoint.x + iconSize.width / 2;
      const xIconCenter = anchorPoint.x;
      const yIconTop = anchorPoint.y - iconSize.height / 2;
      const yIconBottom = anchorPoint.y + iconSize.height / 2;

      const rightLabel = labelBuilder(
        rightLabelText,
        [xIconRight, yIconBottom],
        'start',
        'up',
        'md',
        blueBg,
      );

      const leftLabel = labelBuilder(
        leftLabelText,
        [xIconLeft, yIconBottom],
        'end',
        'up',
        'md',
        blueBg,
      );

      // leftDesc sits below the leftLabel rect, centered on it
      const leftLabelBottomCenterAnchor = {
        x: leftLabel.rectX + leftLabel.rectW / 2,
        y: leftLabel.rectY + leftLabel.rectH,
      };

      const leftDesc = labelBuilder(
        leftDescText,
        [leftLabelBottomCenterAnchor.x, leftLabelBottomCenterAnchor.y],
        'middle',
        'down',
        'sm',
        'none',
        'normal',
      );

      const topLabel = labelBuilder(
        topLabelText,
        [xIconCenter, yIconTop],
        'middle',
        'up',
        'sm',
      );

      const bottomLabel = labelBuilder(
        bottomLabelText,
        isHQ ? [xIconLeft, yIconBottom] : [xIconCenter, yIconBottom],
        isHQ ? 'start' : 'middle',
        'down',
        'md',
      );

      const bottomLabelAnchor = {
        x: bottomLabel.rectX,
        y: bottomLabel.rectY + bottomLabel.rectH,
      };

      const bottomDesc = labelBuilder(
        bottomDescText,
        [bottomLabelAnchor.x, bottomLabelAnchor.y],
        isHQ ? 'start' : 'middle',
        'down',
        'sm',
      );

      const iconRect: Rect = {
        x: xPos,
        y: yPos,
        width: iconSize.width,
        height: iconSize.height,
      };
      const parts: Rect[] = [iconRect];

      const addLabelRect = (label: {
        cleanText: string;
        rectX: number;
        rectY: number;
        rectW: number;
        rectH: number;
      }) => {
        if (label.cleanText) {
          parts.push({
            x: label.rectX,
            y: label.rectY,
            width: label.rectW,
            height: label.rectH,
          });
        }
      };
      [
        leftLabel,
        leftDesc,
        bottomLabel,
        bottomDesc,
        rightLabel,
        topLabel,
      ].forEach(addLabelRect);

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
          iconW: iconSize.width,
          iconH: iconSize.height,
          xPos,
          yPos,
          labels: [
            leftLabel,
            leftDesc,
            rightLabel,
            bottomLabel,
            bottomDesc,
            topLabel,
          ],
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
          let priorityA = mappingSVGs[elA.ptApp6dType]?.priority ?? 0;
          let priorityB = mappingSVGs[elB.ptApp6dType]?.priority ?? 0;

          if (elA.pt.isHQ) priorityA -= 1;
          if (elB.pt.isHQ) priorityB -= 1;

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
