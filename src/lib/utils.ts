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

// ─────────────────────────────────────────────────────────────
// Unified label layout
// ─────────────────────────────────────────────────────────────

/**
 * Placement strategy for a label relative to its parent icon.
 *
 * - `left`          – text-anchor="end",    text sits to the left of the icon
 * - `right`         – text-anchor="start",  text sits to the right of the icon
 * - `bottom-center` – text-anchor="middle", text is horizontally centered below the icon
 * - `bottom-left`   – text-anchor="start",  text starts from the icon's left edge, grows right
 */
export type LabelAnchor = 'left' | 'right' | 'bottom-center' | 'bottom-left';

/** All geometric + content data needed to render a label + its background rect. */
export interface LabelLayout {
  cleanText: string;
  /** SVG text x anchor point. */
  textX: number;
  /** SVG text baseline y. */
  textY: number;
  /** SVG text-anchor attribute value. */
  textAnchor: 'end' | 'start' | 'middle';
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  bgColor: string;
}

/**
 * Unified label layout calculator.
 *
 * For `left` / `right` anchors, `marginOffset` shifts the label outward along
 * the horizontal axis (negative = further left for `left`).
 * For `bottom-*` anchors, `marginOffset` is the vertical gap between the
 * bottom of the icon (svgPt.y + iconH/2) and the top of the background rect.
 *
 * When computing a secondary label (desc) that sits below another label rather
 * than below the icon, pass the label's rect-bottom as `svgPt.y` with
 * `iconH = 0` and set `marginOffset` to the desired gap.
 */
function computeLabelLayout(
  rawName: string,
  anchor: LabelAnchor,
  bgColor: string,
  size: 'sm' | 'md',
  //////////////////////////////
  svgPt: { x: number; y: number },
  iconW: number,
  iconH: number,
  marginOffset = 0.0, ///////////
  rectPadX = 0.9,
  rectPadY = 0.05,
): LabelLayout {
  let fontSizeMm = 3.526; // matches font-size="3.526" in CorelDraw
  let rectHeight = 2.917; // mm — matches text height in CorelDraw

  if (size === 'sm') {
    fontSizeMm = 2.822;
    rectHeight = 2.822;
  }

  const cleanText = rawName ?? '';
  const textWidth = measureTextWidthMm(cleanText, fontSizeMm);

  let textX: number;
  let textY: number;
  let rectX: number;
  let rectY: number;
  let textAnchor: 'end' | 'start' | 'middle';

  // Vertical baseline for left/right labels: icon bottom edge + a small inward nudge
  const sideBaselineY = Number((svgPt.y + iconH / 2 - 0.2).toFixed(3));

  switch (anchor) {
    case 'left': {
      textAnchor = 'end';
      const marginOffsetX = -0.5;
      textX = Number((svgPt.x - iconW / 2 + marginOffsetX).toFixed(3));
      textY = sideBaselineY;
      rectX = Number((textX - textWidth - rectPadX).toFixed(3));
      rectY = Number((textY - rectHeight + rectPadY).toFixed(3));
      break;
    }

    case 'right': {
      textAnchor = 'start';
      const marginOffsetX = 0.5;
      textX = Number((svgPt.x + iconW / 2 + marginOffsetX).toFixed(3));
      textY = sideBaselineY;
      rectX = Number((textX - rectPadX).toFixed(3));
      rectY = Number((textY - rectHeight + rectPadY).toFixed(3));
      break;
    }

    case 'bottom-center': {
      textAnchor = 'middle';
      textX = Number(svgPt.x.toFixed(3));
      rectY = Number((svgPt.y + iconH / 2 + marginOffset).toFixed(3));
      textY = Number((rectY + rectHeight - rectPadY).toFixed(3));
      rectX = Number((textX - textWidth / 2 - rectPadX).toFixed(3));
      break;
    }

    case 'bottom-left': {
      textAnchor = 'start';
      const marginOffsetX = 1.5;
      textX = Number((svgPt.x - iconW / 2 + marginOffsetX).toFixed(3));
      rectY = Number((svgPt.y + iconH / 2 + marginOffset).toFixed(3));
      textY = Number((rectY + rectHeight - rectPadY).toFixed(3));
      rectX = Number((textX - rectPadX).toFixed(3));
      break;
    }
  }

  return {
    cleanText,
    textX,
    textY,
    textAnchor,
    rectX,
    rectY,
    rectW: Number((textWidth + rectPadX * 2).toFixed(3)),
    rectH: Number(rectHeight.toFixed(3)),
    bgColor,
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function rectsOverlap(r1: Rect, r2: Rect): boolean {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

export function boundingBoxesOverlap(
  b1: BoundingBox,
  b2: BoundingBox,
): boolean {
  return (
    b1.minX < b2.maxX &&
    b1.maxX > b2.minX &&
    b1.minY < b2.maxY &&
    b1.maxY > b2.minY
  );
}

export function computeBoundingBox(rects: Rect[]): BoundingBox {
  if (rects.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { minX, minY, maxX, maxY };
}

export { measureTextWidthMm, computeLabelLayout };
