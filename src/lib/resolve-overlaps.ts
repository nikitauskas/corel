import { BlueForceElementLayout } from './points.js';

/** Search grid step size in mm */
const STEP_MM = 1.5;

/** Safety ring limit for the spiral search */
const MAX_RINGS = 400;

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Point2D {
  x: number;
  y: number;
}

function aabbsOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
  );
}

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

function getDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Generates (x, y) candidate positions for a SPECIFIC ring in a square spiral.
 * Ring 0 is just the center.
 */
function* getRingCandidates(
  cx: number,
  cy: number,
  ring: number,
): Generator<[number, number]> {
  if (ring === 0) {
    yield [cx, cy];
    return;
  }
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

/** Simple Union-Find for clustering */
class UnionFind {
  private parent = new Map<number, number>();

  find(i: number): number {
    if (!this.parent.has(i)) this.parent.set(i, i);
    if (this.parent.get(i) === i) return i;
    const root = this.find(this.parent.get(i)!);
    this.parent.set(i, root);
    return root;
  }

  union(i: number, j: number): void {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
    }
  }
}

/**
 * Main resolution function.
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  const displacedElements = elements.filter((el) => el.status === 'displaced');
  if (displacedElements.length === 0) return;

  // 1. Initial sorting for determinism (Top-to-bottom, Left-to-right)
  displacedElements.sort(
    (a, b) =>
      a.anchorPoint.y - b.anchorPoint.y || a.anchorPoint.x - b.anchorPoint.x,
  );

  // 2. Build Clusters via Union-Find (Overlap detection)
  const uf = new UnionFind();
  for (let i = 0; i < displacedElements.length; i++) {
    for (let j = i + 1; j < displacedElements.length; j++) {
      const bboxI = bboxAt(
        displacedElements[i],
        displacedElements[i].anchorPoint.x,
        displacedElements[i].anchorPoint.y,
      );
      const bboxJ = bboxAt(
        displacedElements[j],
        displacedElements[j].anchorPoint.x,
        displacedElements[j].anchorPoint.y,
      );
      if (aabbsOverlap(bboxI, bboxJ)) {
        uf.union(i, j);
      }
    }
  }

  // 3. Group elements into clusters
  const clustersMap = new Map<number, BlueForceElementLayout[]>();
  for (let i = 0; i < displacedElements.length; i++) {
    const root = uf.find(i);
    if (!clustersMap.has(root)) clustersMap.set(root, []);
    clustersMap.get(root)!.push(displacedElements[i]);
  }
  const clusters = Array.from(clustersMap.values());

  // 4. Calculate Centers of Mass (CoM) and process clusters
  const processedQueue: Array<{ el: BlueForceElementLayout; vector: Point2D }> =
    [];

  for (const cluster of clusters) {
    const com = cluster.reduce(
      (acc, el) => ({
        x: acc.x + el.anchorPoint.x,
        y: acc.y + el.anchorPoint.y,
      }),
      { x: 0, y: 0 },
    );
    com.x /= cluster.length;
    com.y /= cluster.length;

    // Sort within cluster by distance to CoM (closest first)
    cluster.sort(
      (a, b) =>
        getDistance(a.anchorPoint, com) - getDistance(b.anchorPoint, com),
    );

    // Group types and generate aesthetic petal vectors for this cluster
    const types = Array.from(new Set(cluster.map((el) => el.ptApp6dType)));
    const typeVectors = new Map<string, Point2D>();

    types.forEach((type, idx) => {
      const angle = (idx * 2 * Math.PI) / types.length; // Spread types radially
      typeVectors.set(type, { x: Math.cos(angle), y: Math.sin(angle) });
    });
    //
    cluster.forEach((el) => {
      processedQueue.push({
        el,
        vector: typeVectors.get(el.ptApp6dType) || { x: 0, y: 0 },
      });
    });
  }

  // Define static obstacles
  const occupied: AABB[] = elements
    .filter((el) => el.status !== 'displaced')
    .map((el) => bboxAt(el, el.anchorPoint.x, el.anchorPoint.y));

  // 5. Place elements using the constrained scoring search
  for (const item of processedQueue) {
    const { el, vector } = item;
    const { x: ax, y: ay } = el.anchorPoint;
    let placed = false;

    // Search outward ring by ring
    for (let ring = 0; ring < MAX_RINGS; ring++) {
      let bestPoint: Point2D | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      for (const [cx, cy] of getRingCandidates(ax, ay, ring)) {
        const candidateBbox = bboxAt(el, cx, cy);

        // A. Collision check
        if (occupied.some((o) => aabbsOverlap(candidateBbox, o))) {
          continue;
        }

        // B. Joint height constraint (Angle >= 90°)
        // Сустав на 5.5 мм ниже нижней границы кандидата (maxY)
        const jointY = candidateBbox.maxY + 5.5;

        // В координатах SVG Y растет вниз.
        // Если якорь (ay) меньше (выше) сустава, линия пойдет вверх, образуя острый угол.
        // Безусловно бракуем.
        if (ay < jointY) {
          continue;
        }

        // C. Calculate composite score
        // - Euclidean distance is penalized heavily (weight 10,000)
        // - Dot product with type vector adds small aesthetic pull (rewarded -> subtracted from score)
        const dist = getDistance({ x: cx, y: cy }, el.anchorPoint);
        const dx = cx - ax;
        const dy = cy - ay;

        // Normalize direction (avoid divide by zero)
        const len = dist || 1;
        const dotPull = (dx / len) * vector.x + (dy / len) * vector.y;

        const score = 10000 * dist - dotPull;

        if (score < bestScore) {
          bestScore = score;
          bestPoint = { x: cx, y: cy };
        }
      }

      // If we found valid candidates in this ring, place the best one and stop searching for this element
      if (bestPoint) {
        el.renderPoint = {
          x: Number(bestPoint.x.toFixed(3)),
          y: Number(bestPoint.y.toFixed(3)),
        };
        occupied.push(bboxAt(el, bestPoint.x, bestPoint.y));
        placed = true;
        break;
      }
    }

    if (!placed) {
      el.renderPoint = undefined;
    }
  }
}
