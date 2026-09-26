import type { MapContext } from './geo';

export function buildFinalSvg(
  map: MapContext,
  generatedIconsDefs: string,
  unitsSpearationLinesSVGs: string[],
  mapObjectsSVGs: string[],
): string {
  const { widthMm, heightMm, centerX, centerY, scale, mgrsTL } = map;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}" style="width: ${widthMm}mm; height: ${heightMm}mm;" version="1.1">
  <sodipodi:namedview id="namedview1" pagecolor="#ffffff" bordercolor="#666666" borderopacity="1.0" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:document-units="mm" showgrid="false" units="mm" width="${widthMm}mm" height="${heightMm}mm" inkscape:zoom="1" inkscape:cx="${centerX}" inkscape:cy="${centerY}" />
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
  <rect id="background" width="100%" height="100%" fill="#ffffff" />

  <!-- Center Crosshair Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line id="vertical-center-line" x1="${centerX}" y1="0" x2="${centerX}" y2="${heightMm}" />
    <!-- Horizontal Center Line -->
    <line id="horizontal-center-line" x1="0" y1="${centerY}" x2="${widthMm}" y2="${centerY}" />
  </g>

  <!-- Lines Layer (Горизонтальна між підрозділами) -->
  <g id="Units Separation Lines">
${unitsSpearationLinesSVGs.join('\n')}
  </g>

  <!-- Map Objects and Connectors Layer -->
  <g id="Map Objects and Connectors">
${mapObjectsSVGs.join('\n')}
  </g>

</svg>
`;
}
