import { TOTAL_WIDTH_MM, TOTAL_HEIGHT_MM, CENTER_X_MM, CENTER_Y_MM, MGRS_TL } from './geo.js';

export function buildFinalSvg(
  generatedIconsDefs: string,
  pathElements: string,
  bluePointElements: string[],
  blueTextElements: string[],
): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${TOTAL_WIDTH_MM}mm" height="${TOTAL_HEIGHT_MM}mm" viewBox="0 0 ${TOTAL_WIDTH_MM} ${TOTAL_HEIGHT_MM}" style="width: ${TOTAL_WIDTH_MM}mm; height: ${TOTAL_HEIGHT_MM}mm;" version="1.1">
  <sodipodi:namedview id="namedview1" pagecolor="#ffffff" bordercolor="#666666" borderopacity="1.0" inkscape:showpageshadow="2" inkscape:pageopacity="0.0" inkscape:pagecheckerboard="0" inkscape:deskcolor="#d1d1d1" inkscape:document-units="mm" showgrid="false" units="mm" width="${TOTAL_WIDTH_MM}mm" height="${TOTAL_HEIGHT_MM}mm" inkscape:zoom="1" inkscape:cx="${CENTER_X_MM}" inkscape:cy="${CENTER_Y_MM}" />
  <metadata id="metadata1">
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <cc:Work xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:format>image/svg+xml</dc:format>
        <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage" />
        <dc:title>1:25000 Map 1810×1810mm — TL MGRS ${MGRS_TL} — SIDC UAV Drone Icons</dc:title>
      </cc:Work>
    </rdf:RDF>
  </metadata>

${generatedIconsDefs}

  <!-- Background / Canvas -->
  <rect id="background" width="100%" height="100%" fill="#ffffff" />

  <!-- Center Crosshair Lines -->
  <g id="CenterLines" stroke="#000000" stroke-width="0.5" stroke-linecap="square">
    <!-- Vertical Center Line -->
    <line id="vertical-center-line" x1="${CENTER_X_MM}" y1="0" x2="${CENTER_X_MM}" y2="${TOTAL_HEIGHT_MM}" />
    <!-- Horizontal Center Line -->
    <line id="horizontal-center-line" x1="0" y1="${CENTER_Y_MM}" x2="${TOTAL_WIDTH_MM}" y2="${CENTER_Y_MM}" />
  </g>

  <!-- Lines Layer (Горизонтальна між підрозділами) -->
  <g id="KMLLines">
${pathElements}
  </g>

  <!-- Blue Force Centered Labels -->
  <g id="BlueForceLabels">
${blueTextElements.join('\n')}
  </g>

  <!-- Blue Force Layer (Red Dots / Drone Icons) -->
  <g id="BlueForceDots">
${bluePointElements.join('\n')}
  </g>

</svg>
`;
}
