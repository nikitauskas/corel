import { BlueForceElementLayout } from './points.js';

/** Search grid step size in mm — smaller = closer to anchor, slower to compute */
const STEP_MM = 1.5;

/** Safety ring limit for the spiral search */
const MAX_RINGS = 400;

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function aabbsOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Returns the element's axis-aligned bounding box as if its centre were placed at (cx, cy).
 * The element's bbox in points.ts is computed relative to the anchorPoint, so we shift it.
 */
function bboxAt(el: BlueForceElementLayout, cx: number, cy: number): AABB {
  const dx = cx - el.anchorPoint.x;
  const dy = cy - el.anchorPoint.y;
  return {
    minX: el.bbox.minX + dx,
    minY: el.bbox.minY + dy,
    maxX: el.bbox.maxX + dx,
    maxY: el.bbox.maxY + dy,
  };
}

/**
 * Generates (x, y) candidate positions in an expanding square spiral centred on (cx, cy).
 * Ring 0 → the anchor itself; ring 1 → 8 neighbours at distance STEP_MM; and so on.
 */
function* spiralAround(cx: number, cy: number): Generator<[number, number]> {
  yield [cx, cy];
  for (let ring = 1; ring < MAX_RINGS; ring++) {
    // Walk the perimeter of the ring square (clockwise)
    for (let col = -ring; col <= ring; col++) {
      yield [cx + col * STEP_MM, cy - ring * STEP_MM]; // top edge
    }
    for (let row = -ring + 1; row <= ring; row++) {
      yield [cx + ring * STEP_MM, cy + row * STEP_MM]; // right edge
    }
    for (let col = ring - 1; col >= -ring; col--) {
      yield [cx + col * STEP_MM, cy + ring * STEP_MM]; // bottom edge
    }
    for (let row = ring - 1; row >= -ring + 1; row--) {
      yield [cx - ring * STEP_MM, cy + row * STEP_MM]; // left edge
    }
  }
}

/**
 * Assigns each overlapping element the closest possible renderPoint to its anchorPoint
 * that does not collide with any other element (overlapping or not).
 *
 * Non-overlapping elements are treated as immovable obstacles at their anchorPoints.
 * Overlapping elements are placed one-by-one (sorted top-to-bottom, left-to-right for
 * determinism), each claiming the nearest free slot.
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  const overlapping = elements.filter((el) => el.status === 'displaced');
  if (overlapping.length === 0) return;

  // Seed the occupied list with all non-displaced elements (fixed obstacles)
  const occupied: AABB[] = elements
    .filter((el) => el.status !== 'displaced')
    .map((el) => bboxAt(el, el.anchorPoint.x, el.anchorPoint.y));

  // Process top-to-bottom, left-to-right for stable, predictable output
  const sorted = [...overlapping].sort(
    (a, b) => a.anchorPoint.y - b.anchorPoint.y || a.anchorPoint.x - b.anchorPoint.x,
  );

  for (const el of sorted) {
    const { x: ax, y: ay } = el.anchorPoint;
    let placed = false;

    for (const [cx, cy] of spiralAround(ax, ay)) {
      const candidate = bboxAt(el, cx, cy);
      if (!occupied.some((o) => aabbsOverlap(candidate, o))) {
        el.renderPoint = {
          x: Number(cx.toFixed(3)),
          y: Number(cy.toFixed(3)),
        };
        occupied.push(candidate);
        placed = true;
        break;
      }
    }

    // Fallback: if spiral exhausted (shouldn't happen), leave renderPoint undefined
    if (!placed) {
      el.renderPoint = undefined;
    }
  }
}
