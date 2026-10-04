import type { MapContext } from "./geo";

export function buildFinalSvg(
  map: MapContext,
  generatedIconsDefs: string,
  unitsSpearationLinesSVGs: string[],
  mapObjectsSVGs: string[],
): string {
  const { widthMm, heightMm, centerX, centerY, scale, mgrsTL } = map;

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

  <!-- Background / Canvas -->
<rect id="background" x="-1" y="-1" width="${widthMm + 2}" height="${heightMm + 2}" fill="none" shape-rendering="crispEdges" /> 
  <rect id="canvas-frame" x="0" y="0" width="${widthMm}" height="${heightMm}" fill="none" stroke="red" stroke-width="2" />

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
