import type { BlueForceElementLayout } from './points.js';

/* ────────────────────────────── Константы ────────────────────────────── */

/** Шаг сетки поиска, мм (квадратная спираль вокруг якоря) */
const STEP_MM = 1.5;

/** Предельное число колец спирали (защита от бесконечного поиска) */
const MAX_RINGS = 400;

/**
 * Смещение «сустава» коннектора вниз от центра иконки, мм.
 * Линия к якорю строится от конца вертикального штриха, а не от центра.
 */
export const CONNECTOR_JOINT_OFFSET_MM = 5.5;

/** Вес близости к якорю. В 10 000 раз выше веса притяжения к группе. */
const ANCHOR_WEIGHT = 10_000;
const GROUP_WEIGHT = 1;

/** Радиус «лепестка»: на каком расстоянии от центра кластера лежит целевая точка типа, мм */
const PETAL_RADIUS_MM = 12;

/** Допуски для сравнения чисел с плавающей точкой */
const GEOM_EPS = 1e-9;
const SCORE_EPS = 1e-6;

/* ────────────────────────────── Геометрия ────────────────────────────── */

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Vec {
  x: number;
  y: number;
}

function aabbsOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
  );
}

/**
 * AABB элемента, если бы его центр стоял в (cx, cy).
 * bbox в points.ts посчитан относительно anchorPoint, поэтому просто сдвигаем.
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
 * Ограничение по углу коннектора (≥ 90°).
 * Линия идёт от «сустава» (центр иконки + 5.5 мм вниз) к якорю.
 * Координаты — SVG (Y вниз): якорь не должен быть ВЫШЕ сустава,
 * иначе линия шла бы вверх. Горизонталь (равенство) допустима.
 */
function isConnectorAngleValid(anchorY: number, centerY: number): boolean {
  const jointY = centerY + CONNECTOR_JOINT_OFFSET_MM;
  return anchorY >= jointY - GEOM_EPS;
}

/* ────────────────────────────── Union-Find ───────────────────────────── */

class UnionFind {
  private parent: number[];
  private size: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = new Array<number>(n).fill(1);
  }

  find(i: number): number {
    let root = i;
    while (this.parent[root] !== root) root = this.parent[root];
    // сжатие путей
    let node = i;
    while (this.parent[node] !== root) {
      const next = this.parent[node];
      this.parent[node] = root;
      node = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    let ra = this.find(a);
    let rb = this.find(b);
    if (ra === rb) return;
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;
    this.size[ra] += this.size[rb];
  }
}

/* ───────────────────────── Детерминированный порядок ─────────────────── */

/** Сверху-вниз, слева-направо; idx — финальный tie-break для стабильности */
function compareTopLeft(
  a: BlueForceElementLayout,
  b: BlueForceElementLayout,
): number {
  return (
    a.anchorPoint.y - b.anchorPoint.y ||
    a.anchorPoint.x - b.anchorPoint.x ||
    a.idx - b.idx
  );
}

/* ─────────────────────────────── Кластеры ────────────────────────────── */

/**
 * Объединяет смещаемые элементы, чьи bbox ПЕРЕСЕКАЮТСЯ в исходных позициях (по якорям).
 * Вход должен быть уже отсортирован по compareTopLeft — тогда и кластеры
 * (порядок Map = порядок первого вхождения) идут в детерминированном порядке.
 */
function buildClusters(
  sortedItems: BlueForceElementLayout[],
): BlueForceElementLayout[][] {
  const boxes = sortedItems.map((el) =>
    bboxAt(el, el.anchorPoint.x, el.anchorPoint.y),
  );
  const uf = new UnionFind(sortedItems.length);

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (aabbsOverlap(boxes[i], boxes[j])) uf.union(i, j);
    }
  }

  const byRoot = new Map<number, BlueForceElementLayout[]>();
  sortedItems.forEach((el, i) => {
    const root = uf.find(i);
    const bucket = byRoot.get(root);
    if (bucket) bucket.push(el);
    else byRoot.set(root, [el]);
  });
  return [...byRoot.values()];
}

/** Центр масс кластера — среднее по якорям */
function centroidOf(points: Vec[]): Vec {
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/** Группировка по ptApp6dType. Порядок групп = порядок первого элемента (сверху-вниз, слева-направо). */
function groupByType(
  cluster: BlueForceElementLayout[],
): BlueForceElementLayout[][] {
  const map = new Map<string, BlueForceElementLayout[]>();
  for (const el of cluster) {
    const bucket = map.get(el.ptApp6dType);
    if (bucket) bucket.push(el);
    else map.set(el.ptApp6dType, [el]);
  }
  return [...map.values()];
}

/**
 * Направляющий вектор «лепестка» для группы k из total.
 * Из-за ограничения коннектора допустима только верхняя полуплоскость (Y вниз → sin < 0),
 * поэтому лепестки равномерно раскладываются по дуге π…2π. Для одной группы — строго вверх.
 */
function petalDirection(k: number, total: number): Vec {
  const theta = Math.PI + (Math.PI * (k + 0.5)) / total;
  return { x: Math.cos(theta), y: Math.sin(theta) };
}

/* ───────────────────────────────── Спираль ───────────────────────────── */

/**
 * Расширяющаяся квадратная спираль с шагом STEP_MM.
 * Ring 0 → сам якорь; ring N → периметр квадрата (8·N точек).
 * Третий элемент кортежа — номер кольца (нужен для досрочной остановки поиска).
 */
function* spiralAround(
  cx: number,
  cy: number,
): Generator<[number, number, number]> {
  yield [cx, cy, 0];
  for (let ring = 1; ring < MAX_RINGS; ring++) {
    const r = ring * STEP_MM;
    for (let col = -ring; col <= ring; col++)
      yield [cx + col * STEP_MM, cy - r, ring]; // верх
    for (let row = -ring + 1; row <= ring; row++)
      yield [cx + r, cy + row * STEP_MM, ring]; // право
    for (let col = ring - 1; col >= -ring; col--)
      yield [cx + col * STEP_MM, cy + r, ring]; // низ
    for (let row = ring - 1; row >= -ring + 1; row--)
      yield [cx - r, cy + row * STEP_MM, ring]; // лево
  }
}

/* ─────────────────────────────── Поиск точки ─────────────────────────── */

/**
 * Ищет лучшую свободную точку для элемента.
 *
 * score = 10 000 · dist(кандидат, якорь) + 1 · dist(кандидат, цель группы)
 *
 * Кольцо квадратной спирали — это расстояние Чебышёва, а не евклидово, поэтому
 * первая найденная свободная точка не обязательно ближайшая. Мы продолжаем обход,
 * пока нижняя оценка score следующего кольца (10 000 · ring · STEP) не превысит
 * лучший найденный score — так минимум по сетке находится точно.
 */
function findBestSlot(
  el: BlueForceElementLayout,
  occupied: AABB[],
  groupTarget: Vec,
): Vec | null {
  const { x: ax, y: ay } = el.anchorPoint;
  let best: Vec | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const [cx, cy, ring] of spiralAround(ax, ay)) {
    // Ни одна точка этого и последующих колец уже не может быть лучше
    if (ANCHOR_WEIGHT * ring * STEP_MM > bestScore) break;

    // 1) Жёсткое ограничение: якорь не выше сустава коннектора
    if (!isConnectorAngleValid(ay, cy)) continue;

    // 2) Жёсткое ограничение: нет пересечений с занятыми областями
    const candidate = bboxAt(el, cx, cy);
    if (occupied.some((o) => aabbsOverlap(candidate, o))) continue;

    // 3) Мягкий критерий
    const score =
      ANCHOR_WEIGHT * Math.hypot(cx - ax, cy - ay) +
      GROUP_WEIGHT * Math.hypot(cx - groupTarget.x, cy - groupTarget.y);

    // SCORE_EPS: при равенстве побеждает точка, раньше встреченная в спирали (детерминизм)
    if (score < bestScore - SCORE_EPS) {
      bestScore = score;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/* ─────────────────────────────── Публичный API ───────────────────────── */

/**
 * Назначает каждому смещаемому элементу renderPoint:
 *  1. Смещаемые элементы (status === 'displaced') объединяются в кластеры по пересечению bbox (Union-Find).
 *  2. Внутри кластера элементы делятся по ptApp6dType; каждой группе — свой «лепесток».
 *  3. Для каждого элемента выбирается свободная точка с минимальным score
 *     (расстояние до якоря весит в 10 000 раз больше притяжения к группе).
 *  4. Точки, где якорь оказывается выше «сустава» коннектора (центр + 5.5 мм), отбраковываются.
 *
 * Порядок обработки полностью детерминирован:
 *  кластеры — сверху-вниз/слева-направо; группы — так же по первому элементу;
 *  элементы внутри группы — по удалённости от центра масс кластера (ближние первыми).
 *
 * Элементы с другим status считаются неподвижными препятствиями в своих якорях.
 */
export function resolveOverlappingRenderPoints(
  elements: BlueForceElementLayout[],
): void {
  const displaced = elements
    .filter((el) => el.status === 'displaced')
    .sort(compareTopLeft);
  if (displaced.length === 0) return;

  const occupied: AABB[] = elements
    .filter((el) => el.status !== 'displaced')
    .map((el) => bboxAt(el, el.anchorPoint.x, el.anchorPoint.y));

  for (const cluster of buildClusters(displaced)) {
    const centroid = centroidOf(cluster.map((el) => el.anchorPoint));
    const groups = groupByType(cluster);

    groups.forEach((members, groupIdx) => {
      const dir = petalDirection(groupIdx, groups.length);
      const petalPoint: Vec = {
        x: centroid.x + dir.x * PETAL_RADIUS_MM,
        y: centroid.y + dir.y * PETAL_RADIUS_MM,
      };

      const dist = (el: BlueForceElementLayout) =>
        Math.hypot(
          el.anchorPoint.x - centroid.x,
          el.anchorPoint.y - centroid.y,
        );
      const queue = [...members].sort(
        (a, b) => dist(a) - dist(b) || compareTopLeft(a, b),
      );

      const placed: Vec[] = [];
      for (const el of queue) {
        // Пока в группе никого нет — тянемся к лепестку, затем к центру уже размещённых
        const groupTarget = placed.length > 0 ? centroidOf(placed) : petalPoint;
        const slot = findBestSlot(el, occupied, groupTarget);

        if (!slot) {
          el.renderPoint = undefined; // спираль исчерпана (на практике не должно случаться)
          continue;
        }

        el.renderPoint = {
          x: Number(slot.x.toFixed(3)),
          y: Number(slot.y.toFixed(3)),
        };
        occupied.push(bboxAt(el, slot.x, slot.y));
        placed.push(slot);
      }
    });
  }
}
