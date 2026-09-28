import { LAYOUT_CONFIG } from "./label-builder";
import type { MapObjectLayout } from "./map-objects";

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
  el: MapObjectLayout,
  anchorPt: { x: number; y: number },
  renderPt: { x: number; y: number },
  idx: number,
  iconBottomY: number,
  iconW = 0,
  isHQ = false,
  isJustVertical = false,
): string {
  const stubBottomY = iconBottomY + (isHQ ? 8 : CONNECTOR_STUB_MM);
  const startX = isHQ ? renderPt.x - iconW / 2 + 0.2 : renderPt.x;

  return `      <path
  id="[${idx + 1}] ${el.pt.name}"
  d="M ${startX.toFixed(3)},${iconBottomY.toFixed(3)}
     V ${stubBottomY.toFixed(3)}
     ${isJustVertical ? "" : `L ${anchorPt.x.toFixed(3)},${anchorPt.y.toFixed(3)}`}"
  fill="none"
  stroke="#333333"
  stroke-width="0.4" />`;
}

export function renderElementsSVG(
  preparedElements: MapObjectLayout[],
): string[] {
  const layers = new Map<
    string,
    { elements: string[]; connectors: string[] }
  >();

  preparedElements.forEach((el, idx) => {
    if (el.isExcluded) {
      return;
    }

    const layerName = el.overlayName || "Default Overlay";
    let layer = layers.get(layerName);
    if (!layer) {
      layer = { elements: [], connectors: [] };
      layers.set(layerName, layer);
    }

    const renderPt = el.renderPoint;
    const anchorPt = el.anchorPoint;
    const isDisplaced =
      el.status === "displaced" &&
      renderPt &&
      (renderPt.x !== anchorPt.x || renderPt.y !== anchorPt.y);

    const dx = isDisplaced && renderPt ? renderPt.x - anchorPt.x : 0;
    const dy = isDisplaced && renderPt ? renderPt.y - anchorPt.y : 0;

    const elementLines: string[] = [];
    elementLines.push(`    <g id="[${idx + 1}] ${el.pt.name}">`);

    // Draw connector: vertical stub from icon bottom, then diagonal to anchorPoint
    if (isDisplaced && renderPt) {
      // iconBottomY = center Y + half icon height; fall back to center Y for circles
      const iconBottomY =
        el.iconDetails != null
          ? renderPt.y + el.iconDetails.iconH / 2
          : renderPt.y;
      layer.connectors.push(
        renderConnector(
          el,
          anchorPt,
          renderPt,
          idx,
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
      layer.connectors.push(
        renderConnector(
          el,
          anchorPt,
          anchorPt,
          idx,
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

    if (el.iconDetails) {
      const { xPos, yPos, labels } = el.iconDetails;

      const renderMappingIdx = el.mappingIdx === -1 ? 0 : el.mappingIdx;

      //const rectBgColor = el.status !== 'idle' ? '#ff0000' : '#92B4EC';

      for (let i = 0; i < labels.length; i++) {
        elementLines.push(
          `      <rect x="${labels[i].rectX}" y="${labels[i].rectY}" width="${labels[i].rectW}" height="${labels[i].rectH}" fill="${labels[i].bgColor}" />`,
          `      <text id="blue-label-top-${idx + 1}-${i + 1}" x="${labels[i].textX.toFixed(3)}" y="${labels[i].textY.toFixed(3)}" text-anchor="${labels[i].textAnchor}" font-family="${LAYOUT_CONFIG.fontStyle[labels[i].fontStyle]}, sans-serif" font-size="${LAYOUT_CONFIG.fontSize[labels[i].fontSize]}" fill="#000000">${labels[i].cleanText}</text>`,
        );
      }

      elementLines.push(
        `      <g transform="translate(${xPos} ${yPos})" data-status="${el.status}" data-anchor-point="${anchorPt.x} ${anchorPt.y}" data-render-point="${renderPt?.x} ${renderPt?.y}" data-ptapp6d-type="${el.ptApp6dType}" data-object-id="${el.pt.objectId}">`,
        `        <use xlink:href="#icon-mapping-${renderMappingIdx}" />`,
      );

      if (el.iconDetails.damageOverlay) {
        const isDestroyed = el.iconDetails.damageOverlay === "destroyed";
        const scale = el.iconDetails.iconH / 28 + 0.05;
        const destW = 34 * scale;
        const destH = 34 * scale;
        const offsetX = (el.iconDetails.iconW - destW) / 2;
        const offsetY = (el.iconDetails.iconH - destH) / 2;

        const pathData = isDestroyed ? "M3 3L31 31M31 3L3 31" : "M31 3L3 31";
        const strokeColor = isDestroyed ? "red" : "#000";

        elementLines.push(
          `        <g transform="translate(${offsetX.toFixed(3)}, ${offsetY.toFixed(3)}) scale(${scale.toFixed(3)})">`,
          `          <path d="${pathData}" stroke="${strokeColor}" stroke-width="1.5"/>`,
          "        </g>",
        );
      }

      elementLines.push("      </g>");
    }

    if (isDisplaced) {
      elementLines.push("      </g>");
    }

    elementLines.push("    </g>");
    layer.elements.push(elementLines.join("\n"));
  });

  const connectorLines: string[] = ['  <g id="Connectors">'];
  const objectLines: string[] = ['  <g id="Map Objects">'];

  layers.forEach((layer, layerName) => {
    // Connectors group (only emit if layer has connectors)
    if (layer.connectors.length > 0) {
      connectorLines.push(`    <g id="${layerName}">`);
      connectorLines.push(...layer.connectors);
      connectorLines.push("    </g>");
    }

    // Objects group (always emit)
    objectLines.push(`    <g id="${layerName}">`);
    objectLines.push(...layer.elements);
    objectLines.push("    </g>");
  });

  connectorLines.push("  </g>");
  objectLines.push("  </g>");

  return [...connectorLines, ...objectLines];
}
