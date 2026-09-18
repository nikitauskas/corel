import { BlueForceElementLayout } from './points.js';

const OVERLAP_OFFSET_MM = 20;

/**
 * For each overlapping element, assigns a `renderPoint` offset 20mm
 * to the top-left from its `anchorPoint`.
 * Non-overlapping elements are left with `renderPoint` undefined (use anchorPoint).
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  for (const el of elements) {
    if (el.isOverlapping) {
      el.renderPoint = {
        x: el.anchorPoint.x - OVERLAP_OFFSET_MM,
        y: el.anchorPoint.y - OVERLAP_OFFSET_MM,
      };
    }
  }
}
