import { BlueForceElementLayout } from './points.js';

/** Search grid step size in mm — smaller = closer to anchor, slower to compute */
const STEP_MM = 1.5;

/** Safety ring limit for the spiral search */
const MAX_RINGS = 400;

/** Minimum angle from the vertical axis (in radians) to ensure visible connector lines */
const MIN_VERTICAL_ANGLE_RAD = (10 * Math.PI) / 180;
const MIN_VERTICAL_TAN = Math.tan(MIN_VERTICAL_ANGLE_RAD);

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function aabbsOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
  );
}

function expandAABB(box: AABB, amount: number): AABB {
  return {
    minX: box.minX - amount,
    minY: box.minY - amount,
    maxX: box.maxX + amount,
    maxY: box.maxY + amount,
  };
}

/**
 * Returns the element's axis-aligned bounding box as if its centre were placed at (cx, cy).
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
 * Generates expanding square rings around (cx, cy).
 * Yields an array of all points in the current ring so they can be scored together.
 */
function* spiralRings(cx: number, cy: number): Generator<[number, number][]> {
  yield [[cx, cy]]; // Ring 0
  for (let ring = 1; ring < MAX_RINGS; ring++) {
    const currentRing: [number, number][] = [];
    for (let col = -ring; col <= ring; col++) {
      currentRing.push([cx + col * STEP_MM, cy - ring * STEP_MM]); // top
    }
    for (let row = -ring + 1; row <= ring; row++) {
      currentRing.push([cx + ring * STEP_MM, cy + row * STEP_MM]); // right
    }
    for (let col = ring - 1; col >= -ring; col--) {
      currentRing.push([cx + col * STEP_MM, cy + ring * STEP_MM]); // bottom
    }
    for (let row = ring - 1; row >= -ring + 1; row--) {
      currentRing.push([cx - ring * STEP_MM, cy + row * STEP_MM]); // left
    }
    yield currentRing;
  }
}

/**
 * Simple Disjoint-Set (Union-Find) to group overlapping elements into clusters.
 */
class UnionFind {
  parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] === i) return i;
    const root = this.find(this.parent[i]);
    this.parent[i] = root;
    return root;
  }
  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
    }
  }
}

/**
 * Assigns each overlapping element the closest possible renderPoint to its anchor.
 * Uses a directional bias to cluster elements of the same type together, while
 * avoiding vertical stacking to ensure connector lines are visible.
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  const overlapping = elements
    .filter((el) => el.status === 'displaced')
    .sort(
      (a, b) =>
        a.anchorPoint.y - b.anchorPoint.y || a.anchorPoint.x - b.anchorPoint.x,
    );

  if (overlapping.length === 0) return;

  const occupied: AABB[] = elements
    .filter((el) => el.status !== 'displaced')
    .map((el) => bboxAt(el, el.anchorPoint.x, el.anchorPoint.y));

  // 1. Find Connected Clusters
  const uf = new UnionFind(overlapping.length);
  const bboxes = overlapping.map((el) =>
    bboxAt(el, el.anchorPoint.x, el.anchorPoint.y),
  );

  for (let i = 0; i < overlapping.length; i++) {
    const boxI = expandAABB(bboxes[i], STEP_MM * 2);
    for (let j = i + 1; j < overlapping.length; j++) {
      const boxJ = expandAABB(bboxes[j], STEP_MM * 2);
      if (aabbsOverlap(boxI, boxJ)) {
        uf.union(i, j);
      }
    }
  }

  const clustersMap = new Map<number, BlueForceElementLayout[]>();
  for (let i = 0; i < overlapping.length; i++) {
    const root = uf.find(i);
    let cluster = clustersMap.get(root);

    if (!cluster) {
      cluster = [];
      clustersMap.set(root, cluster);
    }

    cluster.push(overlapping[i]);
  }

  // 2. Resolve placements
  for (const cluster of clustersMap.values()) {
    // Center of mass for the cluster
    let cx = 0;
    let cy = 0;
    for (const el of cluster) {
      cx += el.anchorPoint.x;
      cy += el.anchorPoint.y;
    }
    cx /= cluster.length;
    cy /= cluster.length;

    const byType: Record<string, BlueForceElementLayout[]> = {};
    for (const el of cluster) {
      if (!byType[el.ptApp6dType]) byType[el.ptApp6dType] = [];
      byType[el.ptApp6dType].push(el);
    }

    const types = Object.keys(byType).sort();
    const numTypes = types.length;

    // Arbitrary distance just to act as a directional "magnet" for sorting ties
    const directionalRadius = STEP_MM * 10 * Math.sqrt(cluster.length);

    for (let i = 0; i < numTypes; i++) {
      const typeName = types[i];
      const typeGroup = byType[typeName];

      let typeCx = cx;
      let typeCy = cy;

      if (numTypes > 1) {
        const angle = (i / numTypes) * Math.PI * 2;
        typeCx += Math.cos(angle) * directionalRadius;
        typeCy += Math.sin(angle) * directionalRadius;
      }

      // Process elements closest to the cluster center first
      typeGroup.sort((a, b) => {
        const distA = Math.hypot(a.anchorPoint.x - cx, a.anchorPoint.y - cy);
        const distB = Math.hypot(b.anchorPoint.x - cx, b.anchorPoint.y - cy);
        return distA - distB || a.anchorPoint.y - b.anchorPoint.y;
      });

      for (const el of typeGroup) {
        let placed = false;
        const ax = el.anchorPoint.x;
        const ay = el.anchorPoint.y;

        // Spiral around the element's ACTUAL anchor to guarantee closeness
        for (const ringPoints of spiralRings(ax, ay)) {
          let bestPoint: [number, number] | null = null;
          let minScore = Number.POSITIVE_INFINITY;

          for (const [sx, sy] of ringPoints) {
            const dx = sx - ax;
            const dy = sy - ay;

            // Reject points that form too steep of a vertical line to ensure
            // connectors don't overlap with the central vertical ticks of the icon.
            if (dy !== 0 && Math.abs(dx) < Math.abs(dy) * MIN_VERTICAL_TAN) {
              continue;
            }

            const candidate = bboxAt(el, sx, sy);

            if (!occupied.some((o) => aabbsOverlap(candidate, o))) {
              // Primary goal: Minimize exact Euclidean distance to anchor
              const distToAnchor = Math.hypot(dx, dy);

              // Secondary goal: Bias towards the type's directional magnet
              const distToTypeCenter = Math.hypot(sx - typeCx, sy - typeCy);

              // Weight anchor proximity heavily over grouping
              const score = distToAnchor * 10000 + distToTypeCenter;

              if (score < minScore) {
                minScore = score;
                bestPoint = [sx, sy];
              }
            }
          }

          if (bestPoint) {
            el.renderPoint = {
              x: Number(bestPoint[0].toFixed(3)),
              y: Number(bestPoint[1].toFixed(3)),
            };
            occupied.push(bboxAt(el, bestPoint[0], bestPoint[1]));
            placed = true;
            break;
          }
        }

        if (!placed) {
          el.renderPoint = undefined;
        }
      }
    }
  }
}
