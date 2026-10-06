import type { MapContext } from "./geo";

export function buildFinalSvg(
  map: MapContext,
  generatedIconsDefs: string,
  unitsSpearationLinesSVGs: string[],
  mapObjectsSVGs: string[],
): string {
  const { widthMm, heightMm, centerX, centerY, scale, mgrsTL } = map;

  // For a stroke-width of 3, we offset by 1.5 to keep it perfectly within the viewBox
  const strokeWidth = 3;
  const offset = strokeWidth / 2;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" style="width: ${widthMm}mm; height: ${heightMm}mm;" version="1.1">
  <metadata id="metadata1">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <cc:Work xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:format>image/svg+xml</dc:format>
        <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <dc:title>1:${scale} Map ${widthMm}×${heightMm}mm — TL MGRS ${mgrsTL} — SIDC UAV Drone Icons</dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>

${generatedIconsDefs}

  <!-- Background / Canvas Layout -->
  <rect 
    id="background" 
    x="${offset}" 
    y="${offset}" 
    width="${widthMm - strokeWidth}" 
    height="${heightMm - strokeWidth}" 
    stroke="red" 
    stroke-width="${strokeWidth}"
    shape-rendering="crispEdges" 
    fill="none"
  /> 
  <rect id="canvas-frame" x="0" y="0" width="${widthMm}" height="${heightMm}" fill="none" stroke="none" />

  <!-- Center Crosshair Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line id="vertical-center-line" x1="${centerX}" y1="0" x2="${centerX}" y2="${heightMm}" />
    <!-- Horizontal Center Line -->
    <line id="horizontal-center-line" x1="0" y1="${centerY}" x2="${widthMm}" y2="${centerY}" />
  </g>

  <!-- Lines Layer (Горизонтальна між підрозділами) -->
  <g id="Units Separation Lines">
${unitsSpearationLinesSVGs.join("\n")}
  </g>

  <!-- Map Objects and Connectors Layer -->
  <g id="Map Objects and Connectors">
${mapObjectsSVGs.join("\n")}
  </g>

</svg>
`;
}
