import { BlueForceElementLayout } from './points.js';

const CONNECTOR_STUB_MM = 4.5;

/**
 * Renders a two-segment solid connector between a displaced element and its anchor:
 *  1. A vertical line going straight down CONNECTOR_STUB_MM from renderPt.
 *  2. A diagonal line from the bottom of that stub to anchorPt.
 */
function renderConnector(
  anchorPt: { x: number; y: number },
  renderPt: { x: number; y: number },
): string {
  const stubBottomY = renderPt.y + CONNECTOR_STUB_MM;
  return `      <path
  d="M ${renderPt.x.toFixed(3)},${renderPt.y.toFixed(3)}
     V ${stubBottomY.toFixed(3)}
     L ${anchorPt.x.toFixed(3)},${anchorPt.y.toFixed(3)}"
  fill="none"
  stroke="#333333"
  stroke-width="0.4" />`;
}

export function renderBlueForceSVG(
  preparedElements: BlueForceElementLayout[],
): string[] {
  const blueForceElements: string[] = [];

  preparedElements.forEach((el, idx) => {
    const isOverlapping = el.isOverlapping;

    // Determine if element should be displaced to a renderPoint
    const renderPt = el.renderPoint;
    const anchorPt = el.anchorPoint;
    const isDisplaced =
      isOverlapping &&
      renderPt &&
      (renderPt.x !== anchorPt.x || renderPt.y !== anchorPt.y);

    const dx = isDisplaced && renderPt ? renderPt.x - anchorPt.x : 0;
    const dy = isDisplaced && renderPt ? renderPt.y - anchorPt.y : 0;

    const elementLines: string[] = [];
    elementLines.push(`    <g id="${el.ptApp6dType}">`);

    // Draw connector: vertical stub down from renderPoint, then diagonal to anchorPoint
    if (isDisplaced && renderPt) {
      elementLines.push(renderConnector(anchorPt, renderPt));
    }

    // Wrap element content in translate group when displaced
    if (isDisplaced) {
      elementLines.push(
        `      <g transform="translate(${dx.toFixed(3)}, ${dy.toFixed(3)})">`,
      );
    }

    if (el.mappingIdx !== -1 && el.iconDetails) {
      const { xPos, yPos, leftLabel, rightLabel, leftDesc } = el.iconDetails;

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

  return blueForceElements;
}
