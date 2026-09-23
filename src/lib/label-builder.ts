/** All geometric + content data needed to render a label + its background rect. */
export interface LabelLayout {
  cleanText: string;
  /** SVG text x anchor point. */
  textX: number;
  /** SVG text baseline y. */
  textY: number;
  /** SVG text-anchor attribute value. */
  textAnchor: 'end' | 'start' | 'middle';
  fontSize: 'sm' | 'md';
  fontStyle: 'normal' | 'italic' | 'bold' | 'bold-italic';
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
} as const;

const round = (val: number, decimals = 3) => Number(val.toFixed(decimals));

export const labelBuilder = (
  rawName: string,
  anchor: [anchorX: number, anchorY: number],
  textAnchor: 'start' | 'middle' | 'end',
  dir: 'down' | 'up' = 'down',
  fontSize: 'sm' | 'md' = 'md',
  bgColor = 'none',
  fontStyle: 'normal' | 'italic' | 'bold' | 'bold-italic' = 'bold-italic',
): LabelLayout => {
  const [anchorX, anchorY] = anchor;

  let fontSizeMm = LAYOUT_CONFIG.fontSize[fontSize];
  let rectHeight = LAYOUT_CONFIG.rectHeight[fontSize];
  let currentY = anchorY;

  const cleanText = rawName ?? '';

  if (fontSize === 'sm') {
    fontSizeMm = 2.822;
    rectHeight = 2.822;
  }

  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);
  const rectW = textWidth + LAYOUT_CONFIG.rectPadX * 2;
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
      ? rectX + LAYOUT_CONFIG.rectPadX
      : textAnchor === 'end'
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

// ─────────────────────────────────────────────────────────────
// Arial Bold(Italic) glyph width table, units per 1000 em.
// Italic transform is a skew, not a width change, so Bold metrics apply.
// Unmapped chars fall back to DEFAULT_CHAR_WIDTH_1000.
// ─────────────────────────────────────────────────────────────

const CHAR_WIDTHS_1000: Record<string, number> = {
  // space & basic punctuation
  ' ': 278,
  '!': 333,
  '"': 474,
  '#': 556,
  $: 556,
  '%': 889,
  '&': 722,
  "'": 238,
  '(': 333,
  ')': 333,
  '*': 389,
  '+': 584,
  ',': 278,
  '-': 333,
  '.': 278,
  '/': 278,
  ':': 333,
  ';': 333,
  '<': 584,
  '=': 584,
  '>': 584,
  '?': 611,
  '@': 975,
  '[': 333,
  '\\': 278,
  ']': 333,
  '^': 584,
  _: 556,
  '`': 333,
  '{': 389,
  '|': 280,
  '}': 389,
  '~': 584,

  // digits (Arial digits are tabular — all equal width)
  '0': 556,
  '1': 556,
  '2': 556,
  '3': 556,
  '4': 556,
  '5': 556,
  '6': 556,
  '7': 556,
  '8': 556,
  '9': 556,

  // Latin uppercase
  A: 722,
  B: 722,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 556,
  K: 722,
  L: 611,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,

  // Latin lowercase
  a: 556,
  b: 611,
  c: 556,
  d: 611,
  e: 556,
  f: 333,
  g: 611,
  h: 611,
  i: 278,
  j: 278,
  k: 556,
  l: 278,
  m: 889,
  n: 611,
  o: 611,
  p: 611,
  q: 611,
  r: 389,
  s: 556,
  t: 333,
  u: 611,
  v: 556,
  w: 778,
  x: 556,
  y: 556,
  z: 500,

  // Cyrillic (Ukrainian) uppercase — estimated proportionally to Arial Bold shapes
  А: 722,
  Б: 667,
  В: 722,
  Г: 611,
  Ґ: 611,
  Д: 722,
  Е: 667,
  Є: 611,
  Ж: 944,
  З: 611,
  И: 722,
  І: 278,
  Ї: 278,
  Й: 722,
  К: 722,
  Л: 722,
  М: 833,
  Н: 722,
  О: 778,
  П: 722,
  Р: 667,
  С: 722,
  Т: 611,
  У: 667,
  Ф: 833,
  Х: 667,
  Ц: 722,
  Ч: 667,
  Ш: 944,
  Щ: 944,
  Ь: 611,
  Ю: 944,
  Я: 722,

  // Cyrillic (Ukrainian) lowercase
  а: 556,
  б: 611,
  в: 556,
  г: 389,
  ґ: 389,
  д: 611,
  е: 556,
  є: 500,
  ж: 778,
  з: 500,
  и: 611,
  і: 278,
  ї: 278,
  й: 611,
  к: 556,
  л: 556,
  м: 722,
  н: 611,
  о: 611,
  п: 611,
  р: 611,
  с: 556,
  т: 500,
  у: 556,
  ф: 778,
  х: 556,
  ц: 611,
  ч: 556,
  ш: 833,
  щ: 833,
  ь: 500,
  ю: 833,
  я: 556,

  '’': 238,
  '–': 556,
  '—': 1000,
  '№': 900,
};

const DEFAULT_CHAR_WIDTH_1000 = 611; // fallback for anything unmapped (e.g. emoji, rare symbols)

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
