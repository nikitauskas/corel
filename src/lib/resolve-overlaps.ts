import { BlueForceElementLayout } from './points.js';

/** Search grid step size in mm — smaller = closer to anchor, slower to compute */
const STEP_MM = 1.5;

/** Safety ring limit for the spiral search */
const MAX_RINGS = 400;

/** Multiplier for how far to push different types apart in a cluster */
const TYPE_SEPARATION_MULTIPLIER = 2.5;

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
 * Generates (x, y) candidate positions in an expanding square spiral centred on (cx, cy).
 */
function* spiralAround(cx: number, cy: number): Generator<[number, number]> {
  yield [cx, cy];
  for (let ring = 1; ring < MAX_RINGS; ring++) {
    for (let col = -ring; col <= ring; col++) {
      yield [cx + col * STEP_MM, cy - ring * STEP_MM];
    }
    for (let row = -ring + 1; row <= ring; row++) {
      yield [cx + ring * STEP_MM, cy + row * STEP_MM];
    }
    for (let col = ring - 1; col >= -ring; col--) {
      yield [cx + col * STEP_MM, cy + ring * STEP_MM];
    }
    for (let row = ring - 1; row >= -ring + 1; row--) {
      yield [cx - ring * STEP_MM, cy + row * STEP_MM];
    }
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

    // Resolve the root first, then assign, then return
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
 * Assigns each overlapping element the closest possible renderPoint.
 * Elements grouped by proximity are separated radially into "lobes" based on their type.
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  // Sort initially for deterministic processing
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

  // 1. Find Connected Clusters based on proximity
  const uf = new UnionFind(overlapping.length);
  const bboxes = overlapping.map((el) =>
    bboxAt(el, el.anchorPoint.x, el.anchorPoint.y),
  );

  for (let i = 0; i < overlapping.length; i++) {
    // Expand the box slightly so near-misses also get grouped into the same visual cluster
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

  // 2. Resolve placements cluster by cluster
  for (const cluster of clustersMap.values()) {
    // Determine main center of mass for this cluster
    let cx = 0;
    let cy = 0;
    for (const el of cluster) {
      cx += el.anchorPoint.x;
      cy += el.anchorPoint.y;
    }
    cx /= cluster.length;
    cy /= cluster.length;

    // Group elements in this cluster by their type
    const byType: Record<string, BlueForceElementLayout[]> = {};
    for (const el of cluster) {
      if (!byType[el.ptApp6dType]) byType[el.ptApp6dType] = [];
      byType[el.ptApp6dType].push(el);
    }

    const types = Object.keys(byType).sort(); // Deterministic sorting of types
    const numTypes = types.length;

    // Dynamic radius based on cluster size to push types outward from the center
    const separationRadius =
      numTypes > 1
        ? STEP_MM * TYPE_SEPARATION_MULTIPLIER * Math.sqrt(cluster.length)
        : 0;

    for (let i = 0; i < numTypes; i++) {
      const typeName = types[i];
      const typeGroup = byType[typeName];

      let typeCx = cx;
      let typeCy = cy;

      // If multiple types exist, position this type's "gravity center" on a circle (like flower petals)
      if (numTypes > 1) {
        const angle = (i / numTypes) * Math.PI * 2;
        typeCx += Math.cos(angle) * separationRadius;
        typeCy += Math.sin(angle) * separationRadius;
      }

      // Sort elements so ones closest to their new target center are placed first
      typeGroup.sort((a, b) => {
        const distA = Math.hypot(
          a.anchorPoint.x - typeCx,
          a.anchorPoint.y - typeCy,
        );
        const distB = Math.hypot(
          b.anchorPoint.x - typeCx,
          b.anchorPoint.y - typeCy,
        );
        return (
          distA - distB ||
          a.anchorPoint.y - b.anchorPoint.y ||
          a.anchorPoint.x - b.anchorPoint.x
        );
      });

      // Execute spiral placement around the TYPE'S center, not the element's raw anchor point
      for (const el of typeGroup) {
        let placed = false;

        for (const [sx, sy] of spiralAround(typeCx, typeCy)) {
          const candidate = bboxAt(el, sx, sy);

          if (!occupied.some((o) => aabbsOverlap(candidate, o))) {
            el.renderPoint = {
              x: Number(sx.toFixed(3)),
              y: Number(sy.toFixed(3)),
            };
            occupied.push(candidate);
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
