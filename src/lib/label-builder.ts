import { LabelLayout, measureTextWidthMm } from './utils.js';

const round = (val: number, decimals = 3) => Number(val.toFixed(decimals));

export const labelBuilder = (
  rawName: string,
  anchor: [anchorX: number, anchorY: number],
  textAnchor: 'start' | 'middle' | 'end',
  dir: 'down' | 'up' = 'down',
  textSize: 'sm' | 'md' = 'md',
  bgColor = 'none',
): LabelLayout => {
  const [anchorX, anchorY] = anchor;

  let fontSizeMm = 3.526; // matches font-size="3.526" in CorelDraw
  let rectHeight = 2.917; // mm — matches text height in CorelDraw
  let currentY = anchorY;

  const rectPadX = 0.9;
  const rectPadY = 0.05;

  const cleanText = rawName ?? '';

  if (textSize === 'sm') {
    fontSizeMm = 2.822;
    rectHeight = 2.822;
  }

  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);
  const rectW = textWidth + rectPadX * 2;
  const rectH = rectHeight;

  let rectX: number;
  if (textAnchor === 'start') {
    rectX = anchorX;
  } else if (textAnchor === 'end') {
    rectX = anchorX - rectW;
  } else {
    rectX = anchorX - rectW / 2;
  }

  let rectY: number;
  if (dir === 'down') {
    rectY = currentY;
    currentY += rectH;
  } else {
    rectY = currentY - rectH;
    currentY -= rectH;
  }

  const textX =
    textAnchor === 'start'
      ? rectX + rectPadX
      : textAnchor === 'end'
        ? rectX + rectW - rectPadX
        : anchorX;

  const textY = rectY + rectH - rectPadY;

  return {
    cleanText,
    textX: round(textX),
    textY: round(textY),
    textAnchor,
    rectX: round(rectX),
    rectY: round(rectY),
    rectW: round(rectW),
    rectH: round(rectH),
    bgColor,
  };
};
