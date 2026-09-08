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
function measureTextWidthMm(text: string, fontSizeMm: number): number {
  let totalUnits = 0;
  for (const ch of text) {
    totalUnits += CHAR_WIDTHS_1000[ch] ?? DEFAULT_CHAR_WIDTH_1000;
  }
  return (totalUnits / 1000) * fontSizeMm;
}

/**
 * Computes the background rect + text position for a bottom-left-anchored
 * icon label, using accurate glyph-width measurement instead of a flat
 * per-character estimate.
 */
function computeLeftLabelLayout(
  svgPt: { x: number; y: number },
  iconW: number,
  iconH: number,
  rawName: string,
  fontSizeMm = 3.526, // matches font-size="3.526" used in <text>
  rectPadX = 0.9,
  rectPadY = 0.05,
  rectHeight = 2.917, // mm — matches text height in CorelDraw
  marginOffsetX = 0.0, // Extra outwards shift from the icon (user tweakable)
  marginOffsetY = -0.2, // Extra outwards shift from the icon (user tweakable)
) {
  const cleanText = escapeXml(rawName ?? '');

  // Shift left by marginOffset so it doesn't overlap the icon more than desired
  const xPos = Number((svgPt.x - iconW / 2 + marginOffsetX).toFixed(3));
  const yPos = Number((svgPt.y + iconH / 2 + marginOffsetY).toFixed(3));

  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);

  const rectX = (xPos - textWidth - rectPadX).toFixed(3);
  const rectY = (yPos - rectHeight + rectPadY).toFixed(3);
  const rectW = (textWidth + rectPadX * 2).toFixed(3);
  const rectH = rectHeight.toFixed(3);

  return { xPos, yPos, cleanText, rectX, rectY, rectW, rectH };
}

// Helper to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function computeRightLabelLayout(
  svgPt: { x: number; y: number },
  iconW: number,
  iconH: number,
  rawName: string,
  fontSizeMm = 3.526, // matches font-size="3.526" used in <text>
  rectPadX = 0.9,
  rectPadY = 0.05,
  rectHeight = 2.917, // mm — matches text height in CorelDraw
  marginOffsetX = 0.0, // Extra outwards shift from the icon (user tweakable)
  marginOffsetY = -0.2, // Extra outwards shift from the icon (user tweakable)
) {
  const cleanText = escapeXml(rawName ?? '');

  // Shift right by marginOffset so it doesn't overlap the icon more than desired
  const xPos = Number((svgPt.x + iconW / 2 + marginOffsetX).toFixed(3));
  const yPos = Number((svgPt.y + iconH / 2 + marginOffsetY).toFixed(3));

  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);

  const rectX = (xPos - rectPadX).toFixed(3);
  const rectY = (yPos - rectHeight + rectPadY).toFixed(3);
  const rectW = (textWidth + rectPadX * 2).toFixed(3);
  const rectH = rectHeight.toFixed(3);

  return { xPos, yPos, cleanText, rectX, rectY, rectW, rectH };
}

export {
  measureTextWidthMm,
  computeLeftLabelLayout,
  computeRightLabelLayout,
  escapeXml,
};
