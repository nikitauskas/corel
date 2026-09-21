import { BlueForceElementLayout } from './points.js';

const CONNECTOR_STUB_MM = 4.5;

/**
 * Renders a two-segment solid connector between a displaced element and its anchor:
 *  1. A vertical line going straight down CONNECTOR_STUB_MM from the icon's bottom edge.
 *  2. A diagonal line from the bottom of that stub to anchorPt.
 *
 * @param anchorPt   - The original geographic anchor point in SVG space.
 * @param renderPt   - The displaced render position (center of the icon) in SVG space.
 * @param iconBottomY - The Y coordinate of the icon's bottom edge in SVG space.
 */
function renderConnector(
  anchorPt: { x: number; y: number },
  renderPt: { x: number; y: number },
  iconBottomY: number,
  iconW = 0,
  isHQ = false,
  isJustVertical = false,
): string {
  const stubBottomY = iconBottomY + (isHQ ? 8 : CONNECTOR_STUB_MM);
  const startX = isHQ ? renderPt.x - iconW / 2 + 0.2 : renderPt.x;

  return `      <path
  d="M ${startX.toFixed(3)},${iconBottomY.toFixed(3)}
     V ${stubBottomY.toFixed(3)}
     ${isJustVertical ? '' : `L ${anchorPt.x.toFixed(3)},${anchorPt.y.toFixed(3)}`}"
  fill="none"
  stroke="#333333"
  stroke-width="0.4" />`;
}

export function renderBlueForceSVG(
  preparedElements: BlueForceElementLayout[],
): string[] {
  const blueForceElements: string[] = [];
  const connectorLines: string[] = [];

  preparedElements.forEach((el, idx) => {
    const renderPt = el.renderPoint;
    const anchorPt = el.anchorPoint;
    const isDisplaced =
      el.status === 'displaced' &&
      renderPt &&
      (renderPt.x !== anchorPt.x || renderPt.y !== anchorPt.y);

    const dx = isDisplaced && renderPt ? renderPt.x - anchorPt.x : 0;
    const dy = isDisplaced && renderPt ? renderPt.y - anchorPt.y : 0;

    const elementLines: string[] = [];
    elementLines.push(`    <g id="${el.ptApp6dType}">`);

    // Draw connector: vertical stub from icon bottom, then diagonal to anchorPoint
    if (isDisplaced && renderPt) {
      // iconBottomY = center Y + half icon height; fall back to center Y for circles
      const iconBottomY =
        el.iconDetails != null
          ? renderPt.y + el.iconDetails.iconH / 2
          : renderPt.y;
      connectorLines.push(
        renderConnector(
          anchorPt,
          renderPt,
          iconBottomY,
          el.iconDetails?.iconW,
          el.pt.isHQ,
        ),
      );
    } else if (el.pt.isHQ) {
      const iconBottomY =
        el.iconDetails != null
          ? anchorPt.y + el.iconDetails.iconH / 2
          : anchorPt.y;
      connectorLines.push(
        renderConnector(
          anchorPt,
          anchorPt,
          iconBottomY,
          el.iconDetails?.iconW,
          el.pt.isHQ,
          true,
        ),
      );
    }

    // Wrap element content in translate group when displaced
    if (isDisplaced) {
      elementLines.push(
        `      <g transform="translate(${dx.toFixed(3)}, ${dy.toFixed(3)})">`,
      );
    }

    if (el.mappingIdx !== -1 && el.iconDetails) {
      const {
        xPos,
        yPos,
        leftLabel,
        rightLabel,
        leftDesc,
        bottomLabel,
        bottomDesc,
      } = el.iconDetails;

      const rectBgColor = el.status !== 'idle' ? '#ff0000' : '#92B4EC';

      if (leftLabel.cleanText) {
        elementLines.push(
          `      <rect x="${leftLabel.rectX}" y="${leftLabel.rectY}" width="${leftLabel.rectW}" height="${leftLabel.rectH}" fill="${leftLabel.bgColor}" />`,
          `      <text id="blue-label-${idx + 1}" x="${leftLabel.xPos}" y="${leftLabel.yPos.toFixed(3)}" text-anchor="${leftLabel.textAnchor}" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${leftLabel.cleanText}</text>`,
        );
      }

      if (rightLabel.cleanText) {
        elementLines.push(
          `      <rect x="${rightLabel.rectX}" y="${rightLabel.rectY}" width="${rightLabel.rectW}" height="${rightLabel.rectH}"  fill="${rightLabel.bgColor}" />`,
          `      <text id="blue-label-right-${idx + 1}" x="${rightLabel.xPos}" y="${rightLabel.yPos.toFixed(3)}" text-anchor="${rightLabel.textAnchor}" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${rightLabel.cleanText}</text>`,
        );
      }

      if (bottomLabel.cleanText) {
        elementLines.push(
          `      <rect x="${bottomLabel.rectX}" y="${bottomLabel.rectY}" width="${bottomLabel.rectW}" height="${bottomLabel.rectH}" fill="${bottomLabel.bgColor}" />`,
          `      <text id="blue-label-bottom-${idx + 1}" x="${bottomLabel.xPos.toFixed(3)}" y="${bottomLabel.yPos.toFixed(3)}" text-anchor="${bottomLabel.textAnchor}" font-family="ArialBI, sans-serif" font-size="3.526" fill="#000000">${bottomLabel.cleanText}</text>`,
        );
      }

      if (bottomDesc.cleanText) {
        elementLines.push(
          `      <rect x="${bottomDesc.rectX}" y="${bottomDesc.rectY}" width="${bottomDesc.rectW}" height="${bottomDesc.rectH}" fill="${bottomDesc.bgColor}"/>`,
          `      <text id="blue-label-bottom-desc-${idx + 1}" x="${bottomDesc.xPos.toFixed(3)}" y="${bottomDesc.yPos.toFixed(3)}" text-anchor="${bottomDesc.textAnchor}" font-family="ArialBI, sans-serif" font-size="2.822" fill="#000000">${bottomDesc.cleanText}</text>`,
        );
      }

      if (leftDesc.cleanText) {
        elementLines.push(
          `      <rect x="${leftDesc.rectX}" y="${leftDesc.rectY}" width="${leftDesc.rectW}" height="${leftDesc.rectH}" fill="${leftDesc.bgColor}"/>`,
          `      <text id="blue-label-desc-${idx + 1}" x="${leftDesc.xPos.toFixed(3)}" y="${leftDesc.yPos.toFixed(3)}" text-anchor="${leftDesc.textAnchor}" font-family="ArialBI, sans-serif" font-size="2.822" fill="#000000">${leftDesc.cleanText}</text>`,
        );
      }

      elementLines.push(
        `      <g transform="translate(${xPos} ${yPos})" data-status="${el.status}" data-anchor-point="${anchorPt.x} ${anchorPt.y}" data-render-point="${renderPt?.x} ${renderPt?.y}">`,
        `        <use xlink:href="#icon-mapping-${el.mappingIdx}" />`,
        '      </g>',
      );
    } else if (el.circleDetails) {
      elementLines.push(
        `      <circle id="blue-point-${idx + 1}" cx="${anchorPt.x}" cy="${anchorPt.y}" r="2.0" fill="#ff0000" stroke="#000000" stroke-width="0.3" />`,
        `      <text id="blue-label-${idx + 1}" x="${anchorPt.x}" y="${(anchorPt.y + 4.2).toFixed(3)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="1.6" font-weight="bold" fill="#cc0000">${el.circleDetails.cleanText}</text>`,
      );
    }

    if (isDisplaced) {
      elementLines.push('      </g>');
    }

    elementLines.push('    </g>');
    blueForceElements.push(elementLines.join('\n'));
  });

  if (connectorLines.length > 0) {
    blueForceElements.unshift(
      `    <g id="connectors">\n${connectorLines.join('\n')}\n    </g>`,
    );
  }

  return blueForceElements;
}
