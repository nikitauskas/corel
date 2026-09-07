import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ICONS_DIR = resolve(import.meta.dirname ?? '.', '../icons');
const VIEWBOX_PADDING = 50;

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function num(s: string): number {
  return Number.parseFloat(s);
}

function expandBBox(bbox: BBox, x: number, y: number): void {
  if (x < bbox.minX) bbox.minX = x;
  if (x > bbox.maxX) bbox.maxX = x;
  if (y < bbox.minY) bbox.minY = y;
  if (y > bbox.maxY) bbox.maxY = y;
}

function emptyBBox(): BBox {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

function bboxIsValid(b: BBox): boolean {
  return (
    Number.isFinite(b.minX) &&
    Number.isFinite(b.minY) &&
    Number.isFinite(b.maxX) &&
    Number.isFinite(b.maxY)
  );
}

const NUM_RE_STR = '-?[\\d]*\\.?[\\d]+(?:[eE][+-]?\\d+)?';
const NUM_RE = new RegExp(NUM_RE_STR, 'g');

function computeBBox(svgContent: string): BBox {
  const bbox = emptyBBox();

  // --- <rect> ---
  const rectRe2 = /<rect\b[^>]*?>/g;
  for (const m of svgContent.matchAll(rectRe2)) {
    const tag = m[0];
    const xm = tag.match(/\bx\s*=\s*"([^"]+)"/);
    const ym = tag.match(/\by\s*=\s*"([^"]+)"/);
    const wm = tag.match(/\bwidth\s*=\s*"([^"]+)"/);
    const hm = tag.match(/\bheight\s*=\s*"([^"]+)"/);
    if (xm && ym && wm && hm) {
      const x = num(xm[1]);
      const y = num(ym[1]);
      const w = num(wm[1]);
      const h = num(hm[1]);
      expandBBox(bbox, x, y);
      expandBBox(bbox, x + w, y + h);
    }
  }

  // --- <circle> ---
  const circleRe = /<circle\b[^>]*?>/g;
  for (const m of svgContent.matchAll(circleRe)) {
    const tag = m[0];
    const cxm = tag.match(/\bcx\s*=\s*"([^"]+)"/);
    const cym = tag.match(/\bcy\s*=\s*"([^"]+)"/);
    const rm = tag.match(/\br\s*=\s*"([^"]+)"/);
    if (cxm && cym && rm) {
      const cx = num(cxm[1]);
      const cy = num(cym[1]);
      const r = num(rm[1]);
      expandBBox(bbox, cx - r, cy - r);
      expandBBox(bbox, cx + r, cy + r);
    }
  }

  // --- <ellipse> ---
  const ellipseRe = /<ellipse\b[^>]*?>/g;
  for (const m of svgContent.matchAll(ellipseRe)) {
    const tag = m[0];
    const cxm = tag.match(/\bcx\s*=\s*"([^"]+)"/);
    const cym = tag.match(/\bcy\s*=\s*"([^"]+)"/);
    const rxm = tag.match(/\brx\s*=\s*"([^"]+)"/);
    const rym = tag.match(/\bry\s*=\s*"([^"]+)"/);
    if (cxm && cym && rxm && rym) {
      const cx = num(cxm[1]);
      const cy = num(cym[1]);
      const rx = num(rxm[1]);
      const ry = num(rym[1]);
      expandBBox(bbox, cx - rx, cy - ry);
      expandBBox(bbox, cx + rx, cy + ry);
    }
  }

  // --- <line> ---
  const lineRe = /<line\b[^>]*?>/g;
  for (const m of svgContent.matchAll(lineRe)) {
    const tag = m[0];
    const x1m = tag.match(/\bx1\s*=\s*"([^"]+)"/);
    const y1m = tag.match(/\by1\s*=\s*"([^"]+)"/);
    const x2m = tag.match(/\bx2\s*=\s*"([^"]+)"/);
    const y2m = tag.match(/\by2\s*=\s*"([^"]+)"/);
    if (x1m && y1m && x2m && y2m) {
      expandBBox(bbox, num(x1m[1]), num(y1m[1]));
      expandBBox(bbox, num(x2m[1]), num(y2m[1]));
    }
  }

  // --- <polygon> / <polyline> ---
  const polyRe = /<poly(?:gon|line)\b[^>]*?\bpoints\s*=\s*"([^"]+)"/g;
  for (const m of svgContent.matchAll(polyRe)) {
    const nums = m[1].match(NUM_RE);
    if (nums) {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        expandBBox(bbox, num(nums[i]), num(nums[i + 1]));
      }
    }
  }

  // --- <path d="..."> ---
  const pathDRe = /\bd\s*=\s*"([^"]+)"/g;
  for (const m of svgContent.matchAll(pathDRe)) {
    const d = m[1];
    extractPathBBox(d, bbox);
  }

  return bbox;
}

function extractPathBBox(d: string, bbox: BBox): void {
  const tokenRe = /([a-zA-Z])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  let currentCmd = '';
  const numbers: number[] = [];

  let currentX = 0;
  let currentY = 0;

  const flush = () => {
    if (numbers.length === 0 && currentCmd.toUpperCase() !== 'Z') return;

    const isAbsolute = currentCmd === currentCmd.toUpperCase();
    const cmd = currentCmd.toUpperCase();

    switch (cmd) {
      case 'M':
      case 'L':
      case 'T': {
        for (let i = 0; i + 1 < numbers.length; i += 2) {
          if (isAbsolute) {
            currentX = numbers[i];
            currentY = numbers[i + 1];
          } else {
            currentX += numbers[i];
            currentY += numbers[i + 1];
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
      case 'C': {
        for (let i = 0; i + 5 < numbers.length; i += 6) {
          if (isAbsolute) {
            expandBBox(bbox, numbers[i], numbers[i + 1]);
            expandBBox(bbox, numbers[i + 2], numbers[i + 3]);
            currentX = numbers[i + 4];
            currentY = numbers[i + 5];
          } else {
            expandBBox(bbox, currentX + numbers[i], currentY + numbers[i + 1]);
            expandBBox(
              bbox,
              currentX + numbers[i + 2],
              currentY + numbers[i + 3],
            );
            currentX += numbers[i + 4];
            currentY += numbers[i + 5];
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
      case 'S':
      case 'Q': {
        for (let i = 0; i + 3 < numbers.length; i += 4) {
          if (isAbsolute) {
            expandBBox(bbox, numbers[i], numbers[i + 1]);
            currentX = numbers[i + 2];
            currentY = numbers[i + 3];
          } else {
            expandBBox(bbox, currentX + numbers[i], currentY + numbers[i + 1]);
            currentX += numbers[i + 2];
            currentY += numbers[i + 3];
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
      case 'H': {
        for (const n of numbers) {
          if (isAbsolute) {
            currentX = n;
          } else {
            currentX += n;
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
      case 'V': {
        for (const n of numbers) {
          if (isAbsolute) {
            currentY = n;
          } else {
            currentY += n;
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
      case 'A': {
        for (let i = 0; i + 6 < numbers.length; i += 7) {
          if (isAbsolute) {
            currentX = numbers[i + 5];
            currentY = numbers[i + 6];
          } else {
            currentX += numbers[i + 5];
            currentY += numbers[i + 6];
          }
          expandBBox(bbox, currentX, currentY);
        }
        break;
      }
    }
    numbers.length = 0;
  };

  while (true) {
    match = tokenRe.exec(d);
    if (!match) break;
    if (match[1]) {
      flush();
      currentCmd = match[1];
    } else if (match[2]) {
      numbers.push(num(match[2]));
    }
  }
  flush();
}

function expandBBoxWithTransforms(content: string, bbox: BBox): void {
  const matrixRe = /transform\s*=\s*"matrix\(([^)]+)\)"/g;
  for (const m of content.matchAll(matrixRe)) {
    const parts = m[1].split(/[\s,]+/).map(num);
    if (parts.length >= 6) {
      expandBBox(bbox, parts[4], parts[5]);
    }
  }
}

function buildSvg(
  innerContent: string,
  bbox: BBox,
  defs: string,
  padding: number,
): string {
  const vbX = bbox.minX - padding;
  const vbY = bbox.minY - padding;
  const vbW = bbox.maxX - bbox.minX + 2 * padding;
  const vbH = bbox.maxY - bbox.minY + 2 * padding;

  const maxDim = 800;
  const scale = Math.min(maxDim / vbW, maxDim / vbH, 1);
  const width = Math.round(vbW * scale);
  const height = Math.round(vbH * scale);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `  width="${width}" height="${height}"`,
    `  viewBox="${vbX} ${vbY} ${vbW} ${vbH}"`,
    `  style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd">`,
    '  <defs>',
    defs,
    '  </defs>',
    innerContent,
    '</svg>',
  ].join('\n');
}

function getAllSvgFiles(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat?.isDirectory()) {
      results = results.concat(getAllSvgFiles(filePath));
    } else if (file.endsWith('.svg')) {
      results.push(filePath);
    }
  }
  return results;
}

function removeTextsFromIcons() {
  const labelsExceptions = [
    '/Зв_язок/Станція звязку _РЗ-радіо_ ТрЗ-транкінговий_ РРЗ-радіорелейний_ ТРЗ-топосферний_ СЗ-супутниковий_ ПрЗ-проводовий.',
  ];

  const allFiles = getAllSvgFiles(ICONS_DIR);

  for (const filePath of allFiles) {
    const relPath = filePath.substring(ICONS_DIR.length).replace(/\\/g, '/');

    const matches = labelsExceptions.some((exc) => {
      const normExc = exc.replace(/\\/g, '/');
      return (
        relPath.includes(normExc) ||
        relPath.replace(/\.svg$/, '').includes(normExc.replace(/\.$/, '')) ||
        relPath.startsWith(normExc)
      );
    });

    if (!matches) continue;

    console.log(`Processing: ${relPath}`);
    const svgText = readFileSync(filePath, 'utf-8');

    // Strip text tags
    const svgWithoutText = svgText.replace(/<text[\s\S]*?<\/text>/gi, '');

    // Extract defs content
    const defsMatch = svgWithoutText.match(/<defs>([\s\S]*?)<\/defs>/i);
    const defs = defsMatch ? defsMatch[1] : '';

    // Extract geometry (everything inside <svg> except <defs>...</defs>)
    const innerSvgMatch = svgWithoutText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    const innerSvg = innerSvgMatch ? innerSvgMatch[1] : '';
    const geometry = innerSvg.replace(/<defs>[\s\S]*?<\/defs>/i, '').trim();

    // Compute bounding box without text
    const bbox = emptyBBox();
    const computed = computeBBox(geometry);
    if (bboxIsValid(computed)) {
      bbox.minX = computed.minX;
      bbox.minY = computed.minY;
      bbox.maxX = computed.maxX;
      bbox.maxY = computed.maxY;
    }
    expandBBoxWithTransforms(geometry, bbox);

    if (!bboxIsValid(bbox)) {
      console.warn(`Could not compute valid bbox for ${relPath}`);
      continue;
    }

    const newSvg = buildSvg(geometry, bbox, defs, VIEWBOX_PADDING);
    writeFileSync(filePath, newSvg, 'utf-8');
    console.log(
      `Updated ${relPath} (new size: viewBox="${bbox.minX - VIEWBOX_PADDING} ${bbox.minY - VIEWBOX_PADDING} ${bbox.maxX - bbox.minX + 2 * VIEWBOX_PADDING} ${bbox.maxY - bbox.minY + 2 * VIEWBOX_PADDING}")`,
    );
  }
}

removeTextsFromIcons();
