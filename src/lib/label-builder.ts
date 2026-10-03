import { CHAR_WIDTHS_1000, DEFAULT_CHAR_WIDTH_1000 } from "./char-widths";

/** All geometric + content data needed to render a label + its background rect. */
export interface LabelLayout {
  cleanText: string;
  /** SVG text x anchor point. */
  textX: number;
  /** SVG text baseline y. */
  textY: number;
  /** SVG text-anchor attribute value. */
  textAnchor: "end" | "start" | "middle";
  fontSize: "sm" | "md";
  fontStyle: "normal" | "italic" | "bold" | "bold-italic";
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  bgColor: string;
}

export const LAYOUT_CONFIG = {
  rectPadX: 0.9,
  rectPadY: 0.05,
  spacing: 0.2, // Gap between stacked labels
  fontSize: { sm: 2.822, md: 3.526 },
  rectHeight: { sm: 2.822, md: 2.917 },
  fontStyle: {
    normal: "Arial",
    "bold-italic": "ArialBI",
    italic: "ArialI",
    bold: "ArialBI",
  },
} as const;

const round = (val: number, decimals = 3) => Number(val.toFixed(decimals));

export const labelBuilder = (
  rawName: string,
  anchor: [anchorX: number, anchorY: number],
  textAnchor: "start" | "middle" | "end",
  dir: "down" | "up" = "down",
  fontSize: "sm" | "md" = "md",
  bgColor = "none",
  fontStyle: "normal" | "italic" | "bold" | "bold-italic" = "bold-italic",
): LabelLayout => {
  const [anchorX, anchorY] = anchor;

  const fontSizeMm = LAYOUT_CONFIG.fontSize[fontSize];
  const rectHeight = LAYOUT_CONFIG.rectHeight[fontSize];
  let currentY = anchorY;

  const cleanText = rawName ?? "";

  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);
  const rectW = textWidth + LAYOUT_CONFIG.rectPadX * 2;
  const rectH = rectHeight;

  let rectX: number;
  if (textAnchor === "start") {
    rectX = anchorX;
  } else if (textAnchor === "end") {
    rectX = anchorX - rectW;
  } else {
    rectX = anchorX - rectW / 2;
  }

  let rectY: number;
  if (dir === "down") {
    rectY = currentY;
    currentY += rectH;
  } else {
    rectY = currentY - rectH;
    currentY -= rectH;
  }

  const textX =
    textAnchor === "start"
      ? rectX + LAYOUT_CONFIG.rectPadX
      : textAnchor === "end"
        ? rectX + rectW - LAYOUT_CONFIG.rectPadX
        : anchorX;

  const textY = rectY + rectH - LAYOUT_CONFIG.rectPadY;

  return {
    cleanText,
    textX: round(textX),
    textY: round(textY),
    textAnchor,
    fontSize,
    fontStyle,
    rectX: round(rectX),
    rectY: round(rectY),
    rectW: round(rectW),
    rectH: round(rectH),
    bgColor,
  };
};

/**
 * Measures rendered text width in millimeters for Arial Bold Italic
 * at a given font size (mm), using per-glyph AFM-style advance widths.
 */
export function measureTextWidthMm(text: string, fontSizeMm: number): number {
  let totalUnits = 0;
  for (const ch of text) {
    totalUnits += CHAR_WIDTHS_1000[ch] ?? DEFAULT_CHAR_WIDTH_1000;
  }
  return (totalUnits / 1000) * fontSizeMm;
}
